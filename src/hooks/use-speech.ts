// packages/ai-ui/src/hooks/use-speech.ts
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";

interface RecognitionAlternative {
  transcript: string;
}

interface RecognitionResult {
  isFinal: boolean;
  0: RecognitionAlternative;
}

interface RecognitionEvent {
  resultIndex: number;
  results: ArrayLike<RecognitionResult>;
}

interface Recognition {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onstart: (() => void) | null;
  onend: (() => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onresult: ((event: RecognitionEvent) => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
}

type RecognitionConstructor = new () => Recognition;

const noopSubscribe = () => () => undefined;

function recognitionConstructor(): RecognitionConstructor | null {
  const scope = window as Window & { SpeechRecognition?: RecognitionConstructor; webkitSpeechRecognition?: RecognitionConstructor };
  return scope.SpeechRecognition ?? scope.webkitSpeechRecognition ?? null;
}

export type DictationState = "idle" | "starting" | "listening" | "error";

const DICTATION_ERRORS: Record<string, string> = {
  "not-allowed": "Microphone access is blocked. Allow it in your browser's site settings, then try again.",
  "service-not-allowed": "Speech recognition is turned off in this browser.",
  "audio-capture": "No microphone was found.",
  network: "Speech recognition needs a network connection.",
  "no-speech": "Didn't catch that. Try again.",
  "language-not-supported": "This language isn't supported for dictation.",
};

export interface UseDictationOptions {
  lang?: string;
  onFinal: (text: string) => void;
  /** Keeps listening across pauses until stopped. */
  continuous?: boolean;
}

export interface DictationApi {
  supported: boolean;
  state: DictationState;
  error: string | null;
  /** Words heard so far that may still change. */
  interim: string;
  start: () => void;
  stop: () => void;
}

/** Browser dictation through the Web Speech API, with interim text and plain-language errors. */
export function useDictation({ lang, onFinal, continuous = true }: UseDictationOptions): DictationApi {
  const Constructor = useSyncExternalStore(noopSubscribe, recognitionConstructor, () => null);
  const [state, setState] = useState<DictationState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [interim, setInterim] = useState("");
  const recognition = useRef<Recognition | null>(null);
  const finalRef = useRef(onFinal);

  useEffect(() => {
    finalRef.current = onFinal;
  });

  useEffect(() => () => recognition.current?.abort(), []);

  const start = useCallback(() => {
    if (!Constructor || recognition.current) return;
    const instance = new Constructor();
    instance.lang = lang ?? (typeof navigator === "undefined" ? "en-US" : navigator.language);
    instance.continuous = continuous;
    instance.interimResults = true;
    instance.onstart = () => setState("listening");
    instance.onresult = (event) => {
      let pending = "";
      for (let index = event.resultIndex; index < event.results.length; index++) {
        const result = event.results[index]!;
        if (result.isFinal) finalRef.current(result[0].transcript.trim());
        else pending += result[0].transcript;
      }
      setInterim(pending.trim());
    };
    instance.onerror = (event) => {
      if (event.error === "aborted") return;
      setError(DICTATION_ERRORS[event.error] ?? "Dictation stopped unexpectedly. Try again.");
      setState("error");
    };
    instance.onend = () => {
      recognition.current = null;
      setInterim("");
      setState((current) => (current === "error" ? "error" : "idle"));
    };
    recognition.current = instance;
    setError(null);
    setState("starting");
    try {
      instance.start();
    } catch {
      recognition.current = null;
      setState("error");
      setError("Dictation couldn't start. Try again.");
    }
  }, [Constructor, continuous, lang]);

  const stop = useCallback(() => recognition.current?.stop(), []);

  return { supported: Constructor !== null, state, error, interim, start, stop };
}

/** Markdown reduced to what should be read aloud: no code, link targets, or formatting marks. */
export function speechText(markdown: string): string {
  return markdown
    .replace(/```[\s\S]*?```/g, " (code block) ")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/^\s*[-*+]\s+/gm, "")
    .replace(/^\s*>\s?/gm, "")
    .replace(/(\*\*|__|\*|_|~~)(.+?)\1/g, "$2")
    .replace(/\|/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export type SpeechState = "idle" | "speaking" | "paused";

const synthesisSupported = () => typeof window !== "undefined" && "speechSynthesis" in window;

export interface SpeechApi {
  supported: boolean;
  state: SpeechState;
  speak: (text: string) => void;
  pause: () => void;
  resume: () => void;
  stop: () => void;
}

/** Text to speech through speechSynthesis; starting one reading cancels any other on the page. */
export function useSpeechSynthesis({ lang, rate = 1 }: { lang?: string; rate?: number } = {}): SpeechApi {
  const supported = useSyncExternalStore(noopSubscribe, synthesisSupported, () => false);
  const [state, setState] = useState<SpeechState>("idle");
  const utterance = useRef<SpeechSynthesisUtterance | null>(null);

  useEffect(
    () => () => {
      if (utterance.current) window.speechSynthesis.cancel();
    },
    [],
  );

  const speak = useCallback(
    (text: string) => {
      if (!supported || !text.trim()) return;
      window.speechSynthesis.cancel();
      const next = new SpeechSynthesisUtterance(text);
      if (lang) next.lang = lang;
      next.rate = rate;
      next.onstart = () => setState("speaking");
      next.onpause = () => setState("paused");
      next.onresume = () => setState("speaking");
      const done = () => {
        if (utterance.current === next) {
          utterance.current = null;
          setState("idle");
        }
      };
      next.onend = done;
      next.onerror = done;
      utterance.current = next;
      setState("speaking");
      window.speechSynthesis.speak(next);
    },
    [supported, lang, rate],
  );

  return {
    supported,
    state,
    speak,
    pause: () => {
      window.speechSynthesis.pause();
      setState("paused");
    },
    resume: () => {
      window.speechSynthesis.resume();
      setState("speaking");
    },
    stop: () => {
      window.speechSynthesis.cancel();
      utterance.current = null;
      setState("idle");
    },
  };
}
