import type { LucideProps } from 'lucide-react';

export function FolderUnlocked({ size = 24, ...props }: LucideProps) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M10 20H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h3.9a2 2 0 0 1 1.69.9l.81 1.2a2 2 0 0 0 1.67.9H20a2 2 0 0 1 1" />
      <rect x="13.5" y="15.5" width="10" height="5.5" rx="1" />
      <path d="M16 15.0v-1.75a2.5 2.5 0 0 1 4.5-1.5" />
    </svg>
  );
}
