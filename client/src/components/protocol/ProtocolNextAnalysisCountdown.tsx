import * as React from "react";

import { cn } from "@/lib/utils";
import { type AppLanguage } from "@/lib/i18n";
import {
  formatSubscriberProtocolNextAnalysisLine,
  subscriberStandardCooldownParts,
} from "@/lib/subscriber-standard-analysis-copy";

export interface ProtocolNextAnalysisCountdownProps {
  language: AppLanguage;
  nextAvailableAt: string | null | undefined;
  onMayHaveUnlocked?: () => void;
  className?: string;
}

export function ProtocolNextAnalysisCountdown({
  language,
  nextAvailableAt,
  onMayHaveUnlocked,
  className,
}: ProtocolNextAnalysisCountdownProps) {
  const [tick, setTick] = React.useState(0);
  const unlockRefetchDoneRef = React.useRef(false);

  React.useEffect(() => {
    unlockRefetchDoneRef.current = false;
  }, [nextAvailableAt]);

  React.useEffect(() => {
    if (!nextAvailableAt) return;
    const id = window.setInterval(() => {
      setTick((previous) => previous + 1);
    }, 60_000);
    return () => window.clearInterval(id);
  }, [nextAvailableAt]);

  const deadlineMs = React.useMemo(
    () => (nextAvailableAt ? Date.parse(nextAvailableAt) : Number.NaN),
    [nextAvailableAt],
  );

  React.useEffect(() => {
    if (!Number.isFinite(deadlineMs)) return;
    if (deadlineMs > Date.now()) return;
    if (unlockRefetchDoneRef.current) return;
    unlockRefetchDoneRef.current = true;
    onMayHaveUnlocked?.();
  }, [deadlineMs, onMayHaveUnlocked, tick]);

  if (!nextAvailableAt || !Number.isFinite(deadlineMs)) {
    return null;
  }

  const parts = subscriberStandardCooldownParts(nextAvailableAt, Date.now());
  const line = formatSubscriberProtocolNextAnalysisLine(language, parts);

  return (
    <p
      className={cn(
        "text-center text-xs font-semibold leading-snug tracking-tight text-zinc-800/90 sm:text-sm",
        className,
      )}
      aria-live="polite"
      aria-atomic="true"
    >
      {line}
    </p>
  );
}
