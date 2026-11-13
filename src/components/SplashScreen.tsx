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
      className={`fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#F7F7FB] dark:bg-[#13101C] transition-opacity duration-350 ${
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
            className="w-24 h-24 rounded-[14px] object-contain shadow-[0_10px_30px_rgba(118,86,201,0.18)] border border-[#EAE7F0] dark:border-[#2E2842] bg-white p-2"
          />
        ) : (
          <EasyBillLogo className="w-24 h-24 shadow-[0_12px_32px_rgba(118,86,201,0.28)] rounded-[14px]" />
        )}

        <h1 className="mt-6 font-display text-4xl font-bold tracking-tight text-[#302A40] dark:text-[#F3F1FA]">
          {appName}
        </h1>
        <p className="mt-2 text-sm font-medium text-[#817A91] dark:text-[#A69FB8]">
          Smart Billing. Simple Business.
        </p>

        <div className="mt-8 w-40 h-1.5 rounded-full bg-[#E9E2FF] dark:bg-[#2A233D] overflow-hidden">
          <motion.div
            initial={{ x: '-100%' }}
            animate={{ x: '0%' }}
            transition={{ duration: 2.7, ease: 'easeInOut' }}
            className="h-full bg-[#7656C9] rounded-full"
          />
        </div>
      </motion.div>
    </div>
  );
}
