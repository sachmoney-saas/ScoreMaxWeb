import * as React from "react";
import { WaveBackground } from "@/components/background/WaveBackground";
import { useAuth } from "@/hooks/use-auth";
import {
  useAnalysisHistory,
  useDeleteAnalysisJob,
} from "@/hooks/use-supabase";
import { buildAnalysisThumbnailUrl } from "@/lib/face-analysis";
import { MiniRing } from "@/components/analysis/WorkerPreviewContent";
import { calculateGlobalFaceScore } from "@/lib/face-analysis-score";
import { getScoreRank } from "@/lib/global-score-tiers";
import { Link, useLocation } from "wouter";
import {
  AlertTriangle,
  ShieldCheck,
  Sparkles,
  Users,
  LogOut,
  Loader2,
  ChevronRight,
  Settings as SettingsIcon,
  CreditCard,
  MoreHorizontal,
  Plus,
  Trash2,
  ClipboardList,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarSeparator,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
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
import { cn } from "@/lib/utils";

type SidebarNavItem = {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  isActive: (location: string) => boolean;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getHistoryGlobalScoreSummary(
  results: Array<{ worker: string; result: Record<string, unknown> }>,
): { score0to100: number | null; rankTitle: string | null } {
  const global = calculateGlobalFaceScore(
    results.map((row) => {
      const outputAggregates = isRecord(row.result.outputAggregates)
        ? row.result.outputAggregates
        : {};

      return {
        worker: row.worker,
        outputAggregates,
      };
    }),
  );

  if (!global) {
    return { score0to100: null, rankTitle: null };
  }

  return {
    score0to100: global.score,
    rankTitle: getScoreRank(global.score).title,
  };
}

function formatAnalysisHistoryDate(value: string): string {
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

/** Matches ScoreRing default arc — frosted highlight + slate depth (Tailwind arbitrary layers). */
const SIDEBAR_SURFACE_CLASS =
  "bg-[radial-gradient(ellipse_110%_70%_at_0%_-10%,rgba(248,250,252,0.24)_0%,transparent_52%),radial-gradient(circle_at_88%_108%,rgba(148,163,184,0.18)_0%,transparent_46%),linear-gradient(152deg,rgba(11,17,24,0.97)_0%,rgba(17,26,34,0.94)_42%,rgba(26,36,50,0.92)_100%)]";

function ModernAppSidebar() {
  const [location] = useLocation();
  const { user, profile, isAdmin, signOut } = useAuth();
  const { data: analysisHistory = [], isLoading: isHistoryLoading } =
    useAnalysisHistory({ enabled: !!user?.id });
  const deleteAnalysisMutation = useDeleteAnalysisJob();
  const { state, isMobile, toggleSidebar } = useSidebar();

  const isCollapsed = state === "collapsed" && !isMobile;

  const lastCompletedAnalysisTierLabel = React.useMemo(() => {
    const completed = analysisHistory
      .filter((a) => a.status === "completed" && a.results.length > 0)
      .sort((a, b) => {
        const ta = new Date(a.completed_at ?? a.created_at).getTime();
        const tb = new Date(b.completed_at ?? b.created_at).getTime();
        return tb - ta;
      });
    const latest = completed[0];
    if (!latest) {
      return null;
    }
    const inputs = latest.results.map((row) => {
      const result = row.result as Record<string, unknown>;
      const outputAggregates = isRecord(result.outputAggregates)
        ? result.outputAggregates
        : {};
      return { worker: row.worker, outputAggregates };
    });
    const global = calculateGlobalFaceScore(inputs);
    return global ? getScoreRank(global.score).title : null;
  }, [analysisHistory]);

  const adminItems: SidebarNavItem[] = isAdmin
    ? [
        {
          href: "/admin",
          label: "Aperçu Admin",
          icon: ShieldCheck,
          isActive: (path) => path === "/admin",
        },
        {
          href: "/admin/users",
          label: "Utilisateurs",
          icon: Users,
          isActive: (path) => path === "/admin/users",
        },
        {
          href: "/admin/analysis-failures",
          label: "Logs analyses",
          icon: AlertTriangle,
          isActive: (path) => path === "/admin/analysis-failures",
        },
        {
          href: "/admin/recommendations",
          label: "Recommandations",
          icon: Sparkles,
          isActive: (path) => path.startsWith("/admin/recommendations"),
        },
      ]
    : [];

  return (
    <Sidebar
      collapsible="icon"
      variant="sidebar"
      className={cn(
        /* Mobile Sheet: keep z-50 so panel stacks above overlay; desktop rail: z-40 above chrome */
        "z-50 border-r border-white/10 md:z-40",
        SIDEBAR_SURFACE_CLASS,
        "[&_[data-sidebar=sidebar]]:bg-transparent",
      )}
    >
      <SidebarHeader className="px-2 pt-3 pb-2">
        <div
          className={`group relative flex h-11 cursor-pointer items-center overflow-hidden rounded-xl border border-white/20 bg-[linear-gradient(128deg,rgba(255,255,255,0.38)_0%,rgba(248,250,252,0.14)_42%,rgba(214,228,255,0.09)_72%,rgba(255,255,255,0.05)_100%)] shadow-[0_30px_65px_-55px_rgba(0,0,0,0.98)] transition-all hover:border-white/30 ${
            isCollapsed ? "justify-center px-0" : "px-2"
          }`}
          title={isCollapsed ? "Ouvrir la left sidebar" : "Rétracter la left sidebar"}
          role="button"
          tabIndex={0}
          onClick={() => {
            if (!isMobile) {
              toggleSidebar();
            }
          }}
          onKeyDown={(event) => {
            if ((event.key === "Enter" || event.key === " ") && !isMobile) {
              event.preventDefault();
              toggleSidebar();
            }
          }}
        >
          <div
            className={`flex min-w-0 items-center ${
              isCollapsed ? "w-full justify-center px-0" : "flex-1 px-1"
            }`}
          >
            <div
              className={`flex shrink-0 items-center justify-center ${
                isCollapsed
                  ? "aspect-square h-8 rounded-lg bg-black/20 p-1"
                  : "h-7 w-7 rounded-lg border border-white/15 bg-black/25"
              }`}
            >
              <img
                src="/favicon.png"
                alt="Logo ScoreMax"
                className={`${isCollapsed ? "h-full w-full" : "h-4 w-4"} object-contain`}
              />
            </div>
            <div
              className={`min-w-0 transition-all duration-200 ${
                isCollapsed ? "ml-0 w-0 opacity-0" : "ml-2.5 w-auto opacity-100"
              }`}
            >
              <p className="truncate font-display text-base font-semibold tracking-tight text-zinc-100">
                ScoreMax
              </p>
            </div>
          </div>
        </div>
      </SidebarHeader>

      <SidebarFooter className={isCollapsed ? "hidden" : "px-2 pt-1 pb-2"}>
        <DropdownMenu>
          <DropdownMenuTrigger asChild className="w-full">
            <SidebarMenuButton
              size="lg"
              className="h-11 w-full rounded-xl border border-white/15 bg-white/[0.06] px-3 transition-all duration-200 hover:border-white/25 hover:bg-white/[0.12] hover:text-zinc-100 data-[state=open]:border-white/25 data-[state=open]:bg-white/[0.12] data-[state=open]:text-zinc-100 data-[state=open]:hover:border-white/25 data-[state=open]:hover:bg-white/[0.12] data-[state=open]:hover:text-zinc-100"
            >
              <Avatar className="h-8 w-8 rounded-lg shrink-0">
                <AvatarFallback className="rounded-lg bg-primary/15 text-primary text-xs">
                  {profile?.email?.substring(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              {!isCollapsed ? (
                <>
                  <div className="grid min-w-0 flex-1 text-left text-sm leading-tight">
                    <span className="truncate font-semibold text-zinc-100">
                      {profile?.email ?? "—"}
                    </span>
                    <span className="truncate text-xs text-zinc-400">
                      {isHistoryLoading
                        ? "…"
                        : lastCompletedAnalysisTierLabel ??
                          "Aucune analyse terminée"}
                    </span>
                  </div>
                  <ChevronRight className="ml-auto size-4 shrink-0 text-zinc-400" />
                </>
              ) : null}
            </SidebarMenuButton>
          </DropdownMenuTrigger>

          <DropdownMenuContent
            className={cn(
              "w-[--radix-dropdown-menu-trigger-width] min-w-56 rounded-2xl border-white/15 p-1.5 text-zinc-100 shadow-[0_28px_90px_-55px_rgba(0,0,0,0.95)] backdrop-blur-xl",
              SIDEBAR_SURFACE_CLASS,
            )}
            side={isMobile ? "bottom" : "right"}
            align="end"
            sideOffset={8}
          >
            <DropdownMenuItem asChild className="rounded-xl text-zinc-100 focus:bg-white/10 focus:text-white">
              <Link
                href="/settings"
                className="flex w-full cursor-pointer items-center"
              >
                <SettingsIcon className="mr-2 h-4 w-4 text-zinc-400" />
                <span>Paramètres</span>
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild className="rounded-xl text-zinc-100 focus:bg-white/10 focus:text-white">
              <Link
                href="/billing"
                className="flex w-full cursor-pointer items-center"
              >
                <CreditCard className="mr-2 h-4 w-4 text-zinc-400" />
                <span>Facturation</span>
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator className="bg-white/10" />
            <DropdownMenuItem
              className="cursor-pointer rounded-xl text-zinc-100 focus:bg-white/10 focus:text-white"
              onClick={() => signOut()}
            >
              <LogOut className="mr-2 h-4 w-4 text-zinc-400" />
              <span>Déconnexion</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarFooter>

      <SidebarContent className={isCollapsed ? "hidden" : "px-2 pb-2"}>
        {/* p-0: match footer email strip width (SidebarGroup defaults to p-2 and narrows rows). */}
        <SidebarGroup className="p-0">
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem className="w-full">
                <SidebarMenuButton
                  asChild
                  isActive={location === "/app/protocol"}
                  tooltip="Mon protocole"
                  className="h-11 w-full rounded-xl border border-white/15 bg-white/[0.06] px-3 transition-all duration-200 hover:border-white/25 hover:bg-white/[0.12] data-[active=true]:border-white/25 data-[active=true]:bg-[linear-gradient(132deg,rgba(214,228,255,0.26)_0%,rgba(214,228,255,0.14)_45%,rgba(255,255,255,0.05)_100%)] data-[active=true]:text-zinc-50"
                >
                  <Link
                    href="/app/protocol"
                    className="flex w-full items-center gap-2.5"
                  >
                    <ClipboardList className="h-4 w-4 shrink-0 text-zinc-200" />
                    <span className="font-semibold text-zinc-100">
                      Mon protocole
                    </span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarSeparator className="my-2 bg-white/10" />

        <SidebarGroup className="p-0">
          <SidebarGroupLabel className="text-[11px] uppercase tracking-[0.14em] text-zinc-500">
            Mes analyses
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <Link
              href="/app/new-analysis"
              className="mb-3 flex h-11 w-full items-center justify-center rounded-xl border border-white/15 bg-white/[0.09] px-3 text-sm font-semibold text-zinc-100 transition hover:border-white/25 hover:bg-white/[0.14]"
            >
              <Plus className="mr-2 h-4 w-4" />
              Nouvelle analyse
            </Link>
            <SidebarMenu className="space-y-1.5">
              {isHistoryLoading ? (
                <div className="rounded-xl border border-white/10 bg-white/[0.04] p-3 text-sm text-zinc-400">
                  Chargement des analyses...
                </div>
              ) : null}

              {!isHistoryLoading && analysisHistory.length === 0 ? (
                <div className="rounded-xl border border-white/10 bg-white/[0.04] p-3 text-sm text-zinc-400">
                  Aucune analyse pour le moment.
                </div>
              ) : null}

              {analysisHistory.map((analysis) => {
                const isAnalysisLoading = analysis.status === "queued" || analysis.status === "running";
                const { score0to100, rankTitle } = getHistoryGlobalScoreSummary(
                  analysis.results,
                );
                const dateLabel = formatAnalysisHistoryDate(
                  analysis.completed_at ?? analysis.created_at,
                );
                const analysisHref = `/app/analyses/${analysis.id}`;
                const isActiveAnalysis = location === analysisHref;

                return (
                  <SidebarMenuItem key={analysis.id}>
                  <div className={`group flex items-center gap-2 rounded-xl border px-2 py-1.5 transition hover:border-white/20 hover:bg-white/[0.085] ${
                    isActiveAnalysis
                      ? "border-white/25 bg-white/[0.12]"
                      : "border-white/10 bg-white/[0.055]"
                  }`}>
                    <Link href={analysisHref} className="flex min-w-0 flex-1 items-center gap-1.5">
                      <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-lg border border-white/10 bg-black/20">
                        {analysis.has_thumbnail && user?.id ? (
                          <img
                            src={buildAnalysisThumbnailUrl({
                              userId: user.id,
                              jobId: analysis.id,
                            })}
                            alt="Photo de face"
                            className="h-full w-full object-cover"
                            loading="lazy"
                          />
                        ) : isAnalysisLoading ? (
                          <div className="flex h-full w-full items-center justify-center bg-black/30 text-zinc-300">
                            <Loader2 className="h-4 w-4 animate-spin" />
                          </div>
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-xs text-zinc-500">
                            —
                          </div>
                        )}
                        {analysis.has_thumbnail && isAnalysisLoading ? (
                          <div className="absolute inset-0 flex items-center justify-center bg-black/45 text-white backdrop-blur-[1px]">
                            <Loader2 className="h-4 w-4 animate-spin" />
                          </div>
                        ) : null}
                      </div>
                      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                        {isAnalysisLoading ? (
                          <>
                            <p className="min-w-0 truncate text-sm font-semibold leading-tight text-zinc-100">
                              {analysis.status === "queued"
                                ? "En file d'attente"
                                : "Analyse en cours"}
                            </p>
                            <p className="truncate text-[9px] tabular-nums leading-tight text-zinc-500">
                              {dateLabel}
                            </p>
                          </>
                        ) : score0to100 !== null && rankTitle ? (
                          <div className="flex min-w-0 items-center gap-1">
                            <div className="-ml-0.5 shrink-0">
                              <MiniRing
                                score={score0to100}
                                scale={100}
                                size={44}
                                fractionDigits={1}
                              />
                            </div>
                            <div className="flex min-w-0 flex-1 flex-col justify-center gap-0.5">
                              <p className="truncate text-[11px] font-semibold leading-snug text-zinc-100">
                                {rankTitle}
                              </p>
                              <p className="truncate text-[9px] tabular-nums leading-snug text-zinc-500">
                                {dateLabel}
                              </p>
                            </div>
                          </div>
                        ) : (
                          <>
                            <p className="min-w-0 truncate text-sm font-semibold leading-tight text-zinc-400">
                              —
                            </p>
                            <p className="truncate text-[9px] tabular-nums leading-tight text-zinc-500">
                              {dateLabel}
                            </p>
                          </>
                        )}
                      </div>
                    </Link>
                    <AlertDialog>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button
                            type="button"
                            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-zinc-400 transition hover:bg-white/10 hover:text-zinc-100"
                            aria-label="Options de l'analyse"
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent side="right" align="start" className="rounded-xl">
                          <AlertDialogTrigger asChild>
                            <DropdownMenuItem
                              className="cursor-pointer text-red-500 focus:text-red-500"
                              disabled={deleteAnalysisMutation.isPending}
                              onSelect={(event) => event.preventDefault()}
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              <span>Supprimer</span>
                            </DropdownMenuItem>
                          </AlertDialogTrigger>
                        </DropdownMenuContent>
                      </DropdownMenu>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Supprimer cette analyse ?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Cette action supprimera définitivement l'analyse, ses résultats et les images associées qui ne sont utilisées par aucune autre analyse. Les images partagées seront conservées.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Annuler</AlertDialogCancel>
                          <AlertDialogAction
                            className="bg-red-600 text-white hover:bg-red-700"
                            disabled={deleteAnalysisMutation.isPending}
                            onClick={() => deleteAnalysisMutation.mutate(analysis.id)}
                          >
                            Supprimer
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {adminItems.length > 0 ? (
          <>
            <SidebarSeparator className="my-2 bg-white/10" />
            <SidebarGroup className="p-0">
              <SidebarGroupLabel className="text-[11px] uppercase tracking-[0.14em] text-zinc-500">
                Administration
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {adminItems.map((item) => {
                    const Icon = item.icon;
                    const active = item.isActive(location);

                    return (
                      <SidebarMenuItem key={item.href}>
                        <SidebarMenuButton
                          asChild
                          isActive={active}
                          tooltip={item.label}
                          className="h-10 rounded-xl border border-transparent px-2.5 transition-all duration-200 data-[active=true]:border-white/20 data-[active=true]:bg-[linear-gradient(132deg,rgba(214,228,255,0.26)_0%,rgba(214,228,255,0.14)_45%,rgba(255,255,255,0.05)_100%)] data-[active=true]:text-zinc-50"
                        >
                          <Link
                            href={item.href}
                            className="flex items-center gap-2 w-full"
                          >
                            <Icon className="shrink-0" />
                            <span className="truncate">{item.label}</span>
                          </Link>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    );
                  })}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </>
        ) : null}
      </SidebarContent>

    </Sidebar>
  );
}

export function AppLayout({ children }: { children: React.ReactNode }) {
  const { isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="relative flex h-screen w-full items-center justify-center overflow-hidden bg-[#9aaeb5]">
        <WaveBackground />
        <div className="relative z-10 flex flex-col items-center gap-4">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="text-muted-foreground font-medium animate-pulse">
            Chargement de la plateforme...
          </p>
        </div>
      </div>
    );
  }

  return (
    <SidebarProvider
      style={
        {
          /* Must match rail width: gap uses inherited var; panel had 22rem locally → overlap vs 16rem default */
          "--sidebar-width": "22rem",
        } as React.CSSProperties
      }
    >
      <div className="relative flex h-screen w-full overflow-hidden bg-[#9aaeb5]">
        <WaveBackground />
        <ModernAppSidebar />
        <SidebarInset className="flex min-h-0 flex-col overflow-hidden bg-transparent">
          <SidebarTrigger className="absolute left-4 top-4 z-30 h-8 w-8 rounded-lg border border-white/10 bg-white/10 backdrop-blur-xl hover:bg-white/15 md:hidden" />
          <div className="min-h-0 flex-1 overflow-y-auto p-4 md:p-8">
            <div className="mx-auto max-w-7xl animate-in fade-in slide-in-from-bottom-4 duration-500 text-foreground">
              {children}
            </div>
          </div>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}
