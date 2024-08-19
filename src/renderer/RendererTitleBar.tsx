import React, { ComponentProps } from 'react';
import icon from '../../assets/icon/small-icon.png';
import { cn } from './components/utils';

const ipc = window.electron.ipcRenderer;

export default function RendererTitleBar() {
  const clickedHide = () => {
    ipc.sendMessage('mainWindow', ['minimize']);
  };

  const clickedResize = () => {
    ipc.sendMessage('mainWindow', ['resize']);
  };

  const clickedQuit = () => {
    ipc.sendMessage('mainWindow', ['quit']);
  };

  const [title, setTitle] = React.useState('Warcraft Recorder Pro');

  React.useEffect(() => {
    window.electron.ipcRenderer.on('updateTitleBar', (t) => {
      setTitle(t as string);
    });
  }, []);

  const TitleBarButton = ({
    children,
    className,
    ...props
  }: ComponentProps<'button'>) => {
    return (
      <button
        type="button"
        className={cn(
          'w-8 h-8 bg-transparent border-0 text-white text-base outline-none hover:bg-foreground',
          className
        )}
        {...props}
      >
        {children}
      </button>
    );
  };

  return (
    <div
      id="title-bar"
      className="w-full h-[32px] bg-transparent flex items-center px-2 pr-0 absolute top-0 left-0"
    >
      {/* <div>
        <img alt="icon" src={icon} height="25px" width="25px" />
      </div>
      <div className="text-primary text-sm text-center font-bold ml-4">
        {title}
      </div> */}
      <div id="title-bar-btns" className="ml-auto absolute right-0 top-0">
        <TitleBarButton id="min-btn" onClick={clickedHide}>
          🗕
        </TitleBarButton>
        <TitleBarButton id="max-btn" onClick={clickedResize}>
          🗗
        </TitleBarButton>
        <TitleBarButton
          id="close-btn"
          className="hover:bg-destructive"
          onClick={clickedQuit}
        >
          ✖
        </TitleBarButton>
      </div>
    </div>
  );
}
