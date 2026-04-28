import { useMemo, useState } from "react";
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
  Users,
  XCircle,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import type { Profile } from "@shared/schema";
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
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import {
  useAdminAnalysisFailures,
  useAdminMetrics,
  useDeleteAdminAnalysisFailure,
  useProfile,
  useUserGrowth,
} from "@/hooks/use-supabase";
import type { AdminAnalysisFailure } from "@/lib/admin-analysis";
import { supabase } from "@/lib/supabase";

type AdminProfile = Profile & {
  user_id?: string;
  created_at?: string;
  updated_at?: string;
  last_active_at?: string | null;
};

type RoleFilter = "all" | "user" | "admin";
type OnboardingFilter = "all" | "completed" | "pending";

function formatDate(value: string | Date | null | undefined, pattern: string) {
  return value ? format(new Date(value), pattern, { locale: fr }) : "—";
}

function getProfileId(profile: Pick<AdminProfile, "id" | "user_id">) {
  return profile.id ?? profile.user_id ?? "";
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Une erreur est survenue.";
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
  const [, setLocation] = useLocation();
  const [location] = useLocation();
  const { data: profiles = [], isLoading: isLoadingProfiles } = useAllProfiles();
  const { data: metrics, isLoading: isLoadingMetrics } = useAdminMetrics();
  const { data: growthData = [], isLoading: isLoadingGrowth } = useUserGrowth();

  if (!isAdmin && !isLoadingProfiles) {
    return <AccessDenied setLocation={setLocation} />;
  }

  if (location === "/admin/users") {
    return <UsersManagementPage />;
  }

  if (location === "/admin/analysis-failures") {
    return <AnalysisFailureLogsPage />;
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
  const { user } = useAuth();
  const { data: profiles = [], isLoading } = useAllProfiles();
  const { updateProfile, deleteProfile, isUpdating, isDeleting } = useProfile();
  const { toast } = useToast();
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

  async function handleToggleSubscriber(profile: AdminProfile) {
    try {
      await updateProfile({
        id: getProfileId(profile),
        updates: { is_subscriber: !profile.is_subscriber },
      });
      toast({ title: "Profil mis à jour", description: "Le statut abonné a été modifié." });
    } catch (error) {
      toast({ variant: "destructive", title: "Mise à jour impossible", description: getErrorMessage(error) });
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
      await deleteProfile(getProfileId(profile));
      toast({ title: "Utilisateur supprimé", description: "Le profil utilisateur a été supprimé." });
    } catch (error) {
      toast({ variant: "destructive", title: "Suppression impossible", description: getErrorMessage(error) });
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
          isMutating={isUpdating || isDeleting}
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
        />
      )}
    </div>
  );
}

function AnalysisFailureLogsPage() {
  const { data: failures = [], isLoading } = useAdminAnalysisFailures();
  const deleteFailureMutation = useDeleteAdminAnalysisFailure();
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [errorCodeFilter, setErrorCodeFilter] = useState("all");

  const errorCodes = useMemo(() => {
    return Array.from(
      new Set(failures.map((failure) => failure.error_code).filter((code): code is string => Boolean(code))),
    ).sort();
  }, [failures]);

  const filteredFailures = useMemo(() => {
    const query = searchQuery.toLowerCase().trim();

    return failures.filter((failure) => {
      const matchesCode = errorCodeFilter === "all" || failure.error_code === errorCodeFilter;
      const matchesSearch =
        !query ||
        [
          failure.id,
          failure.user_id,
          failure.user_email,
          failure.session_id,
          failure.error_code,
          failure.error_message,
        ].some((value) => value?.toLowerCase().includes(query));

      return matchesCode && matchesSearch;
    });
  }, [errorCodeFilter, failures, searchQuery]);

  const latestFailure = failures[0];
  const mostCommonCode = useMemo(() => {
    const counts = new Map<string, number>();
    for (const failure of failures) {
      const code = failure.error_code ?? "UNKNOWN";
      counts.set(code, (counts.get(code) ?? 0) + 1);
    }

    return Array.from(counts.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "—";
  }, [failures]);

  async function handleDeleteFailure(failure: AdminAnalysisFailure) {
    try {
      const deleted = await deleteFailureMutation.mutateAsync(failure.id);
      toast({
        title: "Recherche échouée supprimée",
        description: `${deleted.deleted_scan_asset_count} asset(s) et ${deleted.deleted_storage_object_count} fichier(s) Storage supprimés.`,
      });
    } catch (error) {
      toast({ variant: "destructive", title: "Suppression impossible", description: getErrorMessage(error) });
    }
  }

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Logs d'analyse"
        description="Consulte les jobs ScoreMax échoués, leurs erreurs, puis supprime proprement les recherches mortes et leurs assets."
      />

      {isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-96 w-full" />
        </div>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-3">
            <StatCard
              title="Échecs affichés"
              value={failures.length}
              icon={<AlertTriangle className="h-4 w-4 text-amber-400" />}
              description="Jobs en statut failed"
            />
            <StatCard
              title="Dernier échec"
              value={latestFailure ? formatDate(latestFailure.failed_at ?? latestFailure.created_at, "dd MMM, HH:mm") : "—"}
              icon={<Clock className="h-4 w-4 text-sky-400" />}
              description={latestFailure?.user_email ?? latestFailure?.user_id ?? "Aucun échec"}
            />
            <StatCard
              title="Code principal"
              value={mostCommonCode}
              icon={<ShieldAlert className="h-4 w-4 text-red-300" />}
              description="Code d'erreur le plus fréquent"
            />
          </div>

          <Card className="border-white/15 bg-[linear-gradient(135deg,rgba(255,255,255,0.12)_0%,rgba(214,228,255,0.08)_52%,rgba(255,255,255,0.03)_100%)] text-zinc-50 shadow-[0_30px_65px_-55px_rgba(0,0,0,0.98)] backdrop-blur-xl">
            <CardHeader className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
              <div className="space-y-1">
                <CardTitle>Recherches échouées</CardTitle>
                <CardDescription className="text-zinc-400">
                  {filteredFailures.length} résultat{filteredFailures.length > 1 ? "s" : ""} sur {failures.length} échec{failures.length > 1 ? "s" : ""} chargé{failures.length > 1 ? "s" : ""}.
                </CardDescription>
              </div>
              <div className="grid w-full gap-3 md:grid-cols-[1fr_220px] xl:w-auto">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                  <Input
                    placeholder="Rechercher email, job, session, erreur..."
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                    className="h-10 border-white/15 bg-black/25 pl-9 text-zinc-50 placeholder:text-zinc-500"
                  />
                </div>
                <Select value={errorCodeFilter} onValueChange={setErrorCodeFilter}>
                  <SelectTrigger className="h-10 border-white/15 bg-black/25 text-zinc-50">
                    <Filter className="mr-2 h-4 w-4 text-zinc-400" />
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tous les codes</SelectItem>
                    {errorCodes.map((code) => (
                      <SelectItem key={code} value={code}>{code}</SelectItem>
                    ))}
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
                        <TableHead className="text-zinc-400">Échec</TableHead>
                        <TableHead className="text-zinc-400">Utilisateur</TableHead>
                        <TableHead className="text-zinc-400">Job / session</TableHead>
                        <TableHead className="text-zinc-400">Erreur</TableHead>
                        <TableHead className="text-zinc-400">Assets</TableHead>
                        <TableHead className="text-right text-zinc-400">Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredFailures.length > 0 ? (
                        filteredFailures.map((failure) => (
                          <TableRow key={failure.id} className="border-white/10 hover:bg-white/[0.06]">
                            <TableCell className="min-w-40 text-sm text-zinc-300">
                              {formatDate(failure.failed_at ?? failure.created_at, "dd MMM yyyy, HH:mm")}
                            </TableCell>
                            <TableCell className="min-w-72">
                              <div className="flex flex-col gap-1">
                                <span className="font-medium">{failure.user_email ?? "Email indisponible"}</span>
                                <span className="font-mono text-[11px] text-zinc-500">{failure.user_id}</span>
                              </div>
                            </TableCell>
                            <TableCell className="min-w-72">
                              <div className="flex flex-col gap-1 font-mono text-[11px] text-zinc-400">
                                <span>job: {failure.id}</span>
                                <span>session: {failure.session_id ?? "—"}</span>
                              </div>
                            </TableCell>
                            <TableCell className="min-w-80 max-w-xl">
                              <div className="space-y-2">
                                <Badge variant="outline" className="border-red-300/45 bg-red-500/15 text-red-100">
                                  {failure.error_code ?? "UNKNOWN"}
                                </Badge>
                                <p className="line-clamp-3 text-sm text-zinc-300">
                                  {failure.error_message ?? "Aucun message d'erreur enregistré."}
                                </p>
                              </div>
                            </TableCell>
                            <TableCell className="min-w-36 text-sm text-zinc-300">
                              <div>{failure.asset_count} lié(s)</div>
                              <div className="text-xs text-zinc-500">{failure.scan_asset_count} scan asset(s)</div>
                            </TableCell>
                            <TableCell className="text-right">
                              <DeleteFailureDialog
                                disabled={deleteFailureMutation.isPending}
                                failure={failure}
                                onDelete={() => handleDeleteFailure(failure)}
                              />
                            </TableCell>
                          </TableRow>
                        ))
                      ) : (
                        <TableRow>
                          <TableCell colSpan={6} className="h-28 text-center text-zinc-400">
                            Aucun échec d'analyse trouvé.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

function DeleteFailureDialog({ disabled, failure, onDelete }: { disabled: boolean; failure: AdminAnalysisFailure; onDelete: () => void }) {
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
          <AlertDialogTitle>Supprimer cette recherche échouée ?</AlertDialogTitle>
          <AlertDialogDescription>
            Cette action supprimera définitivement le job échoué, ses résultats partiels, ses liens d'assets, les fichiers Storage non partagés et la session si elle devient orpheline. Les assets encore utilisés par une autre analyse seront conservés.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="rounded-xl border border-white/10 bg-black/20 p-3 text-xs text-zinc-400">
          <div className="font-mono">job: {failure.id}</div>
          <div className="font-mono">session: {failure.session_id ?? "—"}</div>
          <div className="mt-2 text-zinc-300">{failure.error_message ?? "Aucun message d'erreur enregistré."}</div>
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
    <Card className="border-white/15 bg-[linear-gradient(135deg,rgba(255,255,255,0.12)_0%,rgba(214,228,255,0.08)_52%,rgba(255,255,255,0.03)_100%)] text-zinc-50 shadow-[0_30px_65px_-55px_rgba(0,0,0,0.98)] backdrop-blur-xl">
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
    <Card className="border-white/15 bg-[linear-gradient(135deg,rgba(255,255,255,0.12)_0%,rgba(214,228,255,0.08)_52%,rgba(255,255,255,0.03)_100%)] text-zinc-50 shadow-[0_30px_65px_-55px_rgba(0,0,0,0.98)] backdrop-blur-xl">
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
    <Card className="border-white/15 bg-[linear-gradient(135deg,rgba(255,255,255,0.12)_0%,rgba(214,228,255,0.08)_52%,rgba(255,255,255,0.03)_100%)] text-zinc-50 shadow-[0_30px_65px_-55px_rgba(0,0,0,0.98)] backdrop-blur-xl">
      <CardHeader>
        <CardTitle>Derniers inscrits</CardTitle>
        <CardDescription className="text-zinc-400">Les derniers comptes créés sur ScoreMax.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {profiles.map((profile) => (
          <div key={getProfileId(profile)} className="rounded-2xl border border-white/10 bg-black/25 p-4 text-zinc-50">
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
};

function UserManagement(props: UserManagementProps) {
  return (
    <Card className="border-white/15 bg-[linear-gradient(135deg,rgba(255,255,255,0.12)_0%,rgba(214,228,255,0.08)_52%,rgba(255,255,255,0.03)_100%)] text-zinc-50 shadow-[0_30px_65px_-55px_rgba(0,0,0,0.98)] backdrop-blur-xl">
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
                              checked={profile.is_subscriber}
                              disabled={props.isMutating}
                              onCheckedChange={() => props.onToggleSubscriber(profile)}
                            />
                            {profile.is_subscriber ? <Crown className="h-4 w-4 text-amber-500" /> : null}
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
