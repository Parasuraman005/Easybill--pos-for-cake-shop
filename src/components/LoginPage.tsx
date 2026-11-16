import React, { useState } from 'react';
import { motion } from 'motion/react';
import { User, Lock, Eye, EyeOff, ArrowRight, AlertCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useSettings } from '../context/SettingsContext';
import { useToast } from '../context/ToastContext';
import { EasyBillLogo } from './EasyBillLogo';

interface LoginPageProps {
  onSuccess: () => void;
}

export function LoginPage({ onSuccess }: LoginPageProps) {
  const { login } = useAuth();
  const { settings, reloadSettings } = useSettings();
  const { showToast } = useToast();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const appName = settings.application.appName || 'Easy Bill';
  const appLogo = settings.application.appLogo;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!username.trim()) {
      setError('Please enter your username.');
      return;
    }
    if (!password) {
      setError('Please enter your password.');
      return;
    }

    setSubmitting(true);
    try {
      const loggedUser = await login(username.trim(), password);
      await reloadSettings();
      showToast(`Welcome back, ${loggedUser.fullName}`, 'success');
      onSuccess();
    } catch (err: any) {
      setError(err?.message || 'Invalid username or password.');
    } finally {
      setSubmitting(false);
    }
  };

  const fillDemo = (u: string, p: string) => {
    setUsername(u);
    setPassword(p);
    setError(null);
  };

  return (
    <div className="relative min-h-screen w-full flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
      {/* Full-Screen Cake Shop Backdrop */}
      <img
        src="/images/login_bakery_bg_1794586327077.jpg"
        alt="Artisan Cake Shop Counter"
        referrerPolicy="no-referrer"
        className="fixed inset-0 w-full h-full object-cover"
      />
      <div className="fixed inset-0 bg-[var(--eb-primary)]/65 backdrop-blur-[3px]" />

      {/* Two-Column Login Card */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
        className="relative z-10 my-2 w-full max-w-4xl grid grid-cols-1 lg:grid-cols-2 rounded-[16px] overflow-hidden bg-[var(--eb-surface)] border border-[var(--eb-border)]/40 shadow-2xl transition-colors"
      >
        {/* Left Section: Application Information */}
        <div className="flex flex-col justify-between p-5 sm:p-8 lg:p-10 bg-[var(--eb-sidebar-bg)] text-white border-b lg:border-b-0 lg:border-r border-[var(--eb-sidebar-border)] transition-colors">
          <div>
            <div className="flex items-center gap-3.5">
              {appLogo ? (
                <img
                  src={appLogo}
                  alt={appName}
                  className="w-12 h-12 rounded-[12px] object-contain bg-white p-1"
                />
              ) : (
                <EasyBillLogo className="w-12 h-12 shrink-0" />
              )}
              <div>
                <h1 className="text-[24px] font-semibold tracking-tight text-white">
                  {appName}
                </h1>
                <p className="text-[13px] font-medium text-[var(--eb-accent)]">
                  {settings.company.name || 'Cake Shop POS'}
                </p>
              </div>
            </div>

            <div className="mt-10">
              <h2 className="text-2xl sm:text-3xl font-bold leading-tight text-white [text-wrap:balance]">
                Smart Billing. Simple Business.
              </h2>
              <p className="mt-3 text-[14px] font-normal text-white/80 leading-relaxed">
                Fast counter checkout, custom cake advance orders, expense ledgers, and thermal receipt printing designed for daily bakery operations.
              </p>
            </div>
          </div>

          <div className="mt-6 sm:mt-10 pt-5 sm:pt-6 border-t border-[var(--eb-sidebar-border)] text-[13px] font-normal text-white/70 flex flex-wrap items-center justify-between gap-2">
            <span>Walk-in POS · Order Ledger · GST Ready</span>
            <span className="text-[var(--eb-accent)] font-medium">Algogenz Solutions</span>
          </div>
        </div>

        {/* Right Section: Login Form */}
        <div className="p-5 sm:p-8 lg:p-10 flex flex-col justify-center bg-[var(--eb-surface)] transition-colors">
          <div>
            <h2 className="text-[20px] font-semibold text-[var(--eb-text)]">
              Sign in to Counter
            </h2>
            <p className="mt-1 text-[14px] font-normal text-[var(--eb-text-muted)]">
              Enter your staff credentials to start billing.
            </p>
          </div>

          {error && (
            <div
              role="alert"
              className="mt-5 flex items-start gap-2.5 rounded-[12px] bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 px-3.5 py-3 text-[13px] font-medium text-[#DC2626] dark:text-red-300"
            >
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <div>
              <label
                htmlFor="login-username"
                className="block text-[12px] font-medium text-[var(--eb-text)] mb-1.5"
              >
                Username
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-[var(--eb-text-muted)] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  id="login-username"
                  type="text"
                  autoComplete="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Enter username"
                  className="w-full h-[42px] pl-10 pr-4 rounded-[10px] border border-[var(--eb-input-border)] bg-[var(--eb-input-bg)] text-[14px] font-normal text-[var(--eb-text)] placeholder:text-[var(--eb-text-muted)]/60 focus:outline-none focus:ring-2 focus:ring-[var(--eb-accent)]/15 focus:border-[var(--eb-accent)] transition-colors"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="login-password"
                className="block text-[12px] font-medium text-[var(--eb-text)] mb-1.5"
              >
                Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-[var(--eb-text-muted)] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter password"
                  className="w-full h-[42px] pl-10 pr-11 rounded-[10px] border border-[var(--eb-input-border)] bg-[var(--eb-input-bg)] text-[14px] font-normal text-[var(--eb-text)] placeholder:text-[var(--eb-text-muted)]/60 focus:outline-none focus:ring-2 focus:ring-[var(--eb-accent)]/15 focus:border-[var(--eb-accent)] transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--eb-text-muted)] hover:text-[var(--eb-text)] p-1 rounded-[8px] transition-colors"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full h-[42px] mt-2 inline-flex items-center justify-center gap-2 px-5 rounded-[10px] bg-[var(--eb-accent)] hover:bg-[var(--eb-accent-hover)] text-white text-[14px] font-medium shadow-sm transition-colors disabled:opacity-60"
            >
              <span>{submitting ? 'Signing in...' : 'Continue'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          {/* Quick Staff Fill Helper */}
          <div className="mt-6 pt-5 border-t border-[var(--eb-border)] flex items-center justify-between gap-2 text-xs font-normal text-[var(--eb-text-muted)]">
            <span>Quick access:</span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => fillDemo('admin', 'admin123')}
                className="px-3 py-1 rounded-[8px] bg-violet-50 dark:bg-violet-950/40 hover:bg-violet-100 dark:hover:bg-violet-900/50 text-violet-700 dark:text-violet-300 border border-violet-200 dark:border-violet-800/60 font-medium transition-colors whitespace-nowrap shrink-0"
              >
                Admin
              </button>
              <button
                type="button"
                onClick={() => fillDemo('cashier', 'cashier123')}
                className="px-3 py-1 rounded-[8px] bg-sky-50 dark:bg-sky-950/40 hover:bg-sky-100 dark:hover:bg-sky-900/50 text-sky-700 dark:text-sky-300 border border-sky-200 dark:border-sky-800/60 font-medium transition-colors whitespace-nowrap shrink-0"
              >
                Cashier
              </button>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
