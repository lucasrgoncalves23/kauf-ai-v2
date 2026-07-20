"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

// Minimal Web Speech API surface (not in TypeScript's DOM lib)
type SpeechRecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onend: (() => void) | null;
  onerror: ((event: { error: string }) => void) | null;
};

type SpeechRecognitionEventLike = {
  resultIndex: number;
  results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }>;
};

function getSpeechRecognitionCtor(): (new () => SpeechRecognitionLike) | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as Record<string, unknown>;
  return (w.SpeechRecognition || w.webkitSpeechRecognition || null) as
    | (new () => SpeechRecognitionLike)
    | null;
}

/**
 * Browser dictation (Web Speech API, pt-BR). Final transcript chunks are
 * delivered via onFinalText; interim text is exposed for live feedback.
 * Auto-restarts when the browser stops on silence, until the user stops.
 */
export function useDictation(onFinalText: (text: string) => void) {
  const [isRecording, setIsRecording] = useState(false);
  const [interim, setInterim] = useState("");
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const activeRef = useRef(false);
  const onTextRef = useRef(onFinalText);
  onTextRef.current = onFinalText;

  const isSupported = useMemo(() => getSpeechRecognitionCtor() !== null, []);

  const stop = useCallback(() => {
    activeRef.current = false;
    try {
      recognitionRef.current?.stop();
    } catch {
      /* already stopped */
    }
    setIsRecording(false);
    setInterim("");
  }, []);

  const start = useCallback(() => {
    const Ctor = getSpeechRecognitionCtor();
    if (!Ctor || activeRef.current) return;

    const rec = new Ctor();
    rec.lang = "pt-BR";
    rec.continuous = true;
    rec.interimResults = true;

    rec.onresult = (event) => {
      let interimText = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const transcript = result[0]?.transcript || "";
        if (result.isFinal) {
          if (transcript.trim()) onTextRef.current(transcript.trim());
        } else {
          interimText += transcript;
        }
      }
      setInterim(interimText);
    };

    rec.onend = () => {
      // Browsers stop after a silence window; keep going until the user stops
      if (activeRef.current) {
        try {
          rec.start();
        } catch {
          activeRef.current = false;
          setIsRecording(false);
        }
      } else {
        setIsRecording(false);
      }
      setInterim("");
    };

    rec.onerror = (event) => {
      if (event.error === "not-allowed" || event.error === "service-not-allowed") {
        activeRef.current = false;
        setIsRecording(false);
        setInterim("");
      }
      // "no-speech"/"aborted" fall through to onend, which restarts if active
    };

    recognitionRef.current = rec;
    activeRef.current = true;
    rec.start();
    setIsRecording(true);
  }, []);

  const toggle = useCallback(() => {
    if (activeRef.current) stop();
    else start();
  }, [start, stop]);

  // Stop cleanly if the component unmounts mid-dictation
  useEffect(() => {
    return () => {
      activeRef.current = false;
      try {
        recognitionRef.current?.abort();
      } catch {
        /* ignore */
      }
    };
  }, []);

  return { isSupported, isRecording, interim, toggle, stop };
}
