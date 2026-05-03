import * as React from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Code2,
  Eye,
  Plus,
  Sparkles,
  Trash2,
  Wand2,
  X,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  formatAggregateDisplayLabel,
  formatAggregateDisplayValue,
  type WorkerAggregateCatalogEntry,
} from "@/lib/face-analysis-display";
import {
  flattenCondition,
  groupToCondition,
  isFlattenable,
  validateCondition,
  type AllowedAggregate,
  type Condition,
  type FlatGroup,
  type LeafRule,
} from "@/lib/recommendation-condition";
import { getAllowedEnumValues } from "@/lib/aggregate-allowed-values";
import { describeConditionFor } from "./shared";
import { useConditionPreview } from "./hooks";

/* ============================================================================
 * Types & helpers
 * ========================================================================= */

type ScoreOrNumberKind = "score" | "number";

function isScoreLike(
  kind: WorkerAggregateCatalogEntry["kind"],
): kind is ScoreOrNumberKind {
  return kind === "score" || kind === "number";
}

function isEnumLike(
  kind: WorkerAggregateCatalogEntry["kind"],
): boolean {
  return kind === "enum";
}

function buildAllowedAggregates(
  worker: string,
  catalog: WorkerAggregateCatalogEntry[],
): AllowedAggregate[] {
  return catalog.map((entry) => ({
    key: entry.key,
    kind: entry.kind,
    allowedValues:
      getAllowedEnumValues(worker, entry.key)?.slice() ??
      entry.enumValues?.map((v) => v.value),
  }));
}

function defaultRuleForKey(
  worker: string,
  catalog: WorkerAggregateCatalogEntry[],
  key: string,
): LeafRule {
  const entry = catalog.find((c) => c.key === key);
  if (entry && isScoreLike(entry.kind)) {
    return { kind: "score", key, op: "lte", value: 5 };
  }
  if (entry && isEnumLike(entry.kind)) {
    const allowed = getAllowedEnumValues(worker, key);
    return {
      kind: "enum",
      key,
      values: allowed && allowed.length > 0 ? [allowed[0]] : [],
    };
  }
  return { kind: "all" };
}

/* ============================================================================
 * Public component
 * ========================================================================= */

export interface ConditionBuilderProps {
  worker: string;
  catalog: WorkerAggregateCatalogEntry[];
  value: Condition;
  onChange: (condition: Condition) => void;
}

export function ConditionBuilder({
  worker,
  catalog,
  value,
  onChange,
}: ConditionBuilderProps) {
  const allowedAggregates = React.useMemo(
    () => buildAllowedAggregates(worker, catalog),
    [worker, catalog],
  );

  const flattenable = isFlattenable(value);
  const [mode, setMode] = React.useState<"visual" | "json">(
    flattenable ? "visual" : "json",
  );

  React.useEffect(() => {
    if (!flattenable && mode === "visual") setMode("json");
  }, [flattenable, mode]);

  const validation = React.useMemo(
    () => validateCondition(value, allowedAggregates),
    [value, allowedAggregates],
  );

  return (
    <div className="space-y-4">
      <ModeSwitch mode={mode} setMode={setMode} flattenable={flattenable} />

      {mode === "visual" ? (
        <VisualBuilder
          worker={worker}
          catalog={catalog}
          value={value}
          onChange={onChange}
        />
      ) : (
        <JsonEditor value={value} onChange={onChange} />
      )}

      <ValidationPanel issues={validation.issues} />
      <PlainLanguagePreview worker={worker} condition={value} />
      <LiveMatchPreview worker={worker} condition={value} />
    </div>
  );
}

/* ============================================================================
 * Mode switch (visual vs JSON expert)
 * ========================================================================= */

function ModeSwitch({
  mode,
  setMode,
  flattenable,
}: {
  mode: "visual" | "json";
  setMode: (m: "visual" | "json") => void;
  flattenable: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-white/10 bg-white/[0.03] p-1">
      <div className="flex items-center gap-1">
        <ModeButton
          active={mode === "visual"}
          disabled={!flattenable}
          onClick={() => setMode("visual")}
          icon={<Wand2 className="h-3.5 w-3.5" />}
          label="Builder visuel"
        />
        <ModeButton
          active={mode === "json"}
          onClick={() => setMode("json")}
          icon={<Code2 className="h-3.5 w-3.5" />}
          label="JSON expert"
        />
      </div>
      {!flattenable ? (
        <p className="px-2 text-[11px] text-amber-300">
          Condition imbriquée — édition JSON requise
        </p>
      ) : null}
    </div>
  );
}

function ModeButton({
  active,
  disabled,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  disabled?: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
        active
          ? "bg-white text-zinc-900"
          : "text-zinc-400 hover:bg-white/[0.05] hover:text-white"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

/* ============================================================================
 * Visual builder
 * ========================================================================= */

function VisualBuilder({
  worker,
  catalog,
  value,
  onChange,
}: {
  worker: string;
  catalog: WorkerAggregateCatalogEntry[];
  value: Condition;
  onChange: (c: Condition) => void;
}) {
  const group = React.useMemo(() => flattenCondition(value), [value]);
  const isAlwaysOn =
    group.rules.length === 1 && group.rules[0].kind === "all";

  const updateGroup = (next: FlatGroup): void => {
    onChange(groupToCondition(next));
  };

  const addRule = (): void => {
    const firstScoreOrEnum = catalog.find(
      (e) => isScoreLike(e.kind) || isEnumLike(e.kind),
    );
    const newRule: LeafRule = firstScoreOrEnum
      ? defaultRuleForKey(worker, catalog, firstScoreOrEnum.key)
      : { kind: "all" };
    const filtered = group.rules.filter((r) => r.kind !== "all");
    updateGroup({ ...group, rules: [...filtered, newRule] });
  };

  const removeRule = (idx: number): void => {
    const next = group.rules.filter((_, i) => i !== idx);
    updateGroup({ ...group, rules: next });
  };

  const updateRule = (idx: number, rule: LeafRule): void => {
    const next = [...group.rules];
    next[idx] = rule;
    updateGroup({ ...group, rules: next });
  };

  const setCombinator = (combinator: "and" | "or"): void => {
    updateGroup({ ...group, combinator });
  };

  const setAlwaysOn = (): void => {
    updateGroup({ combinator: "and", rules: [{ kind: "all" }] });
  };

  if (isAlwaysOn) {
    return (
      <div className="rounded-xl border border-emerald-300/20 bg-emerald-400/[0.04] p-4">
        <div className="flex items-start gap-3">
          <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-emerald-200" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-emerald-100">
              Recommandation toujours pertinente
            </p>
            <p className="mt-1 text-xs text-emerald-100/80">
              Cette reco s'affiche pour tous les utilisateurs, quel que soit leur score.
              Utilisé pour les bases (sommeil, hydratation, SPF, …).
            </p>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={addRule}
              className="mt-3 h-8 gap-1.5 border border-white/10 bg-white/5 text-xs text-zinc-100 hover:bg-white/10"
            >
              <Plus className="h-3 w-3" />
              Ajouter une condition
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3 rounded-xl border border-white/10 bg-white/[0.02] p-4">
      <header className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-xs">
          <span className="text-zinc-400">Cette reco s'affiche quand</span>
          <Select
            value={group.combinator}
            onValueChange={(v) => setCombinator(v as "and" | "or")}
          >
            <SelectTrigger className="h-7 w-32 border-white/15 bg-white/5 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="and">TOUTES</SelectItem>
              <SelectItem value="or">AU MOINS UNE</SelectItem>
            </SelectContent>
          </Select>
          <span className="text-zinc-400">des règles ci-dessous sont vraies :</span>
        </div>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={setAlwaysOn}
          className="h-7 gap-1 text-[11px] text-zinc-500 hover:text-white"
        >
          Toujours pertinente
        </Button>
      </header>

      <ol className="space-y-2">
        {group.rules.map((rule, idx) => (
          <li key={idx} className="flex items-start gap-2">
            <span className="mt-2 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/[0.06] font-mono text-[11px] text-zinc-400">
              {idx + 1}
            </span>
            <div className="flex-1">
              <RuleEditor
                worker={worker}
                catalog={catalog}
                rule={rule}
                onChange={(r) => updateRule(idx, r)}
              />
            </div>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => removeRule(idx)}
              className="mt-1 h-8 w-8 p-0 text-zinc-500 hover:text-rose-300"
              aria-label="Supprimer cette règle"
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </li>
        ))}
      </ol>

      <Button
        type="button"
        size="sm"
        variant="ghost"
        onClick={addRule}
        className="h-8 gap-1 border border-dashed border-white/15 bg-transparent text-xs text-zinc-300 hover:border-white/30 hover:bg-white/[0.03] hover:text-white"
      >
        <Plus className="h-3 w-3" />
        Ajouter une règle
      </Button>
    </div>
  );
}

/* ============================================================================
 * Per-rule editor
 * ========================================================================= */

function RuleEditor({
  worker,
  catalog,
  rule,
  onChange,
}: {
  worker: string;
  catalog: WorkerAggregateCatalogEntry[];
  rule: LeafRule;
  onChange: (r: LeafRule) => void;
}) {
  if (rule.kind === "all") {
    return (
      <div className="flex items-center gap-2 rounded-md border border-white/10 bg-white/[0.04] p-2 text-xs text-zinc-300">
        <Sparkles className="h-3.5 w-3.5 text-zinc-400" />
        Toujours vraie — clique sur la corbeille pour retirer cette règle.
      </div>
    );
  }

  const meta = catalog.find((c) => c.key === rule.key);

  return (
    <div className="grid gap-2 rounded-md border border-white/10 bg-white/[0.04] p-2 sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]">
      <FieldPicker
        worker={worker}
        catalog={catalog}
        currentKey={rule.key}
        onChange={(newKey) => {
          onChange(defaultRuleForKey(worker, catalog, newKey));
        }}
      />

      {rule.kind === "score" ? (
        <Select
          value={rule.op}
          onValueChange={(op) => onChange({ ...rule, op: op as "lte" | "gte" })}
        >
          <SelectTrigger className="h-9 w-28 border-white/15 bg-white/5 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="lte">≤ (max)</SelectItem>
            <SelectItem value="gte">≥ (min)</SelectItem>
          </SelectContent>
        </Select>
      ) : (
        <div className="flex h-9 items-center px-3 text-xs text-zinc-400">est ∈</div>
      )}

      {rule.kind === "score" ? (
        <Input
          type="number"
          min={0}
          max={10}
          step={0.5}
          value={rule.value}
          onChange={(e) => onChange({ ...rule, value: Number(e.target.value) })}
          className="h-9"
        />
      ) : (
        <EnumValuePicker
          worker={worker}
          aggregateKey={rule.key}
          fallbackValues={meta?.enumValues?.map((v) => v.value) ?? []}
          values={rule.values}
          onChange={(values) => onChange({ ...rule, values })}
        />
      )}
    </div>
  );
}

/* ============================================================================
 * Field picker (combobox of worker aggregates)
 * ========================================================================= */

function FieldPicker({
  worker,
  catalog,
  currentKey,
  onChange,
}: {
  worker: string;
  catalog: WorkerAggregateCatalogEntry[];
  currentKey: string;
  onChange: (key: string) => void;
}) {
  const eligible = catalog.filter(
    (e) => isScoreLike(e.kind) || isEnumLike(e.kind),
  );
  const grouped = React.useMemo(() => {
    const out = new Map<string, WorkerAggregateCatalogEntry[]>();
    for (const e of eligible) {
      const ns = e.key.includes(".") ? e.key.split(".")[0] : "—";
      const arr = out.get(ns) ?? [];
      arr.push(e);
      out.set(ns, arr);
    }
    return Array.from(out.entries());
  }, [eligible]);

  return (
    <Select value={currentKey} onValueChange={onChange}>
      <SelectTrigger className="h-9 border-white/15 bg-white/5 text-xs">
        <SelectValue placeholder="Choisir une métrique" />
      </SelectTrigger>
      <SelectContent>
        {grouped.map(([namespace, items]) => (
          <React.Fragment key={namespace}>
            <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-zinc-500">
              {namespace.replace(/_/g, " ")}
            </div>
            {items.map((entry) => (
              <SelectItem key={entry.key} value={entry.key}>
                <div className="flex items-center gap-2">
                  <span>{entry.label}</span>
                  <span className="rounded bg-white/[0.05] px-1.5 py-0.5 font-mono text-[9px] text-zinc-400">
                    {entry.kind}
                  </span>
                </div>
              </SelectItem>
            ))}
          </React.Fragment>
        ))}
      </SelectContent>
    </Select>
  );
}

/* ============================================================================
 * Enum value picker (multi-select chips)
 * ========================================================================= */

function EnumValuePicker({
  worker,
  aggregateKey,
  fallbackValues,
  values,
  onChange,
}: {
  worker: string;
  aggregateKey: string;
  fallbackValues: string[];
  values: string[];
  onChange: (values: string[]) => void;
}) {
  const allowed = React.useMemo(() => {
    const registry = getAllowedEnumValues(worker, aggregateKey);
    if (registry && registry.length > 0) return Array.from(registry);
    return fallbackValues;
  }, [worker, aggregateKey, fallbackValues]);

  const toggle = (value: string): void => {
    if (values.includes(value)) onChange(values.filter((v) => v !== value));
    else onChange([...values, value]);
  };

  if (allowed.length === 0) {
    return (
      <div className="flex h-9 items-center rounded-md border border-amber-300/30 bg-amber-400/[0.05] px-3 text-[11px] text-amber-200">
        Aucune valeur enregistrée — voir lib/aggregate-allowed-values.ts
      </div>
    );
  }

  return (
    <div className="flex min-h-9 flex-wrap items-center gap-1 rounded-md border border-white/15 bg-white/5 p-1">
      {allowed.map((value) => {
        const selected = values.includes(value);
        return (
          <button
            key={value}
            type="button"
            onClick={() => toggle(value)}
            className={`rounded-full px-2 py-0.5 text-[10px] transition-colors ${
              selected
                ? "bg-emerald-400/20 text-emerald-100 ring-1 ring-emerald-300/30"
                : "bg-white/[0.04] text-zinc-300 hover:bg-white/10 hover:text-white"
            }`}
            title={formatAggregateDisplayValue(worker, aggregateKey, value, "fr")}
          >
            {value}
          </button>
        );
      })}
    </div>
  );
}

/* ============================================================================
 * JSON expert mode
 * ========================================================================= */

function JsonEditor({
  value,
  onChange,
}: {
  value: Condition;
  onChange: (c: Condition) => void;
}) {
  const [text, setText] = React.useState(() => JSON.stringify(value, null, 2));
  const [error, setError] = React.useState<string | null>(null);
  const lastApplied = React.useRef(text);

  React.useEffect(() => {
    const stringified = JSON.stringify(value, null, 2);
    if (stringified !== lastApplied.current) {
      setText(stringified);
      lastApplied.current = stringified;
    }
  }, [value]);

  const apply = (next: string): void => {
    setText(next);
    try {
      const parsed = JSON.parse(next) as Condition;
      setError(null);
      lastApplied.current = next;
      onChange(parsed);
    } catch (err) {
      setError(err instanceof Error ? err.message : "JSON invalide");
    }
  };

  return (
    <div className="space-y-2">
      <Label className="text-[11px] uppercase tracking-[0.12em] text-zinc-400">
        DSL JSON
      </Label>
      <Textarea
        rows={10}
        value={text}
        onChange={(e) => apply(e.target.value)}
        className="font-mono text-xs"
        spellCheck={false}
      />
      {error ? (
        <p className="text-xs text-rose-300">JSON invalide : {error}</p>
      ) : null}
      <details className="rounded-md border border-white/10 bg-white/[0.02] p-3 text-xs text-zinc-400">
        <summary className="cursor-pointer font-semibold uppercase tracking-[0.12em] text-zinc-300">
          Référence DSL
        </summary>
        <pre className="mt-2 whitespace-pre-wrap font-mono text-[10px] leading-relaxed text-zinc-400">
{`{ "all": true }                                  // toujours
{ "score_lte": { "key": "...", "value": N } }    // score ≤ N
{ "score_gte": { "key": "...", "value": N } }    // score ≥ N
{ "enum_in":  { "key": "...", "values": [...] } }// enum dans liste
{ "and": [ ... ] }                                // ET
{ "or":  [ ... ] }                                // OU`}
        </pre>
      </details>
    </div>
  );
}

/* ============================================================================
 * Side panels: validation + plain language + live preview
 * ========================================================================= */

function ValidationPanel({
  issues,
}: {
  issues: ReturnType<typeof validateCondition>["issues"];
}) {
  if (issues.length === 0) {
    return (
      <div className="flex items-center gap-2 rounded-md border border-emerald-300/20 bg-emerald-400/[0.05] px-3 py-2 text-xs text-emerald-200">
        <CheckCircle2 className="h-3.5 w-3.5" />
        Condition valide
      </div>
    );
  }

  const errors = issues.filter((i) => i.level === "error");
  const warnings = issues.filter((i) => i.level === "warning");

  return (
    <div className="space-y-1">
      {errors.map((issue, i) => (
        <div
          key={`e-${i}`}
          className="flex items-start gap-2 rounded-md border border-rose-300/20 bg-rose-400/[0.06] px-3 py-2 text-xs text-rose-200"
        >
          <X className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>{issue.message}</span>
        </div>
      ))}
      {warnings.map((issue, i) => (
        <div
          key={`w-${i}`}
          className="flex items-start gap-2 rounded-md border border-amber-300/20 bg-amber-400/[0.05] px-3 py-2 text-xs text-amber-200"
        >
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>{issue.message}</span>
        </div>
      ))}
    </div>
  );
}

function PlainLanguagePreview({
  worker,
  condition,
}: {
  worker: string;
  condition: Condition;
}) {
  const sentence = React.useMemo(
    () => describeConditionFor(worker, condition),
    [worker, condition],
  );
  return (
    <div className="rounded-md border border-white/10 bg-white/[0.03] px-3 py-2 text-xs text-zinc-200">
      <span className="mr-1 font-semibold text-zinc-400">Lecture :</span>
      {sentence}
    </div>
  );
}

function LiveMatchPreview({
  worker,
  condition,
}: {
  worker: string;
  condition: Condition;
}) {
  const preview = useConditionPreview(worker, condition);

  if (preview.isLoading) {
    return (
      <div className="rounded-md border border-white/10 bg-white/[0.03] px-3 py-2 text-xs text-zinc-400">
        Chargement de l'aperçu…
      </div>
    );
  }

  if (preview.total === 0) {
    return (
      <div className="rounded-md border border-white/10 bg-white/[0.03] px-3 py-2 text-xs text-zinc-400">
        <span className="mr-1 font-semibold text-zinc-300">Aperçu :</span>
        aucune analyse récente disponible pour estimer le matching.
      </div>
    );
  }

  const accent =
    preview.percent >= 60 ? "text-amber-200"
    : preview.percent >= 20 ? "text-emerald-200"
    : "text-sky-200";

  return (
    <div className="flex items-center justify-between gap-3 rounded-md border border-white/10 bg-white/[0.03] px-3 py-2 text-xs text-zinc-300">
      <div className="flex items-center gap-2">
        <Eye className="h-3.5 w-3.5 text-zinc-400" />
        <span className="font-semibold text-zinc-200">Match estimé</span>
        <span className="text-zinc-400">
          sur {preview.total} analyses récentes
        </span>
      </div>
      <Badge variant="outline" className={`border-white/15 ${accent} bg-white/[0.04]`}>
        {preview.matched} / {preview.total} ({preview.percent}%)
      </Badge>
    </div>
  );
}
