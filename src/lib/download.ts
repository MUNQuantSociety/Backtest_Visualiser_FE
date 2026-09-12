/**
 * Handing a fetched file to the browser's downloader.
 *
 * This lives in `lib/` rather than `utils/` because it is not a pure function:
 * it allocates an object URL, puts an element in the document and clicks it.
 * That is the only way to save a response the page fetched itself — and the
 * page has to fetch it, rather than pointing an `<a href>` at the endpoint,
 * so the request carries the api client's credentials and so a failure can be
 * reported in the UI instead of replacing it with the browser's own error page.
 */

/**
 * Save `blob` to the viewer's downloads as `filename`.
 *
 * The anchor is appended before it is clicked: a detached element's click is
 * ignored by Firefox. Revoking happens on the next tick rather than
 * immediately, because Safari reads the href asynchronously and a revoked URL
 * gives it nothing to save.
 */
export function saveBlob(blob: Blob, filename: string): void {
  const href = URL.createObjectURL(blob);
  const anchor = document.createElement('a');

  anchor.href = href;
  anchor.download = filename;
  anchor.rel = 'noopener';
  anchor.hidden = true;

  document.body.append(anchor);
  anchor.click();
  anchor.remove();

  setTimeout(() => {
    URL.revokeObjectURL(href);
  }, 0);
}
