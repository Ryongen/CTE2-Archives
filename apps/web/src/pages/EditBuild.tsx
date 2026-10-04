/**
 * Change or delete a build: its uploader with the edit token shown after upload, or the site
 * admin with the admin token. Only what was typed at upload can change; a different build is a
 * new upload.
 */

import type { BuildManage, Visibility } from "@cob/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { Link, useNavigate, useParams } from "react-router";

import { api } from "../api.ts";
import { forgetToken, rememberToken, savedToken } from "../edit-tokens.ts";

export function EditBuildPage(): ReactNode {
  const { id = "" } = useParams();
  const [typed, setTyped] = useState(() => savedToken(id));
  // The token actually tried; typing doesn't fire a request per keystroke.
  const [token, setToken] = useState(() => savedToken(id));

  const manage = useQuery({
    queryKey: ["manage", id, token],
    queryFn: async () => {
      const result = await api.manage(id, token);
      rememberToken(id, token, result.role);
      return result;
    },
    enabled: token !== "",
    retry: false,
    staleTime: Infinity,
  });

  return (
    <div className="upload">
      <h1>Edit build</h1>
      <p className="faint">
        <Link to={`/builds/${id}`}>Back to the build</Link>
      </p>

      {manage.data === undefined ? (
        <form
          className="form"
          onSubmit={(e) => {
            e.preventDefault();
            setToken(typed.trim());
          }}
        >
          <label>
            Edit token
            <input value={typed} onChange={(e) => setTyped(e.target.value)} placeholder="The token you were shown after uploading" spellCheck={false} />
          </label>
          <button className="primary" disabled={typed.trim() === "" || manage.isFetching}>
            {manage.isFetching ? "Checking…" : "Continue"}
          </button>
          {manage.error ? <p className="error">{manage.error.message}</p> : null}
        </form>
      ) : (
        <EditForm key={manage.data.id} id={id} token={token} start={manage.data} />
      )}
    </div>
  );
}

function EditForm({ id, token, start }: { id: string; token: string; start: BuildManage }): ReactNode {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [title, setTitle] = useState(start.title);
  const [notes, setNotes] = useState(start.notes);
  const [packVersion, setPackVersion] = useState(start.packVersion ?? "");
  const [visibility, setVisibility] = useState<Visibility>(start.visibility);
  const [hidden, setHidden] = useState(start.hidden);
  const admin = start.role === "admin";

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ["build", id] });
    void queryClient.invalidateQueries({ queryKey: ["builds"] });
  };

  const save = useMutation({
    mutationFn: () => api.edit(id, token, { title, notes, packVersion, visibility, ...(admin ? { hidden } : {}) }),
    onSuccess: (saved) => {
      queryClient.setQueryData(["manage", id, token], saved);
      refresh();
    },
  });

  const remove = useMutation({
    mutationFn: () => api.remove(id, token),
    onSuccess: () => {
      forgetToken(id);
      refresh();
      void navigate("/builds", { replace: true });
    },
  });

  return (
    <div className="form">
      {admin ? <p className="faint">Signed in with the admin token.</p> : null}
      <label>
        Title
        <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={100} />
      </label>
      <label>
        Notes
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={8} />
      </label>
      <label>
        Modpack version
        <input value={packVersion} onChange={(e) => setPackVersion(e.target.value)} maxLength={40} placeholder="e.g. 2.1.4" />
      </label>
      <label className="row">
        <input type="checkbox" checked={visibility === "unlisted"} onChange={(e) => setVisibility(e.target.checked ? "unlisted" : "public")} />
        Unlisted: only people with the link can see it
      </label>
      {admin ? (
        <label className="row">
          <input type="checkbox" checked={hidden} onChange={(e) => setHidden(e.target.checked)} />
          Hidden: taken down for everyone, including the uploader
        </label>
      ) : null}

      <div className="row">
        <button className="primary" disabled={title.trim() === "" || save.isPending} onClick={() => save.mutate()}>
          {save.isPending ? "Saving…" : "Save"}
        </button>
        {save.isSuccess && !save.isPending ? <span className="good">Saved.</span> : null}
        <span className="grow" />
        <button
          className="danger"
          disabled={remove.isPending}
          onClick={() => {
            if (window.confirm("Delete this build for good? This can't be undone.")) remove.mutate();
          }}
        >
          {remove.isPending ? "Deleting…" : "Delete build"}
        </button>
      </div>
      {save.error ? <p className="error">{save.error.message}</p> : null}
      {remove.error ? <p className="error">{remove.error.message}</p> : null}
    </div>
  );
}
