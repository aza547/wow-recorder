type VideoChatTextPart = {
  type: 'text';
  text: string;
};

type VideoChatLinkPart = {
  type: 'link';
  text: string;
  seconds: number;
  viewpoint?: string;
};

export type VideoChatMessagePart = VideoChatTextPart | VideoChatLinkPart;

export type VideoChatViewpoint = {
  videoName: string;
  cloud: boolean;
  player?: {
    _name?: string;
    _realm?: string;
  };
};

// Supports plain timestamps, and optional POV-qualified timestamps:
// "2:15" or "@Player-Realm 2:15".
const chatLinkRegex = /(?:@(\S+)\s+)?\b(\d{1,2}):(\d{2})\b/g;

const normalize = (value: string) => value.trim().toLowerCase();

const appendTextPart = (parts: VideoChatMessagePart[], text: string) => {
  if (text.length > 0) {
    parts.push({ type: 'text', text });
  }
};

export const parseVideoChatMessageLinks = (
  message: string,
): VideoChatMessagePart[] => {
  const parts: VideoChatMessagePart[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  chatLinkRegex.lastIndex = 0;

  while ((match = chatLinkRegex.exec(message)) !== null) {
    const [text, viewpoint, minutes, seconds] = match;
    const parsedSeconds = parseInt(seconds, 10);

    if (parsedSeconds > 59) {
      continue;
    }

    appendTextPart(parts, message.slice(lastIndex, match.index));

    const link: VideoChatLinkPart = {
      type: 'link',
      text,
      seconds: parseInt(minutes, 10) * 60 + parsedSeconds,
    };

    if (viewpoint) {
      link.viewpoint = viewpoint;
    }

    parts.push(link);
    lastIndex = match.index + text.length;
  }

  appendTextPart(parts, message.slice(lastIndex));

  return parts;
};

const getViewpointAliases = (viewpoint: VideoChatViewpoint) => {
  const aliases = [viewpoint.videoName];
  const playerName = viewpoint.player?._name;
  const playerRealm = viewpoint.player?._realm;

  if (playerName) {
    aliases.push(playerName);
  }

  if (playerName && playerRealm) {
    aliases.push(`${playerName}-${playerRealm}`);
  }

  return aliases.map(normalize);
};

export const findVideoChatViewpoint = <T extends VideoChatViewpoint>(
  viewpoints: T[],
  viewpoint: string,
): T | undefined => {
  const normalizedViewpoint = normalize(viewpoint);

  if (!normalizedViewpoint) {
    return undefined;
  }

  // Match user-friendly player names first, but also allow the raw video name
  // for cases where chat text was generated from metadata or copied manually.
  return [...viewpoints]
    .sort((a, b) => Number(a.cloud) - Number(b.cloud))
    .find((candidate) =>
      getViewpointAliases(candidate).includes(normalizedViewpoint),
    );
};
