import * as React from "react";

import { cn } from "@/lib/utils";
import { i18n, type AppLanguage } from "@/lib/i18n";

/** Même dégradé que le bouton « Mon protocole » dans la barre latérale. */
export const protocolPageMetallicGradientClassName =
  "bg-[linear-gradient(to_top_right,#475569_0%,#cbd5e1_22%,#ffffff_48%,#e8eef5_72%,#64748b_100%)]";

export const protocolPageTitleClassName =
  "font-display text-2xl font-bold tracking-tight text-zinc-950 sm:text-3xl";

export function ProtocolPageTitle({ language }: { language: AppLanguage }) {
  return (
    <h1 className={cn(protocolPageTitleClassName, "text-center")}>
      {i18n(language, { en: "My protocol", fr: "Mon protocole" })}
    </h1>
  );
}

export interface ProtocolPageShellProps {
  /** Bandeau blanc en tête (souvent titre centré). */
  header?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

/**
 * Cadre métallique + intérieur blanc — conteneur principal de la page Mon protocole.
 */
export function ProtocolPageShell({
  header,
  children,
  className,
}: ProtocolPageShellProps) {
  return (
    <div
      className={cn(
        protocolPageMetallicGradientClassName,
        "mx-auto w-full max-w-5xl rounded-2xl p-1 shadow-[0_10px_36px_-14px_rgba(0,0,0,0.45),inset_0_1px_0_rgba(255,255,255,0.55)]",
        className,
      )}
    >
      <div className="flex flex-col overflow-hidden rounded-[14px] bg-white text-zinc-900">
        {header ? (
          <div className="border-b border-zinc-200 bg-white px-5 py-5 sm:px-8 sm:py-6">
            {header}
          </div>
        ) : null}
        <div className="px-5 py-8 sm:px-8 sm:py-9">{children}</div>
      </div>
    </div>
  );
}