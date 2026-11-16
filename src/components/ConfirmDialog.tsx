import React, { useEffect } from 'react';
import { AlertTriangle, X } from 'lucide-react';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'primary';
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'danger',
  loading = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !loading) onCancel();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, loading, onCancel]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center bg-[var(--eb-primary)]/60 backdrop-blur-[2px] p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
    >
      <div className="w-full max-w-md rounded-[16px] bg-[var(--eb-surface)] border border-[var(--eb-border)] shadow-xl overflow-hidden transition-colors">
        <div className="flex items-start justify-between gap-3 px-5 pt-5 pb-3">
          <div className="flex items-center gap-3">
            <div
              className={`w-10 h-10 rounded-[12px] flex items-center justify-center shrink-0 ${
                variant === 'danger'
                  ? 'bg-red-50 dark:bg-red-950/50 text-[#DC2626]'
                  : 'bg-[var(--eb-accent-light)] text-[var(--eb-accent-text)] border border-[var(--eb-accent-border)]'
              }`}
            >
              <AlertTriangle className="w-5 h-5" />
            </div>
            <h3
              id="confirm-dialog-title"
              className="text-[18px] font-semibold text-[var(--eb-text)]"
            >
              {title}
            </h3>
          </div>
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="text-[var(--eb-text-muted)] hover:text-[var(--eb-text)] p-1 rounded-[8px] transition-colors"
            aria-label="Close dialog"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-5 pb-5">
          <p className="text-[14px] font-normal text-[var(--eb-text-muted)] leading-relaxed pl-[52px]">
            {description}
          </p>

          <div className="mt-6 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onCancel}
              disabled={loading}
              className="px-4 py-2 text-[14px] font-medium rounded-[10px] bg-[var(--eb-btn-secondary-bg)] hover:bg-[var(--eb-border)] text-[var(--eb-btn-secondary-text)] border border-[var(--eb-btn-secondary-border)] transition-colors whitespace-nowrap shrink-0"
            >
              {cancelLabel}
            </button>
            <button
              type="button"
              onClick={onConfirm}
              disabled={loading}
              className={`px-4 py-2 text-[14px] font-medium rounded-[10px] text-white transition-colors whitespace-nowrap shrink-0 shadow-sm disabled:opacity-60 ${
                variant === 'danger'
                  ? 'bg-rose-600 hover:bg-rose-700'
                  : 'bg-[var(--eb-accent)] hover:bg-[var(--eb-accent-hover)]'
              }`}
            >
              {loading ? 'Processing...' : confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
