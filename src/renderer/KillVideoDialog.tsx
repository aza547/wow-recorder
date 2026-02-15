import { RendererVideo } from 'main/types';
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
import { useState } from 'react';
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
import { translateQuality } from './rendererutils';
import { obsResolutions } from 'main/constants';
import SourceTimeline, { TimelineSegment } from './SourceTimeline';
import { useRef } from 'react';
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from './components/Tabs/Tabs';

interface IProps {
  sources: RendererVideo[];
  children: React.ReactNode;
  language: Language;
}

const ipc = window.electron.ipcRenderer;

export default function KillVideoDialog(props: IProps) {
  const { children, language, sources } = props;

  // Our select component only accepts strings annoyingly.
  const [fps, setFps] = useState('60');
  const [quality, setQuality] = useState(QualityPresets.HIGH);
  const [resolution, setResolution] =
    useState<keyof typeof obsResolutions>('1920x1080');

  // Keep the latest timeline segment state so we can pass it to createKillVideo.
  const segmentsRef = useRef<TimelineSegment[] | null>(null);

  const handleTimelineChange = (segs: TimelineSegment[]) => {
    segmentsRef.current = segs;
  };

  const createKillVideo = () => {
    const { width, height } = obsResolutions[resolution];
    const orderedSources = segmentsRef.current
      ? segmentsRef.current.map((s) => ({
          ...s.video,
          duration: s.duration,
        }))
      : sources;
    ipc.createKillVideo(
      width,
      height,
      parseInt(fps, 10),
      quality,
      orderedSources,
    );
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

  return (
    <Dialog>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="max-w-5xl">
        <DialogHeader>
          <DialogTitle>Create Kill Video</DialogTitle>
          <DialogDescription>
            <p>
              Lorem Ipsum is simply dummy text of the printing and typesetting
              industry. Lorem Ipsum has been the industrys standard dummy text
              ever since the 1500s, when an unknown printer took a galley of
              type and scrambled it to make a type specimen book.
            </p>
            <br></br>
            <p>
              It has survived not only five centuries, but also the leap into
              electronic typesetting, remaining essentially unchanged. It was
              popularised in the 1960s with the release of Letraset sheets
              containing Lorem Ipsum passages, and more recently with desktop
              publishing software like Aldus PageMaker including versions of
              Lorem Ipsum.
            </p>
          </DialogDescription>
        </DialogHeader>
        <Tabs defaultValue="timeline">
          <TabsList>
            <TabsTrigger value="timeline">Timeline</TabsTrigger>
            <TabsTrigger value="settings">Settings</TabsTrigger>
          </TabsList>
          <TabsContent value="timeline" className="mt-4">
            <SourceTimeline sources={sources} onChange={handleTimelineChange} />
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
          <DialogClose asChild>
            <Button onClick={() => createKillVideo()} type="submit">
              Create
            </Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
