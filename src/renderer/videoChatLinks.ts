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

type VideoChatMentionPart = {
  type: 'mention';
  text: string;
  viewpoint: string;
};

export type VideoChatMessagePart =
  | VideoChatTextPart
  | VideoChatLinkPart
  | VideoChatMentionPart;

export type VideoChatViewpoint = {
  videoName: string;
  cloud: boolean;
  player?: {
    _name?: string;
    _realm?: string;
  };
};

export type VideoChatMentionSuggestion<T extends VideoChatViewpoint> = {
  viewpoint: T;
  label: string;
  detail?: string;
  // Text inserted after @. It includes the realm only when the short player
  // name would be ambiguous.
  mention: string;
  // Lowercase aliases used by the textarea mention filter.
  searchText: string;
};

// Supports plain timestamps, and optional POV-qualified timestamps:
// "2:15" or "@Player-Realm 2:15".
const chatLinkRegex =
  /(?:@([^\s@,.;:!?)}\]]+)[,.;:!?)}\]]*\s+)?\b(\d{1,2}):(\d{2})\b/g;
const chatMentionRegex = /(^|\s)@([^\s@,.;:!?)}\]]+)/g;

const normalize = (value: string) => value.trim().toLowerCase();

const appendTextPart = (parts: VideoChatMessagePart[], text: string) => {
  if (text.length > 0) {
    parts.push({ type: 'text', text });
  }
};

const appendTextAndMentionParts = (
  parts: VideoChatMessagePart[],
  text: string,
) => {
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  chatMentionRegex.lastIndex = 0;

  while ((match = chatMentionRegex.exec(text)) !== null) {
    const [rawText, separator, viewpoint] = match;
    const mentionStart = match.index + separator.length;

    appendTextPart(parts, text.slice(lastIndex, mentionStart));

    parts.push({
      type: 'mention',
      text: rawText.slice(separator.length),
      viewpoint,
    });

    lastIndex = match.index + rawText.length;
  }

  appendTextPart(parts, text.slice(lastIndex));
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

    appendTextAndMentionParts(parts, message.slice(lastIndex, match.index));

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

  appendTextAndMentionParts(parts, message.slice(lastIndex));

  return parts;
};

const getPlayerName = (viewpoint: VideoChatViewpoint) =>
  viewpoint.player?._name;

const getPlayerRealm = (viewpoint: VideoChatViewpoint) =>
  viewpoint.player?._realm;

const getViewpointAliases = (viewpoint: VideoChatViewpoint) => {
  const playerName = getPlayerName(viewpoint);
  const playerRealm = getPlayerRealm(viewpoint);

  if (!playerName) {
    return [];
  }

  const aliases = [playerName];

  if (playerRealm) {
    aliases.push(`${playerName}-${playerRealm}`);
  }

  return aliases.map(normalize);
};

const getPlayerNameContexts = (viewpoints: VideoChatViewpoint[]) => {
  // Disk and cloud copies of the same POV share one context. Distinct
  // player identities make the short name ambiguous.
  return viewpoints.reduce<Map<string, Set<string>>>((counts, viewpoint) => {
    const playerName = getPlayerName(viewpoint);

    if (!playerName) {
      return counts;
    }

    const normalizedName = normalize(playerName);
    const context = normalize(getPlayerRealm(viewpoint) || viewpoint.videoName);
    const contexts = counts.get(normalizedName) || new Set<string>();
    contexts.add(context);
    counts.set(normalizedName, contexts);
    return counts;
  }, new Map());
};

export const getVideoChatMentionSuggestions = <T extends VideoChatViewpoint>(
  viewpoints: T[],
): VideoChatMentionSuggestion<T>[] => {
  const playerNameContexts = getPlayerNameContexts(viewpoints);
  const seen = new Set<string>();

  return [...viewpoints]
    .sort((a, b) => Number(a.cloud) - Number(b.cloud))
    .reduce<VideoChatMentionSuggestion<T>[]>((suggestions, viewpoint) => {
      const label = getPlayerName(viewpoint);
      const realm = getPlayerRealm(viewpoint);

      if (!label) {
        return suggestions;
      }

      const normalizedLabel = normalize(label);
      const duplicateName =
        (playerNameContexts.get(normalizedLabel)?.size || 0) > 1;

      if (duplicateName && !realm) {
        return suggestions;
      }

      const mention = duplicateName ? `${label}-${realm}` : label;
      const key = normalize(mention);

      if (seen.has(key)) {
        return suggestions;
      }

      seen.add(key);

      suggestions.push({
        viewpoint,
        label,
        detail: realm,
        mention,
        searchText: getViewpointAliases(viewpoint).join(' '),
      });

      return suggestions;
    }, []);
};

export const findVideoChatViewpoint = <T extends VideoChatViewpoint>(
  viewpoints: T[],
  viewpoint: string,
): T | undefined => {
  const normalizedViewpoint = normalize(viewpoint);

  if (!normalizedViewpoint) {
    return undefined;
  }

  const playerNameContexts = getPlayerNameContexts(viewpoints);
  const matchingContexts = playerNameContexts.get(normalizedViewpoint);

  if (matchingContexts && matchingContexts.size > 1) {
    return undefined;
  }

  // Match user-friendly player names and Player-Realm aliases.
  return [...viewpoints]
    .sort((a, b) => Number(a.cloud) - Number(b.cloud))
    .find((candidate) =>
      getViewpointAliases(candidate).includes(normalizedViewpoint),
    );
};
