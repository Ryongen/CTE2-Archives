-- Versions are stored as `normaliseVersion` spells them: `6.4.13`, not `1.20.1-6.4.13`, and
-- NULL rather than the exporter's `unknown`. The list filters on them.
UPDATE builds SET mns_version = NULL WHERE lower(trim(mns_version)) IN ('', 'unknown');
UPDATE builds SET mns_version = substr(mns_version, instr(mns_version, '-') + 1)
  WHERE mns_version GLOB '[0-9]*.[0-9]*-*';
UPDATE builds SET pack_version = NULL WHERE lower(trim(pack_version)) IN ('', 'unknown');
CREATE INDEX builds_version ON builds (mns_version);
