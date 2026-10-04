import type { BuildDoc, Observation } from "@cte2/schema";
import type { BuildDetail, BuildEdit, BuildListResponse, BuildManage, UploadRequest, UploadResponse } from "@cob/shared";

import { API_URL } from "./config.ts";

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(API_URL + path, init);
  const body = (await response.json().catch(() => null)) as (T & { error?: string }) | null;
  if (!response.ok) throw new Error(body?.error ?? `The catalogue answered ${response.status}`);
  return body as T;
}

export const api = {
  list: (query: string) => call<BuildListResponse>(`/builds${query ? `?${query}` : ""}`),
  build: (id: string) => call<BuildDetail>(`/builds/${encodeURIComponent(id)}`),
  doc: (id: string) => call<BuildDoc>(`/builds/${encodeURIComponent(id)}/doc`),
  observed: (id: string) => call<Observation>(`/builds/${encodeURIComponent(id)}/observed`),
  upload: (request: UploadRequest) =>
    call<UploadResponse>("/builds", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(request),
    }),
  manage: (id: string, token: string) =>
    call<BuildManage>(`/builds/${encodeURIComponent(id)}/manage`, { headers: { authorization: `Bearer ${token}` } }),
  edit: (id: string, token: string, edit: BuildEdit) =>
    call<BuildManage>(`/builds/${encodeURIComponent(id)}`, {
      method: "PATCH",
      headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
      body: JSON.stringify(edit),
    }),
  remove: (id: string, token: string) =>
    call<{ id: string; deleted: true }>(`/builds/${encodeURIComponent(id)}`, {
      method: "DELETE",
      headers: { authorization: `Bearer ${token}` },
    }),
};
