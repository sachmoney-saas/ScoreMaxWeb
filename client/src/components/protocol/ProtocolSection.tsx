import * as React from "react";
import type { LucideIcon } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

/* ============================================================================
 * ProtocolSection — shared shell for every block on the Protocol page.
 *
 * Keeps the visual rhythm consistent (header, count, optional accent icon)
 * and stops every section file from re-implementing the same layout.
 * ========================================================================= */

const glassCardClassName =
  "relative overflow-hidden border-white/15 bg-[radial-gradient(circle_at_25%_10%,rgba(255,255,255,0.16),transparent_36%),linear-gradient(145deg,rgba(10,16,22,0.94)_0%,rgba(20,31,39,0.9)_48%,rgba(185,204,209,0.22)_100%)] text-zinc-50 shadow-[0_24px_80px_-55px_rgba(0,0,0,0.95)]";

const sheetCardClassName =
  "relative overflow-hidden rounded-xl border border-zinc-200 bg-white text-zinc-900 shadow-sm";

export interface ProtocolSectionProps {
  /** `sheet` : bloc clair type compte-rendu (page Mon protocole). */
  variant?: "glass" | "sheet";
  eyebrow?: string;
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
  variant = "glass",
  eyebrow,
  title,
  description,
  count,
  icon: Icon,
  trailing,
  children,
}: ProtocolSectionProps) {
  const isSheet = variant === "sheet";

  return (
    <Card
      className={isSheet ? sheetCardClassName : glassCardClassName}
    >
      <CardContent className="space-y-5 p-6">
        <header
          className={cn(
            "flex flex-wrap items-end justify-between gap-3 border-b pb-4",
            isSheet ? "border-zinc-100" : "border-white/5",
          )}
        >
          <div className="flex min-w-0 items-start gap-3">
            {Icon ? (
              <div
                className={cn(
                  "mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full",
                  isSheet
                    ? "border border-zinc-200 bg-zinc-50 text-zinc-700"
                    : "bg-white/[0.06] text-zinc-200",
                )}
              >
                <Icon className="h-4 w-4" />
              </div>
            ) : null}
            <div className="min-w-0">
              {eyebrow ? (
                <p
                  className={cn(
                    "text-[10px] font-semibold uppercase tracking-[0.18em]",
                    isSheet ? "text-zinc-500" : "text-zinc-500",
                  )}
                >
                  {eyebrow}
                </p>
              ) : null}
              <h3
                className={cn(
                  "font-display text-xl font-bold tracking-tight",
                  eyebrow ? "mt-1" : null,
                  isSheet ? "text-zinc-950" : "text-white",
                )}
              >
                {title}
              </h3>
              {description ? (
                <p
                  className={cn(
                    "mt-1 max-w-xl text-xs",
                    isSheet ? "text-zinc-600" : "text-zinc-400",
                  )}
                >
                  {description}
                </p>
              ) : null}
            </div>
          </div>

          <div className="flex items-center gap-2 text-[11px]">
            {typeof count === "number" ? (
              <span
                className={cn(
                  "rounded-full px-3 py-1 font-semibold tabular-nums",
                  isSheet
                    ? "bg-zinc-100 text-zinc-800"
                    : "bg-white/[0.06] text-zinc-300",
                )}
              >
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
