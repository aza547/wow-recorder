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
  const [quality, setQuality] = useState(QualityPresets.HIGH);
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
    ipc.createKillVideo(width, height, parseInt(fps, 10), quality, segments);
  };

  const getQualitySelect = () => {
    const options = Object.values(QualityPresets);

    return (
      <div className="flex flex-col w-1/4 min-w-40 max-w-60">
        <Label className="flex items-center">
          {getLocalePhrase(language, Phrase.QualityLabel)}
          <Tooltip
            content={getLocalePhrase(
              language,
              configSchema.obsQuality.description,
            )}
            side="right"
          >
            <Info size={20} className="inline-flex ml-2" />
          </Tooltip>
        </Label>
        <Select
          value={quality}
          onValueChange={(value) => setQuality(value as QualityPresets)}
        >
          <SelectTrigger className="w-full">
            <SelectValue
              placeholder={getLocalePhrase(language, Phrase.SelectQuality)}
            />
          </SelectTrigger>
          <SelectContent>
            {options.map((option) => (
              <SelectItem key={option} value={option}>
                {translateQuality(option, language)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
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
    setQuality(QualityPresets.HIGH);
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
            <TabsTrigger value="settings">Settings</TabsTrigger>
          </TabsList>
          <TabsContent value="timeline" className="mt-4">
            <KillVideoSourceTimeline
              segments={segments}
              setSegments={setSegments}
            />
          </TabsContent>
          <TabsContent value="settings" className="mt-4">
            <div className="flex flex-row gap-x-4 ">
              {getQualitySelect()}
              {getFpsSelect()}
              {getResolutionSelect()}
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
