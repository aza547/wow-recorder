import { ComponentProps } from 'react';
import { cn } from './components/utils';
import icon from '../../assets/icon.png';

const ipc = window.electron.ipcRenderer;

export default function RendererTitleBar() {
  const clickedHide = () => {
    ipc.sendMessage('window', ['minimize']);
  };

  const clickedResize = () => {
    ipc.sendMessage('window', ['resize']);
  };

  const clickedQuit = () => {
    ipc.sendMessage('window', ['quit']);
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
          'w-8 h-8 bg-transparent border-0 text-white text-base outline-none hover:bg-foreground flex items-center justify-center',
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
      <div id="title-bar-btns" className="ml-auto absolute right-0 top-0 h-full flex items-center">
        <TitleBarButton id="min-btn" onClick={clickedHide}>
          <span className="inline-block w-3 h-[2px] bg-white" />
        </TitleBarButton>
        <TitleBarButton id="max-btn" onClick={clickedResize}>
          <span className="inline-block w-3 h-3 border border-white" />
        </TitleBarButton>
        <TitleBarButton
          id="close-btn"
          className="hover:bg-destructive"
          onClick={clickedQuit}
        >
          <svg className="w-3 h-3" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="2" y1="2" x2="10" y2="10" />
            <line x1="10" y1="2" x2="2" y2="10" />
          </svg>
        </TitleBarButton>
      </div>
    </div>
  );
}
