/* eslint-disable @typescript-eslint/no-explicit-any */
// Disabled the above because the only other option here is to make this context
// with generics, which is just an unnecessary PITA.

import React, { PropsWithChildren, ReactNode } from 'react';
import { cn } from '../utils';

type MenuProps = {
  initialValue?: any;
  onChange: (value: any) => void;
  className?: string;
};

interface MenuContextType {
  currentValue?: any;
  onValueChange: (newValue: string) => void;
}

const MenuContext = React.createContext<MenuContextType>({
  onValueChange: () => {},
});

export const useMenuContext = (): MenuContextType => {
  const menuContext = React.useContext(MenuContext);

  if (!menuContext) {
    throw new Error(
      'useMenuContext has to be used within a MenuContextProvider',
    );
  }

  return menuContext;
};

export const Menu = ({
  initialValue,
  children,
  onChange,
  className,
}: PropsWithChildren<MenuProps>) => {
  const [currentValue, setCurrentValue] = React.useState(initialValue);

  const onValueChange = (newValue: string) => {
    setCurrentValue(newValue);
    onChange(newValue);
  };

  // This is a bit of a janky way to handle it I guess, but it accounts for
  // the fact that the two sections of content and settings are two different menus
  // so when one gets selected, the other needs to be cleared
  React.useEffect(() => {
    if (!initialValue) setCurrentValue(undefined);
  }, [initialValue]);

  return (
    <div className={cn('flex flex-col items-center gap-y-2 w-full', className)}>
      <MenuContext.Provider value={{ currentValue, onValueChange }}>
        {children}
      </MenuContext.Provider>
    </div>
  );
};

export const MenuLabel = ({ children }: { children: ReactNode }) => {
  return (
    <small className="text-xs font-extrabold leading-none text-foreground pl-4 self-start font-sans mb-2">
      {children}
    </small>
  );
};

export default Menu;
