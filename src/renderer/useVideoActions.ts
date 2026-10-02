import {
  useMutation,
  useMutationState,
  useQueryClient,
} from '@tanstack/react-query';
import { Language, Phrase } from 'localisation/phrases';
import { getLocalePhrase } from 'localisation/translations';
import { RendererVideo, VideoAction } from 'main/types';
import { Dispatch, SetStateAction } from 'react';
import { toast } from './components/Toast/useToast';

type VideoActionVariables = {
  action: VideoAction;
  targets: RendererVideo[];
};

const mutationKey = ['video-action'];

export default function useVideoActions(
  setVideoState: Dispatch<SetStateAction<RendererVideo[]>>,
  language: Language,
) {
  const queryClient = useQueryClient();
  const pending = useMutationState({
    filters: { mutationKey, status: 'pending' },
    select: (mutation) =>
      (mutation.state.variables as VideoActionVariables).targets,
  }).flat();

  const mutation = useMutation({
    mutationKey,
    networkMode: 'always',
    mutationFn: async ({ action, targets }: VideoActionVariables) => {
      const results = await Promise.allSettled(
        [false, true].map(async (cloud) => {
          const videos = targets.filter((video) => video.cloud === cloud);
          if (videos.length === 0) return [] as string[];

          return window.electron.ipcRenderer.invoke(
            cloud ? 'videoActionCloud' : 'videoActionDisk',
            [action, videos],
          ) as Promise<string[]>;
        }),
      );

      const succeeded = results.flatMap((result) =>
        result.status === 'fulfilled' ? result.value : [],
      );

      // Cloud state is supplied by the server's WebSocket events.
      setVideoState((prev) =>
        prev.flatMap((video) => {
          if (video.cloud || !succeeded.includes(video.uniqueId))
            return [video];
          if (action.type === 'delete') return [];
          if (action.type === 'protect') {
            return [
              { ...video, protected: action.value, isProtected: action.value },
            ];
          }
          return [
            { ...video, tag: action.value.trim() ? action.value : undefined },
          ];
        }),
      );

      if (succeeded.length !== targets.length) {
        toast({
          title: getLocalePhrase(language, Phrase.VideoActionFailed),
          description: getLocalePhrase(
            language,
            Phrase.ShareableLinkFailedText,
          ),
          variant: 'destructive',
          duration: 5000,
        });
      }

      return succeeded;
    },
  });

  const isPending = (targets: RendererVideo[]) =>
    targets.some((video) =>
      pending.some((item) => item.uniqueId === video.uniqueId),
    );

  const run = async (action: VideoAction, targets: RendererVideo[]) => {
    // Check the cache synchronously as a second click can precede a render.
    const busy = queryClient.isMutating({
      mutationKey,
      predicate: (item) =>
        (item.state.variables as VideoActionVariables).targets.some((video) =>
          targets.some((target) => target.uniqueId === video.uniqueId),
        ),
    });

    if (busy || targets.length === 0) return [];
    return mutation.mutateAsync({ action, targets });
  };

  return { run, isPending };
}
