import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: React.ReactNode;
  headerClass?: string;
  maxWidth?: string;
  footer?: React.ReactNode;
  children: React.ReactNode;
}

export function Modal({
  open,
  onClose,
  title,
  headerClass = 'bg-zinc-800',
  maxWidth = 'max-w-lg',
  footer,
  children,
}: ModalProps) {
  const [rendered, setRendered] = useState(open);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (open) {
      setRendered(true);
      const t = setTimeout(() => setVisible(true), 10);
      return () => clearTimeout(t);
    } else {
      setVisible(false);
      const t = setTimeout(() => setRendered(false), 300);
      return () => clearTimeout(t);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!rendered) return null;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      className={`fixed inset-0 z-50 flex items-center justify-center p-4 transition-all duration-300 ${
        visible ? 'bg-black/30 backdrop-blur-sm' : 'bg-black/0 backdrop-blur-none'
      }`}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className={`w-full ${maxWidth} rounded-2xl bg-white shadow-2xl transition-all duration-300 ease-out ${
          visible
            ? 'translate-y-0 scale-100 opacity-100'
            : 'translate-y-4 scale-95 opacity-0'
        }`}
      >
        {/* Header */}
        <div className={`flex items-center justify-between rounded-t-2xl px-6 py-4 ${headerClass}`}>
          <div className="flex items-center gap-2.5">
            {typeof title === 'string' ? (
              <h2 className="text-base font-bold text-white">{title}</h2>
            ) : (
              title
            )}
          </div>
          <button
            onClick={onClose}
            className="rounded p-0.5 text-white/70 transition-colors hover:text-white"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5">{children}</div>

        {/* Footer */}
        {footer && (
          <div className="flex justify-end gap-2 border-t border-zinc-100 px-6 py-4">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
