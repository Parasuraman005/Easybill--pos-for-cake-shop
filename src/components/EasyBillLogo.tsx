import React from 'react';

export function EasyBillLogo({ className = 'w-9 h-9' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <rect width="48" height="48" rx="12" fill="#7656C9" />
      <path
        d="M14 27C14 23.6863 16.6863 21 20 21H28C31.3137 21 34 23.6863 34 27V33C34 34.1046 33.1046 35 32 35H16C14.8954 35 14 34.1046 14 33V27Z"
        fill="#FFFFFF"
      />
      <path
        d="M14 26.5C15.5 28 17.5 28 19 26.5C20.5 25 22.5 25 24 26.5C25.5 28 27.5 28 29 26.5C30.5 25 32.5 25 34 26.5"
        stroke="#7656C9"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <rect x="22.5" y="13" width="3" height="8" rx="1.5" fill="#E9E2FF" />
      <path
        d="M24 8.5C24 8.5 26 10.6 26 12C26 13.1046 25.1046 14 24 14C22.8954 14 22 13.1046 22 12C22 10.6 24 8.5 24 8.5Z"
        fill="#E9E2FF"
      />
    </svg>
  );
}

export function ShopDefaultEmblem({ className = 'w-9 h-9' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 40 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <rect width="40" height="40" rx="10" fill="#E9E2FF" />
      <path
        d="M11 22C11 18.6863 13.6863 16 17 16H23C26.3137 16 29 18.6863 29 22V27C29 28.1046 28.1046 29 27 29H13C11.8954 29 11 28.1046 11 27V22Z"
        stroke="#7656C9"
        strokeWidth="1.8"
      />
      <path
        d="M15 16V14.5C15 12.567 16.567 11 18.5 11H21.5C23.433 11 25 12.567 25 14.5V16"
        stroke="#302A40"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <path d="M11 23H29" stroke="#7656C9" strokeWidth="1.6" />
    </svg>
  );
}
