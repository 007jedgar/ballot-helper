/**
 * Optional "chip in" links (e.g. Stripe Payment Links), set at build time.
 * NEXT_PUBLIC_SUPPORT_URL is a choose-your-own-amount link; the per-amount
 * links are optional and add one-tap amount buttons. Nothing shows without them.
 */
export const SUPPORT_URL = process.env.NEXT_PUBLIC_SUPPORT_URL || null;

export const SUPPORT_AMOUNTS = [
  { amount: 3, url: process.env.NEXT_PUBLIC_SUPPORT_URL_3 },
  { amount: 5, url: process.env.NEXT_PUBLIC_SUPPORT_URL_5, suggested: true },
  { amount: 10, url: process.env.NEXT_PUBLIC_SUPPORT_URL_10 },
  { amount: 20, url: process.env.NEXT_PUBLIC_SUPPORT_URL_20 },
].filter((a): a is { amount: number; url: string; suggested?: boolean } => Boolean(a.url));

export const supportEnabled = Boolean(SUPPORT_URL || SUPPORT_AMOUNTS.length);
