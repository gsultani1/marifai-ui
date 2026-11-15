// packages/ai-ui/test/region-capture.test.ts
import { afterEach, describe, expect, it, vi } from "vitest";

import { captureViewportRegion } from "../src/lib/region-capture.js";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

function setup() {
  vi.useFakeTimers();
  const stop = vi.fn();
  const stream = { getTracks: () => [{ stop }] };
  const getDisplayMedia = vi.fn().mockResolvedValue(stream);
  vi.stubGlobal("navigator", { mediaDevices: { getDisplayMedia } });
  const video = document.createElement("video");
  Object.defineProperties(video, { videoWidth: { value: 1280, configurable: true }, videoHeight: { value: 900, configurable: true } });
  const play = vi.spyOn(video, "play").mockResolvedValue();
  const pause = vi.spyOn(video, "pause").mockImplementation(() => undefined);
  const canvas = document.createElement("canvas");
  const drawImage = vi.fn();
  vi.spyOn(canvas, "getContext").mockReturnValue({ drawImage } as unknown as CanvasRenderingContext2D);
  const image = new Blob(["image"], { type: "image/webp" });
  const toBlob = vi.spyOn(canvas, "toBlob").mockImplementation((callback) => callback(image));
  const createElement = document.createElement.bind(document);
  vi.spyOn(document, "createElement").mockImplementation((tag, options) => tag === "video" ? video : tag === "canvas" ? canvas : createElement(tag, options));
  vi.stubGlobal("innerWidth", 1280);
  vi.stubGlobal("innerHeight", 900);
  return { stop, stream, getDisplayMedia, video, play, pause, canvas, drawImage, image, toBlob };
}

const region = () => ({ x: 20, y: 40, width: 200, height: 140 });

describe("screen capture resource lifetime", () => {
  it("encodes the selected frame and releases the stream and video", async () => {
    const state = setup();
    const result = captureViewportRegion(region, { type: "image/webp", quality: 0.8 });
    await vi.advanceTimersByTimeAsync(100);
    await expect(result).resolves.toBe(state.image);
    expect(state.drawImage).toHaveBeenCalledWith(state.video, 20, 40, 200, 140, 0, 0, 200, 140);
    expect(state.toBlob).toHaveBeenCalledWith(expect.any(Function), "image/webp", 0.8);
    expect(state.stop).toHaveBeenCalledOnce();
    expect(state.pause).toHaveBeenCalledOnce();
    expect(state.video.srcObject).toBeNull();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("ends a stalled play request without encoding a late result", async () => {
    const state = setup();
    let resume!: () => void;
    state.play.mockReturnValue(new Promise<void>((resolve) => { resume = resolve; }));
    const result = captureViewportRegion(region);
    const rejected = expect(result).rejects.toThrow("timed out while starting video playback");
    await vi.advanceTimersByTimeAsync(10_000);
    await rejected;
    expect(state.stop).toHaveBeenCalledOnce();
    expect(state.video.srcObject).toBeNull();
    resume();
    await vi.advanceTimersByTimeAsync(100);
    expect(state.drawImage).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("cancels a stalled animation frame and stops sharing", async () => {
    const state = setup();
    vi.stubGlobal("requestAnimationFrame", vi.fn().mockReturnValue(42));
    const cancel = vi.fn();
    vi.stubGlobal("cancelAnimationFrame", cancel);
    const rejected = expect(captureViewportRegion(region)).rejects.toThrow("timed out while waiting for a frame");
    await vi.advanceTimersByTimeAsync(10_000);
    await rejected;
    expect(cancel).toHaveBeenCalledWith(42);
    expect(state.stop).toHaveBeenCalledOnce();
    expect(state.video.srcObject).toBeNull();
    expect(state.drawImage).not.toHaveBeenCalled();
  });

  it("stops sharing when image encoding stalls", async () => {
    const state = setup();
    state.toBlob.mockImplementation(() => undefined);
    const rejected = expect(captureViewportRegion(region)).rejects.toThrow("timed out while encoding the image");
    await vi.advanceTimersByTimeAsync(10_100);
    await rejected;
    expect(state.stop).toHaveBeenCalledOnce();
    expect(state.pause).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("preserves playback errors while releasing the stream", async () => {
    const state = setup();
    const error = new DOMException("Playback unavailable", "NotSupportedError");
    state.play.mockRejectedValue(error);
    await expect(captureViewportRegion(region)).rejects.toBe(error);
    expect(state.stop).toHaveBeenCalledOnce();
    expect(state.video.srcObject).toBeNull();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("releases the stream after an empty frame or failed encoder", async () => {
    const state = setup();
    Object.defineProperty(state.video, "videoWidth", { value: 0 });
    const empty = expect(captureViewportRegion(region)).rejects.toThrow("empty image");
    await vi.advanceTimersByTimeAsync(100);
    await empty;
    expect(state.stop).toHaveBeenCalledOnce();
    Object.defineProperty(state.video, "videoWidth", { value: 1280 });
    state.toBlob.mockImplementation((callback) => callback(null));
    const failed = expect(captureViewportRegion(region)).rejects.toThrow("couldn't be encoded");
    await vi.advanceTimersByTimeAsync(100);
    await failed;
    expect(state.stop).toHaveBeenCalledTimes(2);
    expect(state.video.srcObject).toBeNull();
  });
});
