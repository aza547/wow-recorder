import { KillVideoSegment, RendererVideo } from 'main/types';
import { getLocalePhrase } from 'localisation/translations';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from './components/Dialog/Dialog';
import { Button } from './components/Button/Button';
import { Language, Phrase } from 'localisation/phrases';
import { useEffect, useState, useMemo, useRef } from 'react';
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
import { getVideoGroup } from './rendererutils';

const ipc = window.electron.ipcRenderer;

interface IProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  targetVideoId: string | null;
  parentLookupMap: Map<string, RendererVideo>;
  language: Language;
}

const KillVideoDialog = (props: IProps) => {
  const { open, onOpenChange, targetVideoId, parentLookupMap, language } =
    props;

  // This React logic is super gross but we need the kill video dialog to
  // snapshot the sources when it opens so that we can calculate the segments,
  // which shouldn't be reset on an update to the parentLookupMap, triggered
  // by another user in the guild. It's not possible for a change another user
  // makes to impact this dialog as it only operates on local videos.
  const sources = useMemo(() => {
    const group = getVideoGroup(targetVideoId, parentLookupMap);
    return group.filter((rv) => !rv.cloud);
  }, [targetVideoId, parentLookupMap]);

  const sourcesRef = useRef<Array<RendererVideo>>([]);

  useEffect(() => {
    sourcesRef.current = sources;
  }, [sources]);

  useEffect(() => {
    // Calculate the length of the video as the shortest source. That
    // avoids weird conditions due to misclipped videos. Not perfect
    // but should be good enough for now.
    let videoDuration = Number.MAX_SAFE_INTEGER;

    sourcesRef.current.forEach((rv) => {
      videoDuration = Math.min(videoDuration, rv.duration);
    });

    const segmentDuration = videoDuration / sourcesRef.current.length;

    setSegments(
      sourcesRef.current.map((rv, idx) => ({
        video: rv,
        start: idx * segmentDuration,
        stop: (idx + 1) * segmentDuration,
      })),
    );

    setFps('60');
    setResolution('1920x1080');
    setSingleAudioSource(false);
    setSingleAudioSourcePlayer(sourcesRef.current[0]?.player?._name || '');
  }, [open]);

  // Our select component only accepts strings annoyingly.
  const [fps, setFps] = useState('60');
  const [singleAudioSource, setSingleAudioSource] = useState(false);

  const [singleAudioSourcePlayer, setSingleAudioSourcePlayer] = useState('');
  const [resolution, setResolution] =
    useState<keyof typeof obsResolutions>('1920x1080');

  const [segments, setSegments] = useState<KillVideoSegment[]>([]);

  const getSingleAudioSourceIndex = () => {
    return singleAudioSource
      ? segments.findIndex(
          (s) => s.video.player?._name === singleAudioSourcePlayer,
        )
      : -1;
  };

  const createKillVideo = () => {
    const { width, height } = obsResolutions[resolution];
    const audioSegmentIndex = getSingleAudioSourceIndex();

    ipc.createKillVideo(
      width,
      height,
      parseInt(fps, 10),
      segments,
      audioSegmentIndex,
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
      <div className="flex flex-col w-[160px]">
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
          <Switch
            checked={singleAudioSource}
            onCheckedChange={setSingleAudioSource}
          />
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
        <Select
          value={singleAudioSourcePlayer}
          onValueChange={setSingleAudioSourcePlayer}
        >
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
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
            {singleAudioSource && getAudioTrackSelect()}
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
            <Button
              onClick={() => createKillVideo()}
              type="submit"
              disabled={singleAudioSource && getSingleAudioSourceIndex() === -1}
            >
              {getLocalePhrase(language, Phrase.Render)}
            </Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default KillVideoDialog;
