import { SendHorizontal } from 'lucide-react';
import { Textarea } from './components/TextArea/textarea';
import { Button } from './components/Button/Button';
import { useEffect, useState } from 'react';
import { RendererVideo } from 'main/types';

interface IProps {}

/**
 * A page representing a video category.
 */
const VideoChat = (props: IProps) => {
  const [message, setMessage] = useState<string>('');

  const [chats, setChats] = useState<{ message: string; userName: string }[]>(
    [],
  );

  useEffect(() => {
    const init = async () => {
      const fetchedChats = await window.electron.ipcRenderer.getChatMessages(
        {} as RendererVideo,
      );
      setChats(
        fetchedChats.map((c) => ({ message: c.message, userName: c.userName })),
      );
    };
    init();
  }, []);

  const handleSendMessage = () => {
    console.log('would post', message);
    setMessage('');
  };

  return (
    <>
      <div className="flex-1 overflow-auto bg-background border-card border-b mb-2 p-2 ">
        {chats.length > 0 &&
          chats.map((chat, idx) => (
            <div key={idx} className="mb-2 text-xs">
              <strong>{chat.userName}:</strong> {chat.message}
            </div>
          ))}
        {chats.length === 0 && <div>No chat messages available.</div>}
      </div>
      <div className="flex items-center gap-x-2">
        <Textarea
          className="bg-background border-card flex-1 resize-none text-foreground-lighter placeholder:text-foreground border-none focus-visible:ring-0 focus-visible:border-none"
          placeholder="Type your message here."
          maxLength={256}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={(e) => {
            // Need this to prevent "k" triggering video play/pause while
            // dialog is open and other similar things.
            e.stopPropagation();

            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault(); // stop newline
              handleSendMessage();
            }
          }}
        />
        <Button variant="ghost" size="sm" onClick={handleSendMessage}>
          <SendHorizontal size={16} />
        </Button>
      </div>
    </>
  );
};

export default VideoChat;
