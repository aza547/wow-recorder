/* eslint-disable react/prop-types */
import * as React from 'react';
import * as SliderPrimitive from '@radix-ui/react-slider';

import { cn } from '../utils';
import { Tooltip } from '../Tooltip/Tooltip';

const Slider = React.forwardRef<
  React.ElementRef<typeof SliderPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof SliderPrimitive.Root>
>(({ className, value, ...props }, ref) => (
  <SliderPrimitive.Root
    ref={ref}
    className={cn(
      'relative flex w-full touch-none select-none items-center',
      className
    )}
    {...props}
  >
    <SliderPrimitive.Track className="relative h-1 w-full grow overflow-hidden rounded-full bg-card">
      <SliderPrimitive.Range className="absolute h-full bg-primary" />
    </SliderPrimitive.Track>
    <Tooltip
      content={value}
      side="top"
      onClick={(e) => e.preventDefault()}
      onPointerDownOutside={(e) => e.preventDefault()}
    >
      <SliderPrimitive.Thumb
        className={cn(
          'block h-4 w-4 rounded-full bg-white transition-colors',
          'focus-visible:outline-none hover:bg-primary hover:cursor-pointer',
          'disabled:pointer-events-none disabled:opacity-50'
        )}
      />
    </Tooltip>
  </SliderPrimitive.Root>
));
Slider.displayName = SliderPrimitive.Root.displayName;

export default Slider;
