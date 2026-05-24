import { useCallback, useEffect, useRef, useState } from 'react';
import { Eraser } from 'lucide-react';
import { cn } from '@/lib/utils';

export function isSignatureImage(value?: string | null): boolean {
  return Boolean(value?.startsWith('data:image/'));
}

type SignaturePadProps = {
  value?: string | null;
  onChange?: (dataUrl: string | null) => void;
  disabled?: boolean;
  className?: string;
  height?: number;
};

export function SignaturePad({
  value,
  onChange,
  disabled = false,
  className,
  height = 140,
}: SignaturePadProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const hasInkRef = useRef(false);
  const [hasInk, setHasInk] = useState(false);

  const markInk = () => {
    if (!hasInkRef.current) {
      hasInkRef.current = true;
      setHasInk(true);
    }
  };

  const emit = useCallback(
    (url: string | null) => {
      onChange?.(url);
    },
    [onChange],
  );

  const getPoint = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  };

  const setupCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.offsetWidth;
    canvas.width = w * dpr;
    canvas.height = height * dpr;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.scale(dpr, dpr);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = 2.2;
    ctx.strokeStyle = '#0f172a';
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, w, height);
    if (value && isSignatureImage(value)) {
      const img = new Image();
      img.onload = () => {
        ctx.drawImage(img, 0, 0, w, height);
        hasInkRef.current = true;
        setHasInk(true);
      };
      img.src = value;
    } else {
      hasInkRef.current = false;
      setHasInk(false);
    }
  }, [height, value]);

  useEffect(() => {
    setupCanvas();
    const onResize = () => setupCanvas();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [setupCanvas]);

  const start = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (disabled) return;
    e.preventDefault();
    const p = getPoint(e);
    const ctx = canvasRef.current?.getContext('2d');
    if (!p || !ctx) return;
    drawing.current = true;
    canvasRef.current?.setPointerCapture(e.pointerId);
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
  };

  const move = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current || disabled) return;
    e.preventDefault();
    const p = getPoint(e);
    const ctx = canvasRef.current?.getContext('2d');
    if (!p || !ctx) return;
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    markInk();
  };

  const end = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current) return;
    drawing.current = false;
    try {
      canvasRef.current?.releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
    const canvas = canvasRef.current;
    if (canvas && hasInkRef.current) {
      emit(canvas.toDataURL('image/png'));
    }
  };

  const clear = () => {
    if (disabled) return;
    hasInkRef.current = false;
    setupCanvas();
    setHasInk(false);
    emit(null);
  };

  const handleEndStroke = () => {
    const canvas = canvasRef.current;
    if (canvas && hasInkRef.current) emit(canvas.toDataURL('image/png'));
  };

  if (disabled && value && isSignatureImage(value)) {
    return (
      <div
        className={cn('rounded-lg border-2 border-emerald-200 bg-white p-2', className)}
        style={{ minHeight: height }}
      >
        <img
          src={value}
          alt="Signature du responsable"
          className="mx-auto max-h-[120px] w-full object-contain"
        />
      </div>
    );
  }

  return (
    <div className={cn('space-y-2', className)}>
      <div className="relative rounded-lg border-2 border-dashed border-zinc-300 bg-white">
        <canvas
          ref={canvasRef}
          className={cn(
            'w-full touch-none rounded-lg',
            disabled ? 'cursor-not-allowed opacity-60' : 'cursor-crosshair',
          )}
          style={{ height }}
          onPointerDown={start}
          onPointerMove={move}
          onPointerUp={(e) => {
            end(e);
            handleEndStroke();
          }}
          onPointerLeave={(e) => {
            end(e);
            handleEndStroke();
          }}
        />
        {!hasInk && !disabled && (
          <p className="pointer-events-none absolute inset-0 flex items-center justify-center text-xs text-zinc-400">
            Signez ici avec la souris ou le doigt
          </p>
        )}
      </div>
      {!disabled && (
        <button
          type="button"
          onClick={clear}
          className="inline-flex items-center gap-1.5 rounded-md border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-50"
        >
          <Eraser size={12} /> Effacer la signature
        </button>
      )}
    </div>
  );
}
