export function ago(iso: string): string {
  const seconds = (Date.now() - Date.parse(iso)) / 1000;
  if (seconds < 60) return "just now";
  const steps: [number, string][] = [
    [60, "minute"],
    [3600, "hour"],
    [86400, "day"],
    [2592000, "month"],
    [31536000, "year"],
  ];
  let unit = steps[0]!;
  for (const step of steps) if (seconds >= step[0]) unit = step;
  const count = Math.floor(seconds / unit[0]);
  return `${count} ${unit[1]}${count === 1 ? "" : "s"} ago`;
}

/** Which patch a build is from: the modpack's version when known, and Mine and Slash's. */
export function versionLabel(mnsVersion: string | null, packVersion: string | null): string {
  const parts = [packVersion === null ? null : `CtE2 ${packVersion}`, mnsVersion === null ? null : `M&S ${mnsVersion}`];
  const known = parts.filter((p) => p !== null);
  return known.length === 0 ? "Unknown version" : known.join(" · ");
}
