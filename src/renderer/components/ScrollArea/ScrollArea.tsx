/* eslint-disable no-inner-declarations */
/* eslint-disable react/require-default-props */
/* eslint-disable react/prop-types */
import * as React from 'react';
import * as ScrollAreaPrimitive from '@radix-ui/react-scroll-area';

import { ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '../utils';

const ScrollBar = React.forwardRef<
  React.ElementRef<typeof ScrollAreaPrimitive.ScrollAreaScrollbar>,
  React.ComponentPropsWithoutRef<typeof ScrollAreaPrimitive.ScrollAreaScrollbar>
>(({ className, orientation = 'vertical', ...props }, ref) => (
  <ScrollAreaPrimitive.ScrollAreaScrollbar
    ref={ref}
    orientation={orientation}
    className={cn(
      'flex touch-none select-none transition-colors',
      orientation === 'vertical' &&
        'h-full w-2 border-l border-l-transparent p-[1px]',
      orientation === 'horizontal' &&
        'h-2 flex-col border-t border-t-transparent p-[1px]',
      className
    )}
    {...props}
  >
    <ScrollAreaPrimitive.ScrollAreaThumb className="relative flex-1 rounded-full bg-popover" />
  </ScrollAreaPrimitive.ScrollAreaScrollbar>
));
ScrollBar.displayName = ScrollAreaPrimitive.ScrollAreaScrollbar.displayName;

type ScrollIndicatorProps = {
  viewport: HTMLDivElement | undefined;
};

const ScrollabilityIndicator = ({
  direction,
}: {
  direction: 'up' | 'down';
}) => (
  <div
    className={cn(
      'w-full flex h-2 absolute left-0 items-center justify-center transition-all text-foreground-lighter',
      { 'bottom-0': direction === 'down' },
      { '-top-[-2px]': direction === 'up' }
    )}
  >
    <div
      className={cn(
        'w-[90%] absolute bottom-0 left-1/2 -translate-x-1/2 shadow-[0_0_8px_3px_rgba(0,0,0,0.73)]',
        { 'bottom-0': direction === 'down' },
        { 'bottom-[8px]': direction === 'up' }
      )}
    />
    {direction === 'down' ? <ChevronDown size={18} /> : <ChevronUp size={18} />}
  </div>
);

const ScrollUpIndicator = ({ viewport }: ScrollIndicatorProps) => {
  const [canScrollUp, setCanScrollUp] = React.useState(false);

  React.useLayoutEffect(() => {
    if (viewport) {
      function handleScroll() {
        // This is mostly to appease TS linter ..
        if (viewport) {
          const canScroll = viewport.scrollTop > 0;
          setCanScrollUp(canScroll);
        }
      }
      handleScroll();
      viewport.addEventListener('scroll', handleScroll);

      return () => viewport?.removeEventListener('scroll', handleScroll);
    }

    return () => {};
  });

  return canScrollUp ? <ScrollabilityIndicator direction="up" /> : null;
};

const ScrollDownIndicator = ({ viewport }: ScrollIndicatorProps) => {
  const [canScrollDown, setCanScrollDown] = React.useState(false);

  React.useLayoutEffect(() => {
    if (viewport) {
      function handleScroll() {
        // This is mostly to appease TS linter ..
        if (viewport) {
          const maxScroll = viewport.scrollHeight - viewport.clientHeight;
          const canScroll = Math.ceil(viewport.scrollTop) < maxScroll;
          setCanScrollDown(canScroll);
        }
      }
      handleScroll();
      viewport.addEventListener('scroll', handleScroll);

      return () => viewport?.removeEventListener('scroll', handleScroll);
    }
    return () => {};
  }, [viewport]);

  return canScrollDown ? <ScrollabilityIndicator direction="down" /> : null;
};

type ScrollAreaProps = {
  withScrollIndicators?: boolean;
};

const ScrollArea = React.forwardRef<
  React.ElementRef<typeof ScrollAreaPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof ScrollAreaPrimitive.Root> &
    ScrollAreaProps
>(({ className, children, withScrollIndicators = true, ...props }, ref) => {
  const viewportRef = React.useRef<HTMLDivElement>();
  const [viewport, setViewport] = React.useState<HTMLDivElement>();

  React.useLayoutEffect(() => {
    if (viewportRef.current) {
      setViewport(viewportRef.current);
    }
  }, [viewportRef]);
  return (
    <ScrollAreaPrimitive.Root
      ref={ref}
      className={cn('relative overflow-hidden', className)}
      {...props}
    >
      <ScrollAreaPrimitive.Viewport
        className="h-full w-full rounded-[inherit]"
        ref={viewportRef}
      >
        {withScrollIndicators && <ScrollUpIndicator viewport={viewport} />}
        {children}
        {withScrollIndicators && <ScrollDownIndicator viewport={viewport} />}
      </ScrollAreaPrimitive.Viewport>
      <ScrollBar />
      <ScrollAreaPrimitive.Corner />
    </ScrollAreaPrimitive.Root>
  );
});
ScrollArea.displayName = ScrollAreaPrimitive.Root.displayName;

export { ScrollArea, ScrollBar };
