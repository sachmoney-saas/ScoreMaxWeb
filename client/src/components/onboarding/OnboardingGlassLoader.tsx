import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { saasGlassInsetClassName } from "@/lib/auth-page-shell-styles";

type Props = {
  message: string;
  className?: string;
};

/**
 * Même bloc que pendant l’envoi du scan : fond glass, spinner, barre d’attente.
 */
export function OnboardingGlassLoader({ message, className }: Props) {
  return (
    <div
      className={cn(
        saasGlassInsetClassName,
        "w-full p-3 text-left sm:p-4",
        className,
      )}
    >
      <div className="flex items-center justify-center gap-3 text-sm text-zinc-200">
        <Loader2 className="h-4 w-4 shrink-0 animate-spin text-zinc-400" />
        <span>{message}</span>
      </div>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10">
        <div className="h-full w-1/2 animate-pulse rounded-full bg-white/40" />
      </div>
    </div>
  );
}
