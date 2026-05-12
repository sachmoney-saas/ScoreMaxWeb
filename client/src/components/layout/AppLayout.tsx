import * as React from "react";
import { WaveBackground } from "@/components/background/WaveBackground";
import { useAuth } from "@/hooks/use-auth";
import {
  useAnalysisHistory,
  useDeleteAnalysisJob,
  useSubscriberStandardAnalysisQuota,
} from "@/hooks/use-supabase";
import { analysisHistoryGlobalScoreSummary } from "@/lib/analysis-history-global-summary";
import {
  buildAnalysisThumbnailUrl,
  type SubscriberStandardQuotaWire,
} from "@/lib/face-analysis";
import { AuthenticatedThumbnail } from "@/components/analysis/AuthenticatedThumbnail";
import { MiniRing } from "@/components/analysis/WorkerPreviewContent";
import { Link, useLocation } from "wouter";
import {
  AlertTriangle,
  Bug,
  ShieldCheck,
  Sparkles,
  Users,
  LogOut,
  Loader2,
  ChevronRight,
  Settings as SettingsIcon,
  CreditCard,
  MessageCircle,
  MoreHorizontal,
  Plus,
  Lock,
  Trash2,
  ClipboardList,
  Clock,
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
import { scoreRingMatchMetallicPillClassName } from "@/components/analysis/workers/_shared";
import { BrandLoader } from "@/components/ui/brand-loader";
import {
  analysisElapsedAnchorEpochMs,
  formatAnalysisElapsedLabel,
} from "@/components/analysis/AnalysisProcessingState";
import { useAppLanguage, i18n, type AppLanguage } from "@/lib/i18n";
import {
  formatSubscriberCooldownCountdownLine,
  subscriberStandardCooldownParts,
} from "@/lib/subscriber-standard-analysis-copy";

type SidebarNavItem = {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  isActive: (location: string) => boolean;
};

function formatAnalysisHistoryDate(value: string): string {
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

/** Durée depuis `created_at` du job (sidebar : à droite de « Analyse en cours »). */
function SidebarAnalysisRunningElapsed({ createdAtIso }: { createdAtIso: string }) {
  const language = useAppLanguage();
  const anchorMs = React.useMemo(
    () => analysisElapsedAnchorEpochMs(createdAtIso),
    [createdAtIso],
  );
  const [tick, setTick] = React.useState(0);
  React.useEffect(() => {
    const id = window.setInterval(() => setTick((previous) => previous + 1), 1000);
    return () => window.clearInterval(id);
  }, []);

  const elapsedSeconds = React.useMemo(() => {
    if (anchorMs != null) {
      return Math.max(0, Math.floor((Date.now() - anchorMs) / 1000));
    }
    return tick;
  }, [anchorMs, tick]);

  return (
    <span
      className="shrink-0 whitespace-nowrap tabular-nums text-[10px] font-semibold leading-tight text-zinc-400 sm:text-[11px]"
      aria-live="polite"
      aria-atomic="true"
    >
      {formatAnalysisElapsedLabel(elapsedSeconds, language)}
    </span>
  );
}

const NEW_ANALYSIS_CTA_CLASS =
  "flex h-11 w-full items-center justify-center rounded-xl border border-white/15 bg-white/[0.09] px-3 text-sm font-semibold text-zinc-100 transition hover:border-white/25 hover:bg-white/[0.14]";

const NEW_ANALYSIS_LOCKED_PREMIUM_CLASS = cn(
  NEW_ANALYSIS_CTA_CLASS,
  "pointer-events-none min-h-11 flex-col gap-0.5 border-white/10 bg-white/[0.055] py-1.5 opacity-90 !text-zinc-400 hover:!border-white/10 hover:!bg-white/[0.055]",
);

const NEW_ANALYSIS_BLOCKED_CLASS =
  "pointer-events-none flex w-full min-h-11 flex-col items-center justify-center gap-0.5 rounded-xl border border-white/10 bg-white/[0.05] px-2 py-1.5 text-center text-zinc-400";

const NEW_ANALYSIS_QUOTA_LOADING_CLASS =
  "pointer-events-none flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.05] px-3 text-zinc-400";

function SidebarWeeklyAnalysisCooldownFace({
  language,
  nextAvailableAt,
  onMayHaveUnlocked,
}: {
  language: AppLanguage;
  nextAvailableAt: string;
  onMayHaveUnlocked: () => void;
}) {
  const [tick, setTick] = React.useState(0);
  const unlockRefetchDoneRef = React.useRef(false);

  React.useEffect(() => {
    unlockRefetchDoneRef.current = false;
  }, [nextAvailableAt]);

  React.useEffect(() => {
    const id = window.setInterval(() => setTick((previous) => previous + 1), 1000);
    return () => window.clearInterval(id);
  }, []);

  const deadlineMs = React.useMemo(() => Date.parse(nextAvailableAt), [nextAvailableAt]);
  const parts = subscriberStandardCooldownParts(nextAvailableAt, Date.now());
  const line = formatSubscriberCooldownCountdownLine(language, parts);

  React.useEffect(() => {
    if (!Number.isFinite(deadlineMs)) return;
    if (deadlineMs > Date.now()) return;
    if (unlockRefetchDoneRef.current) return;
    unlockRefetchDoneRef.current = true;
    onMayHaveUnlocked();
  }, [deadlineMs, onMayHaveUnlocked, tick]);

  return (
    <div className={NEW_ANALYSIS_BLOCKED_CLASS} aria-live="polite" aria-atomic="true">
      <div className="flex items-center gap-1.5 text-[11px] font-semibold leading-tight text-zinc-300">
        <Clock className="h-3.5 w-3.5 shrink-0 text-zinc-500" aria-hidden />
        {i18n(language, {
          en: "Next analysis",
          fr: "Prochaine analyse",
        })}
      </div>
      <span className="tabular-nums text-[12px] font-semibold leading-tight tracking-tight text-zinc-100">
        {line}
      </span>
    </div>
  );
}

function SidebarNewAnalysisPrimarySlot({
  language,
  closeMobileSidebar,
  userId,
  isAdmin,
  subscriberQuota,
  subscriberQuotaLoading,
  refetchSubscriberQuota,
}: {
  language: AppLanguage;
  closeMobileSidebar: () => void;
  userId: string | undefined;
  isAdmin: boolean;
  subscriberQuota: SubscriberStandardQuotaWire | undefined;
  subscriberQuotaLoading: boolean;
  refetchSubscriberQuota: () => void;
}) {
  const gatedByWeeklyQuotaUi = Boolean(userId) && !isAdmin;

  const onCooldownEnd = React.useCallback(() => {
    void refetchSubscriberQuota();
  }, [refetchSubscriberQuota]);

  if (!gatedByWeeklyQuotaUi) {
    return (
      <Link
        href="/app/new-analysis"
        className={NEW_ANALYSIS_CTA_CLASS}
        onClick={closeMobileSidebar}
      >
        <Plus className="mr-2 h-4 w-4" />
        {i18n(language, {
          en: "New analysis",
          fr: "Nouvelle analyse",
        })}
      </Link>
    );
  }

  if (subscriberQuotaLoading || subscriberQuota == null) {
    return (
      <div className={NEW_ANALYSIS_QUOTA_LOADING_CLASS} aria-busy="true">
        <Loader2 className="h-4 w-4 shrink-0 animate-spin text-zinc-500" aria-hidden />
        <span className="text-[12px] font-medium text-zinc-400">
          {i18n(language, {
            en: "Checking quota…",
            fr: "Vérification du quota…",
          })}
        </span>
      </div>
    );
  }

  const q = subscriberQuota;

  if (q.requires_active_subscription_to_launch) {
    if (q.has_standard_in_flight) {
      return (
        <div className={NEW_ANALYSIS_BLOCKED_CLASS}>
          <div className="flex items-center gap-2 text-[12px] font-semibold leading-tight text-zinc-300">
            <Loader2 className="h-4 w-4 shrink-0 animate-spin text-zinc-400" aria-hidden />
            {i18n(language, {
              en: "Analysis running",
              fr: "Analyse en cours",
            })}
          </div>
          <span className="text-[10px] leading-snug text-zinc-500">
            {i18n(language, {
              en: "Up to once per week",
              fr: "Au plus une fois par semaine",
            })}
          </span>
        </div>
      );
    }

    if (q.next_available_at) {
      return (
        <SidebarWeeklyAnalysisCooldownFace
          language={language}
          nextAvailableAt={q.next_available_at}
          onMayHaveUnlocked={onCooldownEnd}
        />
      );
    }

    if (!q.has_prior_completed_analysis) {
      return (
        <Link
          href="/app/new-analysis"
          className={NEW_ANALYSIS_CTA_CLASS}
          onClick={closeMobileSidebar}
        >
          <Plus className="mr-2 h-4 w-4" />
          {i18n(language, {
            en: "New analysis",
            fr: "Nouvelle analyse",
          })}
        </Link>
      );
    }

    return (
      <div
        className={NEW_ANALYSIS_LOCKED_PREMIUM_CLASS}
        aria-disabled="true"
        aria-label={i18n(language, {
          en: "New analysis — subscription required",
          fr: "Nouvelle analyse — abonnement requis",
        })}
      >
        <div className="flex items-center gap-2">
          <Lock className="h-4 w-4 shrink-0 text-zinc-500" aria-hidden />
          <span>
            {i18n(language, {
              en: "New analysis",
              fr: "Nouvelle analyse",
            })}
          </span>
        </div>
        <span className="max-w-[14rem] text-center text-[10px] font-medium leading-snug text-zinc-500">
          {i18n(language, {
            en: "Subscribe to unlock after this wait",
            fr: "Abonnez-vous pour lancer après ce délai",
          })}
        </span>
      </div>
    );
  }

  if (q.can_launch_standard_now) {
    return (
      <Link
        href="/app/new-analysis"
        className={NEW_ANALYSIS_CTA_CLASS}
        onClick={closeMobileSidebar}
      >
        <Plus className="mr-2 h-4 w-4" />
        {i18n(language, {
          en: "New analysis",
          fr: "Nouvelle analyse",
        })}
      </Link>
    );
  }

  if (q.has_standard_in_flight) {
    return (
      <div className={NEW_ANALYSIS_BLOCKED_CLASS}>
        <div className="flex items-center gap-2 text-[12px] font-semibold leading-tight text-zinc-300">
          <Loader2 className="h-4 w-4 shrink-0 animate-spin text-zinc-400" aria-hidden />
          {i18n(language, {
            en: "Analysis running",
            fr: "Analyse en cours",
          })}
        </div>
        <span className="text-[10px] leading-snug text-zinc-500">
          {i18n(language, {
            en: "1 per week maximum",
            fr: "1 par semaine maximum",
          })}
        </span>
      </div>
    );
  }

  if (q.next_available_at) {
    return (
      <SidebarWeeklyAnalysisCooldownFace
        language={language}
        nextAvailableAt={q.next_available_at}
        onMayHaveUnlocked={onCooldownEnd}
      />
    );
  }

  return (
    <div className={NEW_ANALYSIS_BLOCKED_CLASS}>
      <span className="text-[12px] font-medium text-zinc-400">
        {i18n(language, {
          en: "Next analysis soon",
          fr: "Prochaine analyse bientôt",
        })}
      </span>
    </div>
  );
}

/** Matches ScoreRing default arc — frosted highlight + slate depth (Tailwind arbitrary layers). */
const SIDEBAR_SURFACE_CLASS =
  "bg-[radial-gradient(ellipse_110%_70%_at_0%_-10%,rgba(248,250,252,0.24)_0%,transparent_52%),radial-gradient(circle_at_88%_108%,rgba(148,163,184,0.18)_0%,transparent_46%),linear-gradient(152deg,rgba(11,17,24,0.97)_0%,rgba(17,26,34,0.94)_42%,rgba(26,36,50,0.92)_100%)]";

function ModernAppSidebar() {
  const [location] = useLocation();
  const language = useAppLanguage();
  const { user, profile, isAdmin, hasPremiumAccess, signOut } = useAuth();
  const { data: analysisHistory = [], isLoading: isHistoryLoading } =
    useAnalysisHistory({ enabled: !!user?.id });
  const {
    data: subscriberQuota,
    isLoading: subscriberQuotaLoading,
    refetch: refetchSubscriberQuotaQuery,
  } = useSubscriberStandardAnalysisQuota();
  const deleteAnalysisMutation = useDeleteAnalysisJob();
  const { state, isMobile, toggleSidebar, setOpenMobile } = useSidebar();

  const closeMobileSidebar = React.useCallback(() => {
    if (isMobile) setOpenMobile(false);
  }, [isMobile, setOpenMobile]);

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
    return analysisHistoryGlobalScoreSummary(latest.results).rankTitle;
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
          href: "/admin/analysis",
          label: "Logs analyses",
          icon: AlertTriangle,
          isActive: (path) => path === "/admin/analysis" || path === "/admin/analysis-failures",
        },
        {
          href: "/admin/client-errors",
          label: "Erreurs client",
          icon: Bug,
          isActive: (path) => path === "/admin/client-errors",
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
                Score
                <span className="italic text-[#d6e4ff]">Max</span>
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
                onClick={closeMobileSidebar}
              >
                <SettingsIcon className="mr-2 h-4 w-4 text-zinc-400" />
                <span>
                  {i18n(language, { en: "Settings", fr: "Paramètres" })}
                </span>
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild className="rounded-xl text-zinc-100 focus:bg-white/10 focus:text-white">
              <Link
                href="/support-client"
                className="flex w-full cursor-pointer items-center"
                onClick={closeMobileSidebar}
              >
                <MessageCircle className="mr-2 h-4 w-4 text-zinc-400" />
                <span>
                  {i18n(language, { en: "Client Support", fr: "Support Client" })}
                </span>
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild className="rounded-xl text-zinc-100 focus:bg-white/10 focus:text-white">
              <Link
                href="/billing"
                className="flex w-full cursor-pointer items-center"
                onClick={closeMobileSidebar}
              >
                <CreditCard className="mr-2 h-4 w-4 text-zinc-400" />
                <span>
                  {i18n(language, { en: "Billing", fr: "Facturation" })}
                </span>
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator className="bg-white/10" />
            <DropdownMenuItem
              className="cursor-pointer rounded-xl text-zinc-100 focus:bg-white/10 focus:text-white"
              onClick={() => signOut()}
            >
              <LogOut className="mr-2 h-4 w-4 text-zinc-400" />
              <span>
                {i18n(language, { en: "Log out", fr: "Déconnexion" })}
              </span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarFooter>

      {!isCollapsed ? (
        <div className="shrink-0 px-2">
          <SidebarGroup className="p-0">
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem className="w-full">
                  <SidebarMenuButton
                    asChild
                    isActive={
                      hasPremiumAccess
                        ? location === "/app/protocol"
                        : location === "/billing"
                    }
                    tooltip={i18n(
                      language,
                      hasPremiumAccess
                        ? { en: "My protocol", fr: "Mon protocole" }
                        : {
                            en: "Unlock my protocol",
                            fr: "Débloquer mon protocole",
                          },
                    )}
                    className={cn(
                      scoreRingMatchMetallicPillClassName,
                      "h-11 w-full rounded-xl px-3 !text-zinc-950",
                      "transition-[transform,filter] duration-150 ease-out",
                      "hover:!text-zinc-950 hover:!brightness-[1.04]",
                      "hover:!bg-[linear-gradient(to_top_right,#475569_0%,#cbd5e1_22%,#ffffff_48%,#e8eef5_72%,#64748b_100%)]",
                      "active:!text-zinc-950 active:!brightness-[0.98] active:translate-y-px",
                      "active:!bg-[linear-gradient(to_top_right,#475569_0%,#cbd5e1_22%,#ffffff_48%,#e8eef5_72%,#64748b_100%)]",
                      "data-[active=true]:!text-zinc-950 data-[active=true]:!brightness-[0.99] data-[active=true]:translate-y-px",
                      "data-[active=true]:!bg-[linear-gradient(to_top_right,#475569_0%,#cbd5e1_22%,#ffffff_48%,#e8eef5_72%,#64748b_100%)]",
                      !hasPremiumAccess && "relative overflow-hidden",
                    )}
                  >
                    <Link
                      href={hasPremiumAccess ? "/app/protocol" : "/billing"}
                      className={cn(
                        "relative z-10 flex w-full items-center justify-center gap-2.5 text-center select-none !text-zinc-950",
                        !hasPremiumAccess && "overflow-hidden rounded-[10px]",
                      )}
                      onClick={closeMobileSidebar}
                    >
                      {!hasPremiumAccess ? (
                        <span
                          className="pointer-events-none absolute inset-0 z-[1] overflow-hidden rounded-[10px]"
                          aria-hidden
                        >
                          <span
                            className="absolute -top-px -bottom-px left-0 w-[42%] max-w-[11rem] animate-sidebar-unlock-shimmer will-change-transform bg-[linear-gradient(100deg,transparent_6%,rgba(255,255,255,0.12)_28%,rgba(255,255,255,0.62)_50%,rgba(255,255,255,0.14)_72%,transparent_94%)] opacity-95 mix-blend-overlay motion-reduce:animate-none"
                          />
                        </span>
                      ) : null}
                      <span className="relative z-[2] flex items-center justify-center gap-2.5">
                        {hasPremiumAccess ? (
                          <ClipboardList className="h-4 w-4 shrink-0 !text-zinc-900" />
                        ) : (
                          <Lock className="h-4 w-4 shrink-0 !text-zinc-900" />
                        )}
                        <span className="font-semibold text-zinc-950">
                          {i18n(
                            language,
                            hasPremiumAccess
                              ? { en: "My protocol", fr: "Mon protocole" }
                              : {
                                  en: "Unlock my protocol",
                                  fr: "Débloquer mon protocole",
                                },
                          )}
                        </span>
                      </span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>

          <SidebarSeparator className="my-2 bg-white/10" />
        </div>
      ) : null}

      <SidebarContent className={isCollapsed ? "hidden" : "px-2 pb-2"}>
        {/* p-0: match footer email strip width (SidebarGroup defaults to p-2 and narrows rows). */}
        <SidebarGroup className="p-0">
          <SidebarGroupLabel className="text-[11px] uppercase tracking-[0.14em] text-white">
            {i18n(language, {
              en: "My analyses",
              fr: "Mes analyses",
            })}
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <div className="mb-3">
              <SidebarNewAnalysisPrimarySlot
                language={language}
                closeMobileSidebar={closeMobileSidebar}
                userId={user?.id}
                isAdmin={isAdmin}
                subscriberQuota={subscriberQuota}
                subscriberQuotaLoading={subscriberQuotaLoading}
                refetchSubscriberQuota={() => void refetchSubscriberQuotaQuery()}
              />
            </div>
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
                const { score0to100, rankTitle } =
                  analysisHistoryGlobalScoreSummary(analysis.results);
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
                    <Link
                      href={analysisHref}
                      className="flex min-w-0 flex-1 items-center gap-1.5"
                      onClick={closeMobileSidebar}
                    >
                      <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-lg border border-white/10 bg-black/20">
                        {analysis.has_thumbnail && user?.id ? (
                          <AuthenticatedThumbnail
                            src={buildAnalysisThumbnailUrl({
                              userId: user.id,
                              jobId: analysis.id,
                            })}
                            alt="Photo de face"
                            className="h-full w-full object-cover"
                            fallback={
                              isAnalysisLoading ? (
                                <div className="flex h-full w-full items-center justify-center bg-black/30 text-zinc-300">
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                </div>
                              ) : (
                                <div className="flex h-full w-full items-center justify-center text-xs text-zinc-500">
                                  —
                                </div>
                              )
                            }
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
                          <div className="flex min-w-0 flex-1 items-center justify-between gap-2">
                            <p className="min-w-0 truncate text-sm font-semibold leading-tight text-zinc-100">
                              Analyse en cours
                            </p>
                            <SidebarAnalysisRunningElapsed
                              createdAtIso={analysis.created_at}
                            />
                          </div>
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
                    {isAdmin ? (
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
                    ) : null}
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
                            onClick={closeMobileSidebar}
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
        <div className="relative z-10 flex flex-col items-center justify-center">
          <BrandLoader size="lg" tone="on-dark" label="Chargement de la plateforme" />
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
          <div
            data-app-scroll-region
            className="flex min-h-0 flex-1 flex-col overflow-y-auto overflow-x-hidden px-2 py-4 md:p-8"
          >
            <div className="mx-auto flex min-h-0 w-full max-w-7xl flex-1 flex-col animate-in fade-in slide-in-from-bottom-4 duration-500 text-foreground">
              {children}
            </div>
          </div>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}
