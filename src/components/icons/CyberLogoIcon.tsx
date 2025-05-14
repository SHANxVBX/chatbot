import type { SVGProps } from 'react';

export function CyberLogoIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <defs>
        <linearGradient id="cyberGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style={{ stopColor: "hsl(var(--primary))", stopOpacity: 1 }} />
          <stop offset="100%" style={{ stopColor: "hsl(var(--accent))", stopOpacity: 1 }} />
        </linearGradient>
      </defs>
      <path d="M12 2L2 7l10 5 10-5-10-5z" stroke="url(#cyberGradient)" />
      <path d="M2 17l10 5 10-5" stroke="url(#cyberGradient)" />
      <path d="M2 12l10 5 10-5" stroke="url(#cyberGradient)" />
      <path d="M10 20.5v-6.5" strokeWidth="1.5" stroke="hsl(var(--secondary))" />
      <path d="M14 20.5v-6.5" strokeWidth="1.5" stroke="hsl(var(--secondary))" />
      <path d="M12 14l-2-1h4z" strokeWidth="1.5" fill="hsl(var(--secondary))" />
    </svg>
  );
}
