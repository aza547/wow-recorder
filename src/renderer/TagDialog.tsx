import { RendererVideo } from 'main/types';
import { Dispatch, SetStateAction, useState } from 'react';
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
import { Input } from './components/Input/Input';
import { Button } from './components/Button/Button';
import { Language, Phrase } from 'localisation/phrases';

interface IProps {
  initialTag: string;
  videos: RendererVideo[];
  setVideoState: Dispatch<SetStateAction<RendererVideo[]>>;
  children: React.ReactNode;
  language: Language;
}

export default function TagDialog(props: IProps) {
  const { videos, setVideoState, children, language, initialTag } = props;

  const [tag, setTag] = useState(initialTag);

  const saveTag = (newTag: string) => {
    window.electron.ipcRenderer.sendMessage('videoButton', [
      'tag',
      newTag,
      videos,
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
    saveTag(tag ?? '');
  };

  return (
    <Dialog>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {getLocalePhrase(language, Phrase.AddADescription)}
          </DialogTitle>
          <DialogDescription>
            {getLocalePhrase(language, Phrase.TagDialogText)}
          </DialogDescription>
        </DialogHeader>
        <Input
          autoFocus
          type="text"
          id="newTag"
          name="newTag"
          defaultValue={initialTag}
          spellCheck={false}
          onKeyDown={(e) => {
            // Need this to prevent "k" triggering video play/pause while
            // dialog is open and other similar things.
            e.stopPropagation();
          }}
          onChange={(e) => setTag(e.target.value)}
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
