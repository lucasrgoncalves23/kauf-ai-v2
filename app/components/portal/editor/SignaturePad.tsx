"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Eraser } from "lucide-react";

const SAVED_KEY = "kai-doctor-signature";
const WIDTH = 480;
const HEIGHT = 160;

export function loadSavedSignature(): string | null {
  try {
    return localStorage.getItem(SAVED_KEY);
  } catch {
    return null;
  }
}

export function saveSignature(image: string | null) {
  try {
    if (image) localStorage.setItem(SAVED_KEY, image);
    else localStorage.removeItem(SAVED_KEY);
  } catch {
    /* storage full or blocked: the doctor just draws again next time */
  }
}

/** Draw-to-sign canvas. Emits a PNG data URL (transparent background) or null when cleared. */
export function SignaturePad({ value, onChange }: { value: string | null; onChange: (image: string | null) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const last = useRef<{ x: number; y: number } | null>(null);
  const hasInk = useRef(false);
  const [empty, setEmpty] = useState(!value);

  const ctx = useCallback(() => canvasRef.current?.getContext("2d") ?? null, []);

  // Set up the backing store for sharp lines on retina screens, and paint the incoming value
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = Math.max(1, Math.min(window.devicePixelRatio || 1, 2));
    canvas.width = WIDTH * dpr;
    canvas.height = HEIGHT * dpr;
    const c = canvas.getContext("2d");
    if (!c) return;
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.lineCap = "round";
    c.lineJoin = "round";
    c.lineWidth = 2.2;
    c.strokeStyle = "#0f172a";
    if (value) {
      const img = new Image();
      img.onload = () => c.drawImage(img, 0, 0, WIDTH, HEIGHT);
      img.src = value;
      hasInk.current = true;
    }
    // Only on mount: later values come from this pad itself
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const point = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    return { x: ((e.clientX - rect.left) / rect.width) * WIDTH, y: ((e.clientY - rect.top) / rect.height) * HEIGHT };
  };

  const onDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    drawing.current = true;
    last.current = point(e);
    const c = ctx();
    if (c && last.current) {
      c.beginPath();
      c.arc(last.current.x, last.current.y, 1.1, 0, Math.PI * 2);
      c.fillStyle = "#0f172a";
      c.fill();
    }
    hasInk.current = true;
  };

  const onMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current || !last.current) return;
    const c = ctx();
    const p = point(e);
    if (c) {
      c.beginPath();
      c.moveTo(last.current.x, last.current.y);
      c.lineTo(p.x, p.y);
      c.stroke();
    }
    last.current = p;
  };

  const onUp = () => {
    if (!drawing.current) return;
    drawing.current = false;
    last.current = null;
    if (hasInk.current && canvasRef.current) {
      setEmpty(false);
      onChange(canvasRef.current.toDataURL("image/png"));
    }
  };

  const clear = () => {
    const canvas = canvasRef.current;
    const c = ctx();
    if (canvas && c) c.clearRect(0, 0, WIDTH, HEIGHT);
    hasInk.current = false;
    setEmpty(true);
    onChange(null);
  };

  return (
    <div>
      <div className="relative overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-600">
        <canvas
          ref={canvasRef}
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerCancel={onUp}
          style={{ aspectRatio: `${WIDTH} / ${HEIGHT}` }}
          className="block w-full cursor-crosshair touch-none"
          aria-label="Área para assinar"
        />
        <div className="pointer-events-none absolute inset-x-6 bottom-8 border-b border-dashed border-slate-300" />
        {empty && (
          <p className="pointer-events-none absolute inset-0 flex items-center justify-center text-sm text-slate-300">Assine aqui com o mouse, trackpad ou caneta</p>
        )}
      </div>
      <div className="mt-1.5 flex justify-end">
        <button type="button" onClick={clear} className="flex items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700">
          <Eraser className="h-3.5 w-3.5" /> Limpar
        </button>
      </div>
    </div>
  );
}
