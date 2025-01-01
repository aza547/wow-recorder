import React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '../utils';

const statusLightForegroundVariants = cva('rounded-full border-[3px]', {
  variants: {
    variant: {
      ready:
        'bg-success border-success-border shadow-[0px_0px_4px_2px_rgba(45,216,127,0.5)]',
      recording:
        'bg-success border-success-border shadow-[0px_0px_4px_2px_rgba(45,216,127,0.5)] animate-pulse',
      invalid:
        'bg-warning border-warning-border shadow-[0px_0px_4px_2px_rgba(234,179,8,0.5)]',
      error:
        'bg-error border-error-border shadow-[0px_0px_4px_2px_rgba(153,27,27,0.66)]',
      waiting: 'bg-zinc-400 border-zinc-500',
      overrunning:
        'bg-blue-accent border-blue-accent-border shadow-[0px_0px_4px_2px_rgba(2,132,199,0.66)]',
    },
  },
});

export interface StatusLightProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof statusLightForegroundVariants> {
  variant:
    | 'waiting'
    | 'recording'
    | 'invalid'
    | 'error'
    | 'ready'
    | 'overrunning';
  wrapperClasses?: string;
  foregroundClasses?: string;
}

const StatusLight = ({
  variant,
  wrapperClasses,
  foregroundClasses,
}: StatusLightProps) => {
  return (
    <div className={cn('relative h-5 w-5', wrapperClasses)}>
      <div
        className={cn(
          statusLightForegroundVariants({
            variant,
            className: foregroundClasses,
          }),
        )}
      />
    </div>
  );
};

export default StatusLight;
