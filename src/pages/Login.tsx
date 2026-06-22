import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { LogIn, Eye, EyeOff, CheckCircle2, ShieldCheck, MessageSquare, RotateCcw } from 'lucide-react';
import { Logo } from '@/components/Logo';
import { useAuthContext } from '@/context/AuthContext';
// @ts-ignore
import emailjs from '@emailjs/browser';
const EMAILJS_SERVICE_ID  = 'service_r7hqb0a';
const EMAILJS_TEMPLATE_ID = 'template_1eagmoq';
const EMAILJS_PUBLIC_KEY  = '3EADglSyrabvBHuvW';

// ── Mapping email app → email réel ──
const USER_REAL_EMAILS: Record<string, string> = {
  'admin@afromoney.ma': 'abdelzaim4@gmail.com',
};

// ── OTP en mémoire (TTL 5 min) ──
let otpStore: { code: string; expiry: number; email: string } | null = null;

function generateOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function maskEmail(email: string): string {
  const [user, domain] = email.split('@');
  return user.slice(0, 2) + '***@' + domain;
}

interface FormErrors {
  email?: string;
  password?: string;
  otp?: string;
  general?: string;
}

const DEMO_ACCOUNTS = [
  {
    label: 'Admin',
    sublabel: 'admin@afromoney.ma',
    email: 'admin@afromoney.ma',
    password: 'Admin2026!',
    color: '#D4AF37',
    initials: 'AD',
  },
  {
    label: 'Caissier',
    sublabel: 'caissier1@afromoney.ma',
    email: 'caissier1@afromoney.ma',
    password: 'Test2026!',
    color: '#C41E3A',
    initials: 'CA',
  },
] as const;

function validate(email: string, password: string): FormErrors {
  const errors: FormErrors = {};
  if (!email.trim()) errors.email = 'Email requis';
  else if (!email.includes('@')) errors.email = 'Adresse email invalide';
  if (!password) errors.password = 'Mot de passe requis';
  else if (password.length < 6) errors.password = 'Minimum 6 caractères';
  return errors;
}

export function Login() {
  const navigate = useNavigate();
  const { login, isAuthenticated } = useAuthContext();

  const [step, setStep]           = useState<'credentials' | 'otp'>('credentials');
  const [email, setEmail]         = useState('');
  const [password, setPassword]   = useState('');
  const [showPwd, setShowPwd]     = useState(false);
  const [otpCode, setOtpCode]     = useState('');
  const [errors, setErrors]       = useState<FormErrors>({});
  const [loading, setLoading]     = useState(false);
  const [success, setSuccess]     = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [maskedEmail, setMaskedEmail] = useState('');

  useEffect(() => {
    if (isAuthenticated) navigate('/', { replace: true });
  }, [isAuthenticated, navigate]);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const t = setTimeout(() => setResendCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [resendCooldown]);

  async function sendOTP(userEmail: string): Promise<boolean> {
    const realEmail = USER_REAL_EMAILS[userEmail.toLowerCase()];
    if (!realEmail) return false;

    const code = generateOTP();
    otpStore = { code, expiry: Date.now() + 5 * 60 * 1000, email: userEmail };

    try {
      await emailjs.send(
        EMAILJS_SERVICE_ID,
        EMAILJS_TEMPLATE_ID,
        {
          to_email: realEmail,
          otp_code: code,
        },
        EMAILJS_PUBLIC_KEY,
      );
      setMaskedEmail(maskEmail(realEmail));
      return true;
    } catch {
      otpStore = null;
      return false;
    }
  }

  // Étape 1 : credentials → envoyer OTP
  async function handleCredentials(e: React.FormEvent) {
    e.preventDefault();
    const errs = validate(email, password);
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }
    setErrors({});
    setLoading(true);

    const result = await login(email, password);
    if (!result.ok) {
      setErrors({ general: result.error });
      setLoading(false);
      return;
    }

    const sent = await sendOTP(email);
    if (!sent) {
      setErrors({ general: 'Impossible d\'envoyer le code. Vérifiez votre connexion.' });
      setLoading(false);
      return;
    }

    setStep('otp');
    setResendCooldown(60);
    setLoading(false);
  }

  // Étape 2 : vérifier OTP
  async function handleOTP(e: React.FormEvent) {
    e.preventDefault();
    if (otpCode.length !== 6) { setErrors({ otp: 'Code à 6 chiffres requis' }); return; }
    setErrors({});
    setLoading(true);

    if (!otpStore) {
      setErrors({ otp: 'Aucun code envoyé — renvoyez un code' });
      setLoading(false);
      return;
    }
    if (Date.now() > otpStore.expiry) {
      otpStore = null;
      setErrors({ otp: 'Code expiré — renvoyez un nouveau code' });
      setLoading(false);
      return;
    }
    if (otpStore.code !== otpCode.trim()) {
      setErrors({ otp: 'Code incorrect' });
      setLoading(false);
      return;
    }

    otpStore = null;
    setSuccess(true);
    await new Promise((r) => setTimeout(r, 900));
    navigate('/', { replace: true });
  }

  async function handleResend() {
    if (resendCooldown > 0) return;
    setOtpCode('');
    setErrors({});
    setLoading(true);
    const sent = await sendOTP(email);
    if (!sent) setErrors({ general: 'Impossible d\'envoyer le code.' });
    else setResendCooldown(60);
    setLoading(false);
  }

  function fillDemo(acc: (typeof DEMO_ACCOUNTS)[number]) {
    setEmail(acc.email);
    setPassword(acc.password);
    setErrors({});
  }

  return (
    <div className="login-bg relative flex min-h-screen items-center justify-center px-4 py-8 overflow-hidden">

      <div className="pointer-events-none absolute rounded-full blur-[120px]"
        style={{ width: 600, height: 600, background: 'rgba(196,30,58,0.28)', top: '-10%', left: '-15%', animation: 'orbFloat1 18s ease-in-out infinite' }} />
      <div className="pointer-events-none absolute rounded-full blur-[120px]"
        style={{ width: 500, height: 500, background: 'rgba(45,80,22,0.32)', bottom: '-12%', right: '-10%', animation: 'orbFloat2 22s ease-in-out infinite' }} />
      <div className="pointer-events-none absolute rounded-full blur-[80px]"
        style={{ width: 280, height: 280, background: 'rgba(212,175,55,0.22)', top: '35%', right: '20%', animation: 'orbFloat3 14s ease-in-out infinite' }} />

      <div className="pointer-events-none absolute inset-0"
        style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,0.025) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.025) 1px, transparent 1px)', backgroundSize: '48px 48px' }} />

      <div className="relative w-full max-w-sm" style={{ animation: 'slideUpFade 0.55s cubic-bezier(0.16,1,0.3,1) both' }}>
        <div className="absolute -inset-px rounded-[24px]"
          style={{ background: 'linear-gradient(135deg, rgba(196,30,58,0.5), rgba(212,175,55,0.4), rgba(45,80,22,0.5))', filter: 'blur(1px)' }} />

        <div className="relative rounded-[22px] border border-white/[0.1] shadow-[0_32px_80px_rgba(0,0,0,0.6)]"
          style={{ background: 'rgba(8,13,28,0.88)', backdropFilter: 'blur(32px) saturate(180%)' }}>

          {/* Header */}
          <div className="flex flex-col items-center px-8 pt-8 pb-6">
            <div className="mb-4 rounded-2xl p-1" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}>
              <Logo size="md" className="drop-shadow-xl" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-white" style={{ fontFamily: 'Outfit, Inter, sans-serif' }}>
              AFROMONEY
            </h1>
            <p className="mt-1 text-center text-[12px] text-white/45">
              {step === 'otp' ? 'Vérification par email' : 'Bureau de change · Interface sécurisée'}
            </p>
          </div>

          <div className="mx-8 h-px" style={{ background: 'linear-gradient(90deg, transparent, rgba(212,175,55,0.4), transparent)' }} />

          {/* ── SUCCÈS ── */}
          {success ? (
            <div className="flex flex-col items-center px-8 py-10" style={{ animation: 'slideUpFade 0.4s ease both' }}>
              <CheckCircle2 size={52} className="text-emerald-400 drop-shadow-[0_0_16px_rgba(52,211,153,0.6)]" />
              <p className="mt-4 text-base font-semibold text-white">Connexion réussie</p>
              <p className="mt-1 text-xs text-white/50">Redirection en cours…</p>
            </div>

          /* ── ÉTAPE OTP ── */
          ) : step === 'otp' ? (
            <form onSubmit={handleOTP} className="space-y-5 px-8 pt-6 pb-7" noValidate>
              <div className="flex flex-col items-center gap-2 pb-1">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl"
                  style={{ background: 'rgba(212,175,55,0.12)', border: '1px solid rgba(212,175,55,0.3)' }}>
                  <MessageSquare size={22} style={{ color: '#D4AF37' }} />
                </div>
                <p className="text-center text-[12px] text-white/50 leading-relaxed">
                  Code envoyé à<br />
                  <span className="font-semibold text-white/75">{maskedEmail}</span>
                </p>
              </div>

              {errors.general && (
                <div className="rounded-xl border border-red-500/25 px-4 py-3 text-sm text-red-400"
                  style={{ background: 'rgba(196,30,58,0.1)' }}>
                  {errors.general}
                </div>
              )}

              <div className="space-y-2">
                <label className="block text-xs font-medium text-white/60">Code à 6 chiffres</label>
                <input
                  type="text" inputMode="numeric" pattern="[0-9]*" maxLength={6}
                  value={otpCode}
                  onChange={(e) => { setOtpCode(e.target.value.replace(/\D/g, '')); setErrors({}); }}
                  placeholder="• • • • • •"
                  autoFocus
                  className="login-input w-full text-center text-2xl tracking-[0.5em] font-bold"
                  style={errors.otp ? { borderColor: 'rgba(196,30,58,0.6)' } : {}}
                />
                {errors.otp && <p className="text-[11px] text-red-400">{errors.otp}</p>}
              </div>

              <button type="submit" disabled={loading} className="login-btn w-full">
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-20" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                      <path className="opacity-80" fill="currentColor" d="M4 12a8 8 0 018-8v2a6 6 0 100 12v2a8 8 0 01-8-8z" />
                    </svg>
                    Vérification…
                  </span>
                ) : (
                  <span className="flex items-center justify-center gap-2">
                    <ShieldCheck size={15} /> Valider le code
                  </span>
                )}
              </button>

              <div className="flex items-center justify-between pt-1">
                <button type="button" onClick={() => { setStep('credentials'); setOtpCode(''); setErrors({}); }}
                  className="text-[11px] text-white/30 hover:text-white/60 transition-colors">
                  ← Retour
                </button>
                <button type="button" onClick={handleResend} disabled={resendCooldown > 0}
                  className="flex items-center gap-1.5 text-[11px] transition-colors"
                  style={{ color: resendCooldown > 0 ? 'rgba(255,255,255,0.25)' : 'rgba(212,175,55,0.8)' }}>
                  <RotateCcw size={11} />
                  {resendCooldown > 0 ? `Renvoyer (${resendCooldown}s)` : 'Renvoyer le code'}
                </button>
              </div>
            </form>

          /* ── ÉTAPE CREDENTIALS ── */
          ) : (
            <form onSubmit={handleCredentials} className="space-y-5 px-8 pt-6 pb-7" noValidate>
              {errors.general && (
                <div className="rounded-xl border border-red-500/25 px-4 py-3 text-sm text-red-400"
                  style={{ background: 'rgba(196,30,58,0.1)' }}>
                  {errors.general}
                </div>
              )}

              <div className="space-y-2">
                <label className="block text-xs font-medium text-white/60">Adresse email</label>
                <input type="email" value={email}
                  onChange={(e) => { setEmail(e.target.value); setErrors((p) => ({ ...p, email: undefined, general: undefined })); }}
                  placeholder="vous@afromoney.ma" autoComplete="email" className="login-input w-full"
                  style={errors.email ? { borderColor: 'rgba(196,30,58,0.6)' } : {}} />
                {errors.email && <p className="text-[11px] text-red-400">{errors.email}</p>}
              </div>

              <div className="space-y-2">
                <label className="block text-xs font-medium text-white/60">Mot de passe</label>
                <div className="relative">
                  <input type={showPwd ? 'text' : 'password'} value={password}
                    onChange={(e) => { setPassword(e.target.value); setErrors((p) => ({ ...p, password: undefined, general: undefined })); }}
                    placeholder="••••••••" autoComplete="current-password" className="login-input w-full pr-10"
                    style={errors.password ? { borderColor: 'rgba(196,30,58,0.6)' } : {}} />
                  <button type="button" tabIndex={-1} onClick={() => setShowPwd((s) => !s)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-white/35 hover:text-white/70">
                    {showPwd ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
                {errors.password && <p className="text-[11px] text-red-400">{errors.password}</p>}
              </div>

              <button type="submit" disabled={loading} className="login-btn w-full">
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-20" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                      <path className="opacity-80" fill="currentColor" d="M4 12a8 8 0 018-8v2a6 6 0 100 12v2a8 8 0 01-8-8z" />
                    </svg>
                    Vérification…
                  </span>
                ) : (
                  <span className="flex items-center justify-center gap-2">
                    <LogIn size={15} /> Se connecter
                  </span>
                )}
              </button>
            </form>
          )}

          {/* Demo accounts */}
          {!success && step === 'credentials' && (
            <div className="px-8 pb-8">
              <div className="mb-3 flex items-center gap-2">
                <div className="h-px flex-1" style={{ background: 'rgba(255,255,255,0.08)' }} />
                <span className="text-[11px] font-medium text-white/30">accès démo</span>
                <div className="h-px flex-1" style={{ background: 'rgba(255,255,255,0.08)' }} />
              </div>
              <div className="grid grid-cols-2 gap-2.5">
                {DEMO_ACCOUNTS.map((acc) => (
                  <button key={acc.email} type="button" onClick={() => fillDemo(acc)}
                    className="login-demo-btn flex items-center gap-2.5 rounded-xl border border-white/[0.08] px-3 py-2.5 text-left transition-all hover:border-white/20"
                    style={{ background: 'rgba(255,255,255,0.04)' }}>
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[10px] font-bold text-white"
                      style={{ background: `${acc.color}33`, border: `1px solid ${acc.color}55` }}>
                      {acc.initials}
                    </div>
                    <div className="min-w-0">
                      <p className="text-[12px] font-semibold leading-none text-white/90">{acc.label}</p>
                      <p className="mt-0.5 truncate text-[9px] text-white/35">{acc.sublabel}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="rounded-b-[22px] border-t border-white/[0.06] px-8 py-3 text-center"
            style={{ background: 'rgba(255,255,255,0.02)' }}>
            <div className="flex items-center justify-center gap-1.5 text-[10px] text-white/25">
              <ShieldCheck size={11} />
              <span>Session chiffrée · Vérification email activée</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
