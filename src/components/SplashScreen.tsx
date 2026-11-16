import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { EasyBillLogo } from './EasyBillLogo';
import { useSettings } from '../context/SettingsContext';

interface SplashScreenProps {
  onComplete: () => void;
}

export function SplashScreen({ onComplete }: SplashScreenProps) {
  const { settings } = useSettings();
  const [fadingOut, setFadingOut] = useState(false);

  useEffect(() => {
    const fadeTimer = setTimeout(() => setFadingOut(true), 2650);
    const doneTimer = setTimeout(() => onComplete(), 3000);
    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(doneTimer);
    };
  }, [onComplete]);

  const appName = settings.application.appName || 'Easy Bill';
  const appLogo = settings.application.appLogo;

  return (
    <div
      className={`fixed inset-0 z-50 flex flex-col items-center justify-center bg-[var(--eb-bg)] transition-opacity duration-350 ${
        fadingOut ? 'opacity-0' : 'opacity-100'
      }`}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.94 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
        className="flex flex-col items-center text-center px-6"
      >
        {appLogo ? (
          <img
            src={appLogo}
            alt={appName}
            className="w-24 h-24 rounded-[16px] object-contain shadow-lg border border-[var(--eb-border)] bg-[var(--eb-surface)] p-2"
          />
        ) : (
          <EasyBillLogo className="w-24 h-24 shadow-lg rounded-[16px]" />
        )}

        <h1 className="mt-6 text-[32px] font-bold tracking-tight text-[var(--eb-text)]">
          {appName}
        </h1>
        <p className="mt-2 text-[14px] font-normal text-[var(--eb-text-muted)]">
          Smart Billing. Simple Business.
        </p>

        <div className="mt-8 w-40 h-1.5 rounded-full bg-[var(--eb-border)] overflow-hidden">
          <motion.div
            initial={{ x: '-100%' }}
            animate={{ x: '0%' }}
            transition={{ duration: 2.7, ease: 'easeInOut' }}
            className="h-full bg-[var(--eb-accent)] rounded-full"
          />
        </div>
      </motion.div>
    </div>
  );
}
