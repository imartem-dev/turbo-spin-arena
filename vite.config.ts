import { defineConfig } from "vite";

export default defineConfig(({ mode }) => {
  const yandexBuild = mode === "yandex";
  return {
    base: yandexBuild ? "./" : "/turbo-spin-arena/",
    plugins: yandexBuild ? [{
      name: "yandex-games-sdk",
      transformIndexHtml: {
        order: "post",
        handler(html: string) {
          const sdkLoader = `    <script>
      window.__yandexSdkReady = new Promise((resolve, reject) => {
        const startedAt = Date.now();
        const waitForSdk = () => {
          if (typeof YaGames !== "undefined") {
            resolve(YaGames);
          } else if (Date.now() - startedAt >= 15000) {
            reject(new Error("Yandex Games SDK timed out."));
          } else {
            window.setTimeout(waitForSdk, 16);
          }
        };
        const script = document.createElement("script");
        script.src = "/sdk.js";
        script.async = true;
        script.onerror = () => reject(new Error("Yandex Games SDK failed to load."));
        document.head.append(script);
        waitForSdk();
      });
    </script>`;
          return html.replace("<head>", `<head>\n${sdkLoader}`);
        },
      },
    }] : [],
  };
});
