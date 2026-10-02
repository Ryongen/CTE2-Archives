/**
 * The pack's data, read from CoB's published site: the snapshot names and draws things, and the
 * asset index turns resource paths into icon URLs.
 *
 * The site works before it arrives. Every name falls back to a humanised id and every icon to
 * nothing, so the list is usable while ~800 KB of snapshot downloads.
 */

import type { Snapshot } from "@cte2/extractor";
import { SnapshotProvider, type AssetResolvers } from "@cte2/view";
import { useQuery } from "@tanstack/react-query";
import { createContext, useContext, type ReactNode } from "react";

import { COB_SITE } from "./config.ts";

type Manifest = { snapshot: string; assets: string; assetIndex: string; source?: { mineAndSlashVersion?: string } };
type AssetIndex = { assets?: Record<string, string>; items?: Record<string, string> };

export type GameData = { snapshot: Snapshot; assets: AssetResolvers; mnsVersion: string };

const GameContext = createContext<GameData | null>(null);

async function json<T>(url: string): Promise<T> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${url}: ${response.status}`);
  return (await response.json()) as T;
}

async function loadGameData(): Promise<GameData> {
  const manifest = await json<Manifest>(`${COB_SITE}data/manifest.json`);
  const [snapshot, index] = await Promise.all([
    json<Snapshot>(COB_SITE + manifest.snapshot),
    // Missing icons are a plainer page, not a broken one.
    json<AssetIndex>(COB_SITE + manifest.assetIndex).catch((): AssetIndex => ({})),
  ]);
  const base = COB_SITE + manifest.assets;
  const url = (relative: string | undefined) =>
    relative === undefined ? null : base + relative.split("/").map(encodeURIComponent).join("/");
  return {
    snapshot,
    mnsVersion: manifest.source?.mineAndSlashVersion ?? snapshot.meta.mineAndSlashVersion,
    assets: {
      assetUrl: (path) => url(index.assets?.[path]),
      itemIconUrl: (itemId) => url(index.items?.[itemId]),
    },
  };
}

export function GameDataProvider({ children }: { children: ReactNode }): ReactNode {
  const { data } = useQuery({ queryKey: ["game-data"], queryFn: loadGameData, staleTime: Infinity, retry: 1 });
  if (data === undefined) return <GameContext.Provider value={null}>{children}</GameContext.Provider>;
  return (
    <GameContext.Provider value={data}>
      <SnapshotProvider snapshot={data.snapshot} path={COB_SITE} assets={data.assets}>
        {children}
      </SnapshotProvider>
    </GameContext.Provider>
  );
}

/** The game data, or null while it loads. */
export function useGame(): GameData | null {
  return useContext(GameContext);
}

/** For components that only render once the data is in, as `@cte2/view`'s do. */
export function WhenLoaded({ children, fallback = null }: { children: ReactNode; fallback?: ReactNode }): ReactNode {
  return useGame() === null ? fallback : children;
}
