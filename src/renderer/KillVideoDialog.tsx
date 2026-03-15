import { KillVideoSegment, RendererVideo } from 'main/types';
import { getLocalePhrase } from 'localisation/translations';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from './components/Dialog/Dialog';
import { Button } from './components/Button/Button';
import { Language, Phrase } from 'localisation/phrases';
import { ReactNode, useState } from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './components/Select/Select';
import { Tooltip } from './components/Tooltip/Tooltip';
import Label from './components/Label/Label';
import { Info } from 'lucide-react';
import { obsResolutions } from 'main/constants';
import KillVideoSourceTimeline from './KillVideoSourceTimeline';
import Switch from './components/Switch/Switch';

const ipc = window.electron.ipcRenderer;

interface IProps {
  sources: RendererVideo[];
  language: Language;
  children: ReactNode;
}

const KillVideoDialog = (props: IProps) => {
  const [open, setOpen] = useState(false);
  const { children, language, sources } = props;

  // Our select component only accepts strings annoyingly.
  const [fps, setFps] = useState('60');
  const [singleAudio, setSingleAudio] = useState(false);
  const [audioTrackPlayer, setAudioTrackPlayer] = useState(
    sources[0]?.player?._name || '',
  );
  const [resolution, setResolution] =
    useState<keyof typeof obsResolutions>('1920x1080');

  const [segments, setSegments] = useState<KillVideoSegment[]>(() => {
    // Calculate the length of the video as the shortest source. That
    // avoids weird conditions due to misclipped videos. Not perfect
    // but should be good enough for now.
    let videoDuration = Number.MAX_SAFE_INTEGER;

    sources.forEach((rv) => {
      videoDuration = Math.min(videoDuration, rv.duration);
    });

    const segmentDuration = videoDuration / sources.length;

    return sources.map((rv, idx) => ({
      video: rv,
      start: idx * segmentDuration,
      stop: (idx + 1) * segmentDuration,
    }));
  });

  const createKillVideo = () => {
    const { width, height } = obsResolutions[resolution];
    let audioTrackIndex = -1;

    if (singleAudio) {
      // If not found, findIndex returns -1 so if something goes wrong will
      // just fallback to splicing all the audio tracks.
      audioTrackIndex = segments.findIndex(
        (s) => s.video.player?._name === audioTrackPlayer,
      );
    }

    ipc.createKillVideo(
      width,
      height,
      parseInt(fps, 10),
      segments,
      audioTrackIndex,
    );
  };

  const getFpsSelect = () => {
    // Our select component only accepts strings annoyingly.
    const options = ['10', '20', '30', '60'];

    return (
      <div className="flex flex-col w-1/4 min-w-40 max-w-60">
        <Label className="flex items-center">
          {getLocalePhrase(language, Phrase.FPSLabel)}
        </Label>
        <Select value={fps} onValueChange={setFps}>
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {options.map((option) => (
              <SelectItem key={option} value={option}>
                {option}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    );
  };

  const getAudioSwitch = () => {
    return (
      <div className="flex flex-col w-[140px]">
        <Label className="flex items-center">
          {getLocalePhrase(language, Phrase.KillVideoSingleAudioTrackLabel)}
          <Tooltip
            content={getLocalePhrase(
              language,
              Phrase.KillVideoSingleAudioTrackTooltip,
            )}
            side="right"
          >
            <Info size={20} className="inline-flex ml-2" />
          </Tooltip>
        </Label>
        <div className="flex h-10 items-center">
          <Switch checked={singleAudio} onCheckedChange={setSingleAudio} />
        </div>
      </div>
    );
  };

  const getAudioTrackSelect = () => {
    const options = segments.map(
      (s) => s.video.player?._name || s.video.videoName,
    );

    return (
      <div className="flex flex-col w-1/4 min-w-40 max-w-60">
        <Label className="flex items-center">
          {getLocalePhrase(language, Phrase.KillVideoAudioTrackLabel)}
          <Tooltip
            content={getLocalePhrase(
              language,
              Phrase.KillVideoAudioTrackTooltip,
            )}
            side="right"
          >
            <Info size={20} className="inline-flex ml-2" />
          </Tooltip>
        </Label>
        <Select value={audioTrackPlayer} onValueChange={setAudioTrackPlayer}>
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {options.map((option) => (
              <SelectItem key={option} value={option}>
                {option}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    );
  };

  const getResolutionSelect = () => {
    const options = Object.keys(obsResolutions);

    return (
      <div className="flex flex-col w-1/4 min-w-40 max-w-60">
        <Label className="flex items-center">
          {getLocalePhrase(language, Phrase.CanvasResolutionLabel)}
        </Label>
        <Select
          value={resolution}
          onValueChange={(value) =>
            setResolution(value as keyof typeof obsResolutions)
          }
        >
          <SelectTrigger className="w-full">
            <SelectValue
              placeholder={getLocalePhrase(language, Phrase.SelectResolution)}
            />
          </SelectTrigger>
          <SelectContent>
            {options.map((option) => (
              <SelectItem key={option} value={option}>
                {option}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    );
  };

  const resetSettings = (event: React.MouseEvent<HTMLElement>) => {
    event.stopPropagation();

    // Calculate the length of the video as the shortest source. That
    // avoids weird conditions due to misclipped videos. Not perfect
    // but should be good enough for now.
    let videoDuration = Number.MAX_SAFE_INTEGER;

    sources.forEach((rv) => {
      videoDuration = Math.min(videoDuration, rv.duration);
    });

    const segmentDuration = videoDuration / sources.length;

    const resetSegments = sources.map((rv, idx) => ({
      video: rv,
      start: idx * segmentDuration,
      stop: (idx + 1) * segmentDuration,
    }));

    setSegments(resetSegments);
    setFps('60');
    setResolution('1920x1080');
  };

  if (!open) {
    // Lazy render the dialog for performance.
    return (
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>{children}</DialogTrigger>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="max-w-[70%]">
        <DialogHeader>
          <DialogTitle>
            {getLocalePhrase(language, Phrase.KillVideoCreatorTitle)}
          </DialogTitle>
          <div className="text-sm text-foreground text-left">
            {getLocalePhrase(language, Phrase.KillVideoDescription)}
          </div>
        </DialogHeader>

        <KillVideoSourceTimeline
          segments={segments}
          setSegments={setSegments}
          language={language}
        >
          <div className="flex flex-col gap-4">
            {getFpsSelect()}
            {getResolutionSelect()}
            {getAudioSwitch()}
            {singleAudio && getAudioTrackSelect()}
          </div>
        </KillVideoSourceTimeline>

        <DialogFooter>
          <DialogClose asChild>
            <Button variant="ghost">
              {getLocalePhrase(language, Phrase.CancelTooltip)}
            </Button>
          </DialogClose>
          <Button onClick={resetSettings} variant="ghost">
            {getLocalePhrase(language, Phrase.Reset)}
          </Button>
          <DialogClose asChild>
            <Button onClick={() => createKillVideo()} type="submit">
              {getLocalePhrase(language, Phrase.Render)}
            </Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default KillVideoDialog;
