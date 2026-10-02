import type { BuildDoc } from "@cte2/schema";
import type { BuildDetail, BuildListResponse, UploadRequest, UploadResponse } from "@cob/shared";

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
  upload: (request: UploadRequest) =>
    call<UploadResponse>("/builds", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(request),
    }),
};
