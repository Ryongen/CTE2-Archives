/**
 * The four ways a build leaves the catalogue for CoB.
 *
 * The web link carries the build as a `#code=` fragment rather than `?build=<id>`, so it works
 * whichever catalogue CoB's web build is pointed at, including none. Desktop gets the id, since
 * the app fetches it from the catalogue itself.
 */

import { encodeBuildCode, type BuildDoc } from "@cte2/schema";
import { useQuery } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";

import { COB_SITE } from "../config.ts";

export function OpenInCob({ id, doc, title }: { id: string; doc: BuildDoc; title: string }): ReactNode {
  const { data: code } = useQuery({ queryKey: ["code", id], queryFn: () => encodeBuildCode(doc), staleTime: Infinity });
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    if (code === undefined) return;
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const download = () => {
    const url = URL.createObjectURL(new Blob([JSON.stringify(doc, null, 2)], { type: "application/json" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `${title.replace(/[^\w.-]+/g, "_") || id}.json`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 30_000);
  };

  return (
    <div className="open-in-cob">
      <a className="button primary" href={code === undefined ? undefined : `${COB_SITE}#code=${code}`} target="_blank" rel="noreferrer">
        Open in CoB (web)
      </a>
      <a className="button" href={`cob://build/${id}`} title="Needs the CoB desktop app installed">
        Open in CoB desktop
      </a>
      <button onClick={copy} disabled={code === undefined}>
        {copied ? "Copied!" : "Copy build code"}
      </button>
      <button onClick={download}>Download .json</button>
    </div>
  );
}
