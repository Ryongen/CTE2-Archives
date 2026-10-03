export type Env = {
  DB: D1Database;
  /** When set, web uploads must carry a valid Turnstile token. Unset in local dev. */
  TURNSTILE_SECRET?: string;
  /** Bearer token for `/internal/*`, which only the indexer calls. Unset means those routes refuse. */
  INDEXER_TOKEN?: string;
  /** Per-IP limit on `POST /builds`, from `[[ratelimits]]` in wrangler.toml. */
  UPLOAD_LIMIT?: RateLimit;
};
