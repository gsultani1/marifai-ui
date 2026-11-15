// packages/ai-ui/src/components/speech-controls.tsx
"use client";

import { MicIcon, PauseIcon, SquareIcon, Volume2Icon } from "lucide-react";

import { useDictation, useSpeechSynthesis, speechText } from "../hooks/use-speech.js";
import { focusRing, iconButton } from "../lib/classes.js";
import { cn } from "../lib/cn.js";
import { usePromptInput } from "./prompt-input.js";

export interface VoiceInputProps {
  onTranscript: (text: string) => void;
  lang?: string;
  /** Renders nothing in browsers without speech recognition. */
  hideWhenUnsupported?: boolean;
  className?: string;
}

/**
 * Dictation button: shows words as they are heard, hands each finished
 * phrase to `onTranscript`, and explains blocked microphones and other
 * failures with a way to try again.
 */
export function VoiceInput({ onTranscript, lang, hideWhenUnsupported = true, className }: VoiceInputProps) {
  const dictation = useDictation({ onFinal: onTranscript, ...(lang ? { lang } : {}) });
  if (!dictation.supported && hideWhenUnsupported) return null;
  const listening = dictation.state === "listening" || dictation.state === "starting";
  return (
    <span className={cn("relative inline-flex items-center", className)}>
      <button
        type="button"
        disabled={!dictation.supported}
        aria-pressed={listening}
        aria-label={listening ? "Stop dictation" : "Start dictation"}
        title={dictation.supported ? undefined : "Dictation isn't supported in this browser"}
        onClick={() => (listening ? dictation.stop() : dictation.start())}
        className={cn(iconButton, "rounded-full aria-pressed:bg-destructive/10 aria-pressed:text-destructive", focusRing)}
      >
        <MicIcon aria-hidden="true" className={cn(listening && "motion-safe:animate-pulse")} />
      </button>
      {dictation.interim && (
        <span aria-hidden="true" className="absolute bottom-full left-0 mb-1 max-w-64 truncate rounded-md bg-foreground px-2 py-1 text-xs text-background shadow-md">
          {dictation.interim}
        </span>
      )}
      <span role="status" className="sr-only">
        {dictation.state === "listening" ? "Listening" : dictation.error ?? ""}
      </span>
      {dictation.error && (
        <span role="alert" className="absolute bottom-full left-0 mb-1 w-64 rounded-md border border-destructive/40 bg-popover px-2 py-1.5 text-xs text-popover-foreground shadow-md">
          {dictation.error}
        </span>
      )}
    </span>
  );
}

/** VoiceInput wired to PromptInput: each finished phrase is appended to the draft. */
export function PromptInputVoice(props: Omit<VoiceInputProps, "onTranscript">) {
  const { value, setValue } = usePromptInput();
  return <VoiceInput {...props} onTranscript={(text) => text && setValue(value ? `${value.replace(/\s+$/, "")} ${text}` : text)} />;
}

export interface ReadAloudProps {
  /** Markdown or plain text; code blocks and link targets are skipped. */
  text: string;
  lang?: string;
  rate?: number;
  hideWhenUnsupported?: boolean;
  className?: string;
}

/** Reads a message aloud with play, pause and stop; another reading on the page stops this one. */
export function ReadAloud({ text, lang, rate, hideWhenUnsupported = true, className }: ReadAloudProps) {
  const speech = useSpeechSynthesis({ ...(lang ? { lang } : {}), ...(rate ? { rate } : {}) });
  if (!speech.supported && hideWhenUnsupported) return null;
  return (
    <span className={cn("inline-flex items-center", className)}>
      <button
        type="button"
        disabled={!speech.supported}
        aria-label={speech.state === "speaking" ? "Pause reading" : speech.state === "paused" ? "Resume reading" : "Read aloud"}
        onClick={() => (speech.state === "speaking" ? speech.pause() : speech.state === "paused" ? speech.resume() : speech.speak(speechText(text)))}
        className={cn(iconButton, focusRing)}
      >
        {speech.state === "speaking" ? <PauseIcon aria-hidden="true" /> : <Volume2Icon aria-hidden="true" />}
      </button>
      {speech.state !== "idle" && (
        <button type="button" aria-label="Stop reading" onClick={speech.stop} className={cn(iconButton, focusRing)}>
          <SquareIcon aria-hidden="true" className="fill-current" />
        </button>
      )}
    </span>
  );
}
