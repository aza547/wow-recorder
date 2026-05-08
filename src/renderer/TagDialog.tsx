import { RendererVideo } from 'main/types';
import { Dispatch, SetStateAction, useState } from 'react';
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
import { Textarea } from './components/TextArea/textarea';

interface IProps {
  tag: string;
  videos: RendererVideo[];
  setVideoState: Dispatch<SetStateAction<RendererVideo[]>>;
  children: React.ReactNode;
  language: Language;
}

export default function TagDialog(props: IProps) {
  const { videos, setVideoState, children, language, tag } = props;
  const [open, setOpen] = useState(false);
  const [innerTag, setInnerTag] = useState(tag);

  const handleOpenChange = (isOpen: boolean) => {
    setOpen(isOpen);
    setInnerTag(tag);
  };

  const saveTag = (newTag: string) => {
    const toProtectDisk = videos.filter((v) => !v.cloud);
    const toProtectCloud = videos.filter((v) => v.cloud);

    window.electron.ipcRenderer.sendMessage('videoButtonDisk', [
      'tag',
      newTag,
      toProtectDisk,
    ]);

    window.electron.ipcRenderer.sendMessage('videoButtonCloud', [
      'tag',
      newTag,
      toProtectCloud,
    ]);

    setVideoState((prev) => {
      const state = [...prev];

      state.forEach((rv) => {
        // A video is uniquely identified by its name and storage type.
        const match = videos.find(
          (v) => v.videoName === rv.videoName && v.cloud === rv.cloud,
        );

        if (match) {
          rv.tag = newTag;
        }
      });

      return state;
    });
  };

  const clearTag = (event: React.MouseEvent<HTMLElement>) => {
    event.stopPropagation();
    saveTag('');
  };

  const onSave = (event: React.MouseEvent<HTMLElement>) => {
    event.stopPropagation();
    saveTag(innerTag ?? '');
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {getLocalePhrase(language, Phrase.AddADescription)}
          </DialogTitle>
        </DialogHeader>
        <Textarea
          maxLength={1024}
          className="bg-background-dark-gradient-to rounded-sm h-40
                    border-background-dark-gradient-to flex-1 resize-none
                    placeholder:text-foreground  focus-visible:ring-0
                    focus-visible:border-background-dark-gradient-to scrollbar-thin py-2"
          placeholder={getLocalePhrase(language, Phrase.TagButtonTooltip)}
          spellCheck={false}
          value={innerTag}
          onChange={(e) => setInnerTag(e.target.value)}
          onKeyDown={(e) => {
            // Need this to prevent "k" triggering video play/pause while
            // dialog is open and other similar things.
            e.stopPropagation();
          }}
        />
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="ghost">
              {getLocalePhrase(language, Phrase.CancelTooltip)}
            </Button>
          </DialogClose>
          <DialogClose asChild>
            <Button onClick={clearTag} variant="ghost">
              {getLocalePhrase(language, Phrase.Clear)}
            </Button>
          </DialogClose>
          <DialogClose asChild>
            <Button onClick={onSave} type="submit">
              {getLocalePhrase(language, Phrase.Save)}
            </Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
