"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { TranscriptSegment } from "@/lib/types";

/* Minimal typings for the Web Speech API (not in lib.dom for all TS versions). */
interface SRAlternative { transcript: string }
interface SRResult { isFinal: boolean; 0: SRAlternative; length: number }
interface SREvent { resultIndex: number; results: ArrayLike<SRResult> }
interface SRErrorEvent { error: string }
interface SpeechRecognitionLike {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((e: SREvent) => void) | null;
  onerror: ((e: SRErrorEvent) => void) | null;
  onend: (() => void) | null;
}
type SRCtor = new () => SpeechRecognitionLike;

function getSR(): SRCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: SRCtor; webkitSpeechRecognition?: SRCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

let segCounter = 0;
const segId = () => `${Date.now().toString(36)}-${(segCounter++).toString(36)}`;

/**
 * Live, bot-free transcription in the browser. Uses the Web Speech API for
 * speech-to-text and an AnalyserNode for the level meter. Recognition restarts
 * automatically because browsers end sessions after silence.
 */
export function useTranscriber(opts: {
  baseMs: number;
  onSegment: (s: TranscriptSegment) => void;
  onElapsed?: (ms: number) => void;
}) {
  const [supported, setSupported] = useState(true);
  const [recording, setRecording] = useState(false);
  const [interim, setInterim] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [levels, setLevels] = useState<number[]>([0, 0, 0, 0, 0]);
  const [elapsed, setElapsed] = useState(opts.baseMs);

  const rec = useRef<SpeechRecognitionLike | null>(null);
  const wantOn = useRef(false);
  const startedAt = useRef(0);
  const base = useRef(opts.baseMs);
  const cbs = useRef(opts);
  cbs.current = opts;
  const audio = useRef<{ ctx: AudioContext; stream: MediaStream; raf: number; timer: number } | null>(null);

  useEffect(() => setSupported(getSR() !== null), []);
  useEffect(() => {
    if (!recording) {
      base.current = opts.baseMs;
      setElapsed(opts.baseMs);
    }
  }, [opts.baseMs, recording]);

  const now = () => base.current + (performance.now() - startedAt.current);

  const stopAudio = () => {
    if (!audio.current) return;
    cancelAnimationFrame(audio.current.raf);
    clearInterval(audio.current.timer);
    audio.current.stream.getTracks().forEach((t) => t.stop());
    audio.current.ctx.close().catch(() => {});
    audio.current = null;
    setLevels([0, 0, 0, 0, 0]);
  };

  const stop = useCallback(() => {
    wantOn.current = false;
    rec.current?.stop();
    rec.current = null;
    if (startedAt.current) {
      const total = now();
      base.current = total;
      cbs.current.onElapsed?.(total);
    }
    startedAt.current = 0;
    stopAudio();
    setInterim("");
    setRecording(false);
  }, []);

  const start = useCallback(async () => {
    const SR = getSR();
    if (!SR) {
      setError("Live transcription needs Chrome, Edge or Safari (Web Speech API).");
      return;
    }
    setError(null);

    // Microphone + level meter
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
    } catch {
      setError("Microphone access was blocked. Allow it in your browser's site settings.");
      return;
    }
    const ctx = new AudioContext();
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 64;
    ctx.createMediaStreamSource(stream).connect(analyser);
    const data = new Uint8Array(analyser.frequencyBinCount);
    const tick = () => {
      analyser.getByteFrequencyData(data);
      const bands = [2, 4, 6, 9, 13].map((i) => Math.min(1, (data[i] ?? 0) / 200));
      setLevels(bands);
      if (audio.current) audio.current.raf = requestAnimationFrame(tick);
    };
    const timer = window.setInterval(() => setElapsed(now()), 500);
    audio.current = { ctx, stream, raf: requestAnimationFrame(tick), timer };

    startedAt.current = performance.now();
    wantOn.current = true;

    const boot = () => {
      const r = new SR();
      r.continuous = true;
      r.interimResults = true;
      r.lang = navigator.language || "en-US";
      let segStart = now();
      r.onresult = (e) => {
        let live = "";
        for (let i = e.resultIndex; i < e.results.length; i++) {
          const res = e.results[i];
          const text = res[0].transcript.trim();
          if (res.isFinal) {
            if (text) cbs.current.onSegment({ id: segId(), speaker: "me", text, t: Math.round(segStart) });
            segStart = now();
          } else {
            live += res[0].transcript;
          }
        }
        setInterim(live.trim());
      };
      r.onerror = (e) => {
        if (e.error === "not-allowed" || e.error === "service-not-allowed") {
          setError("Speech recognition permission was denied.");
          stop();
        } else if (e.error === "network") {
          setError("Speech recognition lost its network connection — retrying…");
        }
        // "no-speech" / "aborted" are normal; onend handles restart.
      };
      r.onend = () => {
        if (wantOn.current) {
          try {
            boot();
          } catch {
            /* ignore */
          }
        }
      };
      rec.current = r;
      r.start();
    };
    boot();
    setRecording(true);
  }, [stop]);

  useEffect(() => () => {
    wantOn.current = false;
    rec.current?.abort();
    stopAudio();
  }, []);

  return { supported, recording, interim, error, levels, elapsed, start, stop };
}
