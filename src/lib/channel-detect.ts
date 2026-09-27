/**
 * Channel-page detection and channel-ID extraction.
 *
 * Pure functions over explicit inputs (no DOM access) so they are unit-testable;
 * content.ts wires them to the live DOM.
 *
 * Design note: the meta tag is primary. The fallback chain deliberately avoids
 * `window.ytInitialData`: content scripts run in an isolated JS world where page
 * variables are invisible, so reading it would require injecting a <script> into
 * the page context (CSP friction + race with SPA navigation). The canonical
 * <link> carries the same channel ID, is DOM-accessible, and is locale-independent.
 */

const CHANNEL_RE = /^\/(?:@[^/]+|channel\/[^/]+|c\/[^/]+|user\/[^/]+)\/?$/;

/** True for /@handle, /channel/UC…, /c/custom, /user/legacy channel home pages. */
export function isChannelPath(pathname: string): boolean {
  return CHANNEL_RE.test(pathname);
}

/** Primary source: <meta itemprop="channelId" content="UC…">. */
export function channelIdFromMeta(content: string | null | undefined): string | null {
  const trimmed = content?.trim();
  return trimmed ? trimmed : null;
}

/** Fallback: <link rel="canonical" href="https://www.youtube.com/channel/UC…">. */
export function channelIdFromCanonical(href: string | null | undefined): string | null {
  if (!href) return null;
  const m = href.match(/youtube\.com\/channel\/([^/?#]+)/);
  return m ? m[1] : null;
}

/** Last resort: the /channel/UC… URL form carries the ID directly. */
export function channelIdFromPath(pathname: string): string | null {
  const m = pathname.match(/^\/channel\/([^/?#]+)/);
  return m ? m[1] : null;
}

/** Priority: meta tag → canonical link → /channel/ URL. */
export function resolveChannelId(
  metaContent: string | null | undefined,
  canonicalHref: string | null | undefined,
  pathname: string,
): string | null {
  return (
    channelIdFromMeta(metaContent) ??
    channelIdFromCanonical(canonicalHref) ??
    channelIdFromPath(pathname)
  );
}
