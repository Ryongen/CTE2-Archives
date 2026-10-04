/**
 * Edit tokens remembered in this browser, so an uploader doesn't have to paste theirs back in.
 * Only a convenience: the token shown after upload is still the real key, and storage can be
 * cleared or blocked at any time.
 */

const PREFIX = "cte2-archives:edit:";
const ADMIN = "cte2-archives:admin";

function get(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function put(key: string, value: string | null): void {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    // Storage blocked; the uploader still has the token they were shown.
  }
}

/** The token to try first for a build: its own, else an admin token used here before. */
export function savedToken(id: string): string {
  return get(PREFIX + id) ?? get(ADMIN) ?? "";
}

export function rememberToken(id: string, token: string, role: "owner" | "admin"): void {
  put(role === "admin" ? ADMIN : PREFIX + id, token);
}

export function forgetToken(id: string): void {
  put(PREFIX + id, null);
}
