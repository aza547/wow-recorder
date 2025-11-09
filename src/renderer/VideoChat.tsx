import { Cloud, SendHorizontal } from 'lucide-react';
import { Textarea } from './components/TextArea/textarea';
import { Button } from './components/Button/Button';
import { MutableRefObject, useEffect, useRef, useState } from 'react';
import { RendererVideo } from 'main/types';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { CircularProgress } from '@mui/material';
import { areDatesWithinSeconds } from './rendererutils';
import { ChatMessage, TChatMessage } from 'types/api';
import { Tooltip } from './components/Tooltip/Tooltip';
import { VideoPlayerRef } from './VideoPlayer';
import { getLocalePhrase, Language } from 'localisation/translations';
import { Phrase } from 'localisation/phrases';

const ipc = window.electron.ipcRenderer;

interface IProps {
  enabled: boolean;
  video: RendererVideo;
  videoPlayerRef: MutableRefObject<VideoPlayerRef | null>;
  language: Language;
}

/**
 * A page representing a video category.
 */
const VideoChat = (props: IProps) => {
  const { video, videoPlayerRef, enabled } = props;
  const [message, setMessage] = useState<string>('');
  const chatRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();

  const { data, isPending, error, refetch } = useQuery({
    gcTime: 0, // Always refetch.
    enabled, // Don't bother fetching if chat is disabled.
    queryKey: ['chats', video.videoName],
    refetchOnWindowFocus: false,
    queryFn: async () => ipc.getChatMessages(video),
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

  // Scrolls to the bottom of the chat on loading it, or receiving a new message.
  useEffect(() => {
    if (!chatRef.current) return;

    chatRef.current.scrollTo({
      top: chatRef.current.scrollHeight,
      behavior: 'instant',
    });
  }, [data]);

  const handleSendMessage = () => {
    if (message.trim() === '') {
      setMessage('');
      return;
    }

    window.electron.ipcRenderer.postChatMessage(video, message);
    setMessage('');
  };

  const processMessageContent = (msg: string) => {
    const timestampRegex = /\b(\d{1,2}):(\d{2})\b/g;
    const parts: React.ReactNode[] = [];
    let lastIndex = 0;
    let match;

    while ((match = timestampRegex.exec(msg)) !== null) {
      const [fullMatch, minutes, seconds] = match;
      const index = match.index;

      if (index > lastIndex) {
        parts.push(msg.slice(lastIndex, index)); // text before timestamp
      }

      parts.push(
        <Button
          variant="secondary"
          className="px-1 m-0 h-5"
          size="xs"
          key={index}
          onClick={() => {
            videoPlayerRef.current?.seekTo(
              parseInt(minutes) * 60 + parseInt(seconds),
            );
          }}
        >
          {fullMatch}
        </Button>,
      );

      lastIndex = index + fullMatch.length;
    }

    if (lastIndex < msg.length) {
      parts.push(msg.slice(lastIndex));
    }

    return <div className="pl-1">{parts}</div>;
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
      return (
        <div>
          {getLocalePhrase(props.language, Phrase.ChatErrorLoadingText)}
        </div>
      );
    }

    const now = new Date();

    if (data && data.length > 0) {
      return data.map((chat, idx) => {
        const date = new Date(chat.timestamp);

        const isToday =
          date.getDate() === now.getDate() &&
          date.getMonth() === now.getMonth() &&
          date.getFullYear() === now.getFullYear();

        const formattedDate = isToday
          ? date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          : date.toLocaleDateString([], { day: '2-digit', month: 'short' });

        return (
          <div key={idx} className="mb-2">
            <div>
              <strong className="text-foreground-lighter mr-1">
                {chat.userName}
              </strong>
              <Tooltip content={date.toLocaleString()}>
                <span>{formattedDate}</span>
              </Tooltip>
            </div>
            {processMessageContent(chat.message)}
          </div>
        );
      });
    }

    return (
      <div>{getLocalePhrase(props.language, Phrase.ChatNoMessagesText)}</div>
    );
  };

  if (!enabled) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-foreground text-sm font-bold">
        <Cloud />
        {getLocalePhrase(props.language, Phrase.ChatUploadToCloudText)}
      </div>
    );
  }

  return (
    <>
      <div
        ref={chatRef}
        className="flex-1 overflow-y-auto p-2 text-sm text-foreground 
          bg-background-dark-gradient-to rounded-sm break-words scrollbar-thin"
      >
        {renderChats()}
      </div>
      <div className="text-sm text-foreground flex items-center gap-x-2">
        <Textarea
          className="bg-background-dark-gradient-to rounded-sm 
            border-background-dark-gradient-to flex-1 resize-none
            placeholder:text-foreground  focus-visible:ring-0 
            focus-visible:border-background-dark-gradient-to scrollbar-thin py-2"
          placeholder={getLocalePhrase(
            props.language,
            Phrase.ChatTypeMessageText,
          )}
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
