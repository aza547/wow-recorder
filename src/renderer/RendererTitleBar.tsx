import { ComponentProps } from 'react';
import { cn } from './components/utils';
import icon from '../../assets/icon.png';

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
          className,
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
      className="w-full h-[32px] bg-background flex items-center justify-center px-2 pr-0 absolute top-0 left-0"
    >
      <img
        src={icon}
        style={{ width: '20px', height: '20px', marginRight: 8 }}
      />
      <div className="text-popover-foreground font-semibold text-sm font-sans">
        Warcraft Recorder
      </div>
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
