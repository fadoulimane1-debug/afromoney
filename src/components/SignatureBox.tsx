import { useCallback, useEffect, useRef, useState } from 'react';
import dayjs from 'dayjs';
import { CheckCircle, Eraser, Keyboard, Lock, Monitor, RefreshCw, Smartphone, X } from 'lucide-react';
import { getCurrentUser } from '@/lib/storage';
import {
  type SignatureMode,
  type SignatureRecord,
  SIGNATURE_MODE_LABELS,
  decodeSignature,
  encodeSignature,
  isDrawnSignatureUrl,
  sha256hex,
} from '@/lib/signatureUtils';

const CANVAS_H = 190;

export interface SigState {
  value: string | null;
  nom: string;
  isReady: boolean;
}

interface SignatureBoxProps {
  savedValue?: string | null;
  nomFallback?: string;
  timestampFallback?: string;
  disabled?: boolean;
  onChange: (state: SigState) => void;
}

// ── MODE CONFIG ───────────────────────────────────────────────────────────────

const MODES: Array<{ mode: SignatureMode; icon: React.ReactNode; label: string; hint: string }> = [
  { mode: 'tactile', icon: <Smartphone size={14} />, label: 'Tactile', hint: 'Doigt / stylet' },
  { mode: 'souris',  icon: <Monitor size={14} />,    label: 'Souris',  hint: 'Clic & glisser' },
  { mode: 'clavier', icon: <Keyboard size={14} />,   label: 'Électronique', hint: 'Certification' },
];

// ── COMPONENT ─────────────────────────────────────────────────────────────────

export function SignatureBox({
  savedValue,
  nomFallback,
  timestampFallback,
  disabled = false,
  onChange,
}: SignatureBoxProps) {
  const [nom, setNom] = useState<string>(() => getCurrentUser()?.nom ?? '');
  const [mode, setMode] = useState<SignatureMode>('tactile');
  const [canvasData, setCanvasData] = useState<string | null>(null);
  const [hasInk, setHasInk] = useState(false);
  const [kbChecked, setKbChecked] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [confirmLoading, setConfirmLoading] = useState(false);
  const [record, setRecord] = useState<SignatureRecord | null>(null);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawingRef = useRef(false);
  const hasInkRef = useRef(false);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  // ── notify parent ────────────────────────────────────────────────────────────

  useEffect(() => {
    if (confirmed && record) {
      onChangeRef.current({ value: encodeSignature(record), nom: record.nom, isReady: true });
    } else {
      onChangeRef.current({ value: null, nom, isReady: false });
    }
  }, [confirmed, record, nom]);

  // ── canvas setup ─────────────────────────────────────────────────────────────

  const setupCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.offsetWidth;
    if (!w) return;
    canvas.width = w * dpr;
    canvas.height = CANVAS_H * dpr;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.scale(dpr, dpr);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = '#1e293b';
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, w, CANVAS_H);
    hasInkRef.current = false;
    setHasInk(false);
    setCanvasData(null);
  }, []);

  // Run setupCanvas when canvas needs to appear (mode switch, cancel)
  useEffect(() => {
    if (!disabled && !confirmed && (mode === 'tactile' || mode === 'souris')) {
      setupCanvas();
    }
  }, [disabled, confirmed, mode, setupCanvas]);

  // Resize handler
  useEffect(() => {
    const onResize = () => {
      if (!disabled && !confirmed && mode !== 'clavier') setupCanvas();
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [disabled, confirmed, mode, setupCanvas]);

  // ── canvas pointer events ─────────────────────────────────────────────────

  const getPoint = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) * (canvas.width / rect.width),
      y: (e.clientY - rect.top) * (canvas.height / rect.height),
    };
  };

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (confirmed) return;
    e.preventDefault();
    const p = getPoint(e);
    const ctx = canvasRef.current?.getContext('2d');
    if (!p || !ctx) return;
    drawingRef.current = true;
    canvasRef.current?.setPointerCapture(e.pointerId);
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
  };

  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current || confirmed) return;
    e.preventDefault();
    const p = getPoint(e);
    const ctx = canvasRef.current?.getContext('2d');
    if (!p || !ctx) return;
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    if (!hasInkRef.current) {
      hasInkRef.current = true;
      setHasInk(true);
    }
  };

  const onPointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current) return;
    drawingRef.current = false;
    try { canvasRef.current?.releasePointerCapture(e.pointerId); } catch { /* */ }
    if (canvasRef.current && hasInkRef.current) {
      setCanvasData(canvasRef.current.toDataURL('image/png'));
    }
  };

  const clearCanvas = () => setupCanvas();

  // ── mode change ───────────────────────────────────────────────────────────

  const handleModeChange = (newMode: SignatureMode) => {
    if (confirmed) return;
    setMode(newMode);
    setKbChecked(false);
    // canvas reset handled by useEffect above
  };

  // ── confirm ───────────────────────────────────────────────────────────────

  const handleConfirm = async () => {
    const trimNom = nom.trim();
    if (!trimNom) return;
    const isCanvas = mode === 'tactile' || mode === 'souris';
    if (isCanvas && !canvasData) return;
    if (mode === 'clavier' && !kbChecked) return;

    setConfirmLoading(true);
    try {
      const timestamp = new Date().toISOString();
      const hashInput = isCanvas ? canvasData! : `${trimNom}|${timestamp}|AFROMONEY_SIG_V1`;
      const hash = await sha256hex(hashInput);

      const rec: SignatureRecord = {
        cert: 'AFROMONEY_SIG_V1',
        type: mode,
        nom: trimNom,
        timestamp,
        hash,
        ...(canvasData ? { image: canvasData } : {}),
      };
      setRecord(rec);
      setConfirmed(true);
    } finally {
      setConfirmLoading(false);
    }
  };

  const handleCancel = () => {
    setConfirmed(false);
    setRecord(null);
    setKbChecked(false);
    // canvas reset handled by useEffect([..., confirmed, ...])
  };

  // ── DISABLED: show saved signature ────────────────────────────────────────

  if (disabled) {
    const rec = decodeSignature(savedValue);
    const isOld = isDrawnSignatureUrl(savedValue);
    const displayNom = rec?.nom ?? nomFallback ?? '—';
    const displayTs = rec?.timestamp ?? timestampFallback;

    return (
      <div className="rounded-xl border-2 border-emerald-200 bg-gradient-to-br from-emerald-50 to-white p-5 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-emerald-100 shadow-sm">
            <Lock size={20} className="text-emerald-600" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-emerald-800 text-base">
              ✅ Signé par {displayNom}
            </p>
            {displayTs && (
              <p className="text-sm text-emerald-600">
                {dayjs(displayTs).format('DD/MM/YYYY [à] HH:mm:ss')}
                {rec?.type ? (
                  <span className="ml-2 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">
                    {SIGNATURE_MODE_LABELS[rec.type]}
                  </span>
                ) : null}
              </p>
            )}
          </div>
        </div>
        {rec?.hash && (
          <div className="mt-3 rounded-lg bg-white/80 border border-emerald-100 px-3 py-2">
            <p className="font-mono text-[10px] text-zinc-400 break-all">
              🔒 SHA-256 : {rec.hash.slice(0, 20)}…{rec.hash.slice(-10)}
            </p>
          </div>
        )}
        {(rec?.image || isOld) && (
          <div className="mt-3 rounded-lg border border-emerald-100 bg-white p-3 shadow-inner">
            <img
              src={rec?.image ?? savedValue!}
              alt="Signature du responsable"
              className="mx-auto max-h-[90px] w-full object-contain"
            />
          </div>
        )}
      </div>
    );
  }

  // ── ACTIVE: signature UI ──────────────────────────────────────────────────

  const isCanvasMode = mode === 'tactile' || mode === 'souris';
  const canConfirm =
    nom.trim().length > 0 &&
    (mode === 'clavier' ? kbChecked : Boolean(canvasData)) &&
    !confirmLoading;

  return (
    <div className="space-y-4">

      {/* ── Nom du responsable ── */}
      <div>
        <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-zinc-600">
          Nom du responsable <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          value={nom}
          onChange={(e) => {
            setNom(e.target.value);
            if (confirmed) handleCancel();
          }}
          placeholder="Ex : Maryam (DG)"
          disabled={confirmed}
          className="w-full rounded-lg border-2 border-zinc-300 px-4 py-2.5 text-sm font-medium outline-none transition-all placeholder:text-zinc-400 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 disabled:cursor-not-allowed disabled:bg-zinc-100 disabled:text-zinc-500 disabled:border-zinc-200"
        />
      </div>

      {/* ── Mode de signature ── */}
      {!confirmed && (
        <div>
          <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-zinc-600">
            Mode de signature <span className="text-red-500">*</span>
          </label>
          <div className="grid grid-cols-3 gap-2">
            {MODES.map(({ mode: m, icon, label, hint }) => (
              <button
                key={m}
                type="button"
                onClick={() => handleModeChange(m)}
                className={`flex flex-col items-center gap-1.5 rounded-xl border-2 px-2 py-3 text-xs font-medium transition-all ${
                  mode === m
                    ? 'border-blue-400 bg-blue-50 text-blue-700 shadow-sm ring-1 ring-blue-200'
                    : 'border-zinc-200 bg-white text-zinc-500 hover:border-zinc-300 hover:bg-zinc-50'
                }`}
              >
                <span className={mode === m ? 'text-blue-600' : 'text-zinc-400'}>{icon}</span>
                <span className="font-bold">{label}</span>
                <span className={`text-[10px] leading-tight text-center ${mode === m ? 'text-blue-400' : 'text-zinc-400'}`}>
                  {hint}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Canvas (Tactile / Souris) ── */}
      {!confirmed && isCanvasMode && (
        <div>
          <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-zinc-600">
            Signature manuscrite
          </label>
          <div
            className={`relative rounded-xl border-2 bg-white shadow-inner transition-all ${
              hasInk ? 'border-zinc-400 shadow-md' : 'border-dashed border-zinc-300'
            }`}
            style={{ boxShadow: hasInk ? 'inset 0 1px 4px rgba(0,0,0,0.06)' : undefined }}
          >
            <canvas
              ref={canvasRef}
              className="w-full touch-none rounded-xl"
              style={{ height: CANVAS_H, display: 'block', cursor: 'crosshair' }}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerLeave={onPointerUp}
            />
            {!hasInk && (
              <p className="pointer-events-none absolute inset-0 flex items-center justify-center gap-2 text-xs text-zinc-400">
                {mode === 'tactile'
                  ? '☝️ Signez avec le doigt ou le stylet'
                  : '🖱️ Maintenez le clic gauche et tracez'}
              </p>
            )}
          </div>
          <div className="mt-2.5 flex gap-2">
            <button
              type="button"
              onClick={clearCanvas}
              className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-xs font-medium text-zinc-600 transition-all hover:bg-zinc-50 hover:border-zinc-400"
            >
              <Eraser size={12} /> Effacer
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={!canConfirm}
              className={`inline-flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2 text-xs font-bold text-white transition-all ${
                canConfirm
                  ? 'bg-emerald-500 hover:bg-emerald-600 shadow-sm hover:shadow-md active:scale-95'
                  : 'cursor-not-allowed bg-zinc-300 text-zinc-400'
              }`}
            >
              {confirmLoading ? (
                <><RefreshCw size={12} className="animate-spin" /> Traitement…</>
              ) : (
                <><CheckCircle size={12} /> Confirmer la signature</>
              )}
            </button>
          </div>
          {!canvasData && nom.trim() && (
            <p className="mt-1.5 text-[10px] text-amber-600">
              ⚠️ Tracez votre signature dans le cadre avant de confirmer
            </p>
          )}
        </div>
      )}

      {/* ── Clavier (Électronique) ── */}
      {!confirmed && mode === 'clavier' && (
        <div className="space-y-3">
          <div className="rounded-xl border border-blue-200 bg-blue-50/60 p-4">
            <p className="text-xs font-bold text-blue-800 mb-1.5">⌨️ Signature électronique certifiée</p>
            <p className="text-xs text-blue-700 leading-relaxed">
              En cochant la case ci-dessous, vous certifiez avoir vérifié et approuvé les données de
              la clôture. Une empreinte cryptographique (SHA-256) horodatée sera générée et archivée.
            </p>
          </div>
          <label className="flex cursor-pointer items-start gap-3 rounded-xl border-2 border-zinc-200 bg-white p-4 transition-all hover:border-blue-300 hover:bg-blue-50/30">
            <input
              type="checkbox"
              checked={kbChecked}
              onChange={(e) => setKbChecked(e.target.checked)}
              className="mt-0.5 h-4 w-4 cursor-pointer rounded border-zinc-300 accent-blue-600"
            />
            <span className="text-sm text-zinc-700 leading-snug">
              Je certifie que les informations de la clôture du{' '}
              <strong>{dayjs().format('DD MMMM YYYY')}</strong> sont exactes et conformes,
              et j&apos;engage ma responsabilité en tant que responsable signataire.
            </span>
          </label>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={!canConfirm}
            className={`w-full rounded-xl px-4 py-3 text-sm font-bold transition-all ${
              canConfirm
                ? 'bg-blue-600 text-white hover:bg-blue-700 shadow-sm hover:shadow active:scale-[0.98]'
                : 'cursor-not-allowed bg-zinc-200 text-zinc-400'
            }`}
          >
            {confirmLoading ? (
              <span className="flex items-center justify-center gap-2">
                <RefreshCw size={14} className="animate-spin" /> Génération du certificat…
              </span>
            ) : (
              '✅ Valider électroniquement'
            )}
          </button>
        </div>
      )}

      {/* ── Confirmed banner ── */}
      {confirmed && record && (
        <div className="rounded-xl border-2 border-emerald-300 bg-gradient-to-br from-emerald-50 to-white p-4 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-100">
                <CheckCircle size={18} className="text-emerald-600" />
              </div>
              <div>
                <p className="font-bold text-emerald-800">
                  ✅ Signature confirmée — {record.nom}
                </p>
                <p className="text-xs text-emerald-600 mt-0.5">
                  {dayjs(record.timestamp).format('DD/MM/YYYY [à] HH:mm:ss')}
                  <span className="ml-2 rounded-full bg-emerald-100 px-2 py-0.5 font-medium text-emerald-700">
                    {SIGNATURE_MODE_LABELS[record.type]}
                  </span>
                </p>
                <p className="mt-1 font-mono text-[10px] text-emerald-400">
                  🔒 {record.hash.slice(0, 14)}…{record.hash.slice(-8)}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleCancel}
              title="Annuler et re-signer"
              className="flex shrink-0 items-center gap-1 rounded-lg border border-zinc-200 px-2.5 py-1.5 text-xs text-zinc-500 transition-all hover:bg-zinc-50 hover:border-zinc-300"
            >
              <X size={12} /> Annuler
            </button>
          </div>
          {record.image && (
            <div className="mt-3 rounded-lg border border-emerald-100 bg-white p-2 shadow-inner">
              <img
                src={record.image}
                alt="Signature manuscrite"
                className="mx-auto max-h-[72px] w-full object-contain"
              />
            </div>
          )}
          <p className="mt-3 text-center text-xs font-medium text-emerald-600">
            Cliquez sur <strong>Valider &amp; Signer</strong> pour finaliser la clôture
          </p>
        </div>
      )}

      {/* ── Hint when ready to start ── */}
      {!confirmed && !nom.trim() && (
        <p className="text-center text-[11px] text-zinc-400">
          Renseignez le nom du responsable pour activer la signature
        </p>
      )}
    </div>
  );
}
