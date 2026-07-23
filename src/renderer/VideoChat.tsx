import { MessageSquare, SendHorizontal, Unplug, X } from 'lucide-react';
import { Textarea } from './components/TextArea/textarea';
import { Button } from './components/Button/Button';
import { KeyboardEventHandler, useEffect, useRef, useState } from 'react';
import { RendererVideo } from 'main/types';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { CircularProgress } from '@mui/material';
import { ChatMessageWithId, TChatMessageWithId } from 'types/api';
import { Tooltip } from './components/Tooltip/Tooltip';
import { getLocalePhrase, Language } from 'localisation/translations';
import { Phrase } from 'localisation/phrases';
import { z } from 'zod';
import {
  findVideoChatViewpoint,
  getVideoChatMentionSuggestions,
  parseVideoChatMessageLinks,
  VideoChatMentionSuggestion,
} from './videoChatLinks';
import { classImages } from './images';
import { getPlayerClass } from './rendererutils';

const ipc = window.electron.ipcRenderer;
const maxMessageLength = 256;

interface IProps {
  video: RendererVideo;
  availablePovs: RendererVideo[];
  currentPov?: RendererVideo;
  language: Language;
  deletePermissions: boolean;
  onTimestampClick: (seconds: number, viewpoint?: string) => void;
  onViewpointClick: (viewpoint: string) => void;
}

type MentionSearch = {
  start: number;
  end: number;
  query: string;
};

const getMentionSearch = (
  value: string,
  caretPosition: number | null,
): MentionSearch | null => {
  if (caretPosition === null) {
    return null;
  }

  // Only the @ token touching the caret should open the menu. This keeps older
  // mentions elsewhere in the draft from hijacking normal typing.
  const prefix = value.slice(0, caretPosition);
  const match = /(^|\s)@([^\s@]*)$/.exec(prefix);

  if (!match) {
    return null;
  }

  const separatorLength = match[1].length;

  return {
    start: prefix.length - match[0].length + separatorLength,
    end: caretPosition,
    query: match[2].toLowerCase(),
  };
};

const classLabels: Record<string, string> = {
  DEATHKNIGHT: 'Death Knight',
  DEMONHUNTER: 'Demon Hunter',
};

const getClassLabel = (playerClass: string) => {
  return (
    classLabels[playerClass] ||
    playerClass.toLowerCase().replace(/^\w/, (c) => c.toUpperCase())
  );
};

/**
 * A page representing a video category.
 */
const VideoChat = (props: IProps) => {
  const {
    video,
    availablePovs,
    currentPov,
    language,
    deletePermissions,
    onTimestampClick,
    onViewpointClick,
  } = props;
  const [message, setMessage] = useState<string>('');
  const [mentionSearch, setMentionSearch] = useState<MentionSearch | null>(
    null,
  );
  const [selectedMentionIndex, setSelectedMentionIndex] = useState(0);
  const chatRef = useRef<HTMLDivElement>(null);
  const messageInputRef = useRef<HTMLTextAreaElement>(null);
  // Menu control keys are handled on keydown; skip the matching keyup so it
  // cannot reopen mention search from the unchanged caret position.
  const ignoreNextMentionKeyUpRef = useRef(false);
  const correlatorRef = useRef<string | null>(null);
  const queryClient = useQueryClient();

  const { data, isPending, error, refetch } = useQuery({
    gcTime: 0, // Always refetch.
    queryKey: ['chats', video.videoName],
    refetchOnWindowFocus: false,
    queryFn: async () => {
      const correlator = await ipc.getOrCreateChatCorrelator(video);
      correlatorRef.current = correlator;
      return ipc.getChatMessages(correlator);
    },
  });

  // Suggestions come from the currently available POVs so the menu cannot
  // insert a player that this replay cannot actually switch to.
  const mentionSuggestions = getVideoChatMentionSuggestions(availablePovs);

  const filteredMentionSuggestions = mentionSearch
    ? mentionSuggestions
        .filter((suggestion) =>
          suggestion.searchText.includes(mentionSearch.query),
        )
        .slice(0, 6)
    : [];

  const mentionMenuOpen = filteredMentionSuggestions.length > 0;

  useEffect(() => {
    setSelectedMentionIndex(0);
  }, [mentionSearch?.query]);

  const addChatMessage = (message: unknown) => {
    let parsed: TChatMessageWithId;

    try {
      parsed = ChatMessageWithId.parse(message);
    } catch (e) {
      console.error('Invalid chat message received', message, e);
      return;
    }

    const { correlator } = parsed;

    if (correlator !== correlatorRef.current) {
      // Websocket update for another video.
      return;
    }

    // Add to the cached query data directly. This triggers a re-render just
    // like updating state does.
    queryClient.setQueryData(
      ['chats', video.videoName],
      (prev: TChatMessageWithId[]) => {
        return [...prev, parsed].sort((a, b) => a.timestamp - b.timestamp);
      },
    );
  };

  const deleteChatMessage = (id: unknown) => {
    let parsedId: number;

    try {
      parsedId = z.number().parse(id);
    } catch (e) {
      console.error('Invalid delete chat message received', id, e);
      return;
    }

    // Add to the cached query data directly. This triggers a re-render just
    // like updating state does.
    queryClient.setQueryData(
      ['chats', video.videoName],
      (prev: TChatMessageWithId[]) => {
        return prev?.filter((msg) => msg.id !== parsedId) ?? [];
      },
    );
  };

  useEffect(() => {
    // We get a websocket message if a new chat is added/deleted.
    ipc.on('displayAddChatMessage', addChatMessage);
    ipc.on('displayDeleteChatMessage', deleteChatMessage);

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

    if (correlatorRef.current === null) {
      console.error('No chat correlator available to send message');
      setMessage('');
      return;
    }

    window.electron.ipcRenderer.postChatMessage(correlatorRef.current, message);
    setMessage('');
    setMentionSearch(null);
  };

  const updateMentionSearch = (input: HTMLTextAreaElement) => {
    // Mention search only applies to the token immediately before the caret.
    setMentionSearch(getMentionSearch(input.value, input.selectionStart));
  };

  const insertMention = (
    suggestion: VideoChatMentionSuggestion<RendererVideo>,
  ) => {
    if (!mentionSearch) {
      return;
    }

    const insertion = `@${suggestion.mention} `;
    const nextMessage =
      message.slice(0, mentionSearch.start) +
      insertion +
      message.slice(mentionSearch.end);

    if (nextMessage.length > maxMessageLength) {
      return;
    }

    const nextCaretPosition = mentionSearch.start + insertion.length;

    setMessage(nextMessage);
    setMentionSearch(null);

    // React updates the controlled textarea value asynchronously; wait for that
    // commit before restoring focus and placing the caret after the mention.
    requestAnimationFrame(() => {
      messageInputRef.current?.focus();
      messageInputRef.current?.setSelectionRange(
        nextCaretPosition,
        nextCaretPosition,
      );
    });
  };

  const moveMentionSelection = (direction: 1 | -1) => {
    setSelectedMentionIndex((prev) => {
      const suggestionCount = filteredMentionSuggestions.length;
      return (prev + direction + suggestionCount) % suggestionCount;
    });
  };

  const renderClassIcon = (sourceVideo: RendererVideo | undefined) => {
    if (!sourceVideo) {
      return null;
    }

    const playerClass = getPlayerClass(sourceVideo);

    if (playerClass === 'UNKNOWN') {
      return null;
    }

    return (
      <img
        src={classImages[playerClass]}
        alt={`${getClassLabel(playerClass)} class icon`}
        className="h-3.5 w-3.5 rounded-sm object-cover"
      />
    );
  };

  const processMessageContent = (msg: string) => {
    const parts = parseVideoChatMessageLinks(msg).map((part, index) => {
      if (part.type === 'text') {
        return part.text;
      }

      if (part.type === 'mention') {
        const linkedViewpoint = findVideoChatViewpoint(
          availablePovs,
          part.viewpoint,
        );

        if (!linkedViewpoint) {
          return part.text;
        }

        return (
          <Button
            variant="secondary"
            className="px-1 m-0 h-5 inline-flex items-center gap-x-1"
            size="xs"
            key={index}
            onClick={() => {
              onViewpointClick(part.viewpoint);
            }}
          >
            {renderClassIcon(linkedViewpoint)}
            <span>{part.text}</span>
          </Button>
        );
      }

      const linkedViewpoint = part.viewpoint
        ? findVideoChatViewpoint(availablePovs, part.viewpoint)
        : currentPov;

      // Named timestamp links are actionable only when the named POV exists.
      // Plain timestamps still seek the currently selected POV.
      if (part.viewpoint && !linkedViewpoint) {
        return part.text;
      }

      return (
        <Button
          variant="secondary"
          className="px-1 m-0 h-5 inline-flex items-center gap-x-1"
          size="xs"
          key={index}
          onClick={() => {
            onTimestampClick(part.seconds, part.viewpoint);
          }}
        >
          {renderClassIcon(linkedViewpoint)}
          <span>{part.text}</span>
        </Button>
      );
    });

    return <div className="pl-2">{parts}</div>;
  };

  const renderMentionSuggestions = () => {
    if (!mentionMenuOpen) {
      return null;
    }

    return (
      <div
        className="absolute bottom-full left-0 right-0 z-50 mb-1 max-h-48
          overflow-y-auto rounded-sm border border-border bg-card p-1 text-sm
          shadow-md scrollbar-thin"
      >
        {filteredMentionSuggestions.map((suggestion, index) => {
          const selected = selectedMentionIndex === index;

          return (
            <button
              type="button"
              key={suggestion.mention}
              className={`flex w-full items-center justify-between rounded-sm px-2
                py-1 text-left ${selected ? 'bg-accent text-accent-foreground' : ''}`}
              onMouseEnter={() => setSelectedMentionIndex(index)}
              onMouseDown={(event) => {
                // Blur fires before click when leaving the textarea, so select
                // on mouse down while the mention search state still exists.
                event.preventDefault();
                insertMention(suggestion);
              }}
            >
              <span className="flex items-center gap-x-2">
                {renderClassIcon(suggestion.viewpoint)}
                <span>@{suggestion.label}</span>
              </span>
              {suggestion.detail && (
                <span className="ml-2 text-xs text-muted-foreground">
                  {suggestion.detail}
                </span>
              )}
            </button>
          );
        })}
      </div>
    );
  };

  const handleMessageKeyDown: KeyboardEventHandler<HTMLTextAreaElement> = (
    event,
  ) => {
    // Need this to prevent "k" triggering video play/pause while
    // dialog is open and other similar things.
    event.stopPropagation();

    if (mentionMenuOpen) {
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        ignoreNextMentionKeyUpRef.current = true;
        moveMentionSelection(1);
        return;
      }

      if (event.key === 'ArrowUp') {
        event.preventDefault();
        ignoreNextMentionKeyUpRef.current = true;
        moveMentionSelection(-1);
        return;
      }

      if (event.key === 'Enter' || event.key === 'Tab') {
        event.preventDefault();
        ignoreNextMentionKeyUpRef.current = true;
        const selectedSuggestion =
          filteredMentionSuggestions[
            Math.min(
              selectedMentionIndex,
              filteredMentionSuggestions.length - 1,
            )
          ];

        if (selectedSuggestion) {
          insertMention(selectedSuggestion);
        }

        return;
      }

      if (event.key === 'Escape') {
        event.preventDefault();
        ignoreNextMentionKeyUpRef.current = true;
        setMentionSearch(null);
        return;
      }
    }

    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault(); // stop newline
      handleSendMessage();
    }
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
        <div className="flex flex-col items-center justify-center w-full h-full font-bold">
          <Unplug size={35} className="mx-8 my-2" />
          {getLocalePhrase(props.language, Phrase.ChatErrorLoadingText)}
        </div>
      );
    }

    const now = new Date();

    if (data && data.length > 0) {
      return data.map((chat) => {
        const date = new Date(chat.timestamp);

        const isToday =
          date.getDate() === now.getDate() &&
          date.getMonth() === now.getMonth() &&
          date.getFullYear() === now.getFullYear();

        const formattedDate = isToday
          ? date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          : date.toLocaleDateString([], { day: '2-digit', month: 'short' });

        return (
          <div key={chat.id} className="mb-2">
            <div className="flex">
              <strong className="text-foreground-lighter mr-1">
                {chat.userName}
              </strong>
              <Tooltip content={date.toLocaleString()}>
                <span>{formattedDate}</span>
              </Tooltip>
              {deletePermissions && (
                <div className="flex items-center justify-center">
                  <Tooltip
                    content={getLocalePhrase(
                      language,
                      Phrase.ChatDeleteMessageTooltip,
                    )}
                  >
                    <Button
                      variant="ghost"
                      className="mx-1 p-0 w-4 h-4 rounded-sm"
                      onClick={() => ipc.deleteChatMessage(chat.id)}
                    >
                      <X />
                    </Button>
                  </Tooltip>
                </div>
              )}
            </div>
            {processMessageContent(chat.message)}
          </div>
        );
      });
    }

    return (
      <div className="flex flex-col items-center justify-center w-full h-full font-bold">
        <MessageSquare size={35} className="mx-8 my-2" />
        {getLocalePhrase(props.language, Phrase.ChatNoMessagesText)}
      </div>
    );
  };

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
        <div className="relative flex-1">
          {renderMentionSuggestions()}
          <Textarea
            ref={messageInputRef}
            className="bg-background-dark-gradient-to rounded-sm
              border-background-dark-gradient-to resize-none
              placeholder:text-foreground  focus-visible:ring-0
              focus-visible:border-background-dark-gradient-to scrollbar-thin py-2"
            placeholder={getLocalePhrase(
              props.language,
              Phrase.ChatTypeMessageText,
            )}
            maxLength={maxMessageLength}
            value={message}
            onBlur={() => setMentionSearch(null)}
            onClick={(event) => updateMentionSearch(event.currentTarget)}
            onKeyUp={(event) => {
              if (ignoreNextMentionKeyUpRef.current) {
                ignoreNextMentionKeyUpRef.current = false;
                return;
              }

              updateMentionSearch(event.currentTarget);
            }}
            onChange={(event) => {
              setMessage(event.target.value);
              updateMentionSearch(event.currentTarget);
            }}
            onKeyDown={handleMessageKeyDown}
          />
        </div>
        <div className="flex flex-col items-center gap-x-2">
          <Button
            variant="ghost"
            size="xs"
            onClick={handleSendMessage}
            className="rounded-sm"
          >
            <SendHorizontal size={18} />
          </Button>
        </div>
      </div>
    </>
  );
};

export default VideoChat;
