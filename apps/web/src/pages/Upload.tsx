/**
 * Drop a `cob-exports` file, or paste JSON or a `cob1:` code, and publish it.
 *
 * The text is checked locally with the same `readBuildText` the API runs, so a wrong file is
 * refused before anything is sent. The edit token comes back once and is shown once; there is no
 * account yet to keep it for you.
 */

import { readBuildText, type ReadBuild } from "@cte2/schema";
import { MAX_UPLOAD_BYTES, type UploadResponse, type Visibility } from "@cob/shared";
import { useMutation } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { Link } from "react-router";

import { api } from "../api.ts";
import { Turnstile, turnstileEnabled } from "../components/Turnstile.tsx";

export function UploadPage(): ReactNode {
  const [text, setText] = useState("");
  const [read, setRead] = useState<ReadBuild | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [packVersion, setPackVersion] = useState("");
  const [visibility, setVisibility] = useState<Visibility>("public");
  const [captcha, setCaptcha] = useState<string | null>(null);
  const [captchaReset, setCaptchaReset] = useState(0);

  const upload = useMutation({
    mutationFn: () => api.upload({
        build: text,
        title,
        notes,
        visibility,
        ...(packVersion.trim() === "" ? {} : { packVersion: packVersion.trim() }),
        turnstileToken: captcha ?? undefined,
      }),
    // The token was spent on the failed attempt, so get a new one for the retry.
    onError: () => setCaptchaReset((n) => n + 1),
  });
  const waitingForCaptcha = turnstileEnabled && captcha === null;

  const take = async (next: string) => {
    setText(next);
    upload.reset();
    if (next.trim() === "") {
      setRead(null);
      setProblem(null);
      return;
    }
    if (next.length > MAX_UPLOAD_BYTES) {
      setRead(null);
      setProblem(`That's ${Math.round(next.length / 1024)} KB; the limit is ${MAX_UPLOAD_BYTES / 1024} KB.`);
      return;
    }
    try {
      const result = await readBuildText(next);
      setRead(result);
      setProblem(null);
      if (title === "" && result.doc.meta?.name) setTitle(result.doc.meta.name);
    } catch (error) {
      setRead(null);
      setProblem(error instanceof Error ? error.message : "That isn't a build.");
    }
  };

  if (upload.data !== undefined) return <Uploaded result={upload.data} />;

  return (
    <div className="upload">
      <h1>Upload a build</h1>
      <p className="faint">
        Drop a file from your <code>cob-exports</code> folder or one saved from CoB, or paste its JSON or a{" "}
        <code>cob1:</code> build code.
      </p>

      <label
        className="drop"
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          const file = e.dataTransfer.files[0];
          if (file !== undefined) void file.text().then(take);
        }}
      >
        <input
          type="file"
          accept=".json,application/json"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file !== undefined) void file.text().then(take);
          }}
        />
        <span>Drop a .json here, or click to pick one</span>
      </label>

      <textarea value={text} onChange={(e) => void take(e.target.value)} placeholder="…or paste here" rows={6} spellCheck={false} />

      {problem === null ? null : <p className="error">{problem}</p>}
      {read === null ? null : (
        <p className="good">
          Level {read.doc.character.level} build
          {read.observed === null ? "" : ", captured in-game"}
          {(read.doc.stages?.length ?? 0) > 1 ? `, ${read.doc.stages!.length} stages` : ""}
          {read.doc.meta?.mineAndSlashVersion ? `, Mine and Slash ${read.doc.meta.mineAndSlashVersion}` : ", no game version recorded"}.
        </p>
      )}

      <div className="form">
        <label>
          Title
          <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={100} placeholder="Named after the build if left empty" />
        </label>
        <label>
          Notes
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={5} placeholder="How it plays, what to level with, anything else" />
        </label>
        {knownPackVersion(read) ? null : (
          <label>
            Modpack version
            <input
              value={packVersion}
              onChange={(e) => setPackVersion(e.target.value)}
              maxLength={40}
              placeholder="The Craft to Exile 2 version you played it on, e.g. 1.4.2"
            />
          </label>
        )}
        <label className="row">
          <input type="checkbox" checked={visibility === "unlisted"} onChange={(e) => setVisibility(e.target.checked ? "unlisted" : "public")} />
          Unlisted: only people with the link can see it
        </label>
        <Turnstile onToken={setCaptcha} resetKey={captchaReset} />
        <button className="primary" disabled={read === null || waitingForCaptcha || upload.isPending} onClick={() => upload.mutate()}>
          {upload.isPending ? "Uploading…" : "Publish"}
        </button>
        {upload.error ? <p className="error">{upload.error.message}</p> : null}
      </div>
    </div>
  );
}

/** The exporter writes `unknown` because the game can't see the modpack's version. */
function knownPackVersion(read: ReadBuild | null): boolean {
  const v = read?.doc.meta?.packVersion?.trim().toLowerCase();
  return v !== undefined && v !== "" && v !== "unknown";
}

function Uploaded({ result }: { result: UploadResponse }): ReactNode {
  return (
    <div className="upload">
      {result.duplicate ? (
        <>
          <h1>Already here</h1>
          <p>This exact build was uploaded before.</p>
        </>
      ) : (
        <>
          <h1>Published</h1>
          <p>
            Keep this edit token. It's the only way to change or delete the build until accounts exist, and it won't be
            shown again:
          </p>
          <pre className="token">{result.editToken}</pre>
        </>
      )}
      <Link className="button primary" to={`/builds/${result.id}`}>
        Go to the build
      </Link>
    </div>
  );
}
