import type { LucideProps } from 'lucide-react';

export function FolderMessageSquareMore({ size = 24, ...props }: LucideProps) {
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
      <path d="M10 20H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h3.9a2 2 0 0 1 1.69.9l.81 1.2a2 2 0 0 0 1.67.9H20a2 2 0 0 1 2 1" />
      <path d="M23.5 18.5a1.2 1.2 0 0 1-1.2 1.2h-8.2a.85.85 0 0 0-.85.35l-1.3 1.3a.43.43 0 0 1-.75-.31v-9.7a1.2 1.2 0 0 1 1.2-1.2h9.9a1.2 1.2 0 0 1 1.2 1.2z" />
      <circle cx="15.4" cy="15" r="0.38" />
      <circle cx="17.7" cy="15" r="0.38" />
      <circle cx="20" cy="15" r="0.38" />
    </svg>
  );
}
