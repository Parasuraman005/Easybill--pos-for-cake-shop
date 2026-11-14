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
      <div className="fixed inset-0 bg-[#302A40]/65 backdrop-blur-[3px]" />

      {/* Two-Column Login Card */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
        className="relative z-10 my-2 w-full max-w-4xl grid grid-cols-1 lg:grid-cols-2 rounded-[14px] overflow-hidden bg-white dark:bg-[#1B1726] border border-[#EAE7F0]/30 shadow-[0_20px_50px_rgba(24,18,43,0.38)]"
      >
        {/* Left Section: Application Information */}
        <div className="flex flex-col justify-between p-5 sm:p-8 lg:p-10 bg-[#302A40] text-white border-b lg:border-b-0 lg:border-r border-[#433B59]">
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
                <h1 className="font-display text-[26px] font-bold tracking-tight text-white">
                  {appName}
                </h1>
                <p className="text-[13px] font-medium text-[#C5B3F7]">
                  {settings.company.name || 'Cake Shop POS'}
                </p>
              </div>
            </div>

            <div className="mt-10">
              <h2 className="font-display text-2xl sm:text-3xl font-bold leading-tight text-white [text-wrap:balance]">
                Smart Billing. Simple Business.
              </h2>
              <p className="mt-3 text-[14px] font-normal text-[#D6D0E4] leading-relaxed">
                Fast counter checkout, custom cake advance orders, expense ledgers, and thermal receipt printing designed for daily bakery operations.
              </p>
            </div>
          </div>

          <div className="mt-6 sm:mt-10 pt-5 sm:pt-6 border-t border-[#433B59] text-[13px] font-medium text-[#B3ABC7] flex flex-wrap items-center justify-between gap-2">
            <span>Walk-in POS · Order Ledger · GST Ready</span>
            <span className="text-[#C5B3F7]">Algogenz Solutions</span>
          </div>
        </div>

        {/* Right Section: Login Form */}
        <div className="p-5 sm:p-8 lg:p-10 flex flex-col justify-center bg-white dark:bg-[#1B1726]">
          <div>
            <h2 className="font-display text-[19px] font-bold text-[#302A40] dark:text-[#F3F1FA]">
              Sign in to Counter
            </h2>
            <p className="mt-1 text-[14px] font-normal text-[#817A91] dark:text-[#A69FB8]">
              Enter your staff credentials to start billing.
            </p>
          </div>

          {error && (
            <div
              role="alert"
              className="mt-5 flex items-start gap-2.5 rounded-[12px] bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 px-3.5 py-3 text-[13px] font-medium text-red-700 dark:text-red-300"
            >
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <div>
              <label
                htmlFor="login-username"
                className="block text-[13px] font-semibold text-[#302A40] dark:text-[#E9E2FF] mb-1.5"
              >
                Username
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-[#817A91] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  id="login-username"
                  type="text"
                  autoComplete="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Enter username"
                  className="w-full pl-10 pr-4 py-2.5 rounded-[10px] border border-[#EAE7F0] dark:border-[#2E2842] bg-[#F7F7FB] dark:bg-[#13101C] text-[14px] font-medium text-[#302A40] dark:text-[#F3F1FA] placeholder:text-[#817A91]/70 focus:outline-none focus:ring-2 focus:ring-[#7656C9]/20 focus:border-[#7656C9] transition-colors"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="login-password"
                className="block text-[13px] font-semibold text-[#302A40] dark:text-[#E9E2FF] mb-1.5"
              >
                Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-[#817A91] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter password"
                  className="w-full pl-10 pr-11 py-2.5 rounded-[10px] border border-[#EAE7F0] dark:border-[#2E2842] bg-[#F7F7FB] dark:bg-[#13101C] text-[14px] font-medium text-[#302A40] dark:text-[#F3F1FA] placeholder:text-[#817A91]/70 focus:outline-none focus:ring-2 focus:ring-[#7656C9]/20 focus:border-[#7656C9] transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#817A91] hover:text-[#302A40] dark:hover:text-white p-1 rounded-[8px]"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full mt-2 inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-[10px] bg-[#7656C9] hover:bg-[#6947BB] text-white font-display text-[14px] font-semibold shadow-sm transition-colors disabled:opacity-60"
            >
              <span>{submitting ? 'Signing in...' : 'Continue'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          {/* Quick Staff Fill Helper */}
          <div className="mt-6 pt-5 border-t border-[#EAE7F0] dark:border-[#2E2842] flex items-center justify-between gap-2 text-xs font-medium text-[#817A91]">
            <span>Quick access:</span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => fillDemo('admin', 'admin123')}
                className="px-3 py-1 rounded-[10px] bg-[#E9E2FF] hover:bg-[#DDD3FF] text-[#4B3194] font-semibold transition-colors"
              >
                Admin
              </button>
              <button
                type="button"
                onClick={() => fillDemo('cashier', 'cashier123')}
                className="px-3 py-1 rounded-[10px] bg-[#E9E2FF] hover:bg-[#DDD3FF] text-[#4B3194] font-semibold transition-colors"
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
