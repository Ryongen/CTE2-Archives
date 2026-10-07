/**
 * Changing a build after upload: its uploader, holding the edit token they were shown once, or
 * the site admin, holding `ADMIN_TOKEN`. There are no accounts yet, so the token is the identity.
 *
 * Only what the uploader typed can change, plus which skill is the main one (`mainSkillEdit` in
 * index.ts). The rest of the document can't: its facets, stages and summary are all worked out
 * from it, and a different build is a new upload.
 */

import type { BuildEdit, EditRole } from "@cob/shared";

import type { Env } from "./env.ts";
import { sha256Hex } from "./ids.ts";
import { clip, MAX_NOTES, MAX_PACK_VERSION, MAX_TITLE, packVersionOf, UploadError } from "./upload.ts";

export function bearer(header: string | undefined): string | undefined {
  const match = /^Bearer\s+(.+)$/.exec(header ?? "");
  return match?.[1]?.trim() || undefined;
}

/** What `token` may do to a build whose stored edit-token hash is `editTokenHash`. */
export async function roleFor(env: Env, token: string | undefined, editTokenHash: string | null): Promise<EditRole | null> {
  if (token === undefined) return null;
  const hash = await sha256Hex(token);
  // Compared as hashes so the comparison's timing says nothing about the admin token.
  if (env.ADMIN_TOKEN && hash === (await sha256Hex(env.ADMIN_TOKEN))) return "admin";
  if (editTokenHash !== null && hash === editTokenHash) return "owner";
  return null;
}

/** The `SET` clause for an edit, or nothing to do. Refuses what the role may not change. */
export function editColumns(edit: BuildEdit, role: EditRole, now: string): { sql: string; values: unknown[] } | null {
  const sets: string[] = [];
  const values: unknown[] = [];
  const set = (column: string, value: unknown) => {
    sets.push(`${column} = ?`);
    values.push(value);
  };

  if (edit.title !== undefined) {
    const title = clip(String(edit.title), MAX_TITLE);
    if (title === "") throw new UploadError("A build needs a title");
    set("title", title);
  }
  if (edit.notes !== undefined) set("notes_md", clip(String(edit.notes), MAX_NOTES));
  if (edit.visibility !== undefined) {
    if (edit.visibility !== "public" && edit.visibility !== "unlisted") throw new UploadError("Unknown visibility");
    set("visibility", edit.visibility);
  }
  if (edit.packVersion !== undefined) {
    set("pack_version", clip(packVersionOf(String(edit.packVersion)) ?? "", MAX_PACK_VERSION) || null);
  }
  if (edit.hidden !== undefined) {
    if (role !== "admin") throw new UploadError("Only the site admin can hide a build", 403);
    // Unhiding hands it back to the indexer rather than guessing which state it left.
    sets.push(edit.hidden ? "status = 'hidden'" : "status = CASE status WHEN 'hidden' THEN 'pending' ELSE status END");
  }

  if (sets.length === 0) return null;
  set("updated_at", now);
  return { sql: sets.join(", "), values };
}
