export type Env = {
  DB: D1Database;
  /** When set, web uploads must carry a valid Turnstile token. Unset in local dev. */
  TURNSTILE_SECRET?: string;
};
