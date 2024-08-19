import { Mic, MicOff } from 'lucide-react';
import { MicStatus } from 'main/types';
import { Tooltip } from 'renderer/components/Tooltip/Tooltip';

const MicrophoneStatus = ({ micStatus }: { micStatus: MicStatus }) => {
  if (micStatus === MicStatus.LISTENING) {
    return (
      <Tooltip content="Listening" side="right">
        <Mic size={20} />
      </Tooltip>
    );
  }

  if (micStatus === MicStatus.MUTED) {
    return (
      <Tooltip content="Muted" side="right">
        <MicOff size={20} />
      </Tooltip>
    );
  }

  return null;
};

export default MicrophoneStatus;
