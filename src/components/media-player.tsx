// packages/ai-ui/src/components/media-player.tsx
"use client";

import { CaptionsIcon, LoaderCircleIcon, Maximize2Icon, PauseIcon, PlayIcon, Volume2Icon, VolumeXIcon } from "lucide-react";
import { type ComponentProps, type KeyboardEvent, useEffect, useId, useRef, useState } from "react";

import { focusRing } from "../lib/classes.js";
import { cn } from "../lib/cn.js";
import { safeUrl } from "../lib/safe-url.js";
import { ActionMenu } from "./action-menu.js";

const MEDIA_PROTOCOLS = ["http:", "https:", "blob:"];

/** "1:05" or "1:02:09" for a number of seconds. */
export function formatMediaTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const total = Math.floor(seconds);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const rest = String(total % 60).padStart(2, "0");
  return hours ? `${hours}:${String(minutes).padStart(2, "0")}:${rest}` : `${minutes}:${rest}`;
}

export interface MediaTrack {
  src: string;
  label: string;
  srcLang: string;
  kind?: "captions" | "subtitles";
  default?: boolean;
}

export interface MediaPlayerProps extends Omit<ComponentProps<"div">, "children"> {
  src: string;
  kind?: "audio" | "video";
  title: string;
  poster?: string;
  tracks?: MediaTrack[];
  autoPlay?: boolean;
  loop?: boolean;
}

const RATES = [0.5, 0.75, 1, 1.25, 1.5, 2];

/**
 * Audio or video player with consistent controls: play, seek, time, mute,
 * volume, speed, captions and full screen. Keyboard: Space or K plays,
 * J and L skip 10 seconds, arrows seek 5 seconds or change volume, M mutes,
 * F goes full screen.
 */
export function MediaPlayer({ src, kind = "video", title, poster, tracks = [], autoPlay = false, loop = false, className, ...props }: MediaPlayerProps) {
  const mediaRef = useRef<HTMLVideoElement & HTMLAudioElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const [rate, setRate] = useState(1);
  const [waiting, setWaiting] = useState(false);
  const [error, setError] = useState(false);
  const [captions, setCaptions] = useState(tracks.some((track) => track.default));
  const id = useId();
  const safeSrc = safeUrl(src, MEDIA_PROTOCOLS, { allowRelative: true });
  const safePoster = safeUrl(poster, MEDIA_PROTOCOLS, { allowRelative: true });

  useEffect(() => {
    const media = mediaRef.current;
    if (!media) return;
    for (const track of media.textTracks) track.mode = captions ? "showing" : "hidden";
  }, [captions]);

  const media = () => mediaRef.current;
  const toggle = () => {
    const element = media();
    if (!element) return;
    if (element.paused) element.play().catch(() => setError(true));
    else element.pause();
  };
  const seek = (value: number) => {
    const element = media();
    if (element) element.currentTime = Math.min(duration || element.duration || 0, Math.max(0, value));
  };
  const setVolumeLevel = (value: number) => {
    const element = media();
    if (!element) return;
    element.volume = Math.min(1, Math.max(0, value));
    element.muted = element.volume === 0;
  };
  const fullscreen = () => {
    const root = rootRef.current;
    if (!root) return;
    if (document.fullscreenElement) void document.exitFullscreen?.();
    else void root.requestFullscreen?.().catch(() => undefined);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if ((event.target as HTMLElement).closest('input[type="range"], [role="menu"]')) return;
    const key = event.key.toLowerCase();
    const actions: Record<string, () => void> = {
      " ": toggle,
      k: toggle,
      j: () => seek(time - 10),
      l: () => seek(time + 10),
      arrowleft: () => seek(time - 5),
      arrowright: () => seek(time + 5),
      arrowup: () => setVolumeLevel(volume + 0.1),
      arrowdown: () => setVolumeLevel(volume - 0.1),
      m: () => {
        const element = media();
        if (element) element.muted = !element.muted;
      },
      ...(kind === "video" ? { f: fullscreen } : {}),
    };
    const action = actions[key];
    if (action && !event.ctrlKey && !event.metaKey) {
      event.preventDefault();
      action();
    }
  };

  const control = cn("inline-flex size-8 shrink-0 items-center justify-center rounded-md hover:bg-accent [&_svg]:size-4", focusRing);
  const mediaProps = {
    ref: mediaRef,
    src: safeSrc,
    autoPlay,
    loop,
    preload: "metadata" as const,
    crossOrigin: tracks.length ? ("anonymous" as const) : undefined,
    onPlay: () => setPlaying(true),
    onPause: () => setPlaying(false),
    onTimeUpdate: (event: { currentTarget: HTMLMediaElement }) => setTime(event.currentTarget.currentTime),
    onDurationChange: (event: { currentTarget: HTMLMediaElement }) => setDuration(event.currentTarget.duration),
    onVolumeChange: (event: { currentTarget: HTMLMediaElement }) => {
      setVolume(event.currentTarget.volume);
      setMuted(event.currentTarget.muted);
    },
    onRateChange: (event: { currentTarget: HTMLMediaElement }) => setRate(event.currentTarget.playbackRate),
    onWaiting: () => setWaiting(true),
    onPlaying: () => setWaiting(false),
    onCanPlay: () => setWaiting(false),
    onError: () => setError(true),
  };

  return (
    <div
      ref={rootRef}
      role="group"
      aria-label={`${kind === "video" ? "Video" : "Audio"}: ${title}`}
      aria-describedby={`${id}-keys`}
      tabIndex={0}
      onKeyDown={onKeyDown}
      data-slot="media-player"
      className={cn("flex flex-col overflow-hidden rounded-lg border border-border bg-card text-sm text-card-foreground", focusRing, className)}
      {...props}
    >
      {kind === "video" ? (
        <div className="relative bg-black">
          <video {...mediaProps} poster={safePoster} playsInline onClick={toggle} className="block aspect-video w-full">
            {tracks.map((track) => (
              <track key={track.src} src={safeUrl(track.src, MEDIA_PROTOCOLS, { allowRelative: true })} label={track.label} srcLang={track.srcLang} kind={track.kind ?? "captions"} default={track.default} />
            ))}
          </video>
          {waiting && <LoaderCircleIcon aria-hidden="true" className="absolute top-1/2 left-1/2 size-8 -translate-1/2 text-white motion-safe:animate-spin" />}
        </div>
      ) : (
        <audio {...mediaProps} className="hidden" />
      )}
      {error ? (
        <p role="alert" className="px-3 py-2 text-destructive">
          This {kind} could not be played.
        </p>
      ) : (
        <div className="flex flex-wrap items-center gap-1 px-2 py-1.5">
          <button type="button" aria-label={playing ? "Pause" : "Play"} onClick={toggle} className={control}>
            {playing ? <PauseIcon aria-hidden="true" /> : <PlayIcon aria-hidden="true" />}
          </button>
          {kind === "audio" && <span className="mx-1 max-w-48 truncate font-medium">{title}</span>}
          <span className="text-xs tabular-nums">{formatMediaTime(time)}</span>
          <input
            type="range"
            aria-label="Seek"
            aria-valuetext={`${formatMediaTime(time)} of ${formatMediaTime(duration)}`}
            min={0}
            max={duration || 0}
            step={0.1}
            value={Math.min(time, duration || 0)}
            onChange={(event) => seek(Number(event.target.value))}
            className={cn("min-w-24 flex-1 accent-primary", focusRing)}
          />
          <span className="text-xs text-muted-foreground tabular-nums">{formatMediaTime(duration)}</span>
          <button
            type="button"
            aria-label={muted ? "Unmute" : "Mute"}
            aria-pressed={muted}
            onClick={() => {
              const element = media();
              if (element) element.muted = !element.muted;
            }}
            className={control}
          >
            {muted || volume === 0 ? <VolumeXIcon aria-hidden="true" /> : <Volume2Icon aria-hidden="true" />}
          </button>
          <input type="range" aria-label="Volume" min={0} max={1} step={0.05} value={muted ? 0 : volume} onChange={(event) => setVolumeLevel(Number(event.target.value))} className={cn("w-20 accent-primary", focusRing)} />
          <ActionMenu
            align="end"
            side="top"
            trigger={
              <button type="button" aria-label={`Playback speed ${rate}×`} className={cn(control, "w-auto px-2 text-xs tabular-nums")}>
                {rate}×
              </button>
            }
            items={RATES.map((value) => ({
              id: String(value),
              label: `${value}×`,
              checked: rate === value,
              onSelect: () => {
                const element = media();
                if (element) element.playbackRate = value;
              },
            }))}
          />
          {tracks.length > 0 && (
            <button type="button" aria-label="Captions" aria-pressed={captions} onClick={() => setCaptions(!captions)} className={control}>
              <CaptionsIcon aria-hidden="true" />
            </button>
          )}
          {kind === "video" && (
            <button type="button" aria-label="Full screen" onClick={fullscreen} className={control}>
              <Maximize2Icon aria-hidden="true" />
            </button>
          )}
        </div>
      )}
      <p id={`${id}-keys`} className="sr-only">
        Space or K plays and pauses. J and L skip 10 seconds. Left and right arrows seek 5 seconds. Up and down arrows change volume. M mutes{kind === "video" ? ". F toggles full screen" : ""}.
      </p>
    </div>
  );
}
