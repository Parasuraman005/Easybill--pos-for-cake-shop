import React, { createContext, useCallback, useContext, useState } from 'react';
import { CheckCircle2, AlertCircle, AlertTriangle, Info, X } from 'lucide-react';

export type ToastVariant = 'success' | 'warning' | 'error' | 'info';

interface ToastItem {
  id: string;
  title: string;
  message?: string;
  variant: ToastVariant;
}

interface ToastContextValue {
  showToast: (title: string, variant?: ToastVariant, message?: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback(
    (title: string, variant: ToastVariant = 'info', message?: string) => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      setToasts((prev) => [...prev, { id, title, message, variant }]);
      setTimeout(() => {
        dismiss(id);
      }, 4200);
    },
    [dismiss]
  );

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div
        aria-live="polite"
        className="fixed top-14 inset-x-3 sm:left-auto sm:right-4 z-[100] flex flex-col gap-2 sm:max-w-sm sm:w-full pointer-events-none"
      >
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`pointer-events-auto flex items-start gap-3 rounded-[12px] border p-3.5 shadow-md transition-all duration-200 bg-[var(--eb-surface)] text-[var(--eb-text)] ${
              toast.variant === 'success'
                ? 'border-emerald-200 dark:border-emerald-800/60'
                : toast.variant === 'warning'
                ? 'border-amber-200 dark:border-amber-800/60'
                : toast.variant === 'error'
                ? 'border-red-200 dark:border-red-800/60'
                : 'border-[var(--eb-accent-border)]'
            }`}
          >
            <div className="shrink-0 mt-0.5">
              {toast.variant === 'success' && (
                <CheckCircle2 className="w-5 h-5 text-[#16A34A]" />
              )}
              {toast.variant === 'warning' && (
                <AlertTriangle className="w-5 h-5 text-[#F59E0B]" />
              )}
              {toast.variant === 'error' && (
                <AlertCircle className="w-5 h-5 text-[#DC2626]" />
              )}
              {toast.variant === 'info' && (
                <Info className="w-5 h-5 text-[var(--eb-accent)]" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[14px] font-semibold leading-snug">{toast.title}</p>
              {toast.message && (
                <p className="text-[13px] font-normal text-[var(--eb-text-muted)] mt-0.5 leading-relaxed">
                  {toast.message}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={() => dismiss(toast.id)}
              className="shrink-0 text-[var(--eb-text-muted)] hover:text-[var(--eb-text)] p-0.5 rounded-[8px]"
              aria-label="Dismiss notification"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}
