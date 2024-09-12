/* eslint-disable react/require-default-props */
/* eslint-disable jsx-a11y/click-events-have-key-events */
/* eslint-disable jsx-a11y/interactive-supports-focus */
import { PropsWithChildren, ReactNode } from 'react';
import { useMenuContext } from './Menu';
import { cn } from '../utils';
import { Badge } from '../Badge/Badge';

type MenuItemProps = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  value: any;
  className?: string;
};

const Root = ({
  value,
  className,
  children,
}: PropsWithChildren<MenuItemProps>) => {
  const { currentValue, onValueChange } = useMenuContext();
  return (
    <div
      className={cn(
        'w-full flex flex-row bg-transparent rounded-md px-4 py-3 items-center transition-all',
        'text-foreground font-semibold text-sm font-sans border-t border-t-transparent',
        '[text-shadow:_0px_1px_1px_rgba(0,0,0,66)]',
        { 'hover:bg-card/60': currentValue !== value },
        {
          'bg-card text-card-foreground border-t border-t-[rgba(255,255,255,0.2)] shadow-[0_1px_2px_rgba(0,0,0,0.5)]':
            currentValue === value,
        },
        className
      )}
      onClick={() => onValueChange(value)}
      role="button"
    >
      {children}
    </div>
  );
};

const Icon = ({ children }: { children: ReactNode }) => {
  return <div className="mr-4 w-6 h-6">{children}</div>;
};

type MenuBadgeProps = {
  value?: number;
};

const MenuBadge = ({ value }: MenuBadgeProps) => {
  return value ? (
    <Badge variant="default" className="ml-auto">
      {value <= 999 ? value : '999+'}
    </Badge>
  ) : null;
};

const Item = Object.assign(Root, { Icon, Badge: MenuBadge });

export default Item;
