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

  const createKillVideo = () => {
    const { width, height } = obsResolutions[resolution];
    ipc.createKillVideo(width, height, parseInt(fps, 10), quality, sources);
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
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Create Kill Video</DialogTitle>
          <DialogDescription>
            Create a multiple perspective kill video. This requires re-encoding
            the video stream so will take some time and resources.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-row gap-x-2">
          {getQualitySelect()}
          {getFpsSelect()}
          {getResolutionSelect()}
        </div>

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
