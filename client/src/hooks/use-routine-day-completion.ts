import * as React from "react";

import { dayOffsetToDate } from "@/lib/protocol-day";

function toLocalDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function storageKeyForDay(userId: string, dateKey: string): string {
  return `scoremax_protocol_day_checks_v1:${userId}:${dateKey}`;
}

function parseStoredIds(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((x): x is string => typeof x === "string");
  } catch {
    return [];
  }
}

/**
 * Module-level store shared across every `useRoutineDayCompletion` call site.
 *
 * Before this refactor, the hook held checked IDs in `React.useState`. That
 * meant rendering the same day in two places (e.g. the `RoutineDayPanel`
 * checkboxes *and* the header `RoutineDayProgressBar`) created two
 * independent React states that only re-synced after a page reload via
 * `localStorage`. Now both consumers read from one cache and a toggle from
 * either side notifies every subscriber via `useSyncExternalStore`.
 */
const dayCache = new Map<string, Set<string>>();
const daySubscribers = new Map<string, Set<() => void>>();

function readFromCacheOrStorage(storageKey: string): Set<string> {
  const cached = dayCache.get(storageKey);
  if (cached) return cached;
  if (typeof window === "undefined") {
    const empty = new Set<string>();
    dayCache.set(storageKey, empty);
    return empty;
  }
  const fresh = new Set(parseStoredIds(window.localStorage.getItem(storageKey)));
  dayCache.set(storageKey, fresh);
  return fresh;
}

function writeAndNotify(storageKey: string, next: Set<string>): void {
  dayCache.set(storageKey, next);
  if (typeof window !== "undefined") {
    window.localStorage.setItem(storageKey, JSON.stringify(Array.from(next)));
  }
  const subs = daySubscribers.get(storageKey);
  if (!subs) return;
  subs.forEach((cb) => cb());
}

function subscribeToKey(storageKey: string, cb: () => void): () => void {
  let set = daySubscribers.get(storageKey);
  if (!set) {
    set = new Set();
    daySubscribers.set(storageKey, set);
  }
  set.add(cb);
  return () => {
    const current = daySubscribers.get(storageKey);
    if (!current) return;
    current.delete(cb);
    if (current.size === 0) daySubscribers.delete(storageKey);
  };
}

export interface UseRoutineDayCompletionResult {
  checkedIds: ReadonlySet<string>;
  toggle: (stepId: string) => void;
  percent: number;
  completedCount: number;
  total: number;
}

export function useRoutineDayCompletion(
  userId: string | null,
  dayOffset: number,
  stepIds: readonly string[],
  today: Date,
): UseRoutineDayCompletionResult {
  const dateKey = React.useMemo(
    () => toLocalDateKey(dayOffsetToDate(dayOffset, today)),
    [dayOffset, today],
  );

  const storageKey = React.useMemo(
    () => (userId ? storageKeyForDay(userId, dateKey) : null),
    [userId, dateKey],
  );

  /**
   * Trim stored ids whose step has been removed from the routine while the
   * tab was open. We do this opportunistically on (re)subscribe rather than
   * on every render to keep the snapshot stable for `useSyncExternalStore`.
   */
  const stepIdsKey = React.useMemo(
    () => [...stepIds].sort().join("\0"),
    [stepIds],
  );

  React.useEffect(() => {
    if (!storageKey) return;
    const current = readFromCacheOrStorage(storageKey);
    const valid = new Set(stepIds);
    let needsWrite = false;
    const filtered = new Set<string>();
    current.forEach((id) => {
      if (valid.has(id)) filtered.add(id);
      else needsWrite = true;
    });
    if (needsWrite) {
      writeAndNotify(storageKey, filtered);
    }
    // Only react to identity changes — `stepIdsKey` is the canonical fingerprint.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey, stepIdsKey]);

  const subscribe = React.useCallback(
    (cb: () => void) => {
      if (!storageKey) return () => undefined;
      return subscribeToKey(storageKey, cb);
    },
    [storageKey],
  );

  const getSnapshot = React.useCallback((): ReadonlySet<string> => {
    if (!storageKey) return EMPTY_SET;
    return readFromCacheOrStorage(storageKey);
  }, [storageKey]);

  const checkedIds = React.useSyncExternalStore<ReadonlySet<string>>(
    subscribe,
    getSnapshot,
    () => EMPTY_SET,
  );

  const toggle = React.useCallback(
    (stepId: string) => {
      if (!storageKey) return;
      const valid = new Set(stepIds);
      if (!valid.has(stepId)) return;
      const current = readFromCacheOrStorage(storageKey);
      const next = new Set<string>();
      current.forEach((id) => {
        if (valid.has(id)) next.add(id);
      });
      if (next.has(stepId)) next.delete(stepId);
      else next.add(stepId);
      writeAndNotify(storageKey, next);
    },
    [storageKey, stepIds],
  );

  const total = stepIds.length;
  const completedCount = React.useMemo(() => {
    let n = 0;
    for (const id of stepIds) {
      if (checkedIds.has(id)) n += 1;
    }
    return n;
  }, [stepIds, checkedIds]);

  const percent =
    total === 0 ? 0 : Math.min(100, Math.round((completedCount / total) * 100));

  return { checkedIds, toggle, percent, completedCount, total };
}

const EMPTY_SET: ReadonlySet<string> = new Set<string>();
