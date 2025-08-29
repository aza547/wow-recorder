import { Phrase } from 'localisation/phrases';
import { getLocalePhrase } from 'localisation/translations';
import { Mic, MicOff } from 'lucide-react';
import { AppState, MicStatus } from 'main/types';
import { Tooltip } from 'renderer/components/Tooltip/Tooltip';

const MicrophoneStatus = ({
  micStatus,
  appState,
}: {
  micStatus: MicStatus;
  appState: AppState;
}) => {
  if (micStatus === MicStatus.LISTENING) {
    return (
      <Tooltip
        content={getLocalePhrase(appState.language, Phrase.MicListeningTooltip)}
        side="right"
      >
        <Mic size={20} />
      </Tooltip>
    );
  }

  if (micStatus === MicStatus.MUTED) {
    return (
      <Tooltip
        content={getLocalePhrase(appState.language, Phrase.MicMutedTooltip)}
        side="right"
      >
        <MicOff size={20} />
      </Tooltip>
    );
  }

  return null;
};

export default MicrophoneStatus;
