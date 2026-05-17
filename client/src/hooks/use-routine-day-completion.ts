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

  const stepIdsKey = React.useMemo(
    () => [...stepIds].sort().join("\0"),
    [stepIds],
  );

  const [checkedIds, setCheckedIds] = React.useState<Set<string>>(() => new Set());

  React.useEffect(() => {
    if (!userId || typeof window === "undefined") {
      setCheckedIds(new Set());
      return;
    }

    const valid = new Set(stepIds);
    const key = storageKeyForDay(userId, dateKey);
    const stored = parseStoredIds(window.localStorage.getItem(key));
    const filtered = stored.filter((id) => valid.has(id));
    setCheckedIds(new Set(filtered));
    if (filtered.length !== stored.length) {
      window.localStorage.setItem(key, JSON.stringify(filtered));
    }
  }, [userId, dateKey, stepIdsKey]);

  const toggle = React.useCallback(
    (stepId: string) => {
      if (!userId || typeof window === "undefined") {
        return;
      }
      const valid = new Set(stepIds);
      if (!valid.has(stepId)) {
        return;
      }

      setCheckedIds((prev) => {
        const next = new Set(prev);
        if (next.has(stepId)) next.delete(stepId);
        else next.add(stepId);
        const key = storageKeyForDay(userId, dateKey);
        const arr = Array.from(next).filter((id) => valid.has(id));
        window.localStorage.setItem(key, JSON.stringify(arr));
        return new Set(arr);
      });
    },
    [userId, dateKey, stepIds],
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
