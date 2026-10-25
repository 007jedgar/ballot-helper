/** The canonical public URL (no trailing slash). */
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://www.ballothelper.app").replace(/\/$/, "");

/** For pages that only make sense with a ballot loaded in this browser, or that are private (shared picks). */
export const NOINDEX = { index: false, follow: true } as const;
