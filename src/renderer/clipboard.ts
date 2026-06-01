type ClipboardLike = {
  write?: (data: ClipboardItem[]) => Promise<void>;
  writeText: (text: string) => Promise<void>;
};

type ClipboardItemConstructor = new (
  items: Record<string, Blob | Promise<Blob>>,
) => ClipboardItem;

/**
 * Safari/WebKit rejects clipboard writes if they happen after the click
 * handler has awaited async work. Passing a Promise-backed ClipboardItem lets
 * us start the write during the user gesture while the link is still loading.
 */
export async function copyTextPromiseToClipboard(
  textPromise: Promise<string>,
  clipboard: ClipboardLike = navigator.clipboard,
  ClipboardItemCtor:
    | ClipboardItemConstructor
    | undefined = globalThis.ClipboardItem,
) {
  if (clipboard.write && ClipboardItemCtor) {
    // Keep this promise lazy so clipboard.write is called synchronously.
    const textBlobPromise = textPromise.then(
      (text) => new Blob([text], { type: 'text/plain' }),
    );

    await clipboard.write([
      new ClipboardItemCtor({ 'text/plain': textBlobPromise }),
    ]);
    return;
  }

  await clipboard.writeText(await textPromise);
}
