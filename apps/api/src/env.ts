export type Env = {
  DB: D1Database;
  /** When set, web uploads must carry a valid Turnstile token. Unset in local dev. */
  TURNSTILE_SECRET?: string;
  /** Bearer token for `/internal/*`, which only the indexer calls. Unset means those routes refuse. */
  INDEXER_TOKEN?: string;
  /** Bearer token that may edit, hide or delete any build. Unset means only uploaders can. */
  ADMIN_TOKEN?: string;
  /** Per-IP limit on `POST /builds`, from `[[ratelimits]]` in wrangler.toml. */
  UPLOAD_LIMIT?: RateLimit;
  /** Per-IP limit on every public `GET`, from `[[ratelimits]]` in wrangler.toml. */
  READ_LIMIT?: RateLimit;
};
