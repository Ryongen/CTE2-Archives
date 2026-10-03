/** Where things live. Each has a dev default, and the deployed build sets them in Pages. */

/** The catalogue API (`apps/api`). */
export const API_URL = (import.meta.env.VITE_API_URL ?? "http://localhost:8787").replace(/\/$/, "");

/**
 * CoB's published site, which serves the game data (`data/manifest.json`, the snapshot and the
 * icons) with CORS open. The catalogue reads it from there rather than shipping its own copy.
 */
export const COB_SITE = (import.meta.env.VITE_COB_SITE ?? "https://ryongen.github.io/Craft-Of-Building/").replace(
  /\/?$/,
  "/",
);

/** Turnstile site key for uploads. Unset in local dev, where the API doesn't check either. */
export const TURNSTILE_SITE_KEY: string | undefined = import.meta.env.VITE_TURNSTILE_SITE_KEY || undefined;
