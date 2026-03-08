import { KillVideoSegment, RendererVideo } from 'main/types';
import { getLocalePhrase } from 'localisation/translations';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from './components/Dialog/Dialog';
import { Button } from './components/Button/Button';
import { Language, Phrase } from 'localisation/phrases';
import { ReactNode, useState } from 'react';
import { QualityPresets } from 'main/obsEnums';
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
import { configSchema } from 'config/configSchema';
import { filterKillVideoSources, translateQuality } from './rendererutils';
import { obsResolutions } from 'main/constants';
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from './components/Tabs/Tabs';
import KillVideoSourceTimeline from './KillVideoSourceTimeline';
import Switch from './components/Switch/Switch';

const ipc = window.electron.ipcRenderer;

interface IProps {
  sources: RendererVideo[];
  language: Language;
  children: ReactNode;
}

const KillVideoDialog = (props: IProps) => {
  const { children, language, sources } = props;

  // Our select component only accepts strings annoyingly.
  const [fps, setFps] = useState('60');
  const [singleAudio, setSingleAudio] = useState(false);
  const [audioTrackPlayer, setAudioTrackPlayer] = useState(
    sources[0].player?._name || '',
  );
  const [resolution, setResolution] =
    useState<keyof typeof obsResolutions>('1920x1080');

  const [segments, setSegments] = useState<KillVideoSegment[]>(() => {
    // Calculate the length of the video as the shortest source. That
    // avoids weird conditions due to misclipped videos. Not perfect
    // but should be good enough for now.
    let videoDuration = Number.MAX_SAFE_INTEGER;
    const filtered = filterKillVideoSources(sources);

    filtered.forEach((rv) => {
      videoDuration = Math.min(videoDuration, rv.duration);
    });

    const segmentDuration = videoDuration / filtered.length;

    return filtered.map((rv, idx) => ({
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
          <Tooltip content="FPS To use" side="right">
            <Info size={20} className="inline-flex ml-2" />
          </Tooltip>
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
          Single Audio Track
          <Tooltip
            content="Enable this to use a single audio track in the kill video. Leave disabled to switch audio tracks with video"
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
          Audio Track
          <Tooltip content="Select the audio track to use" side="right">
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
          <Tooltip content="Resolution To use" side="right">
            <Info size={20} className="inline-flex ml-2" />
          </Tooltip>
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
    const filtered = filterKillVideoSources(sources);

    filtered.forEach((rv) => {
      videoDuration = Math.min(videoDuration, rv.duration);
    });

    const segmentDuration = videoDuration / filtered.length;

    const resetSegments = filtered.map((rv, idx) => ({
      video: rv,
      start: idx * segmentDuration,
      stop: (idx + 1) * segmentDuration,
    }));

    setSegments(resetSegments);
    setFps('60');
    setResolution('1920x1080');
  };

  return (
    <Dialog>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="max-w-[75%]">
        <DialogHeader>
          <DialogTitle>
            {getLocalePhrase(language, Phrase.KillVideoCreatorTooltip)}
          </DialogTitle>
          <DialogDescription>
            <div className="mb-2">
              {getLocalePhrase(language, Phrase.KillVideoCreatorDescription1)}
            </div>
            <ol className="list-decimal pl-6 mb-2">
              {[
                Phrase.KillVideoCreatorDescription2,
                Phrase.KillVideoCreatorDescription3,
                Phrase.KillVideoCreatorDescription4,
              ].map((p) => (
                <li key={p}>{getLocalePhrase(language, p)}</li>
              ))}
            </ol>
            <div className="mb-2">
              {getLocalePhrase(language, Phrase.KillVideoCreatorDescription5)}
            </div>
          </DialogDescription>
        </DialogHeader>
        <Tabs defaultValue="timeline">
          <TabsList>
            <TabsTrigger value="timeline">Timeline</TabsTrigger>
            <TabsTrigger value="video">Video</TabsTrigger>
            <TabsTrigger value="audio">Audio</TabsTrigger>
          </TabsList>
          <TabsContent value="timeline" className="mt-4">
            <KillVideoSourceTimeline
              segments={segments}
              setSegments={setSegments}
            />
          </TabsContent>
          <TabsContent value="video" className="m-4">
            <div className="flex flex-row gap-x-8 ">
              {getFpsSelect()}
              {getResolutionSelect()}
            </div>
          </TabsContent>
          <TabsContent value="audio" className="m-4">
            <div className="flex flex-row gap-x-8 ">
              {getAudioSwitch()}
              {singleAudio && getAudioTrackSelect()}
            </div>
          </TabsContent>
        </Tabs>

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
              Create
            </Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default KillVideoDialog;
