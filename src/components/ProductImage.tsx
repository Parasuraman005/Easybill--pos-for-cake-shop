import React, { useState } from 'react';
import { CakeSlice } from 'lucide-react';

interface ProductImageProps {
  src?: string;
  alt: string;
  className?: string;
}

export function ProductImage({ src, alt, className = 'w-full h-full object-cover' }: ProductImageProps) {
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-[#F7F7FB] to-[#E9E2FF] dark:from-[#231E33] dark:to-[#1B1726] text-[#7656C9] dark:text-[#A992EB] p-3 text-center">
        <CakeSlice className="w-7 h-7 mb-1.5 opacity-85" />
        <span className="text-[11px] font-medium line-clamp-2 leading-tight px-1 text-[#302A40] dark:text-[#E9E2FF]">
          {alt}
        </span>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className={className}
    />
  );
}
