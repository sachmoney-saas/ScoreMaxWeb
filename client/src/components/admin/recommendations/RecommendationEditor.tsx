import * as React from "react";
import { Loader2, Save } from "lucide-react";

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
import { extractReferencedKeys } from "@/lib/recommendation-condition";
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

/* ============================================================================
 * Form state — keeps DB shape + a local-only `enabled` flag
 * ========================================================================= */

type FormState = Recommendation & { enabled: boolean };

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

function fromRecord(rec: Recommendation): FormState {
  return { ...rec, enabled: (rec as Recommendation & { enabled?: boolean }).enabled ?? true };
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
  if (form.type === "hard" && form.steps.length === 0) {
    w.push("Une intervention hardmaxxing devrait détailler des étapes.");
  }
  if (form.type === "hard" && form.cost_min === null && form.cost_max === null) {
    w.push("Renseigne une fourchette de coût pour les interventions hard.");
  }
  if (form.targets.length === 0) {
    w.push("Aucune métrique ciblée — la reco ne sera jamais boostée par pertinence.");
  }
  if (!form.summary_fr.trim() || !form.summary_en.trim()) {
    w.push("Pense à remplir les résumés FR ET EN.");
  }
  if (
    form.protocol_slots.length === 0 &&
    form.duration_value === null &&
    form.category !== "surgery" &&
    form.category !== "device_clinical"
  ) {
    w.push(
      "Aucun créneau ni durée : la reco n'apparaîtra ni dans la routine ni dans les cures actives.",
    );
  }
  if (form.duration_unit === "permanent" && form.protocol_slots.length === 0) {
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

  React.useEffect(() => {
    if (!open) return;
    setForm(rec ? fromRecord(rec) : makeEmpty(worker));
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
          Métriques ciblées (targets)
        </p>
        <p className="text-xs text-zinc-400">
          Ces métriques seront affichées dans le bloc "Pour toi" et boosteront le
          ranking de pertinence pour les users qui ont un faible score dessus.
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
