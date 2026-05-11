import * as React from "react";
import { Clipboard, Loader2, Save, Upload } from "lucide-react";

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
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
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import type { WorkerAggregateCatalogEntry } from "@/lib/face-analysis-display";
import {
  extractReferencedKeys,
  validateCondition,
  type AllowedAggregate,
} from "@/lib/recommendation-condition";
import { PROTOCOL_SLOTS, sanitizeProtocolSlots } from "@/lib/protocol-slots";
import type {
  Condition,
  Recommendation,
  RecommendationCategory,
  RecommendationDurationUnit,
  RecommendationEvidence,
  RecommendationRisk,
  RecommendationType,
} from "@/lib/recommendations";

import { ConditionBuilder } from "./ConditionBuilder";
import { useUpsertRecommendation } from "./hooks";
import { ProtocolSlotsPicker } from "./ProtocolSlotsPicker";
import { StepsEditor } from "./StepsEditor";
import { TargetsPicker } from "./TargetsPicker";
import { TARGETS_COPY } from "./recommendation-targets-copy";

/* ============================================================================
 * Form state — keeps DB shape + a local-only `enabled` flag
 * ========================================================================= */

type FormState = Recommendation & { enabled: boolean };

type JsonImportResult = {
  form: FormState;
  applied: string[];
  warnings: string[];
};

const recommendationTypes = ["soft", "hard"] as const satisfies readonly RecommendationType[];
const recommendationCategories = [
  "habit",
  "exercise",
  "topical",
  "nutrition",
  "device",
  "injectable",
  "energy",
  "surgery",
  "device_clinical",
  "cosmetic",
] as const satisfies readonly RecommendationCategory[];
const recommendationRisks = ["none", "low", "medium", "high"] as const satisfies readonly RecommendationRisk[];
const recommendationEvidences = ["community", "studies", "medical"] as const satisfies readonly RecommendationEvidence[];
const recommendationDurationUnits = [
  "days",
  "weeks",
  "months",
  "session",
  "permanent",
] as const satisfies readonly RecommendationDurationUnit[];

const JSON_PROMPT = `Tu dois générer une recommandation ScoreMax au format JSON strict.
Réponds uniquement avec un objet JSON valide, sans markdown.

Structure exacte :
{
  "id": "worker.slug_snake_case",
  "type": "soft" | "hard",
  "category": "habit" | "exercise" | "topical" | "nutrition" | "device" | "injectable" | "energy" | "surgery" | "device_clinical" | "cosmetic",
  "priority": 0-100,
  "title_fr": "Titre français court",
  "title_en": "Short English title",
  "summary_fr": "Résumé français concret, orienté action",
  "summary_en": "Concrete action-oriented English summary",
  "steps": [{ "fr": "Étape en français", "en": "Step in English" }],
  "duration_value": number | null,
  "duration_unit": "days" | "weeks" | "months" | "session" | "permanent" | null,
  "cost_min": number | null,
  "cost_max": number | null,
  "cost_currency": "EUR" | null,
  "risk": "none" | "low" | "medium" | "high",
  "evidence": "community" | "studies" | "medical",
  "targets": ["aggregate_key"],
  "conditions": { "all": true },
  "source_url": string | null,
  "protocol_slots": ["morning" | "midday" | "evening" | "night" | "weekly" | "general"],
  "enabled": true
}

Règles :
- id doit commencer par le code worker affiché dans l'interface, exemple: eyes.my_recommendation.
- FR et EN obligatoires pour title, summary et chaque step.
- steps doit être un tableau d'objets { "fr": string, "en": string }.
- targets contient les clés de métriques concernées par la reco.
- conditions utilise ce DSL uniquement :
  { "all": true }
  { "score_lte": { "key": "metric_key", "value": 5 } }
  { "score_gte": { "key": "metric_key", "value": 7 } }
  { "enum_in": { "key": "metric_key", "values": ["value"] } }
  { "and": [condition, condition] }
  { "or": [condition, condition] }
- soft = routine, exercice, soin, habitude, accessoire non médical.
- hard = intervention clinique, injectable, chirurgie, énergie, device clinique.
- protocol_slots détermine où la reco apparaît dans Mon protocole. Laisser [] pour une cure ponctuelle.
- Ne mets aucune clé inconnue.`;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isOneOf<T extends readonly string[]>(value: unknown, allowed: T): value is T[number] {
  return typeof value === "string" && (allowed as readonly string[]).includes(value);
}

function optionalNumber(value: unknown): number | null | undefined {
  if (value === null) return null;
  if (value === undefined || value === "") return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function optionalString(value: unknown): string | null | undefined {
  if (value === null) return null;
  if (typeof value === "string") return value;
  return undefined;
}

function normalizeStringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  return Array.from(new Set(value.filter((v): v is string => typeof v === "string")));
}

function normalizeSteps(value: unknown): Recommendation["steps"] | undefined {
  if (!Array.isArray(value)) return undefined;
  const steps = value
    .filter(isPlainObject)
    .map((step) => ({
      fr: typeof step.fr === "string" ? step.fr : "",
      en: typeof step.en === "string" ? step.en : "",
    }))
    .filter((step) => step.fr.trim() || step.en.trim());
  return steps;
}

function isCondition(value: unknown): value is Condition {
  if (!isPlainObject(value)) return false;
  if (value.all === true) return true;
  if (isPlainObject(value.score_lte)) {
    return typeof value.score_lte.key === "string" && typeof value.score_lte.value === "number";
  }
  if (isPlainObject(value.score_gte)) {
    return typeof value.score_gte.key === "string" && typeof value.score_gte.value === "number";
  }
  if (isPlainObject(value.enum_in)) {
    return typeof value.enum_in.key === "string" && Array.isArray(value.enum_in.values) && value.enum_in.values.every((v) => typeof v === "string");
  }
  if (Array.isArray(value.and)) return value.and.every(isCondition);
  if (Array.isArray(value.or)) return value.or.every(isCondition);
  return false;
}

function allowedAggregatesFromCatalog(catalog: WorkerAggregateCatalogEntry[]): AllowedAggregate[] {
  return catalog.map((entry) => ({
    key: entry.key,
    kind: entry.kind,
    allowedValues: entry.enumValues?.map((v) => v.value),
  }));
}

function applyRecommendationJson(
  current: FormState,
  input: unknown,
  worker: string,
  catalog: WorkerAggregateCatalogEntry[],
  isEditing: boolean,
): JsonImportResult {
  if (!isPlainObject(input)) {
    throw new Error("Le JSON doit être un objet.");
  }

  const next: FormState = { ...current, worker };
  const applied: string[] = [];
  const warnings: string[] = [];

  const setField = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    next[key] = value;
    applied.push(key);
  };

  if (!isEditing && typeof input.id === "string") {
    if (input.id.startsWith(`${worker}.`)) {
      setField("id", input.id);
    } else {
      warnings.push(`id ignoré: il doit commencer par ${worker}.`);
    }
  } else if (isEditing && input.id !== undefined) {
    warnings.push("id ignoré: l'ID est immuable en édition.");
  }

  if (isOneOf(input.type, recommendationTypes)) setField("type", input.type);
  if (isOneOf(input.category, recommendationCategories)) setField("category", input.category);
  if (isOneOf(input.risk, recommendationRisks)) setField("risk", input.risk);
  if (isOneOf(input.evidence, recommendationEvidences)) setField("evidence", input.evidence);
  if (isOneOf(input.duration_unit, recommendationDurationUnits) || input.duration_unit === null) {
    setField("duration_unit", input.duration_unit);
  }

  for (const key of ["title_en", "title_fr", "summary_en", "summary_fr"] as const) {
    if (typeof input[key] === "string") setField(key, input[key]);
  }

  for (const key of ["priority", "duration_value", "cost_min", "cost_max"] as const) {
    const value = optionalNumber(input[key]);
    if (value !== undefined) setField(key, key === "priority" && value !== null ? Math.max(0, Math.min(100, value)) : value);
  }

  const costCurrency = optionalString(input.cost_currency);
  if (costCurrency !== undefined) setField("cost_currency", costCurrency);

  const sourceUrl = optionalString(input.source_url);
  if (sourceUrl !== undefined) setField("source_url", sourceUrl);

  if (typeof input.enabled === "boolean") setField("enabled", input.enabled);

  const targets = normalizeStringArray(input.targets);
  if (targets) setField("targets", targets);

  const steps = normalizeSteps(input.steps);
  if (steps) setField("steps", steps);

  if (input.protocol_slots !== undefined) {
    const slots = sanitizeProtocolSlots(input.protocol_slots);
    setField("protocol_slots", slots);
    if (Array.isArray(input.protocol_slots) && slots.length !== input.protocol_slots.length) {
      warnings.push(`protocol_slots invalides supprimés. Valeurs autorisées: ${PROTOCOL_SLOTS.join(", ")}.`);
    }
  }

  if (input.conditions !== undefined) {
    if (isCondition(input.conditions)) {
      const validation = validateCondition(input.conditions, allowedAggregatesFromCatalog(catalog));
      if (validation.valid) {
        setField("conditions", input.conditions);
      } else {
        warnings.push(`conditions ignorées: ${validation.issues.map((i) => i.message).join(" ")}`);
      }
    } else {
      warnings.push("conditions ignorées: DSL invalide.");
    }
  }

  return { form: next, applied, warnings };
}

function buildPromptForWorker(worker: string, catalog: WorkerAggregateCatalogEntry[]): string {
  const metrics = catalog
    .map((entry) => `- ${entry.key} (${entry.kind ?? "unknown"})${entry.enumValues?.length ? ` valeurs: ${entry.enumValues.map((v) => v.value).join(", ")}` : ""}`)
    .join("\n");

  return `${JSON_PROMPT}\n\nWorker courant: ${worker}\nMétriques disponibles:\n${metrics || "- Aucune métrique documentée"}`;
}

function makeEmpty(worker: string): FormState {
  return {
    id: "",
    worker,
    type: "soft",
    category: "habit",
    priority: 50,
    title_en: "",
    title_fr: "",
    summary_en: "",
    summary_fr: "",
    steps: [],
    duration_value: null,
    duration_unit: null,
    cost_min: null,
    cost_max: null,
    cost_currency: "EUR",
    risk: "low",
    evidence: "community",
    targets: [],
    conditions: { all: true },
    source_url: null,
    protocol_slots: [],
    enabled: true,
  };
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? (value as string[]) : [];
}

function asSteps(value: unknown): Recommendation["steps"] {
  return Array.isArray(value) ? (value as Recommendation["steps"]) : [];
}

/** DB/jsonb rows can omit or null array fields — normalize so the editor never crashes. */
function fromRecord(rec: Recommendation): FormState {
  const r = rec as Recommendation & { enabled?: boolean };
  return {
    ...rec,
    id: rec.id ?? "",
    worker: rec.worker ?? "",
    title_en: rec.title_en ?? "",
    title_fr: rec.title_fr ?? "",
    summary_en: rec.summary_en ?? "",
    summary_fr: rec.summary_fr ?? "",
    steps: asSteps(rec.steps),
    targets: asStringArray(rec.targets),
    protocol_slots: sanitizeProtocolSlots(rec.protocol_slots),
    conditions: rec.conditions ?? { all: true },
    enabled: r.enabled ?? true,
  };
}

function suggestId(worker: string, titleEn: string): string {
  if (!titleEn.trim()) return "";
  const slug = titleEn
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
  return `${worker}.${slug}`;
}

/* ============================================================================
 * Cross-field warnings — shown above the save button
 * ========================================================================= */

function buildSemanticWarnings(form: FormState): string[] {
  const w: string[] = [];
  const stepsLen = form.steps?.length ?? 0;
  const targetsLen = form.targets?.length ?? 0;
  const slotsLen = form.protocol_slots?.length ?? 0;
  const summaryFr = (form.summary_fr ?? "").trim();
  const summaryEn = (form.summary_en ?? "").trim();

  if (form.type === "hard" && stepsLen === 0) {
    w.push("Une intervention hardmaxxing devrait détailler des étapes.");
  }
  if (form.type === "hard" && form.cost_min === null && form.cost_max === null) {
    w.push("Renseigne une fourchette de coût pour les interventions hard.");
  }
  if (targetsLen === 0) {
    w.push("Aucune métrique ciblée — la reco ne sera jamais boostée par pertinence.");
  }
  if (!summaryFr || !summaryEn) {
    w.push("Pense à remplir les résumés FR ET EN.");
  }
  if (
    slotsLen === 0 &&
    form.duration_value === null &&
    form.category !== "surgery" &&
    form.category !== "device_clinical"
  ) {
    w.push(
      "Aucun créneau ni durée : la reco n'apparaîtra pas dans le bloc Routine.",
    );
  }
  if (form.duration_unit === "permanent" && slotsLen === 0) {
    w.push(
      "Reco permanente sans créneau : ajoute au moins le slot 'general' pour qu'elle apparaisse dans les règles.",
    );
  }
  return w;
}

/* ============================================================================
 * Public component
 * ========================================================================= */

export interface RecommendationEditorProps {
  worker: string;
  catalog: WorkerAggregateCatalogEntry[];
  rec: Recommendation | null;
  open: boolean;
  onClose: () => void;
}

export function RecommendationEditor({
  worker,
  catalog,
  rec,
  open,
  onClose,
}: RecommendationEditorProps) {
  const { toast } = useToast();
  const upsert = useUpsertRecommendation();
  const isEditing = rec !== null;

  const [form, setForm] = React.useState<FormState>(() => makeEmpty(worker));
  const [jsonImportText, setJsonImportText] = React.useState("");
  const [jsonImportError, setJsonImportError] = React.useState<string | null>(null);
  const [jsonImportWarnings, setJsonImportWarnings] = React.useState<string[]>([]);

  React.useEffect(() => {
    if (!open) return;
    setForm(rec ? fromRecord(rec) : makeEmpty(worker));
    setJsonImportText("");
    setJsonImportError(null);
    setJsonImportWarnings([]);
  }, [open, rec, worker]);

  const update = <K extends keyof FormState>(key: K, value: FormState[K]): void => {
    setForm((f) => ({ ...f, [key]: value }));
  };

  const conditionKeys = React.useMemo(
    () => extractReferencedKeys(form.conditions),
    [form.conditions],
  );

  const semanticWarnings = React.useMemo(
    () => buildSemanticWarnings(form),
    [form],
  );

  const suggestedId = React.useMemo(
    () => suggestId(worker, form.title_en),
    [worker, form.title_en],
  );

  const promptJson = React.useMemo(() => buildPromptForWorker(worker, catalog), [worker, catalog]);

  const handleInjectJson = (): void => {
    try {
      const parsed = JSON.parse(jsonImportText);
      const result = applyRecommendationJson(form, parsed, worker, catalog, isEditing);
      setForm(result.form);
      setJsonImportError(null);
      setJsonImportWarnings(result.warnings);
      if (result.applied.length === 0) {
        setJsonImportWarnings((warnings) =>
          warnings.length > 0 ? warnings : ["Aucun champ reconnu dans ce JSON."],
        );
      }
      toast({
        title: "JSON injecté",
        description: result.applied.length > 0 ? `${result.applied.length} champ(s) mis à jour` : "Aucun champ appliqué",
      });
    } catch (error) {
      setJsonImportError(error instanceof Error ? error.message : String(error));
      setJsonImportWarnings([]);
    }
  };

  const handleCopyPrompt = async (): Promise<void> => {
    await navigator.clipboard.writeText(promptJson);
    toast({ title: "Prompt JSON copié", description: "Colle-le dans l'IA pour générer une reco conforme." });
  };

  const handleSave = (): void => {
    if (!form.id.trim()) {
      toast({ variant: "destructive", title: "ID manquant" });
      return;
    }
    if (!form.title_fr.trim() || !form.title_en.trim()) {
      toast({ variant: "destructive", title: "Titres FR + EN requis" });
      return;
    }

    const payload: Recommendation & { enabled: boolean } = {
      ...form,
      worker,
      cost_min: form.cost_min === null || Number.isNaN(Number(form.cost_min))
        ? null
        : Number(form.cost_min),
      cost_max: form.cost_max === null || Number.isNaN(Number(form.cost_max))
        ? null
        : Number(form.cost_max),
      duration_value: form.duration_value === null || Number.isNaN(Number(form.duration_value))
        ? null
        : Number(form.duration_value),
      priority: Number(form.priority) || 50,
    };

    upsert.mutate(payload, {
      onSuccess: () => {
        toast({
          title: isEditing ? "Recommandation mise à jour" : "Recommandation créée",
          description: payload.id,
        });
        onClose();
      },
      onError: (error) => {
        toast({
          variant: "destructive",
          title: "Sauvegarde impossible",
          description: error instanceof Error ? error.message : String(error),
        });
      },
    });
  };

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="flex w-full flex-col gap-0 overflow-y-auto border-white/15 bg-zinc-950 text-zinc-100 sm:max-w-2xl">
        <SheetHeader className="border-b border-white/10 px-6 py-5">
          <SheetTitle className="font-display text-2xl font-bold tracking-tight text-white">
            {isEditing ? "Éditer la recommandation" : "Nouvelle recommandation"}
          </SheetTitle>
          <SheetDescription className="text-zinc-400">
            Worker · <code className="font-mono text-zinc-200">{worker}</code>
            {form.id ? (
              <>
                {" · "}
                <code className="font-mono text-zinc-200">{form.id}</code>
              </>
            ) : null}
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 px-6 py-5">
          {!isEditing ? (
            <div className="mb-4 space-y-4 rounded-2xl border border-cyan-400/20 bg-cyan-500/5 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-white">Import JSON / prompt IA</p>
                  <p className="text-xs text-zinc-400">
                    Copie la structure exacte ou colle un JSON pour remplir le formulaire.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button type="button" variant="outline" className="border-white/15 bg-black/20 text-white hover:bg-white/10" onClick={handleCopyPrompt}>
                    <Clipboard className="mr-2 h-4 w-4" />
                    Prompt JSON
                  </Button>
                  <Button type="button" className="bg-cyan-400 text-zinc-950 hover:bg-cyan-300" onClick={handleInjectJson}>
                    <Upload className="mr-2 h-4 w-4" />
                    Injecter JSON
                  </Button>
                </div>
              </div>
              <Textarea
                value={jsonImportText}
                onChange={(e) => setJsonImportText(e.target.value)}
                placeholder='{"id":"eyes.my_reco","title_fr":"..."}'
                className="min-h-40 border-white/10 bg-black/30 font-mono text-xs text-zinc-100 placeholder:text-zinc-600"
              />
              {jsonImportError ? <p className="text-xs text-rose-300">{jsonImportError}</p> : null}
              {jsonImportWarnings.length > 0 ? (
                <ul className="space-y-1 text-xs text-amber-200">
                  {jsonImportWarnings.map((warning) => (
                    <li key={warning}>⚠ {warning}</li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : null}

          <Accordion
            type="multiple"
            defaultValue={["identity", "matching", "content"]}
            className="space-y-3"
          >
            <Section value="identity" title="Identité" subtitle="ID, type, catégorie, priorité, état">
              <IdentitySection
                form={form}
                onChange={update}
                suggestedId={suggestedId}
                isEditing={isEditing}
              />
            </Section>

            <Section
              value="matching"
              title="Matching"
              subtitle="Quand cette reco s'affiche-t-elle pour un utilisateur ?"
            >
              <MatchingSection
                worker={worker}
                catalog={catalog}
                conditions={form.conditions}
                onChangeConditions={(c) => update("conditions", c)}
                targets={form.targets}
                onChangeTargets={(t) => update("targets", t)}
                conditionKeys={conditionKeys}
              />
            </Section>

            <Section
              value="content"
              title="Contenu (bilingue)"
              subtitle="Titres, résumés et étapes en FR + EN"
            >
              <ContentSection form={form} onChange={update} />
            </Section>

            <Section
              value="protocol"
              title="Protocole utilisateur"
              subtitle="À quel(s) moment(s) cette reco doit-elle apparaître dans Mon protocole ?"
            >
              <ProtocolSlotsSection form={form} onChange={update} />
            </Section>

            <Section
              value="meta"
              title="Métadonnées pratiques"
              subtitle="Durée, coût, risque, niveau de preuve"
            >
              <MetaSection form={form} onChange={update} />
            </Section>
          </Accordion>
        </div>

        <SheetFooter className="sticky bottom-0 border-t border-white/10 bg-zinc-950 px-6 py-4">
          <div className="flex w-full flex-col gap-2">
            {semanticWarnings.length > 0 ? (
              <ul className="space-y-0.5 text-[11px] text-amber-200">
                {semanticWarnings.map((w, i) => (
                  <li key={i}>⚠ {w}</li>
                ))}
              </ul>
            ) : null}
            <div className="flex items-center justify-between">
              <Button
                variant="ghost"
                onClick={onClose}
                className="text-zinc-400 hover:text-white"
              >
                Annuler
              </Button>
              <Button
                onClick={handleSave}
                disabled={upsert.isPending}
                className="gap-2 bg-white text-zinc-900 hover:bg-zinc-200"
              >
                {upsert.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                {isEditing ? "Enregistrer" : "Créer"}
              </Button>
            </div>
          </div>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

/* ============================================================================
 * Section components — kept inline so the file stays self-contained
 * ========================================================================= */

function Section({
  value,
  title,
  subtitle,
  children,
}: {
  value: string;
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <AccordionItem
      value={value}
      className="overflow-hidden rounded-xl border border-white/10 bg-white/[0.02] data-[state=open]:bg-white/[0.04]"
    >
      <AccordionTrigger className="px-4 py-3 text-left hover:no-underline">
        <div className="flex flex-col items-start gap-0.5">
          <span className="font-display text-base font-semibold tracking-tight text-white">
            {title}
          </span>
          <span className="text-xs text-zinc-400">{subtitle}</span>
        </div>
      </AccordionTrigger>
      <AccordionContent className="space-y-3 px-4 pb-4 pt-1">
        {children}
      </AccordionContent>
    </AccordionItem>
  );
}

function Field({
  label,
  required,
  children,
  hint,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-[11px] font-semibold uppercase tracking-[0.12em] text-zinc-400">
        {label}
        {required ? <span className="ml-1 text-rose-300">*</span> : null}
      </Label>
      {children}
      {hint ? <p className="text-[11px] text-zinc-500">{hint}</p> : null}
    </div>
  );
}

/* -------------------------------------------------------------- Identity */

function IdentitySection({
  form,
  onChange,
  suggestedId,
  isEditing,
}: {
  form: FormState;
  onChange: <K extends keyof FormState>(key: K, value: FormState[K]) => void;
  suggestedId: string;
  isEditing: boolean;
}) {
  return (
    <div className="space-y-3">
      <Field
        label="ID"
        required
        hint={
          isEditing
            ? "L'ID est immuable une fois la reco créée."
            : "Convention : worker.snake_case_title (ex: eyes.cold_therapy)."
        }
      >
        <Input
          value={form.id}
          disabled={isEditing}
          onChange={(e) => onChange("id", e.target.value)}
          placeholder={suggestedId || `${form.worker}.my_recommendation`}
          className="font-mono"
        />
        {!isEditing && suggestedId && form.id !== suggestedId ? (
          <button
            type="button"
            onClick={() => onChange("id", suggestedId)}
            className="mt-1 text-[11px] text-zinc-400 hover:text-white"
          >
            Utiliser : <code className="font-mono">{suggestedId}</code>
          </button>
        ) : null}
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Type">
          <Select
            value={form.type}
            onValueChange={(v) => onChange("type", v as RecommendationType)}
          >
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="soft">Soft (naturel)</SelectItem>
              <SelectItem value="hard">Hard (clinique)</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <Field label="Catégorie">
          <Select
            value={form.category}
            onValueChange={(v) => onChange("category", v as RecommendationCategory)}
          >
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="habit">Habitude</SelectItem>
              <SelectItem value="exercise">Exercice</SelectItem>
              <SelectItem value="topical">Topique</SelectItem>
              <SelectItem value="nutrition">Nutrition</SelectItem>
              <SelectItem value="device">Accessoire</SelectItem>
              <SelectItem value="injectable">Injectable</SelectItem>
              <SelectItem value="energy">Énergie</SelectItem>
              <SelectItem value="surgery">Chirurgie</SelectItem>
              <SelectItem value="device_clinical">Appareil clinique</SelectItem>
              <SelectItem value="cosmetic">Cosmétique</SelectItem>
            </SelectContent>
          </Select>
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field
          label="Priorité (0–100)"
          hint="Plus haut = remontera en priorité dans la liste user."
        >
          <Input
            type="number"
            min={0}
            max={100}
            value={form.priority}
            onChange={(e) => onChange("priority", Number(e.target.value))}
          />
        </Field>
        <Field label="État">
          <div className="flex h-10 items-center gap-2 rounded-md border border-white/15 bg-white/5 px-3">
            <Switch
              checked={form.enabled}
              onCheckedChange={(v) => onChange("enabled", v)}
            />
            <span className="text-sm text-zinc-300">
              {form.enabled ? "Visible côté users" : "Masquée"}
            </span>
          </div>
        </Field>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------- Matching */

function MatchingSection({
  worker,
  catalog,
  conditions,
  onChangeConditions,
  targets,
  onChangeTargets,
  conditionKeys,
}: {
  worker: string;
  catalog: WorkerAggregateCatalogEntry[];
  conditions: Condition;
  onChangeConditions: (c: Condition) => void;
  targets: string[];
  onChangeTargets: (t: string[]) => void;
  conditionKeys: string[];
}) {
  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-zinc-400">
          Conditions de matching
        </p>
        <ConditionBuilder
          worker={worker}
          catalog={catalog}
          value={conditions}
          onChange={onChangeConditions}
        />
      </div>

      <div className="space-y-2">
        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-zinc-400">
          {TARGETS_COPY.title}
        </p>
        <p className="text-xs text-zinc-400">
          {TARGETS_COPY.description}
        </p>
        <TargetsPicker
          catalog={catalog}
          values={targets}
          onChange={onChangeTargets}
          conditionKeys={conditionKeys}
        />
      </div>
    </div>
  );
}

/* --------------------------------------------------------------- Content */

function ContentSection({
  form,
  onChange,
}: {
  form: FormState;
  onChange: <K extends keyof FormState>(key: K, value: FormState[K]) => void;
}) {
  return (
    <div className="space-y-3">
      <div className="grid gap-3 md:grid-cols-2">
        <Field label="Titre FR" required>
          <Input value={form.title_fr} onChange={(e) => onChange("title_fr", e.target.value)} />
        </Field>
        <Field label="Titre EN" required>
          <Input value={form.title_en} onChange={(e) => onChange("title_en", e.target.value)} />
        </Field>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <Field label="Résumé FR">
          <Textarea
            rows={4}
            value={form.summary_fr}
            onChange={(e) => onChange("summary_fr", e.target.value)}
          />
        </Field>
        <Field label="Résumé EN">
          <Textarea
            rows={4}
            value={form.summary_en}
            onChange={(e) => onChange("summary_en", e.target.value)}
          />
        </Field>
      </div>
      <Field label="Étapes">
        <StepsEditor
          steps={form.steps}
          onChange={(steps) => onChange("steps", steps)}
        />
      </Field>
    </div>
  );
}

/* --------------------------------------------------------------- Meta */

function MetaSection({
  form,
  onChange,
}: {
  form: FormState;
  onChange: <K extends keyof FormState>(key: K, value: FormState[K]) => void;
}) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <Field label="Durée — valeur">
          <Input
            type="number"
            value={form.duration_value ?? ""}
            onChange={(e) =>
              onChange("duration_value", e.target.value === "" ? null : Number(e.target.value))
            }
          />
        </Field>
        <Field label="Durée — unité">
          <Select
            value={form.duration_unit ?? "weeks"}
            onValueChange={(v) => onChange("duration_unit", v as RecommendationDurationUnit)}
          >
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="days">jours</SelectItem>
              <SelectItem value="weeks">semaines</SelectItem>
              <SelectItem value="months">mois</SelectItem>
              <SelectItem value="session">séances</SelectItem>
              <SelectItem value="permanent">permanent</SelectItem>
            </SelectContent>
          </Select>
        </Field>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <Field label="Coût min">
          <Input
            type="number"
            value={form.cost_min ?? ""}
            onChange={(e) =>
              onChange("cost_min", e.target.value === "" ? null : Number(e.target.value))
            }
          />
        </Field>
        <Field label="Coût max">
          <Input
            type="number"
            value={form.cost_max ?? ""}
            onChange={(e) =>
              onChange("cost_max", e.target.value === "" ? null : Number(e.target.value))
            }
          />
        </Field>
        <Field label="Devise">
          <Input
            value={form.cost_currency ?? "EUR"}
            onChange={(e) => onChange("cost_currency", e.target.value)}
          />
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Risque">
          <Select
            value={form.risk}
            onValueChange={(v) => onChange("risk", v as RecommendationRisk)}
          >
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Aucun</SelectItem>
              <SelectItem value="low">Faible</SelectItem>
              <SelectItem value="medium">Modéré</SelectItem>
              <SelectItem value="high">Élevé</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <Field label="Niveau de preuve">
          <Select
            value={form.evidence}
            onValueChange={(v) => onChange("evidence", v as RecommendationEvidence)}
          >
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="community">Communauté</SelectItem>
              <SelectItem value="studies">Études</SelectItem>
              <SelectItem value="medical">Médical</SelectItem>
            </SelectContent>
          </Select>
        </Field>
      </div>
      <Field label="URL source (optionnel)">
        <Input
          value={form.source_url ?? ""}
          onChange={(e) => onChange("source_url", e.target.value || null)}
          placeholder="https://…"
        />
      </Field>
    </div>
  );
}

/* --------------------------------------------------------------- Protocol */

function ProtocolSlotsSection({
  form,
  onChange,
}: {
  form: FormState;
  onChange: <K extends keyof FormState>(key: K, value: FormState[K]) => void;
}) {
  return (
    <div className="space-y-3">
      <Field
        label="Créneaux dans le protocole"
        hint="Détermine où la reco apparaît dans la page « Mon protocole » du user."
      >
        <ProtocolSlotsPicker
          values={form.protocol_slots}
          onChange={(slots) => onChange("protocol_slots", slots)}
        />
      </Field>
    </div>
  );
}
