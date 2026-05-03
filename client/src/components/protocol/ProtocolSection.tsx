import * as React from "react";
import type { LucideIcon } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";

/* ============================================================================
 * ProtocolSection — shared shell for every block on the Protocol page.
 *
 * Keeps the visual rhythm consistent (header, count, optional accent icon)
 * and stops every section file from re-implementing the same layout.
 * ========================================================================= */

const cardClassName =
  "relative overflow-hidden border-white/15 bg-[radial-gradient(circle_at_25%_10%,rgba(255,255,255,0.16),transparent_36%),linear-gradient(145deg,rgba(10,16,22,0.94)_0%,rgba(20,31,39,0.9)_48%,rgba(185,204,209,0.22)_100%)] text-zinc-50 shadow-[0_24px_80px_-55px_rgba(0,0,0,0.95)]";

export interface ProtocolSectionProps {
  eyebrow: string;
  title: string;
  description?: string;
  count?: number;
  icon?: LucideIcon;
  /**
   * Right-aligned slot for inline metadata (badges, time hints, etc.) that
   * sits on the same row as the count chip.
   */
  trailing?: React.ReactNode;
  children: React.ReactNode;
}

export function ProtocolSection({
  eyebrow,
  title,
  description,
  count,
  icon: Icon,
  trailing,
  children,
}: ProtocolSectionProps) {
  return (
    <Card className={cardClassName}>
      <CardContent className="space-y-5 p-6">
        <header className="flex flex-wrap items-end justify-between gap-3 border-b border-white/5 pb-4">
          <div className="flex min-w-0 items-start gap-3">
            {Icon ? (
              <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/[0.06] text-zinc-200">
                <Icon className="h-4 w-4" />
              </div>
            ) : null}
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
                {eyebrow}
              </p>
              <h3 className="mt-1 font-display text-xl font-bold tracking-tight text-white">
                {title}
              </h3>
              {description ? (
                <p className="mt-1 max-w-xl text-xs text-zinc-400">
                  {description}
                </p>
              ) : null}
            </div>
          </div>

          <div className="flex items-center gap-2 text-[11px]">
            {typeof count === "number" ? (
              <span className="rounded-full bg-white/[0.06] px-3 py-1 font-semibold tabular-nums text-zinc-300">
                {count}
              </span>
            ) : null}
            {trailing}
          </div>
        </header>

        {children}
      </CardContent>
    </Card>
  );
}
