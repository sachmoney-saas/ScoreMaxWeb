import { cn } from "@/lib/utils";

export interface RoutineStepRowProps {
  index: number;
  title: string;
  detail: string | null;
  variant?: "light" | "dark";
  checked?: boolean;
  onCheckedChange?: () => void;
}

export function RoutineStepRow({
  index,
  title,
  detail,
  variant = "light",
  checked = false,
  onCheckedChange,
}: RoutineStepRowProps) {
  const onLight = variant === "light";
  const interactive = Boolean(onCheckedChange);

  const textBlocks = (
    <div className="min-w-0 flex-1">
      <p
        className={cn(
          "font-medium leading-snug",
          onLight ? "text-zinc-900" : "text-zinc-100",
          interactive && checked && "text-zinc-500 line-through decoration-zinc-400",
        )}
      >
        {title}
      </p>
      {detail ? (
        <p
          className={cn(
            "mt-0.5 text-[12px] leading-relaxed",
            onLight ? "text-zinc-600" : "text-zinc-400",
            interactive && checked && "text-zinc-400 line-through",
          )}
        >
          {detail}
        </p>
      ) : null}
    </div>
  );

  if (interactive) {
    return (
      <li className="list-none">
        <label
          className={cn(
            "flex cursor-pointer select-none gap-2 text-sm leading-snug",
            "rounded-md -mx-1 px-1 py-0.5 transition-colors hover:bg-zinc-50",
          )}
        >
          <span
            className={cn(
              "w-4 shrink-0 tabular-nums text-xs font-medium",
              onLight ? "text-zinc-400" : "text-zinc-500",
            )}
          >
            {index}.
          </span>
          <span className="mt-0.5 flex shrink-0 items-start pt-px">
            <input
              type="checkbox"
              checked={checked}
              onChange={() => onCheckedChange?.()}
              className={cn(
                "size-4 rounded border-zinc-300 text-zinc-900",
                "focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:ring-offset-1",
              )}
              aria-label={`${index}. ${title}`}
            />
          </span>
          {textBlocks}
        </label>
      </li>
    );
  }

  return (
    <li className="flex gap-2 text-sm leading-snug">
      <span
        className={cn(
          "w-4 shrink-0 tabular-nums text-xs font-medium",
          onLight ? "text-zinc-400" : "text-zinc-500",
        )}
      >
        {index}.
      </span>
      {textBlocks}
    </li>
  );
}
