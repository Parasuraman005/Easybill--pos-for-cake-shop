import React, { useEffect, useState } from 'react';
import { CakeSlice } from 'lucide-react';

interface ProductImageProps {
  src?: string;
  alt: string;
  className?: string;
}

function normalizeImageSrc(src?: string): string {
  if (!src) return '';
  if (src.startsWith('/src/assets/images/')) {
    return src.replace('/src/assets/images/', '/images/');
  }
  return src;
}

export function ProductImage({ src, alt, className = 'w-full h-full object-cover' }: ProductImageProps) {
  const resolvedSrc = normalizeImageSrc(src);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [resolvedSrc]);

  if (!resolvedSrc || failed) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-[var(--eb-bg)] to-[var(--eb-accent-light)] text-[var(--eb-accent)] p-3 text-center">
        <CakeSlice className="w-7 h-7 mb-1.5 opacity-85" />
        <span className="text-[11px] font-medium line-clamp-2 leading-tight px-1 text-[var(--eb-text)]">
          {alt}
        </span>
      </div>
    );
  }

  return (
    <img
      src={resolvedSrc}
      alt={alt}
      loading="lazy"
      decoding="async"
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className={className}
    />
  );
}
