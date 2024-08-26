/* eslint-disable react/require-default-props */
/* eslint-disable react/prop-types */
import * as React from 'react';
import * as TooltipPrimitive from '@radix-ui/react-tooltip';

import { cn } from '../utils';

interface TooltipProps
  extends Omit<TooltipPrimitive.TooltipContentProps, 'content' | 'onClick'>,
    Pick<
      TooltipPrimitive.TooltipProps,
      'open' | 'defaultOpen' | 'onOpenChange' | 'delayDuration'
    > {
  content: React.ReactNode;
  onClick?: React.MouseEventHandler<HTMLButtonElement>;
  side?: 'bottom' | 'left' | 'top' | 'right';
  maxWidth?: number;
}
const Tooltip = ({
  children,
  content,
  open,
  defaultOpen,
  onOpenChange,
  delayDuration,
  maxWidth = 220,
  className,
  side,
  sideOffset = 8,
  onClick,
  ...props
}: TooltipProps) => {
  return (
    <TooltipPrimitive.Root
      open={open}
      defaultOpen={defaultOpen}
      onOpenChange={onOpenChange}
      delayDuration={delayDuration}
    >
      <TooltipPrimitive.Trigger onClick={onClick} asChild>
        {children}
      </TooltipPrimitive.Trigger>
      <TooltipPrimitive.Portal>
        <TooltipPrimitive.Content
          side={side}
          sideOffset={sideOffset}
          align="center"
          className={cn(
            'z-50 overflow-hidden rounded-md border-popover-border ring-1 ring-inset ring-popover-inset bg-popover px-2 py-1.5 font-sans text-[11px] text-popover-foreground shadow-md animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2',
            className
          )}
          {...props}
          style={{ ...props.style, maxWidth }}
        >
          {content}
        </TooltipPrimitive.Content>
      </TooltipPrimitive.Portal>
    </TooltipPrimitive.Root>
  );
};

type TooltipProviderProps = TooltipPrimitive.TooltipProviderProps;

const TooltipProvider = ({
  children,
  delayDuration = 100,
  skipDelayDuration = 300,
  ...props
}: TooltipProviderProps) => {
  return (
    <TooltipPrimitive.TooltipProvider
      delayDuration={delayDuration}
      skipDelayDuration={skipDelayDuration}
      {...props}
    >
      {children}
    </TooltipPrimitive.TooltipProvider>
  );
};

export { Tooltip, TooltipProvider };
