import { afterEach, describe, expect, it, vi } from "vitest";
import { GameRuntimeLifecycle } from "./gameRuntimeLifecycle";

type FakeDocument = EventTarget & {
  body: { classList: { contains: () => boolean } };
  hasFocus: () => boolean;
  hidden: boolean;
  querySelectorAll: () => HTMLMediaElement[];
};

function createBrowserGlobals(media: HTMLMediaElement[] = []) {
  const fakeDocument = Object.assign(new EventTarget(), {
    body: { classList: { contains: () => false } },
    hasFocus: () => true,
    hidden: false,
    querySelectorAll: () => media,
  }) as FakeDocument;
  const fakeWindow = new EventTarget();
  vi.stubGlobal("document", fakeDocument);
  vi.stubGlobal("window", fakeWindow);
  return { fakeDocument, fakeWindow };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("GameRuntimeLifecycle", () => {
  it("keeps the runtime paused until every pause reason is cleared", () => {
    const { fakeWindow } = createBrowserGlobals();
    const onPauseChanged = vi.fn();
    const onResume = vi.fn();
    const lifecycle = new GameRuntimeLifecycle({ onPauseChanged, onResume });

    lifecycle.attach();
    lifecycle.setPaused("ad", true);
    fakeWindow.dispatchEvent(new Event("blur"));
    lifecycle.setPaused("ad", false);

    expect(lifecycle.paused).toBe(true);
    expect(onPauseChanged).toHaveBeenCalledTimes(1);

    fakeWindow.dispatchEvent(new Event("focus"));

    expect(lifecycle.paused).toBe(false);
    expect(onResume).toHaveBeenCalledTimes(1);
    expect(onPauseChanged).toHaveBeenLastCalledWith(false);
  });

  it("pauses active media and resumes it only after focus returns", async () => {
    const media = {
      paused: false,
      pause: vi.fn(),
      play: vi.fn().mockResolvedValue(undefined),
    } as unknown as HTMLMediaElement;
    const { fakeWindow } = createBrowserGlobals([media]);
    const lifecycle = new GameRuntimeLifecycle({
      onPauseChanged: vi.fn(),
      onResume: vi.fn(),
    });

    lifecycle.attach();
    fakeWindow.dispatchEvent(new Event("blur"));
    expect(media.pause).toHaveBeenCalledTimes(1);

    fakeWindow.dispatchEvent(new Event("focus"));
    await Promise.resolve();
    expect(media.play).toHaveBeenCalledTimes(1);
  });

  it("pauses while the document is hidden", () => {
    const { fakeDocument } = createBrowserGlobals();
    const lifecycle = new GameRuntimeLifecycle({ onPauseChanged: vi.fn(), onResume: vi.fn() });
    lifecycle.attach();

    fakeDocument.hidden = true;
    fakeDocument.dispatchEvent(new Event("visibilitychange"));
    expect(lifecycle.paused).toBe(true);

    fakeDocument.hidden = false;
    fakeDocument.dispatchEvent(new Event("visibilitychange"));
    expect(lifecycle.paused).toBe(false);
  });
});
