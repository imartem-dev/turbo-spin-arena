import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { createServer } from "node:http";
import path from "node:path";
import { Readable } from "node:stream";
import { fileURLToPath } from "node:url";

const HOST = "127.0.0.1";
const PORT = 8080;
const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const BUILD_DIR = path.resolve(SCRIPT_DIR, "..", "dist-yandex");
const SDK_DEV_URL = "https://yastatic.net/s3/games-static/sdk-dev/yandex-dev-adapter.js";
const SDK_CHUNK_ORIGIN = "https://games.s3.yandex.net";

const MIME_TYPES = new Map([
  [".css", "text/css; charset=utf-8"],
  [".glb", "model/gltf-binary"],
  [".html", "text/html; charset=utf-8"],
  [".ico", "image/x-icon"],
  [".js", "text/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".mp3", "audio/mpeg"],
  [".ogg", "audio/ogg"],
  [".png", "image/png"],
  [".svg", "image/svg+xml"],
  [".webm", "video/webm"],
  [".webp", "image/webp"],
  [".woff2", "font/woff2"],
]);

function isInsideBuildDir(candidate) {
  const root = BUILD_DIR.toLowerCase();
  const target = candidate.toLowerCase();
  return target === root || target.startsWith(`${root}${path.sep}`);
}

async function proxySdk(url, response) {
  try {
    const upstream = await fetch(url, { redirect: "follow" });
    response.statusCode = upstream.status;
    response.setHeader(
      "content-type",
      upstream.headers.get("content-type") ?? "text/javascript; charset=utf-8",
    );
    response.setHeader("cache-control", "no-store");

    if (!upstream.body) {
      response.end();
      return;
    }

    Readable.fromWeb(upstream.body).pipe(response);
  } catch (error) {
    console.error("Failed to load the Yandex development SDK:", error);
    response.writeHead(502, { "content-type": "text/plain; charset=utf-8" });
    response.end("Yandex SDK proxy error");
  }
}

async function serveStatic(pathname, request, response) {
  let decodedPath;
  try {
    decodedPath = decodeURIComponent(pathname);
  } catch {
    response.writeHead(400).end();
    return;
  }

  const relativePath = decodedPath === "/" ? "index.html" : decodedPath.replace(/^\/+/, "");
  let filePath = path.resolve(BUILD_DIR, relativePath);

  if (!isInsideBuildDir(filePath)) {
    response.writeHead(403).end();
    return;
  }

  try {
    const fileStat = await stat(filePath);
    if (fileStat.isDirectory()) {
      filePath = path.join(filePath, "index.html");
    }

    const finalStat = await stat(filePath);
    if (!finalStat.isFile()) {
      response.writeHead(404).end();
      return;
    }

    response.writeHead(200, {
      "cache-control": "no-store",
      "content-length": finalStat.size,
      "content-type": MIME_TYPES.get(path.extname(filePath).toLowerCase()) ?? "application/octet-stream",
      "x-content-type-options": "nosniff",
    });

    if (request.method === "HEAD") {
      response.end();
      return;
    }

    createReadStream(filePath).pipe(response);
  } catch (error) {
    if (error?.code !== "ENOENT") {
      console.error("Local server error:", error);
    }
    response.writeHead(404).end();
  }
}

const server = createServer(async (request, response) => {
  if (request.method !== "GET" && request.method !== "HEAD") {
    response.writeHead(405, { allow: "GET, HEAD" }).end();
    return;
  }

  const requestUrl = new URL(request.url ?? "/", `http://${HOST}:${PORT}`);
  if (requestUrl.pathname === "/sdk.js") {
    await proxySdk(SDK_DEV_URL, response);
    return;
  }

  if (/^\/sdk\/_\/v2\.[0-9a-f]+\.js$/.test(requestUrl.pathname)) {
    await proxySdk(`${SDK_CHUNK_ORIGIN}${requestUrl.pathname}`, response);
    return;
  }

  await serveStatic(requestUrl.pathname, request, response);
});

server.on("error", (error) => {
  if (error.code === "EADDRINUSE") {
    console.error(`Port ${PORT} is already in use. Stop the previous local server and try again.`);
  } else {
    console.error(error);
  }
  process.exitCode = 1;
});

server.listen(PORT, HOST, () => {
  console.log(`Local Yandex build: http://${HOST}:${PORT}/`);
  console.log("Loopback only. Press Ctrl+C to stop the server.");
});
