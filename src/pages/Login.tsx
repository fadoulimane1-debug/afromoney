import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LogIn, Zap } from 'lucide-react';
import { Logo } from '@/components/Logo';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { UTILISATEURS_TEST } from '@/lib/constants';
import { setCurrentUser } from '@/lib/storage';
import type { User } from '@/types';

interface FormErrors {
  email?: string;
  password?: string;
  general?: string;
}

function validate(email: string, password: string): FormErrors {
  const errors: FormErrors = {};
  if (!email.includes('@')) errors.email = 'Adresse email invalide';
  if (password.length < 6) errors.password = 'Mot de passe minimum 6 caractères';
  return errors;
}

function loginAs(email: string, navigate: ReturnType<typeof useNavigate>) {
  const found = UTILISATEURS_TEST.find((u) => u.email === email);
  if (!found) return;
  const user: User = { ...found, dateCreation: new Date() };
  setCurrentUser(user);
  navigate('/');
}

export function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<FormErrors>({});
  const [loading, setLoading] = useState(false);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const errs = validate(email, password);
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }
    setErrors({});
    setLoading(true);

    // Simule un court délai réseau
    setTimeout(() => {
      const found = UTILISATEURS_TEST.find((u) => u.email === email);
      if (!found) {
        setErrors({ general: 'Email ou mot de passe incorrect' });
        setLoading(false);
        return;
      }
      const user: User = { ...found, dateCreation: new Date() };
      setCurrentUser(user);
      navigate('/');
    }, 400);
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-gradient-to-b from-zinc-50 to-zinc-100 px-4">
      {/* Glow background */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute left-1/2 top-1/3 h-96 w-96 -translate-x-1/2 -translate-y-1/2 rounded-full bg-blue-400/20 blur-3xl" />
      </div>

      <div className="relative w-full max-w-sm space-y-4">
        {/* Logo */}
        <div className="text-center">
          <Logo size="lg" className="mx-auto mb-3 drop-shadow-md" />
          <h1 className="text-2xl font-bold text-zinc-900">AFROMONEY</h1>
          <p className="mt-1 text-sm text-zinc-600">Office de change — interface alignée AFROMONEY V8</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Connexion</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4" noValidate>
              {/* Erreur générale */}
              {errors.general && (
                <div className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-400">
                  {errors.general}
                </div>
              )}

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-zinc-600">Email</label>
                <Input
                  type="email"
                  placeholder="vous@afromoney.com"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    setErrors((prev) => ({ ...prev, email: undefined, general: undefined }));
                  }}
                  className={errors.email ? 'border-red-500 focus-visible:ring-red-500' : ''}
                  autoComplete="email"
                />
                {errors.email && <p className="text-xs text-red-400">{errors.email}</p>}
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-zinc-600">Mot de passe</label>
                <Input
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setErrors((prev) => ({ ...prev, password: undefined, general: undefined }));
                  }}
                  className={errors.password ? 'border-red-500 focus-visible:ring-red-500' : ''}
                  autoComplete="current-password"
                />
                {errors.password && <p className="text-xs text-red-400">{errors.password}</p>}
              </div>

              <Button
                type="submit"
                className="w-full bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600"
                disabled={loading}
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 100 16v-4l-3 3 3 3v-4a8 8 0 01-8-8z" />
                    </svg>
                    Connexion…
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <LogIn size={15} />
                    Se connecter
                  </span>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Accès rapide */}
        <Card>
          <CardContent className="pt-4">
            <div className="mb-3 flex items-center gap-2">
              <Zap size={13} className="text-yellow-400" />
              <span className="text-xs font-medium text-zinc-600">Accès rapide (démo)</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => loginAs('admin@afromoney.com', navigate)}
                className="flex flex-col rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2.5 text-left transition-colors hover:border-blue-300 hover:bg-blue-50"
              >
                <span className="text-xs font-semibold text-zinc-900">Admin</span>
                <span className="mt-0.5 text-[10px] text-zinc-500">admin@afromoney.com</span>
              </button>
              <button
                type="button"
                onClick={() => loginAs('employee@afromoney.com', navigate)}
                className="flex flex-col rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2.5 text-left transition-colors hover:border-blue-300 hover:bg-blue-50"
              >
                <span className="text-xs font-semibold text-zinc-900">Employee</span>
                <span className="mt-0.5 text-[10px] text-zinc-500">employee@afromoney.com</span>
              </button>
            </div>
          </CardContent>
        </Card>

        <p className="text-center text-xs text-zinc-600">
          Mot de passe de démo : n'importe quoi ≥ 6 caractères
        </p>
      </div>
    </div>
  );
}
