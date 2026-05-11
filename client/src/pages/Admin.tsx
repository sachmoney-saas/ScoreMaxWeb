import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Activity,
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  Clock,
  Crown,
  Filter,
  Mail,
  Search,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  TrendingUp,
  UserCheck,
  UserRound,
  Users,
  XCircle,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import type { Profile } from "@shared/schema";
import {
  GUIDE_TRACE_SCAN_ASSET_CODES,
  REQUIRED_ONBOARDING_SCAN_ASSET_CODES,
} from "@shared/schema";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import {
  useAdminAnalysisJobDetail,
  useAdminAnalysisJobs,
  useAdminMetrics,
  useDeleteAdminAnalysisJob,
  useProfile,
  useUserGrowth,
} from "@/hooks/use-supabase";
import {
  buildAdminAnalysisJobAssetUrl,
  type AdminAnalysisFailure,
  type AdminAnalysisJobsFilters,
} from "@/lib/admin-analysis";
import {
  grantUserSubscription,
  revokeUserSubscription,
} from "@/lib/admin-subscriptions-api";
import { deleteUserAccountAsAdmin } from "@/lib/admin-users-api";
import { queryClient } from "@/lib/queryClient";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";

type AdminProfile = Profile & {
  user_id?: string;
  created_at?: string;
  updated_at?: string;
  last_active_at?: string | null;
};

type RoleFilter = "all" | "user" | "admin";
type OnboardingFilter = "all" | "completed" | "pending";

const adminPanelClassName = "relative overflow-hidden border-white/20 bg-[radial-gradient(circle_at_25%_10%,rgba(255,255,255,0.18),transparent_34%),linear-gradient(145deg,rgba(10,16,22,0.92)_0%,rgba(20,31,39,0.88)_48%,rgba(185,204,209,0.28)_100%)] text-zinc-50 shadow-[0_28px_90px_-55px_rgba(0,0,0,0.95)]";

function formatDate(value: string | Date | null | undefined, pattern: string) {
  return value ? format(new Date(value), pattern, { locale: fr }) : "—";
}

function getProfileId(profile: Pick<AdminProfile, "id" | "user_id">) {
  return profile.id ?? profile.user_id ?? "";
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Une erreur est survenue.";
}

function AdminAnalysisAssetThumb({
  jobId,
  assetTypeCode,
  label,
}: {
  jobId: string;
  assetTypeCode: string;
  label: string;
}) {
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [phase, setPhase] = useState<"loading" | "missing" | "ready">("loading");

  useEffect(() => {
    let cancelled = false;

    setPhase("loading");
    setObjectUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });

    void (async () => {
      try {
        const { data, error } = await supabase.auth.getSession();
        const token = data.session?.access_token;
        if (error || !token || cancelled) {
          if (!cancelled) setPhase("missing");
          return;
        }

        const res = await fetch(buildAdminAnalysisJobAssetUrl(jobId, assetTypeCode), {
          credentials: "include",
          headers: { Authorization: `Bearer ${token}` },
        });

        if (!res.ok || cancelled) {
          if (!cancelled) setPhase("missing");
          return;
        }

        const blob = await res.blob();
        if (!blob.type.startsWith("image/")) {
          if (!cancelled) setPhase("missing");
          return;
        }

        const url = URL.createObjectURL(blob);
        if (cancelled) {
          URL.revokeObjectURL(url);
          return;
        }

        setObjectUrl(url);
        setPhase("ready");
      } catch {
        if (!cancelled) setPhase("missing");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [jobId, assetTypeCode]);

  useEffect(() => {
    return () => {
      setObjectUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });
    };
  }, []);

  return (
    <div className="space-y-1.5">
      <p className="line-clamp-2 font-mono text-[10px] uppercase tracking-wide text-zinc-500">
        {label}
      </p>
      <div className="overflow-hidden rounded-xl border border-white/10 bg-black/35">
        {phase === "loading" ? (
          <div className="aspect-square animate-pulse bg-white/10" />
        ) : phase === "missing" || !objectUrl ? (
          <div className="flex aspect-square flex-col items-center justify-center gap-1 p-2 text-center text-[11px] text-zinc-500">
            Absent
          </div>
        ) : (
          <img alt="" src={objectUrl} className="aspect-square w-full object-cover" />
        )}
      </div>
    </div>
  );
}

export function useAllProfiles() {
  const { isAdmin } = useAuth();

  return useQuery<AdminProfile[]>({
    queryKey: ["profiles"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) {
        throw error;
      }

      return (data ?? []) as AdminProfile[];
    },
    enabled: isAdmin,
    staleTime: 15_000,
  });
}

export default function AdminPage() {
  const { isAdmin } = useAuth();
  const [location, setLocation] = useLocation();
  const { data: profiles = [], isLoading: isLoadingProfiles } = useAllProfiles();
  const { data: metrics, isLoading: isLoadingMetrics } = useAdminMetrics();
  const { data: growthData = [], isLoading: isLoadingGrowth } = useUserGrowth();

  if (!isAdmin && !isLoadingProfiles) {
    return <AccessDenied setLocation={setLocation} />;
  }

  if (location === "/admin/users") {
    return <UsersManagementPage />;
  }

  if (location.startsWith("/admin/analysis")) {
    return <AdminAnalysisPage />;
  }

  const isLoading = isLoadingProfiles || isLoadingMetrics || isLoadingGrowth;

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Aperçu Admin"
        description="Vue globale des utilisateurs, inscriptions et accès plateforme."
      />

      {isLoading ? (
        <AdminSkeleton />
      ) : (
        <>
          <AdminStats metrics={metrics} profiles={profiles} />
          <GrowthChart data={growthData} />
          <RecentUsers profiles={profiles.slice(0, 6)} />
        </>
      )}
    </div>
  );
}

function UsersManagementPage() {
  const { user, session } = useAuth();
  const [, setLocation] = useLocation();
  const { data: profiles = [], isLoading } = useAllProfiles();
  const { updateProfile, isUpdating } = useProfile();
  const { toast } = useToast();
  const [isPurgingUserAccount, setIsPurgingUserAccount] = useState(false);
  const [isMutatingSubscription, setIsMutatingSubscription] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<RoleFilter>("all");
  const [onboardingFilter, setOnboardingFilter] = useState<OnboardingFilter>("all");

  const filteredProfiles = useMemo(() => {
    const query = searchQuery.toLowerCase().trim();

    return profiles.filter((profile) => {
      const matchesSearch =
        !query ||
        profile.email?.toLowerCase().includes(query) ||
        profile.full_name?.toLowerCase().includes(query) ||
        getProfileId(profile).toLowerCase().includes(query);
      const matchesRole = roleFilter === "all" || profile.role === roleFilter;
      const matchesOnboarding =
        onboardingFilter === "all" ||
        (onboardingFilter === "completed" && profile.has_completed_onboarding) ||
        (onboardingFilter === "pending" && !profile.has_completed_onboarding);

      return matchesSearch && matchesRole && matchesOnboarding;
    });
  }, [onboardingFilter, profiles, roleFilter, searchQuery]);

  function viewUserActivity(profile: AdminProfile) {
    const email = profile.email?.trim();
    if (!email) return;
    setLocation(`/admin/analysis?search=${encodeURIComponent(email)}`);
  }

  async function handleToggleSubscriber(profile: AdminProfile) {
    const accessToken = session?.access_token;
    if (!accessToken) {
      toast({
        variant: "destructive",
        title: "Session expirée",
        description: "Reconnecte-toi pour modifier les abonnements.",
      });
      return;
    }

    if (profile.role === "admin") {
      toast({
        variant: "destructive",
        title: "Action inutile",
        description:
          "Les administrateurs disposent automatiquement de l'accès abonné via leur rôle.",
      });
      return;
    }

    const userId = getProfileId(profile);
    const willGrant = !profile.is_subscriber;

    try {
      setIsMutatingSubscription(true);
      if (willGrant) {
        await grantUserSubscription({
          accessToken,
          userId,
          reason: "Manual grant from admin panel",
        });
        toast({
          title: "Abonnement accordé",
          description: "L'utilisateur a maintenant un accès abonné permanent.",
        });
      } else {
        await revokeUserSubscription({
          accessToken,
          userId,
          reason: "Manual revoke from admin panel",
        });
        toast({
          title: "Abonnement révoqué",
          description: "L'accès abonné a été retiré.",
        });
      }
      await queryClient.invalidateQueries({ queryKey: ["profiles"] });
      await queryClient.invalidateQueries({ queryKey: ["profile", userId] });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Mise à jour impossible",
        description: getErrorMessage(error),
      });
    } finally {
      setIsMutatingSubscription(false);
    }
  }

  async function handleToggleOnboarding(profile: AdminProfile) {
    try {
      await updateProfile({
        id: getProfileId(profile),
        updates: { has_completed_onboarding: !profile.has_completed_onboarding },
      });
      toast({ title: "Profil mis à jour", description: "Le statut onboarding a été modifié." });
    } catch (error) {
      toast({ variant: "destructive", title: "Mise à jour impossible", description: getErrorMessage(error) });
    }
  }

  async function handleToggleRole(profile: AdminProfile) {
    if (getProfileId(profile) === user?.id && profile.role === "admin") {
      toast({
        variant: "destructive",
        title: "Action bloquée",
        description: "Tu ne peux pas retirer ton propre accès admin depuis ce panneau.",
      });
      return;
    }

    try {
      const role = profile.role === "admin" ? "user" : "admin";
      await updateProfile({ id: getProfileId(profile), updates: { role } });
      toast({
        title: "Rôle mis à jour",
        description: `L'utilisateur est maintenant ${role === "admin" ? "administrateur" : "utilisateur"}.`,
      });
    } catch (error) {
      toast({ variant: "destructive", title: "Mise à jour impossible", description: getErrorMessage(error) });
    }
  }

  async function handleDeleteUser(profile: AdminProfile) {
    if (getProfileId(profile) === user?.id) {
      toast({
        variant: "destructive",
        title: "Action bloquée",
        description: "Tu ne peux pas supprimer ton propre profil depuis ce panneau.",
      });
      return;
    }

    try {
      setIsPurgingUserAccount(true);
      const token = session?.access_token;
      if (!token) {
        throw new Error("Session expirée.");
      }
      await deleteUserAccountAsAdmin({ accessToken: token, userId: getProfileId(profile) });
      toast({
        title: "Utilisateur supprimé",
        description: "Le compte, le profil et les données associées ont été supprimés.",
      });
      await queryClient.invalidateQueries({ queryKey: ["profiles"] });
    } catch (error) {
      toast({ variant: "destructive", title: "Suppression impossible", description: getErrorMessage(error) });
    } finally {
      setIsPurgingUserAccount(false);
    }
  }

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Gestion des utilisateurs"
        description="Consulte les comptes, ajuste les rôles et gère les accès ScoreMax."
      />

      {isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-96 w-full" />
        </div>
      ) : (
        <UserManagement
          currentUserId={user?.id}
          isMutating={isUpdating || isPurgingUserAccount || isMutatingSubscription}
          onboardingFilter={onboardingFilter}
          profiles={filteredProfiles}
          roleFilter={roleFilter}
          searchQuery={searchQuery}
          totalProfiles={profiles.length}
          onDelete={handleDeleteUser}
          onOnboardingFilterChange={setOnboardingFilter}
          onRoleFilterChange={setRoleFilter}
          onSearchChange={setSearchQuery}
          onToggleOnboarding={handleToggleOnboarding}
          onToggleRole={handleToggleRole}
          onToggleSubscriber={handleToggleSubscriber}
          onViewActivity={viewUserActivity}
        />
      )}
    </div>
  );
}

function AdminAnalysisPage() {
  const [location, setLocation] = useLocation();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [listRowSnapshot, setListRowSnapshot] = useState<AdminAnalysisFailure | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<NonNullable<AdminAnalysisJobsFilters["status"]>>(
    "all",
  );
  const [page, setPage] = useState(1);
  const pageSize = 50;

  useEffect(() => {
    const q = new URLSearchParams(location.split("?")[1] ?? "");
    const search = q.get("search") ?? "";
    setSearchQuery(search);
  }, [location]);

  useEffect(() => {
    const current = new URLSearchParams(location.split("?")[1] ?? "");
    const nextSearch = searchQuery.trim();

    if (!nextSearch) {
      if (current.has("search")) {
        current.delete("search");
        const nextQuery = current.toString();
        setLocation(nextQuery ? `/admin/analysis?${nextQuery}` : "/admin/analysis");
      }
      return;
    }

    if (current.get("search") !== nextSearch) {
      current.set("search", nextSearch);
      setLocation(`/admin/analysis?${current.toString()}`);
    }
  }, [location, searchQuery, setLocation]);

  const listFilters = useMemo<AdminAnalysisJobsFilters>(() => {
    return {
      status: statusFilter,
      limit: pageSize,
      offset: (page - 1) * pageSize,
      ...(searchQuery.trim() ? { search: searchQuery.trim() } : {}),
    };
  }, [page, searchQuery, statusFilter]);

  const { data, isLoading, isFetching } = useAdminAnalysisJobs(listFilters);
  const jobs = data?.jobs ?? [];
  const totalJobs = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalJobs / pageSize));
  const {
    data: jobDetail,
    isLoading: detailLoading,
    isError: detailError,
  } = useAdminAnalysisJobDetail(null, {
    enabled: false,
  });
  void jobDetail;
  void detailLoading;
  void detailError;
  void setSheetOpen;
  void sheetOpen;
  void setListRowSnapshot;
  void listRowSnapshot;

  const deleteJobMutation = useDeleteAdminAnalysisJob();
  const { toast } = useToast();

  const failedCount = useMemo(
    () => jobs.filter((row) => row.status === "failed").length,
    [jobs],
  );

  useEffect(() => {
    setPage(1);
  }, [searchQuery, statusFilter]);

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  function openDetail(row: AdminAnalysisFailure) {
    setLocation(`/admin/analysis-jobs/${row.id}`);
  }


  async function handleDeleteJob(job: AdminAnalysisFailure) {
    try {
      const deleted = await deleteJobMutation.mutateAsync(job.id);
      toast({
        title: "Analyse supprimée",
        description: `${deleted.deleted_scan_asset_count} asset(s) et ${deleted.deleted_storage_object_count} fichier(s) Storage supprimés.`,
      });
    } catch (error) {
      toast({ variant: "destructive", title: "Suppression impossible", description: getErrorMessage(error) });
    }
  }

  const latestJob = jobs[0];

  return (
    <div className="space-y-6">
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent
          side="right"
          className="w-full border-white/10 bg-zinc-950 p-0 text-zinc-50 sm:max-w-3xl"
        >
          {detailLoading ? (
            <div className="flex h-40 items-center justify-center px-6 text-sm text-zinc-500">
              Chargement…
            </div>
          ) : detailError || !jobDetail ? (
            <div className="flex min-h-40 flex-col items-center justify-center gap-2 px-6 text-center">
              <p className="text-sm font-medium text-white">Détail indisponible</p>
              <p className="max-w-sm text-sm text-zinc-500">
                Réessaie ou vérifie les droits admin. Le job peut avoir été supprimé.
              </p>
            </div>
          ) : (
            <ScrollArea className="h-[100dvh]">
              <div className="space-y-8 p-6 pb-16 pt-14">
                <SheetHeader className="space-y-2 text-left">
                  <SheetTitle className="text-xl text-white">
                    Job {jobDetail.job.id.slice(0, 8)}…
                  </SheetTitle>
                  <SheetDescription className="text-zinc-400">
                    {jobDetail.user_email ?? jobDetail.job.user_id}
                  </SheetDescription>
                </SheetHeader>

                <div className="flex flex-wrap gap-2">
                  <Badge
                    variant="outline"
                    className={cn(
                      jobDetail.job.status === "failed" && "border-red-400/45 text-red-200",
                      jobDetail.job.status === "completed" &&
                        "border-emerald-400/45 text-emerald-100",
                      (jobDetail.job.status === "queued" ||
                        jobDetail.job.status === "running") &&
                        "border-sky-400/45 text-sky-100",
                    )}
                  >
                    {jobDetail.job.status}
                  </Badge>
                  <Button variant="outline" size="sm" asChild className="border-white/20 bg-black/25">
                    <Link href={`/app/analyses/${jobDetail.job.id}?asUser=${jobDetail.job.user_id}`}>
                      <UserRound className="mr-2 h-4 w-4" />
                      Impersonifier
                    </Link>
                  </Button>
                  {listRowSnapshot && (jobDetail.job.status === "failed" || jobDetail.job.status === "completed") ? (
                    <DeleteAnalysisJobDialog
                      disabled={deleteJobMutation.isPending}
                      job={listRowSnapshot}
                      onDelete={() => handleDeleteJob(listRowSnapshot)}
                    />
                  ) : null}
                </div>

                {jobDetail.job.status === "failed" ? (
                  <div className="rounded-2xl border border-red-500/25 bg-red-500/10 p-4 text-sm">
                    <p className="font-medium text-red-100">{jobDetail.job.error_code ?? "UNKNOWN"}</p>
                    <p className="mt-2 text-zinc-300">
                      {jobDetail.job.error_message ?? "—"}
                    </p>
                  </div>
                ) : null}

                <section className="space-y-3">
                  <h3 className="text-sm font-semibold text-white">
                    Repères géométriques (capture)
                  </h3>
                  {jobDetail.capture_guide_metrics != null ? (
                    <pre className="max-h-52 overflow-auto rounded-xl border border-white/10 bg-black/40 p-3 font-mono text-[11px] leading-relaxed text-zinc-300">
                      {JSON.stringify(jobDetail.capture_guide_metrics, null, 2)}
                    </pre>
                  ) : (
                    <p className="text-sm text-zinc-500">Aucune métrique stockée.</p>
                  )}
                </section>

                <section className="space-y-3">
                  <h3 className="text-sm font-semibold text-white">
                    Clichés onboarding (8)
                  </h3>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    {REQUIRED_ONBOARDING_SCAN_ASSET_CODES.map((code) => (
                      <AdminAnalysisAssetThumb key={code} jobId={jobDetail.job.id} assetTypeCode={code} label={code} />
                    ))}
                  </div>
                </section>

                <section className="space-y-3">
                  <h3 className="text-sm font-semibold text-white">
                    Images repères GUIDE_TRACE
                  </h3>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                    {GUIDE_TRACE_SCAN_ASSET_CODES.map((code) => (
                      <AdminAnalysisAssetThumb key={code} jobId={jobDetail.job.id} assetTypeCode={code} label={code} />
                    ))}
                  </div>
                </section>

                <section className="space-y-3">
                  <h3 className="text-sm font-semibold text-white">Payload résumé (admin)</h3>
                  <pre className="max-h-64 overflow-auto rounded-xl border border-white/10 bg-black/40 p-3 font-mono text-[11px] leading-relaxed text-zinc-300">
                    {JSON.stringify(jobDetail.request_payload_summary, null, 2)}
                  </pre>
                </section>

                <section className="space-y-3">
                  <h3 className="text-sm font-semibold text-white">Résultats workers</h3>
                  <pre className="max-h-96 overflow-auto rounded-xl border border-white/10 bg-black/40 p-3 font-mono text-[11px] leading-relaxed text-zinc-300">
                    {JSON.stringify(jobDetail.results, null, 2)}
                  </pre>
                </section>

                <section className="space-y-3">
                  <h3 className="text-sm font-semibold text-white">
                    Assets liés ({jobDetail.linked_assets.length})
                  </h3>
                  <pre className="max-h-48 overflow-auto rounded-xl border border-white/10 bg-black/40 p-3 font-mono text-[11px] text-zinc-300">
                    {JSON.stringify(jobDetail.linked_assets, null, 2)}
                  </pre>
                </section>
              </div>
            </ScrollArea>
          )}
        </SheetContent>
      </Sheet>

      {isLoading && jobs.length === 0 ? (
        <div className="space-y-4">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-96 w-full" />
        </div>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-3">
            <StatCard
              title="Analyses chargées"
              value={totalJobs}
              icon={<BarChart3 className="h-4 w-4 text-sky-400" />}
              description="Résultats trouvés sur toute base"
            />
            <StatCard
              title="Dernière activité"
              value={
                latestJob
                  ? formatDate(latestJob.created_at, "dd MMM yyyy, HH:mm")
                  : "—"
              }
              icon={<Clock className="h-4 w-4 text-emerald-300" />}
              description={latestJob?.user_email ?? latestJob?.user_id ?? "Aucune analyse"}
            />
            <StatCard
              title="Échecs (Lot)"
              value={failedCount}
              icon={<AlertTriangle className="h-4 w-4 text-amber-400" />}
              description="Jobs failed parmi les résultats filtrés"
            />
          </div>

          <Card className={adminPanelClassName}>
            <CardHeader className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
              <div className="space-y-1">
                <CardTitle>Toutes les analyses</CardTitle>
                <CardDescription className="text-zinc-400">
                  Clique une ligne pour les images détaillées, le payload et impersonation.
                  {isFetching ? " Actualisation…" : ""}
                </CardDescription>
                {searchQuery.trim() ? (
                  <p className="text-xs text-sky-200/80">
                    Recherche active sur <span className="font-mono">{searchQuery.trim()}</span>
                  </p>
                ) : null}
              </div>
              <div className="grid w-full gap-3 md:grid-cols-[1fr_180px] xl:w-auto xl:min-w-[420px]">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                  <Input
                    placeholder="Rechercher email, job, session, erreur…"
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                    className="h-10 border-white/15 bg-black/25 pl-9 text-zinc-50 placeholder:text-zinc-500"
                  />
                </div>
                <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as typeof statusFilter)}>
                  <SelectTrigger className="h-10 border-white/15 bg-black/25 text-zinc-50">
                    <Filter className="mr-2 h-4 w-4 text-zinc-400" />
                    <SelectValue placeholder="Statut" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tous les statuts</SelectItem>
                    <SelectItem value="completed">Terminées</SelectItem>
                    <SelectItem value="failed">Échouées</SelectItem>
                    <SelectItem value="queued">En file</SelectItem>
                    <SelectItem value="running">En cours</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent>
              <div className="overflow-hidden rounded-2xl border border-white/10 bg-black/25 text-zinc-50">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-white/10 hover:bg-transparent">
                        <TableHead className="text-zinc-400">Création</TableHead>
                        <TableHead className="text-zinc-400">Utilisateur</TableHead>
                        <TableHead className="text-zinc-400">Job</TableHead>
                        <TableHead className="text-zinc-400">Statut</TableHead>
                        <TableHead className="text-zinc-400 max-w-xl">Erreur</TableHead>
                        <TableHead className="text-zinc-400">Assets</TableHead>
                        <TableHead className="text-right text-zinc-400">Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {jobs.length > 0 ? (
                        jobs.map((job) => (
                          <TableRow
                            key={job.id}
                            role="button"
                            tabIndex={0}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" || e.key === " ") {
                                e.preventDefault();
                                openDetail(job);
                              }
                            }}
                            className={cn(
                              "cursor-pointer border-white/10 transition-colors hover:bg-white/[0.07]",
                              job.status === "failed" || job.status === "completed" ? "opacity-95" : "",
                            )}
                            onClick={() => openDetail(job)}
                          >
                            <TableCell className="min-w-36 whitespace-nowrap text-sm text-zinc-300">
                              {formatDate(job.created_at, "dd MMM yyyy, HH:mm")}
                            </TableCell>
                            <TableCell className="min-w-60">
                              <div className="flex flex-col gap-1">
                                <span className="font-medium text-zinc-100">
                                  {job.user_email ?? "Email indisponible"}
                                </span>
                                <span className="font-mono text-[11px] text-zinc-500">{job.user_id}</span>
                              </div>
                            </TableCell>
                            <TableCell className="max-w-[200px]">
                              <div className="flex flex-col gap-1 font-mono text-[11px] text-zinc-400">
                                <span className="truncate" title={job.id}>
                                  {job.id.slice(0, 8)}…
                                </span>
                                <span>{job.session_id ? `${job.session_id.slice(0, 8)}…` : "—"}</span>
                              </div>
                            </TableCell>
                            <TableCell className="min-w-[100px]">
                              <Badge
                                variant="outline"
                                className={cn(
                                  "text-xs",
                                  job.status === "failed" && "border-red-400/45 text-red-200",
                                  job.status === "completed" &&
                                    "border-emerald-400/40 text-emerald-100",
                                  (job.status === "queued" || job.status === "running") &&
                                    "border-sky-400/45 text-sky-100",
                                )}
                              >
                                {job.status}
                              </Badge>
                            </TableCell>
                            <TableCell className="max-w-xl min-w-[120px]">
                              {job.status === "failed" ? (
                                <div className="space-y-1">
                                  <span className="inline-flex rounded-md border border-red-400/30 bg-red-500/10 px-2 py-0.5 font-mono text-[11px] text-red-200">
                                    {job.error_code ?? "UNKNOWN"}
                                  </span>
                                  <p className="line-clamp-2 text-sm text-zinc-400">
                                    {job.error_message ?? "—"}
                                  </p>
                                </div>
                              ) : (
                                <span className="text-zinc-500">—</span>
                              )}
                            </TableCell>
                            <TableCell className="min-w-[100px] text-sm text-zinc-300">
                              <div>{job.asset_count} liés</div>
                              <div className="text-xs text-zinc-500">{job.scan_asset_count} scan(s)</div>
                            </TableCell>
                            <TableCell
                              className="text-right"
                              onClick={(e) => {
                                e.stopPropagation();
                              }}
                            >
                              {job.status === "failed" || job.status === "completed" ? (
                                <DeleteAnalysisJobDialog
                                  disabled={deleteJobMutation.isPending}
                                  job={job}
                                  onDelete={() => handleDeleteJob(job)}
                                />
                              ) : (
                                <span className="text-xs text-zinc-600">—</span>
                              )}
                            </TableCell>
                          </TableRow>
                        ))
                      ) : (
                        <TableRow>
                          <TableCell colSpan={7} className="h-28 text-center text-zinc-400">
                            Aucune analyse ne correspond aux filtres.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/10 px-4 py-3 text-sm text-zinc-400">
                <p>
                  Page {page} / {totalPages} · {totalJobs} résultat(s)
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-white/15 bg-black/25"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                  >
                    Précédent
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-white/15 bg-black/25"
                    disabled={page >= totalPages}
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  >
                    Suivant
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

function DeleteAnalysisJobDialog({
  disabled,
  job,
  onDelete,
}: {
  disabled: boolean;
  job: AdminAnalysisFailure;
  onDelete: () => void;
}) {
  const isFailed = job.status === "failed";

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          disabled={disabled}
          className="text-red-300 hover:bg-red-500/15 hover:text-red-100"
        >
          <Trash2 className="mr-2 h-4 w-4" />
          Supprimer
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {isFailed ? "Supprimer cette recherche échouée ?" : "Supprimer cette analyse terminée ?"}
          </AlertDialogTitle>
          <AlertDialogDescription>
            Cette action supprimera définitivement le job, ses résultats, ses liens d'assets, les fichiers Storage non partagés et la session si elle devient orpheline. Les assets encore utilisés par une autre analyse seront conservés.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="rounded-xl border border-white/10 bg-black/20 p-3 text-xs text-zinc-400">
          <div className="font-mono">job: {job.id}</div>
          <div className="font-mono">session: {job.session_id ?? "—"}</div>
          {isFailed ? (
            <div className="mt-2 text-zinc-300">{job.error_message ?? "Aucun message d'erreur enregistré."}</div>
          ) : null}
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel>Annuler</AlertDialogCancel>
          <AlertDialogAction onClick={onDelete} className="bg-red-600 text-white hover:bg-red-700">
            Supprimer proprement
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function AdminPageHeader({ title, description }: { title: string; description: string }) {
  return (
    <div className="flex flex-col gap-2 text-zinc-50">
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-400">
        Administration
      </p>
      <h1 className="font-display text-3xl font-bold tracking-tight md:text-4xl">{title}</h1>
      <p className="max-w-3xl text-base text-zinc-300 md:text-lg">{description}</p>
    </div>
  );
}

function AccessDenied({ setLocation }: { setLocation: (path: string) => void }) {
  return (
    <div className="flex h-[80vh] flex-col items-center justify-center space-y-4 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10 text-destructive">
        <ShieldAlert className="h-8 w-8" />
      </div>
      <h1 className="text-2xl font-bold">Accès refusé</h1>
      <p className="max-w-md text-slate-600">
        Cette zone est réservée aux administrateurs ScoreMax.
      </p>
      <Button onClick={() => setLocation("/app")}>Retour à l'application</Button>
    </div>
  );
}

function AdminStats({ metrics, profiles }: { metrics?: { today: number; week: number; month: number }; profiles: AdminProfile[] }) {
  const adminsCount = profiles.filter((profile) => profile.role === "admin").length;
  const subscribersCount = profiles.filter((profile) => profile.is_subscriber).length;
  const onboardedCount = profiles.filter((profile) => profile.has_completed_onboarding).length;

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      <StatCard title="Aujourd'hui" value={metrics?.today ?? 0} icon={<TrendingUp className="h-4 w-4 text-emerald-500" />} description="Nouveaux inscrits" />
      <StatCard title="Ce mois" value={metrics?.month ?? 0} icon={<Users className="h-4 w-4 text-primary" />} description="Inscriptions 30 jours" />
      <StatCard title="Onboarding terminé" value={onboardedCount} icon={<UserCheck className="h-4 w-4 text-sky-500" />} description="Profils activés" />
      <StatCard title="Admins / abonnés" value={`${adminsCount} / ${subscribersCount}`} icon={<ShieldCheck className="h-4 w-4 text-amber-500" />} description="Accès sensibles" />
    </div>
  );
}

function StatCard({ title, value, icon, description }: { title: string; value: string | number; icon: React.ReactNode; description: string }) {
  return (
    <Card className={adminPanelClassName}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        {icon}
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        <p className="mt-1 text-xs text-zinc-400">{description}</p>
      </CardContent>
    </Card>
  );
}

function GrowthChart({ data }: { data: Array<{ date: string; count: number }> }) {
  return (
    <Card className={adminPanelClassName}>
      <CardHeader className="flex flex-row items-center justify-between">
        <div className="space-y-1">
          <CardTitle>Croissance utilisateurs</CardTitle>
          <CardDescription className="text-zinc-400">Évolution des inscriptions sur les 30 derniers jours.</CardDescription>
        </div>
        <BarChart3 className="h-5 w-5 text-zinc-400" />
      </CardHeader>
      <CardContent>
        <div className="mt-4 h-[300px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data}>
              <defs>
                <linearGradient id="colorCount" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.12)" />
              <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: "#d4d4d8" }} minTickGap={30} />
              <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: "#d4d4d8" }} allowDecimals={false} />
              <Tooltip contentStyle={{ backgroundColor: "#090f16", borderColor: "rgba(255,255,255,0.16)", borderRadius: "8px", color: "#f4f4f5", fontSize: "12px" }} />
              <Area type="monotone" dataKey="count" name="Nouveaux utilisateurs" stroke="#d6e4ff" fill="url(#colorCount)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}

function RecentUsers({ profiles }: { profiles: AdminProfile[] }) {
  return (
    <Card className={adminPanelClassName}>
      <CardHeader>
        <CardTitle>Derniers inscrits</CardTitle>
        <CardDescription className="text-zinc-400">Les derniers comptes créés sur ScoreMax.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {profiles.map((profile) => (
          <div key={getProfileId(profile)} className="rounded-2xl border border-white/15 bg-[radial-gradient(circle_at_25%_10%,rgba(255,255,255,0.18),transparent_34%),linear-gradient(145deg,rgba(10,16,22,0.92)_0%,rgba(20,31,39,0.88)_48%,rgba(185,204,209,0.28)_100%)] p-4 text-zinc-50 shadow-[0_18px_55px_-45px_rgba(0,0,0,0.95)]">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate font-semibold">{profile.full_name || "Sans nom"}</p>
                <p className="truncate text-sm text-zinc-400">{profile.email}</p>
              </div>
              <RoleBadge role={profile.role} />
            </div>
            <p className="mt-3 text-xs text-zinc-400">
              Inscrit le {formatDate(profile.created_at ?? profile.createdAt, "dd MMM yyyy")}
            </p>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

type UserManagementProps = {
  currentUserId?: string;
  isMutating: boolean;
  onboardingFilter: OnboardingFilter;
  profiles: AdminProfile[];
  roleFilter: RoleFilter;
  searchQuery: string;
  totalProfiles: number;
  onDelete: (profile: AdminProfile) => void;
  onOnboardingFilterChange: (value: OnboardingFilter) => void;
  onRoleFilterChange: (value: RoleFilter) => void;
  onSearchChange: (value: string) => void;
  onToggleOnboarding: (profile: AdminProfile) => void;
  onToggleRole: (profile: AdminProfile) => void;
  onToggleSubscriber: (profile: AdminProfile) => void;
  onViewActivity: (profile: AdminProfile) => void;
};

function UserManagement(props: UserManagementProps) {
  return (
    <Card className={adminPanelClassName}>
      <CardHeader className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div className="space-y-1">
          <CardTitle>Utilisateurs</CardTitle>
          <CardDescription className="text-zinc-400">
            {props.profiles.length} résultat{props.profiles.length > 1 ? "s" : ""} sur {props.totalProfiles} profil{props.totalProfiles > 1 ? "s" : ""}.
          </CardDescription>
        </div>
        <div className="grid w-full gap-3 md:grid-cols-[1fr_180px_190px] xl:w-auto">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
            <Input
              placeholder="Rechercher nom, email ou id..."
              value={props.searchQuery}
              onChange={(event) => props.onSearchChange(event.target.value)}
              className="h-10 border-white/15 bg-black/25 pl-9 text-zinc-50 placeholder:text-zinc-500"
            />
          </div>
          <Select value={props.roleFilter} onValueChange={(value) => props.onRoleFilterChange(value as RoleFilter)}>
            <SelectTrigger className="h-10 border-white/15 bg-black/25 text-zinc-50">
              <Filter className="mr-2 h-4 w-4 text-zinc-400" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous les rôles</SelectItem>
              <SelectItem value="user">Utilisateurs</SelectItem>
              <SelectItem value="admin">Administrateurs</SelectItem>
            </SelectContent>
          </Select>
          <Select value={props.onboardingFilter} onValueChange={(value) => props.onOnboardingFilterChange(value as OnboardingFilter)}>
            <SelectTrigger className="h-10 border-white/15 bg-black/25 text-zinc-50">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous les onboardings</SelectItem>
              <SelectItem value="completed">Onboarding terminé</SelectItem>
              <SelectItem value="pending">Onboarding incomplet</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent>
        <div className="overflow-hidden rounded-2xl border border-white/10 bg-black/25 text-zinc-50">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-white/10 hover:bg-transparent">
                  <TableHead className="text-zinc-400">Utilisateur</TableHead>
                  <TableHead className="text-zinc-400">Rôle</TableHead>
                  <TableHead className="text-zinc-400">Abonné</TableHead>
                  <TableHead className="text-zinc-400">Onboarding</TableHead>
                  <TableHead className="text-zinc-400">Dernière activité</TableHead>
                  <TableHead className="text-zinc-400">Activité</TableHead>
                  <TableHead className="text-zinc-400">Inscription</TableHead>
                  <TableHead className="text-right text-zinc-400">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {props.profiles.length > 0 ? (
                  props.profiles.map((profile) => {
                    const profileId = getProfileId(profile);
                    const isCurrentUser = profileId === props.currentUserId;

                    return (
                      <TableRow key={profileId} className="border-white/10 hover:bg-white/[0.06]">
                        <TableCell className="min-w-72">
                          <div className="flex flex-col gap-1">
                            <div className="flex items-center gap-2">
                              <span className="font-medium">{profile.full_name || "Sans nom"}</span>
                              {isCurrentUser ? <Badge variant="outline" className="border-white/20 text-zinc-200">Vous</Badge> : null}
                            </div>
                            <span className="flex items-center gap-1 text-xs text-zinc-400">
                              <Mail className="h-3 w-3" /> {profile.email ?? "Email indisponible"}
                            </span>
                            <span className="font-mono text-[11px] text-zinc-500">{profileId}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <button
                            type="button"
                            disabled={props.isMutating || (isCurrentUser && profile.role === "admin")}
                            onClick={() => props.onToggleRole(profile)}
                            className="disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            <RoleBadge role={profile.role} />
                          </button>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Switch
                              checked={profile.is_subscriber || profile.role === "admin"}
                              disabled={props.isMutating || profile.role === "admin"}
                              onCheckedChange={() => props.onToggleSubscriber(profile)}
                              aria-label={
                                profile.role === "admin"
                                  ? "Accès abonné automatique pour les administrateurs"
                                  : "Basculer le statut abonné"
                              }
                            />
                            {profile.role === "admin" ? (
                              <Badge
                                variant="outline"
                                className="whitespace-nowrap border-blue-300/45 bg-blue-400/15 text-blue-100"
                              >
                                <Crown className="mr-1 h-3 w-3" /> Auto (admin)
                              </Badge>
                            ) : profile.is_subscriber ? (
                              <Crown className="h-4 w-4 text-amber-500" />
                            ) : null}
                          </div>
                        </TableCell>
                        <TableCell>
                          <button
                            type="button"
                            disabled={props.isMutating}
                            onClick={() => props.onToggleOnboarding(profile)}
                            className="disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            <OnboardingBadge completed={profile.has_completed_onboarding} />
                          </button>
                        </TableCell>
                        <TableCell className="text-sm text-zinc-400">
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {formatDate(profile.last_active_at, "dd MMM, HH:mm")}
                          </span>
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={!profile.email}
                            className="text-zinc-200 hover:bg-white/10 hover:text-white"
                            onClick={() => props.onViewActivity(profile)}
                          >
                            <Activity className="mr-2 h-4 w-4" />
                            Voir logs
                          </Button>
                        </TableCell>
                        <TableCell className="text-sm text-zinc-400">
                          {formatDate(profile.created_at ?? profile.createdAt, "dd/MM/yyyy")}
                        </TableCell>
                        <TableCell className="text-right">
                          <DeleteUserDialog
                            disabled={props.isMutating || isCurrentUser}
                            profile={profile}
                            onDelete={() => props.onDelete(profile)}
                          />
                        </TableCell>
                      </TableRow>
                    );
                  })
                ) : (
                  <TableRow>
                    <TableCell colSpan={7} className="h-28 text-center text-zinc-400">
                      Aucun utilisateur trouvé.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function RoleBadge({ role }: { role: AdminProfile["role"] }) {
  return (
    <Badge
      variant="outline"
      className={
        role === "admin"
          ? "whitespace-nowrap border-blue-300/50 bg-blue-400/15 text-blue-100"
          : "whitespace-nowrap border-white/15 bg-white/10 text-zinc-200"
      }
    >
      {role === "admin" ? "Administrateur" : "Utilisateur"}
    </Badge>
  );
}

function OnboardingBadge({ completed }: { completed: boolean }) {
  return completed ? (
    <Badge variant="outline" className="whitespace-nowrap border-emerald-300/50 bg-emerald-400/15 text-emerald-100">
      <CheckCircle2 className="mr-1 h-3 w-3" /> Terminé
    </Badge>
  ) : (
    <Badge variant="outline" className="whitespace-nowrap border-amber-300/50 bg-amber-400/15 text-amber-100">
      <XCircle className="mr-1 h-3 w-3" /> Incomplet
    </Badge>
  );
}

function DeleteUserDialog({ disabled, profile, onDelete }: { disabled: boolean; profile: AdminProfile; onDelete: () => void }) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          disabled={disabled}
          className="text-red-300 hover:bg-red-500/15 hover:text-red-100"
          aria-label="Supprimer l'utilisateur"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Supprimer ce profil ?</AlertDialogTitle>
          <AlertDialogDescription>
            Cette action supprimera le profil de {profile.email}. Elle ne supprime pas le compte Auth Supabase.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Annuler</AlertDialogCancel>
          <AlertDialogAction onClick={onDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
            Supprimer
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function AdminSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {[1, 2, 3, 4].map((index) => (
          <Skeleton key={index} className="h-32 w-full" />
        ))}
      </div>
      <Skeleton className="h-[300px] w-full" />
      <Skeleton className="h-64 w-full" />
    </div>
  );
}
