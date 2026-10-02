-- The catalogue's index. Raw build documents live here too (`build_docs`): R2 needs a card.

-- One row per Mine and Slash version the catalogue knows: the `index-data.json` cut from its
-- snapshot, which is all the Worker needs to summarise a build at upload time.
CREATE TABLE packs (
  mns_version TEXT PRIMARY KEY,
  index_data  TEXT NOT NULL,
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE users (
  id         TEXT PRIMARY KEY,
  discord_id TEXT UNIQUE,
  name       TEXT NOT NULL,
  mc_uuid    TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- Created now, used once the exporter publishes with a player identity.
CREATE TABLE characters (
  id         TEXT PRIMARY KEY,
  mc_uuid    TEXT,
  server_id  TEXT,
  name       TEXT NOT NULL,
  first_seen TEXT NOT NULL,
  last_seen  TEXT NOT NULL,
  UNIQUE (mc_uuid, server_id)
);

CREATE TABLE builds (
  id              TEXT PRIMARY KEY,
  kind            TEXT NOT NULL CHECK (kind IN ('planned', 'capture')),
  source          TEXT NOT NULL CHECK (source IN ('web', 'cob', 'bot', 'mod', 'server')),
  verified        INTEGER NOT NULL DEFAULT 0,
  title           TEXT NOT NULL,
  notes_md        TEXT NOT NULL DEFAULT '',
  author_id       TEXT REFERENCES users (id),
  character_id    TEXT REFERENCES characters (id),
  pack_version    TEXT,
  mns_version     TEXT,
  level           INTEGER NOT NULL,
  ascendancy      TEXT,
  main_skill      TEXT,
  -- `summarizeBuild`'s answer for the main stage, as JSON.
  summary         TEXT NOT NULL,
  content_hash    TEXT NOT NULL UNIQUE,
  edit_token_hash TEXT NOT NULL,
  visibility      TEXT NOT NULL DEFAULT 'public' CHECK (visibility IN ('public', 'unlisted')),
  status          TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'indexed', 'invalid', 'hidden')),
  created_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX builds_listed ON builds (visibility, status, created_at DESC);
CREATE INDEX builds_level ON builds (level);
CREATE INDEX builds_character ON builds (character_id);

-- Kept out of `builds` so list queries never read a document.
CREATE TABLE build_docs (
  build_id TEXT PRIMARY KEY REFERENCES builds (id) ON DELETE CASCADE,
  doc      TEXT NOT NULL,
  -- A capture's `observed` sheet, as JSON, when it came with one.
  observed TEXT
);

CREATE TABLE build_facets (
  build_id TEXT NOT NULL REFERENCES builds (id) ON DELETE CASCADE,
  kind     TEXT NOT NULL,
  value    TEXT NOT NULL,
  PRIMARY KEY (build_id, kind, value)
);
CREATE INDEX build_facets_value ON build_facets (kind, value, build_id);

CREATE TABLE build_stages (
  build_id   TEXT NOT NULL REFERENCES builds (id) ON DELETE CASCADE,
  stage_id   TEXT NOT NULL,
  position   INTEGER NOT NULL,
  name       TEXT NOT NULL,
  level      INTEGER,
  is_main    INTEGER NOT NULL DEFAULT 0,
  main_skill TEXT,
  PRIMARY KEY (build_id, stage_id)
);

-- Written by the indexer, which runs the engine. One row per stage.
CREATE TABLE build_derived (
  build_id      TEXT NOT NULL REFERENCES builds (id) ON DELETE CASCADE,
  stage_id      TEXT NOT NULL,
  snapshot_pack TEXT NOT NULL,
  dps           REAL,
  full_dps      REAL,
  ehp           REAL,
  life          REAL,
  es            REAL,
  mana          REAL,
  res_fire      REAL,
  res_cold      REAL,
  res_light     REAL,
  res_chaos     REAL,
  crit          REAL,
  speed         REAL,
  json          TEXT,
  computed_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  PRIMARY KEY (build_id, stage_id)
);
