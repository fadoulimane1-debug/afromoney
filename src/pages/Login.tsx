import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { LogIn, Eye, EyeOff, CheckCircle2, ShieldCheck } from 'lucide-react';
import { Logo } from '@/components/Logo';
import { useAuthContext } from '@/context/AuthContext';

interface FormErrors {
  email?: string;
  password?: string;
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
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [showPwd, setShowPwd]   = useState(false);
  const [errors, setErrors]     = useState<FormErrors>({});
  const [loading, setLoading]   = useState(false);
  const [success, setSuccess]   = useState(false);

  useEffect(() => {
    if (isAuthenticated) navigate('/', { replace: true });
  }, [isAuthenticated, navigate]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const errs = validate(email, password);
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }
    setErrors({});
    setLoading(true);
    await new Promise((r) => setTimeout(r, 600));
    const result = await login(email, password);
    if (!result.ok) {
      setErrors({ general: result.error });
      setLoading(false);
      return;
    }
    setLoading(false);
    setSuccess(true);
    await new Promise((r) => setTimeout(r, 900));
    navigate('/', { replace: true });
  }

  function fillDemo(acc: (typeof DEMO_ACCOUNTS)[number]) {
    setEmail(acc.email);
    setPassword(acc.password);
    setErrors({});
  }

  return (
    <div className="login-bg relative flex min-h-screen items-center justify-center px-4 py-8 overflow-hidden">

      {/* Animated orbs */}
      <div
        className="pointer-events-none absolute rounded-full blur-[120px]"
        style={{
          width: 600, height: 600,
          background: 'rgba(196,30,58,0.28)',
          top: '-10%', left: '-15%',
          animation: 'orbFloat1 18s ease-in-out infinite',
        }}
      />
      <div
        className="pointer-events-none absolute rounded-full blur-[120px]"
        style={{
          width: 500, height: 500,
          background: 'rgba(45,80,22,0.32)',
          bottom: '-12%', right: '-10%',
          animation: 'orbFloat2 22s ease-in-out infinite',
        }}
      />
      <div
        className="pointer-events-none absolute rounded-full blur-[80px]"
        style={{
          width: 280, height: 280,
          background: 'rgba(212,175,55,0.22)',
          top: '35%', right: '20%',
          animation: 'orbFloat3 14s ease-in-out infinite',
        }}
      />

      {/* Grid overlay */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage:
            'linear-gradient(rgba(255,255,255,0.025) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.025) 1px, transparent 1px)',
          backgroundSize: '48px 48px',
        }}
      />

      {/* Card */}
      <div
        className="relative w-full max-w-sm"
        style={{ animation: 'slideUpFade 0.55s cubic-bezier(0.16,1,0.3,1) both' }}
      >
        {/* Glow ring behind card */}
        <div
          className="absolute -inset-px rounded-[24px]"
          style={{ background: 'linear-gradient(135deg, rgba(196,30,58,0.5), rgba(212,175,55,0.4), rgba(45,80,22,0.5))', filter: 'blur(1px)' }}
        />

        <div
          className="relative rounded-[22px] border border-white/[0.1] shadow-[0_32px_80px_rgba(0,0,0,0.6)]"
          style={{ background: 'rgba(8,13,28,0.88)', backdropFilter: 'blur(32px) saturate(180%)' }}
        >
          {/* Header */}
          <div className="flex flex-col items-center px-8 pt-8 pb-6">
            <div
              className="mb-4 rounded-2xl p-1"
              style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}
            >
              <Logo size="md" className="drop-shadow-xl" />
            </div>
            <h1
              className="text-2xl font-bold tracking-tight text-white"
              style={{ fontFamily: 'Outfit, Inter, sans-serif', animation: 'fadeInDown 0.5s ease 0.1s both' }}
            >
              AFROMONEY
            </h1>
            <p
              className="mt-1 text-center text-[12px] text-white/45"
              style={{ animation: 'fadeInDown 0.5s ease 0.18s both' }}
            >
              Bureau de change · Interface sécurisée
            </p>
          </div>

          {/* Divider */}
          <div className="mx-8 h-px" style={{ background: 'linear-gradient(90deg, transparent, rgba(212,175,55,0.4), transparent)' }} />

          {/* Form */}
          {success ? (
            <div
              className="flex flex-col items-center px-8 py-10"
              style={{ animation: 'slideUpFade 0.4s ease both' }}
            >
              <CheckCircle2 size={52} className="text-emerald-400 drop-shadow-[0_0_16px_rgba(52,211,153,0.6)]" />
              <p className="mt-4 text-base font-semibold text-white">Connexion réussie</p>
              <p className="mt-1 text-xs text-white/50">Redirection en cours…</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5 px-8 pt-6 pb-7" noValidate>

              {errors.general && (
                <div
                  className="rounded-xl border border-red-500/25 px-4 py-3 text-sm text-red-400"
                  style={{ background: 'rgba(196,30,58,0.1)', animation: 'slideUpFade 0.3s ease both' }}
                >
                  {errors.general}
                </div>
              )}

              {/* Email */}
              <div className="space-y-2">
                <label className="block text-xs font-medium text-white/60">Adresse email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); setErrors((p) => ({ ...p, email: undefined, general: undefined })); }}
                  placeholder="vous@afromoney.ma"
                  autoComplete="email"
                  className="login-input w-full"
                  style={errors.email ? { borderColor: 'rgba(196,30,58,0.6)' } : {}}
                />
                {errors.email && <p className="text-[11px] text-red-400">{errors.email}</p>}
              </div>

              {/* Password */}
              <div className="space-y-2">
                <label className="block text-xs font-medium text-white/60">Mot de passe</label>
                <div className="relative">
                  <input
                    type={showPwd ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => { setPassword(e.target.value); setErrors((p) => ({ ...p, password: undefined, general: undefined })); }}
                    placeholder="••••••••"
                    autoComplete="current-password"
                    className="login-input w-full pr-10"
                    style={errors.password ? { borderColor: 'rgba(196,30,58,0.6)' } : {}}
                  />
                  <button
                    type="button"
                    tabIndex={-1}
                    onClick={() => setShowPwd((s) => !s)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-white/35 transition-colors hover:text-white/70"
                  >
                    {showPwd ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
                {errors.password && <p className="text-[11px] text-red-400">{errors.password}</p>}
              </div>

              {/* Submit */}
              <button
                type="submit"
                disabled={loading}
                className="login-btn w-full"
              >
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
                    <LogIn size={15} />
                    Se connecter
                  </span>
                )}
              </button>
            </form>
          )}

          {/* Demo accounts */}
          {!success && (
            <div className="px-8 pb-8">
              <div className="mb-3 flex items-center gap-2">
                <div className="h-px flex-1" style={{ background: 'rgba(255,255,255,0.08)' }} />
                <span className="text-[11px] font-medium text-white/30">accès démo</span>
                <div className="h-px flex-1" style={{ background: 'rgba(255,255,255,0.08)' }} />
              </div>
              <div className="grid grid-cols-2 gap-2.5">
                {DEMO_ACCOUNTS.map((acc) => (
                  <button
                    key={acc.email}
                    type="button"
                    onClick={() => fillDemo(acc)}
                    className="login-demo-btn flex items-center gap-2.5 rounded-xl border border-white/[0.08] px-3 py-2.5 text-left transition-all hover:border-white/20"
                    style={{ background: 'rgba(255,255,255,0.04)' }}
                  >
                    <div
                      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[10px] font-bold text-white"
                      style={{ background: `${acc.color}33`, border: `1px solid ${acc.color}55` }}
                    >
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

          {/* Footer */}
          <div
            className="rounded-b-[22px] border-t border-white/[0.06] px-8 py-3 text-center"
            style={{ background: 'rgba(255,255,255,0.02)' }}
          >
            <div className="flex items-center justify-center gap-1.5 text-[10px] text-white/25">
              <ShieldCheck size={11} />
              <span>Session chiffrée · Données locales sécurisées</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
