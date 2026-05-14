import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Loader2, Save, ShieldAlert } from "lucide-react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { useProfile } from "@/hooks/use-supabase";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { queryClient } from "@/lib/queryClient";
import {
  listAdminAiImagePrompts,
  updateAdminAiImagePrompt,
  type AdminAiImagePrompt,
} from "@/lib/admin-ai-prompts-api";

const adminPanelClassName =
  "relative overflow-hidden border-white/20 bg-[radial-gradient(circle_at_25%_10%,rgba(255,255,255,0.18),transparent_34%),linear-gradient(145deg,rgba(10,16,22,0.92)_0%,rgba(20,31,39,0.88)_48%,rgba(185,204,209,0.28)_100%)] text-zinc-50 shadow-[0_28px_90px_-55px_rgba(0,0,0,0.95)]";

const ASPECT_RATIOS = ["1:1", "16:9", "9:16", "4:3", "3:4"] as const;
const MODEL_VARIANTS = ["default", "fast"] as const;

function AccessDenied({ onBack }: { onBack: () => void }) {
  return (
    <div className="flex h-[80vh] flex-col items-center justify-center space-y-4 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10 text-destructive">
        <ShieldAlert className="h-8 w-8" />
      </div>
      <h1 className="text-2xl font-bold">Accès refusé</h1>
      <p className="max-w-md text-slate-600">
        Cette zone est réservée aux administrateurs ScoreMax.
      </p>
      <Button onClick={onBack}>Retour à l'application</Button>
    </div>
  );
}

type EditableState = {
  prompt: string;
  model_variant: string;
  aspect_ratio: string;
  safety_filters: boolean;
  is_active: boolean;
};

function toEditable(p: AdminAiImagePrompt): EditableState {
  return {
    prompt: p.prompt,
    model_variant: p.model_variant,
    aspect_ratio: p.aspect_ratio,
    safety_filters: p.safety_filters,
    is_active: p.is_active,
  };
}

function PromptCard({
  prompt,
  accessToken,
}: {
  prompt: AdminAiImagePrompt;
  accessToken: string;
}) {
  const [editable, setEditable] = useState<EditableState>(toEditable(prompt));
  const { toast } = useToast();

  useEffect(() => {
    setEditable(toEditable(prompt));
  }, [prompt]);

  const dirty = useMemo(() => {
    return (
      editable.prompt !== prompt.prompt ||
      editable.model_variant !== prompt.model_variant ||
      editable.aspect_ratio !== prompt.aspect_ratio ||
      editable.safety_filters !== prompt.safety_filters ||
      editable.is_active !== prompt.is_active
    );
  }, [editable, prompt]);

  const mutation = useMutation({
    mutationFn: () =>
      updateAdminAiImagePrompt({
        accessToken,
        key: prompt.key,
        patch: {
          prompt: editable.prompt,
          model_variant: editable.model_variant,
          aspect_ratio: editable.aspect_ratio,
          safety_filters: editable.safety_filters,
          is_active: editable.is_active,
        },
      }),
    onSuccess: async () => {
      toast({
        title: "Prompt mis à jour",
        description: `Les modifications de "${prompt.key}" sont enregistrées.`,
      });
      await queryClient.invalidateQueries({ queryKey: ["admin-ai-image-prompts"] });
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        title: "Mise à jour impossible",
        description:
          error instanceof Error ? error.message : "Une erreur est survenue.",
      });
    },
  });

  return (
    <Card className={adminPanelClassName}>
      <CardHeader className="space-y-1">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <CardTitle className="font-mono text-sm font-semibold tracking-tight text-white">
              {prompt.key}
            </CardTitle>
            {prompt.description ? (
              <CardDescription className="text-zinc-300">
                {prompt.description}
              </CardDescription>
            ) : null}
          </div>
          <div className="flex items-center gap-2 text-xs text-zinc-400">
            <span>Modèle :</span>
            <code className="rounded bg-white/10 px-1.5 py-0.5 text-zinc-100">
              {prompt.model}
            </code>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <label
            htmlFor={`prompt-${prompt.key}`}
            className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-300"
          >
            Prompt
          </label>
          <Textarea
            id={`prompt-${prompt.key}`}
            value={editable.prompt}
            onChange={(e) =>
              setEditable((prev) => ({ ...prev, prompt: e.target.value }))
            }
            rows={6}
            className="bg-black/30 text-sm text-zinc-100"
            spellCheck={false}
          />
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-300">
              Variante modèle
            </label>
            <Select
              value={editable.model_variant}
              onValueChange={(value) =>
                setEditable((prev) => ({ ...prev, model_variant: value }))
              }
            >
              <SelectTrigger className="bg-black/30 text-zinc-100">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MODEL_VARIANTS.map((variant) => (
                  <SelectItem key={variant} value={variant}>
                    {variant}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-300">
              Format
            </label>
            <Select
              value={editable.aspect_ratio}
              onValueChange={(value) =>
                setEditable((prev) => ({ ...prev, aspect_ratio: value }))
              }
            >
              <SelectTrigger className="bg-black/30 text-zinc-100">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ASPECT_RATIOS.map((ratio) => (
                  <SelectItem key={ratio} value={ratio}>
                    {ratio}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-6">
          <label className="flex items-center gap-2 text-sm text-zinc-200">
            <Switch
              checked={editable.safety_filters}
              onCheckedChange={(value) =>
                setEditable((prev) => ({ ...prev, safety_filters: value }))
              }
            />
            Filtres de sécurité
          </label>
          <label className="flex items-center gap-2 text-sm text-zinc-200">
            <Switch
              checked={editable.is_active}
              onCheckedChange={(value) =>
                setEditable((prev) => ({ ...prev, is_active: value }))
              }
            />
            Actif
          </label>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-3">
          <p className="text-xs text-zinc-400">
            Dernière modification : {new Date(prompt.updated_at).toLocaleString()}
          </p>
          <Button
            type="button"
            disabled={!dirty || mutation.isPending}
            onClick={() => mutation.mutate()}
            className="gap-2"
          >
            {mutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            Enregistrer
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export default function AdminAiPromptsPage() {
  const { session } = useAuth();
  const { data: profile, isLoading: isLoadingProfile } = useProfile();
  const [, setLocation] = useLocation();

  const accessToken = session?.access_token ?? "";
  const isAdmin = profile?.role === "admin";

  const query = useQuery({
    queryKey: ["admin-ai-image-prompts"],
    queryFn: () => listAdminAiImagePrompts({ accessToken }),
    enabled: !!accessToken && isAdmin,
    staleTime: 30_000,
  });

  if (!isAdmin && !isLoadingProfile) {
    return <AccessDenied onBack={() => setLocation("/app")} />;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 text-zinc-50">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-400">
          Administration
        </p>
        <h1 className="font-display text-3xl font-bold tracking-tight md:text-4xl">
          Prompts IA
        </h1>
        <p className="max-w-3xl text-base text-zinc-300 md:text-lg">
          Configure les prompts utilisés par OneShot API pour générer les
          aperçus « potentiel » montrés aux utilisateurs.
        </p>
      </div>

      {query.isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-44 w-full" />
          <Skeleton className="h-44 w-full" />
        </div>
      ) : query.isError ? (
        <Card className={adminPanelClassName}>
          <CardContent className="py-6 text-sm text-red-200">
            {query.error instanceof Error
              ? query.error.message
              : "Impossible de charger les prompts."}
          </CardContent>
        </Card>
      ) : !query.data || query.data.length === 0 ? (
        <Card className={adminPanelClassName}>
          <CardContent className="py-6 text-sm text-zinc-300">
            Aucun prompt configuré. Lance la migration{" "}
            <code className="rounded bg-white/10 px-1.5 py-0.5">
              supabase/oneshot_potential_image.sql
            </code>{" "}
            pour créer le prompt par défaut.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {query.data.map((prompt) => (
            <PromptCard
              key={prompt.key}
              prompt={prompt}
              accessToken={accessToken}
            />
          ))}
        </div>
      )}
    </div>
  );
}
