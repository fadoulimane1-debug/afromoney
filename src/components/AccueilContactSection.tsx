import { useState } from 'react';

function Field({
  id,
  label,
  required,
  type = 'text',
  value,
  onChange,
  rows,
}: {
  id: string;
  label: string;
  required?: boolean;
  type?: string;
  value: string;
  onChange: (v: string) => void;
  rows?: number;
}) {
  const line =
    'w-full border-0 border-b border-dashed border-white/45 bg-transparent px-0 py-2 text-sm text-white placeholder:text-white/35 focus:border-cyan-300 focus:outline-none focus:ring-0';
  return (
    <div className="space-y-1">
      <label
        htmlFor={id}
        className="text-xs font-medium text-white/95 [text-shadow:0_1px_2px_rgba(0,0,0,0.5)]"
      >
        {label}
        {required ? <span className="text-cyan-300"> *</span> : null}
      </label>
      {rows ? (
        <textarea id={id} rows={rows} value={value} onChange={(e) => onChange(e.target.value)} className={line} />
      ) : (
        <input
          id={id}
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={line}
          autoComplete={type === 'email' ? 'email' : type === 'tel' ? 'tel' : 'organization'}
        />
      )}
    </div>
  );
}

export function AccueilContactSection() {
  const [societe, setSociete] = useState('');
  const [email, setEmail] = useState('');
  const [telephone, setTelephone] = useState('');
  const [message, setMessage] = useState('');
  const [accept, setAccept] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!societe.trim() || !email.trim() || !telephone.trim()) {
      setError('Renseignez société, email et téléphone.');
      return;
    }
    if (!accept) {
      setError('Cochez la case pour accepter les conditions.');
      return;
    }
    setSent(true);
  }

  return (
    <section className="border-t border-white/10 bg-transparent py-8 sm:py-10">
      <div className="mx-auto max-w-md px-4 sm:px-6">
        <h2 className="text-center font-display text-xl font-bold tracking-tight text-white [text-shadow:0_2px_8px_rgba(0,0,0,0.45)]">
          Contact
        </h2>

        <div className="mt-6 rounded-2xl border border-white/20 bg-white/10 p-6 shadow-lg backdrop-blur-md sm:p-7">
          {sent ? (
            <p className="text-center text-sm font-medium text-emerald-200 [text-shadow:0_1px_2px_rgba(0,0,0,0.4)]">
              Message enregistré (démo locale).
            </p>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              <Field id="c-soc" label="Société" required value={societe} onChange={setSociete} />
              <Field id="c-mail" label="Email" required type="email" value={email} onChange={setEmail} />
              <Field id="c-tel" label="Téléphone" required type="tel" value={telephone} onChange={setTelephone} />
              <Field id="c-msg" label="Message" value={message} onChange={setMessage} rows={3} />

              {error ? (
                <p className="text-xs font-medium text-amber-200 [text-shadow:0_1px_2px_rgba(0,0,0,0.5)]" role="alert">
                  {error}
                </p>
              ) : null}

              <button type="submit" className="btn-gradient w-full py-2.5 text-xs sm:text-sm">
                Envoyer
              </button>

              <label className="flex items-start gap-2.5">
                <input
                  type="checkbox"
                  checked={accept}
                  onChange={(e) => setAccept(e.target.checked)}
                  className="mt-0.5 h-3.5 w-3.5 shrink-0 rounded border-white/40 bg-white/15 text-cyan-500 focus:ring-cyan-400/40"
                />
                <span className="text-[10px] leading-snug text-white/85 [text-shadow:0_1px_2px_rgba(0,0,0,0.45)]">
                  J&apos;accepte les conditions et la politique de confidentialité.
                </span>
              </label>
            </form>
          )}
        </div>
      </div>
    </section>
  );
}
