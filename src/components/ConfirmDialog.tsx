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
      className="fixed inset-0 z-[90] flex items-center justify-center bg-[#302A40]/50 backdrop-blur-[2px] p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
    >
      <div className="w-full max-w-md rounded-[14px] bg-white dark:bg-[#1B1726] border border-[#EAE7F0] dark:border-[#2E2842] shadow-[0_12px_36px_rgba(48,42,64,0.16)] overflow-hidden">
        <div className="flex items-start justify-between gap-3 px-5 pt-5 pb-3">
          <div className="flex items-center gap-3">
            <div
              className={`w-10 h-10 rounded-[12px] flex items-center justify-center shrink-0 ${
                variant === 'danger'
                  ? 'bg-red-50 dark:bg-red-950/50 text-red-600 dark:text-red-400'
                  : 'bg-[#E9E2FF] dark:bg-[#7656C9]/20 text-[#7656C9] dark:text-[#C5B3F7]'
              }`}
            >
              <AlertTriangle className="w-5 h-5" />
            </div>
            <h3
              id="confirm-dialog-title"
              className="font-display text-[19px] font-semibold text-[#302A40] dark:text-[#F3F1FA]"
            >
              {title}
            </h3>
          </div>
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="text-[#817A91] hover:text-[#302A40] dark:hover:text-white p-1 rounded-[10px]"
            aria-label="Close dialog"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-5 pb-5">
          <p className="text-sm font-medium text-[#817A91] dark:text-[#A69FB8] leading-relaxed pl-[52px]">
            {description}
          </p>

          <div className="mt-6 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onCancel}
              disabled={loading}
              className="px-4 py-2 text-sm font-semibold rounded-[10px] bg-[#E9E2FF] hover:bg-[#DDD3FF] text-[#4B3194] dark:bg-[#2A233D] dark:text-[#E9E2FF] dark:hover:bg-[#352C4D] transition-colors whitespace-nowrap shrink-0"
            >
              {cancelLabel}
            </button>
            <button
              type="button"
              onClick={onConfirm}
              disabled={loading}
              className={`px-4 py-2 text-sm font-semibold rounded-[10px] text-white transition-colors whitespace-nowrap shrink-0 disabled:opacity-60 ${
                variant === 'danger'
                  ? 'bg-red-600 hover:bg-red-700'
                  : 'bg-[#7656C9] hover:bg-[#6947BB]'
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
