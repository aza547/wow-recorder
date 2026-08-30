import type { LucideProps } from 'lucide-react';

export function FolderMessageSquare({ size = 24, ...props }: LucideProps) {
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
      <path d="M8 20H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h3.9a2 2 0 0 1 1.69.9l.81 1.2a2 2 0 0 0 1.67.9H20a2 2 0 0 1 2 1" />
      <path d="M23.5 18.2a1.05 1.05 0 0 1-1.05 1.05h-7.45a.74.74 0 0 0-.74.3l-1.15 1.15a.37.37 0 0 1-.64-.27v-8.0a1.05 1.05 0 0 1 1.05-1.05h8.93a1.05 1.05 0 0 1 1.05 1.05z" />
    </svg>
  );
}
