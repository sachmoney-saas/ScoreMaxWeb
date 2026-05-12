import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { ChevronDown, ChevronRight, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { useAdminClientErrors, usePurgeAdminClientErrorReports } from "@/hooks/use-supabase";
import type { AdminClientErrorRow } from "@/lib/admin-client-errors";

function formatWhen(iso: string) {
  return format(new Date(iso), "dd MMM yyyy HH:mm:ss", { locale: fr });
}

function PayloadPreview({ payload }: { payload: unknown }) {
  try {
    const text =
      typeof payload === "string"
        ? payload
        : JSON.stringify(payload ?? null, null, 2);
    return (
      <pre className="max-h-48 overflow-auto whitespace-pre-wrap break-all rounded-md border border-white/10 bg-black/40 p-3 text-[11px] leading-relaxed text-zinc-300">
        {text}
      </pre>
    );
  } catch {
    return <span className="text-xs text-zinc-500">(payload illisible)</span>;
  }
}

function RowDetailToggle({
  row,
  open,
  onToggle,
}: {
  row: AdminClientErrorRow;
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <>
      <TableRow className="border-white/10 hover:bg-white/[0.03]">
        <TableCell className="max-w-[140px] align-top text-xs text-zinc-400">
          {formatWhen(row.created_at)}
        </TableCell>
        <TableCell className="align-top">
          <Badge variant="outline" className="border-white/20 bg-black/30 font-mono text-[11px] text-zinc-200">
            {row.source}
          </Badge>
        </TableCell>
        <TableCell className="max-w-md align-top text-sm text-zinc-100">
          <div className="space-y-1">
            <p className="font-medium leading-snug">{row.message}</p>
            {row.error_code ? (
              <p className="font-mono text-[11px] text-amber-200/90">{row.error_code}</p>
            ) : null}
          </div>
        </TableCell>
        <TableCell className="max-w-[200px] align-top text-xs text-zinc-400">
          <div className="space-y-1">
            <p className="truncate" title={row.user_email ?? row.user_id ?? ""}>
              {row.user_email ?? row.user_id ?? "—"}
            </p>
            {row.client_route ? (
              <p className="truncate font-mono text-[10px] text-zinc-500" title={row.client_route}>
                {row.client_route}
              </p>
            ) : null}
          </div>
        </TableCell>
        <TableCell className="w-[52px] align-top">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-zinc-400 hover:bg-white/10 hover:text-white"
            onClick={onToggle}
            aria-expanded={open}
            aria-label={open ? "Masquer le détail" : "Voir le détail"}
          >
            {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </Button>
        </TableCell>
      </TableRow>
      {open ? (
        <TableRow className="border-white/10 bg-black/20 hover:bg-black/25">
          <TableCell colSpan={5} className="p-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                  Détail Postgres / hint
                </p>
                {row.error_detail ? (
                  <p className="text-sm text-zinc-300">{row.error_detail}</p>
                ) : (
                  <p className="text-sm text-zinc-600">—</p>
                )}
                {row.error_hint ? (
                  <p className="text-xs text-zinc-500">
                    <span className="font-semibold text-zinc-400">Hint : </span>
                    {row.error_hint}
                  </p>
                ) : null}
              </div>
              <div className="space-y-2">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                  User-Agent
                </p>
                <p className="break-all text-xs text-zinc-400">{row.user_agent ?? "—"}</p>
                {row.app_version ? (
                  <p className="text-xs text-zinc-500">
                    <span className="font-semibold text-zinc-400">Version app : </span>
                    {row.app_version}
                  </p>
                ) : null}
              </div>
            </div>
            <div className="mt-4 space-y-2">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                Payload JSON
              </p>
              <PayloadPreview payload={row.payload} />
            </div>
          </TableCell>
        </TableRow>
      ) : null}
    </>
  );
}

export default function AdminClientErrorsPage() {
  const { toast } = useToast();
  const purgeMutation = usePurgeAdminClientErrorReports();
  const [searchQuery, setSearchQuery] = useState("");
  const [sourceFilter, setSourceFilter] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 50;
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const listFilters = useMemo(
    () => ({
      limit: pageSize,
      offset: (page - 1) * pageSize,
      ...(sourceFilter.trim() ? { source: sourceFilter.trim() } : {}),
      ...(searchQuery.trim() ? { search: searchQuery.trim() } : {}),
    }),
    [page, pageSize, searchQuery, sourceFilter],
  );

  const { data, isLoading, isFetching } = useAdminClientErrors(listFilters);
  const rows = data?.rows ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  useEffect(() => {
    setPage(1);
  }, [searchQuery, sourceFilter]);

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  async function handlePurge(deleteAll: boolean) {
    try {
      const result = await purgeMutation.mutateAsync({ deleteAll });
      toast({
        title: deleteAll ? "Journal vidé" : "Purge des anciennes entrées",
        description: `${result.deleted_count} ligne(s) supprimée(s).`,
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Purge impossible",
        description: error instanceof Error ? error.message : "Erreur inconnue.",
      });
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 text-zinc-50">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-400">
          Administration
        </p>
        <h1 className="font-display text-3xl font-bold tracking-tight md:text-4xl">
          Erreurs client
        </h1>
        <p className="max-w-3xl text-base text-zinc-300 md:text-lg">
          Événements remontés depuis l&apos;application (hors pipeline d&apos;analyse serveur). Utile pour
          diagnostiquer les échecs RLS, uploads ou autres erreurs côté navigateur.
        </p>
        <p className="max-w-3xl text-xs text-zinc-500">
          Côté base : purge automatique chaque dimanche à 04h00 UTC des entrées de plus de 90 jours
          (extension pg_cron). Tu peux aussi purger manuellement ci-dessous.
        </p>
      </div>

      <Card className="border-white/15 bg-black/25 text-zinc-50 shadow-xl backdrop-blur-sm">
        <CardContent className="space-y-4 pt-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end">
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={purgeMutation.isPending}
                  className="border-white/25 bg-transparent text-zinc-200 hover:bg-white/10"
                >
                  Purger {'>'} 90 jours
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent className="border-white/15 bg-zinc-950 text-zinc-50">
                <AlertDialogHeader>
                  <AlertDialogTitle>Purger les entrées anciennes ?</AlertDialogTitle>
                  <AlertDialogDescription className="text-zinc-400">
                    Supprime uniquement les rapports datant de plus de 90 jours (identique au nettoyage
                    automatique hebdomadaire).
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel className="border-white/20 bg-transparent text-zinc-200">
                    Annuler
                  </AlertDialogCancel>
                  <AlertDialogAction
                    className="bg-sky-600 text-white hover:bg-sky-500"
                    onClick={() => void handlePurge(false)}
                  >
                    Purger
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>

            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  disabled={purgeMutation.isPending}
                  className="gap-2"
                >
                  <Trash2 className="h-4 w-4" />
                  Tout effacer
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent className="border-white/15 bg-zinc-950 text-zinc-50">
                <AlertDialogHeader>
                  <AlertDialogTitle>Supprimer tous les rapports ?</AlertDialogTitle>
                  <AlertDialogDescription className="text-zinc-400">
                    Action irréversible : la table des erreurs client sera entièrement vidée.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel className="border-white/20 bg-transparent text-zinc-200">
                    Annuler
                  </AlertDialogCancel>
                  <AlertDialogAction
                    className="bg-red-600 text-white hover:bg-red-500"
                    onClick={() => void handlePurge(true)}
                  >
                    Tout supprimer
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>

          <div className="flex flex-col gap-3 md:flex-row md:items-end">
            <div className="flex-1 space-y-2">
              <label htmlFor="client-errors-search" className="text-xs font-medium text-zinc-400">
                Recherche (message, source, code, utilisateur, route)
              </label>
              <Input
                id="client-errors-search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Ex. scan_assets, PGRST…"
                className="border-white/15 bg-black/35 text-white placeholder:text-zinc-600"
              />
            </div>
            <div className="w-full space-y-2 md:w-56">
              <label htmlFor="client-errors-source" className="text-xs font-medium text-zinc-400">
                Source exacte
              </label>
              <Input
                id="client-errors-source"
                value={sourceFilter}
                onChange={(e) => setSourceFilter(e.target.value)}
                placeholder="scan_assets.insert"
                className="border-white/15 bg-black/35 text-white placeholder:text-zinc-600"
              />
            </div>
          </div>

          {isLoading ? (
            <div className="space-y-3 py-4">
              <Skeleton className="h-10 w-full bg-white/10" />
              <Skeleton className="h-48 w-full bg-white/10" />
            </div>
          ) : (
            <>
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-zinc-500">
                <span>
                  {total} événement{total === 1 ? "" : "s"}
                  {isFetching ? " · mise à jour…" : ""}
                </span>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={page <= 1}
                    className="border-white/20 bg-transparent text-zinc-200 hover:bg-white/10"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                  >
                    Précédent
                  </Button>
                  <span className="tabular-nums text-zinc-400">
                    {page} / {totalPages}
                  </span>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={page >= totalPages}
                    className="border-white/20 bg-transparent text-zinc-200 hover:bg-white/10"
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  >
                    Suivant
                  </Button>
                </div>
              </div>

              <div className="overflow-x-auto rounded-lg border border-white/10">
                <Table>
                  <TableHeader>
                    <TableRow className="border-white/10 hover:bg-transparent">
                      <TableHead className="w-[140px] text-zinc-400">Date</TableHead>
                      <TableHead className="text-zinc-400">Source</TableHead>
                      <TableHead className="text-zinc-400">Message</TableHead>
                      <TableHead className="text-zinc-400">Utilisateur</TableHead>
                      <TableHead className="w-[52px]" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.length === 0 ? (
                      <TableRow className="border-white/10 hover:bg-transparent">
                        <TableCell colSpan={5} className="py-12 text-center text-sm text-zinc-500">
                          Aucune erreur enregistrée pour ces filtres.
                        </TableCell>
                      </TableRow>
                    ) : (
                      rows.map((row) => (
                        <RowDetailToggle
                          key={row.id}
                          row={row}
                          open={expandedId === row.id}
                          onToggle={() =>
                            setExpandedId((current) => (current === row.id ? null : row.id))
                          }
                        />
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
