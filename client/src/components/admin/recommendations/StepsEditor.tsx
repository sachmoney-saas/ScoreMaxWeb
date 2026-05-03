import * as React from "react";
import { ArrowDown, ArrowUp, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { LocalisedString } from "@/lib/recommendations";

export function StepsEditor({
  steps,
  onChange,
}: {
  steps: LocalisedString[];
  onChange: (steps: LocalisedString[]) => void;
}) {
  const update = (idx: number, locale: "en" | "fr", value: string): void => {
    const next = [...steps];
    next[idx] = { ...next[idx], [locale]: value };
    onChange(next);
  };

  const add = (): void => {
    onChange([...steps, { en: "", fr: "" }]);
  };

  const remove = (idx: number): void => {
    onChange(steps.filter((_, i) => i !== idx));
  };

  const move = (idx: number, direction: -1 | 1): void => {
    const next = [...steps];
    const target = idx + direction;
    if (target < 0 || target >= next.length) return;
    [next[idx], next[target]] = [next[target], next[idx]];
    onChange(next);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-xs text-zinc-400">
          {steps.length === 0
            ? "Aucune étape pour l'instant."
            : `${steps.length} étape${steps.length > 1 ? "s" : ""}`}
        </p>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={add}
          className="h-7 gap-1 text-xs text-zinc-300 hover:text-white"
        >
          <Plus className="h-3 w-3" />
          Ajouter une étape
        </Button>
      </div>

      {steps.length === 0 ? (
        <p className="rounded-md border border-dashed border-white/10 bg-white/[0.02] px-3 py-3 text-xs text-zinc-500">
          Décompose la routine ou la procédure en étapes courtes (ex&nbsp;: "Patch-test 24&nbsp;h
          avant", "Une goutte le soir").
        </p>
      ) : (
        <ol className="space-y-2">
          {steps.map((step, idx) => (
            <li
              key={idx}
              className="space-y-2 rounded-lg border border-white/10 bg-white/[0.03] p-3"
            >
              <div className="flex items-center justify-between">
                <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-zinc-400">
                  Étape {idx + 1}
                </span>
                <div className="flex items-center gap-1">
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => move(idx, -1)}
                    disabled={idx === 0}
                    className="h-6 w-6 p-0 text-zinc-500 hover:text-white disabled:opacity-30"
                    aria-label="Monter"
                  >
                    <ArrowUp className="h-3 w-3" />
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => move(idx, 1)}
                    disabled={idx === steps.length - 1}
                    className="h-6 w-6 p-0 text-zinc-500 hover:text-white disabled:opacity-30"
                    aria-label="Descendre"
                  >
                    <ArrowDown className="h-3 w-3" />
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => remove(idx)}
                    className="h-6 w-6 p-0 text-zinc-500 hover:text-rose-300"
                    aria-label="Supprimer"
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              </div>
              <Input
                placeholder="Étape FR"
                value={step.fr}
                onChange={(e) => update(idx, "fr", e.target.value)}
              />
              <Input
                placeholder="Step EN"
                value={step.en}
                onChange={(e) => update(idx, "en", e.target.value)}
              />
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
