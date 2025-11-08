import { SendHorizontal } from 'lucide-react';
import { Textarea } from './components/TextArea/textarea';
import { Button } from './components/Button/Button';
import { useEffect, useState } from 'react';
import { RendererVideo } from 'main/types';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { CircularProgress } from '@mui/material';
import { areDatesWithinSeconds } from './rendererutils';
import { ChatMessage, TChatMessage } from 'types/api';

const ipc = window.electron.ipcRenderer;

interface IProps {
  video: RendererVideo;
}

/**
 * A page representing a video category.
 */
const VideoChat = (props: IProps) => {
  const { video } = props;
  const [message, setMessage] = useState<string>('');
  const queryClient = useQueryClient();

  const { data, isPending, error, refetch } = useQuery({
    gcTime: 0, // Always refetch.
    queryKey: ['chats', video.videoName],
    refetchOnWindowFocus: false,
    queryFn: async () => {
      const result = await ipc.getChatMessages(video);
      return result.map((c) => ({ message: c.message, userName: c.userName }));
    },
  });

  const addChatMessage = (message: unknown) => {
    let parsed: TChatMessage;

    try {
      parsed = ChatMessage.parse(message);
    } catch (e) {
      console.error('Invalid chat message received', message, e);
      return;
    }

    const { start, uniqueHash } = parsed;

    if (
      !video.start ||
      !areDatesWithinSeconds(new Date(video.start), new Date(start), 60) ||
      video.uniqueHash !== uniqueHash
    ) {
      // Websocket update for another video.
      return;
    }

    // Add to the cached query data directly. This triggers a re-render just
    // like updating state does.
    queryClient.setQueryData(
      ['chats', video.videoName],
      (prev: TChatMessage[]) => {
        return [...prev, parsed].sort((a, b) => a.timestamp - b.timestamp);
      },
    );
  };

  useEffect(() => {
    // We get a websocket message if a new chat is added.
    ipc.on('displayAddChatMessage', addChatMessage);

    // If guild websocket reconnects, refresh the chat in case we missed any messages.
    ipc.on('refreshChatMessages', () => refetch());

    return () => {
      ipc.removeAllListeners('displayAddChatMessage');
      ipc.removeAllListeners('refreshChatMessages');
    };
  }, [addChatMessage]);

  const handleSendMessage = () => {
    console.log('post', message);
    window.electron.ipcRenderer.postChatMessage(video, message);
    setMessage('');
  };

  const renderChats = () => {
    if (isPending) {
      return (
        <div className="w-full h-full flex items-center justify-center">
          <CircularProgress color="inherit" />
        </div>
      );
    }

    if (error) {
      return <div>Error loading chat messages.</div>;
    }

    if (data && data.length > 0) {
      return data.map((chat, idx) => (
        <div key={idx} className="mb-2">
          <strong>{chat.userName}:</strong> {chat.message}
        </div>
      ));
    }

    return <div>No chat messages available.</div>;
  };

  return (
    <>
      <div className="text-xs text-foreground flex-1 overflow-auto bg-background-dark-gradient-to mb-2 p-2 rounded-sm break-words">
        {renderChats()}
      </div>
      <div className="text-xs text-foreground flex items-center gap-x-2">
        <Textarea
          className="bg-background-dark-gradient-to rounded-sm border-background-dark-gradient-to flex-1 resize-none placeholder:text-foreground  focus-visible:ring-0 focus-visible:border-background-dark-gradient-to"
          placeholder="Type your message here..."
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
        <Button
          variant="ghost"
          size="xs"
          onClick={handleSendMessage}
          className="rounded-sm"
        >
          <SendHorizontal size={18} />
        </Button>
      </div>
    </>
  );
};

export default VideoChat;
