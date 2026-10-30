/**
 * sharePageLink — forward a public URL to other apps.
 *
 * Mobile / PWA: opens the native share sheet (WhatsApp, SMS, email, …)
 * via navigator.share when the browser supports it. Everywhere else it
 * falls back to copying the link to the clipboard, and finally to the
 * legacy execCommand path for old/insecure contexts. Callers get a
 * structured result so they can show "Link copied" feedback.
 */

export interface ShareLinkResult {
  /** The native share sheet completed a share. */
  shared: boolean;
  /** The URL was copied to the clipboard (fallback path). */
  copied: boolean;
  /** The user closed the native share sheet without sharing. */
  cancelled: boolean;
}

export async function sharePageLink(options: {
  title: string;
  text?: string;
  url: string;
}): Promise<ShareLinkResult> {
  const nav = typeof navigator === "undefined" ? undefined : navigator;

  if (nav?.share) {
    try {
      await nav.share({
        title: options.title,
        text: options.text,
        url: options.url,
      });
      return { shared: true, copied: false, cancelled: false };
    } catch (error) {
      // Closing the sheet without sharing is not an error for the
      // caller — just a no-op.
      if (error instanceof DOMException && error.name === "AbortError") {
        return { shared: false, copied: false, cancelled: true };
      }
      // Some engines reject with NotAllowedError / TypeError for
      // unsupported data — fall through to the clipboard copy below.
    }
  }

  try {
    await copyTextToClipboard(options.url);
    return { shared: false, copied: true, cancelled: false };
  } catch {
    // Clipboard blocked (permissions / insecure context) — nothing else
    // we can do without a custom dialog; report a silent no-op.
    return { shared: false, copied: false, cancelled: false };
  }
}

/** Clipboard copy with an execCommand fallback for insecure contexts. */
export async function copyTextToClipboard(text: string): Promise<void> {
  if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();
  try {
    document.execCommand("copy");
  } finally {
    document.body.removeChild(textarea);
  }
}
