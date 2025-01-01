import { ShieldAlert } from 'lucide-react';
import { PropsWithChildren } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../utils';

// Only default variant for now, will implement/style more as needed
type TextBannerProps = {
  className?: string;
};

const textBannerVariants = cva(
  'bg-popover border border-popover w-full text-card-foreground text-sm px-4 py-2 rounded-md flex items-center gap-x-4',
  {
    variants: {
      variant: {
        default: '',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
);

const TextBanner = ({
  children,
  variant,
  className = '',
}: PropsWithChildren<TextBannerProps> &
  VariantProps<typeof textBannerVariants>) => {
  return (
    <div className={cn(textBannerVariants({ variant, className }))}>
      <ShieldAlert />
      {children}
    </div>
  );
};

export default TextBanner;
