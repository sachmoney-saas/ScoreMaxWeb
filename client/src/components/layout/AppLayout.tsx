import { WaveBackground } from "@/components/background/WaveBackground";
import { useAuth } from "@/hooks/use-auth";
import {
  useAnalysisHistory,
  useDeleteAnalysisJob,
} from "@/hooks/use-supabase";
import { buildAnalysisThumbnailUrl } from "@/lib/face-analysis";
import { Link, useLocation } from "wouter";
import {
  ShieldCheck,
  Users,
  LogOut,
  ChevronRight,
  Settings as SettingsIcon,
  CreditCard,
  MoreHorizontal,
  Trash2,
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
  SidebarRail,
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

type SidebarNavItem = {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  isActive: (location: string) => boolean;
};

function ModernAppSidebar() {
  const [location] = useLocation();
  const { user, profile, isAdmin, signOut } = useAuth();
  const { data: analysisHistory = [], isLoading: isHistoryLoading } =
    useAnalysisHistory({ enabled: !!user?.id });
  const deleteAnalysisMutation = useDeleteAnalysisJob();
  const { state, isMobile, toggleSidebar } = useSidebar();

  const isCollapsed = state === "collapsed" && !isMobile;

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
      ]
    : [];

  return (
    <Sidebar
      collapsible="icon"
      variant="floating"
      className="relative z-40 border-r border-transparent [--sidebar-width:22rem]"
    >
      <SidebarHeader
        className={`${isCollapsed ? "px-1.5 pt-3 pb-2" : "px-2 pt-3 pb-2"}`}
      >
        <div
          className="group relative flex h-11 cursor-pointer items-center overflow-hidden rounded-xl border border-white/15 bg-[linear-gradient(135deg,rgba(255,255,255,0.12)_0%,rgba(214,228,255,0.08)_52%,rgba(255,255,255,0.03)_100%)] px-2 shadow-[0_30px_65px_-55px_rgba(0,0,0,0.98)] transition-all hover:border-white/25"
          title={
            isCollapsed ? "Ouvrir la left sidebar" : "Rétracter la left sidebar"
          }
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
          <div className="flex min-w-0 flex-1 items-center px-1">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-white/15 bg-black/25">
              <img
                src="/favicon.png"
                alt="Logo ScoreMax"
                className="h-4 w-4 object-contain"
              />
            </div>
            <div
              className={`ml-2.5 min-w-0 transition-all duration-200 ${
                isCollapsed ? "w-0 opacity-0" : "w-auto opacity-100"
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
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              className="h-11 rounded-xl border border-white/15 bg-white/[0.06] data-[state=open]:bg-white/[0.12]"
            >
              <Avatar className="h-8 w-8 rounded-lg shrink-0">
                <AvatarFallback className="rounded-lg bg-primary/15 text-primary text-xs">
                  {profile?.email?.substring(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              {!isCollapsed ? (
                <>
                  <div className="grid flex-1 text-left text-sm leading-tight">
                    <span className="truncate font-semibold text-zinc-100">
                      {profile?.role === "admin"
                        ? "Administrateur"
                        : "Utilisateur"}
                    </span>
                    <span className="truncate text-xs text-zinc-400">
                      {profile?.email}
                    </span>
                  </div>
                  <ChevronRight className="ml-auto size-4 shrink-0 text-zinc-400" />
                </>
              ) : null}
            </SidebarMenuButton>
          </DropdownMenuTrigger>

          <DropdownMenuContent
            className="w-[--radix-dropdown-menu-trigger-width] min-w-56 rounded-xl"
            side={isMobile ? "bottom" : "right"}
            align="end"
            sideOffset={8}
          >
            <DropdownMenuItem asChild>
              <Link
                href="/settings"
                className="flex w-full items-center cursor-pointer"
              >
                <SettingsIcon className="mr-2 h-4 w-4" />
                <span>Paramètres</span>
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link
                href="/billing"
                className="flex w-full items-center cursor-pointer"
              >
                <CreditCard className="mr-2 h-4 w-4" />
                <span>Facturation</span>
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="cursor-pointer"
              onClick={() => signOut()}
            >
              <LogOut className="mr-2 h-4 w-4" />
              <span>Déconnexion</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarFooter>

      <SidebarContent className={isCollapsed ? "hidden" : "px-2 pb-2"}>
        <SidebarGroup>
          <SidebarGroupLabel className="text-[11px] uppercase tracking-[0.14em] text-zinc-500">
            Historique
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="space-y-2">
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

              {analysisHistory.map((analysis) => (
                <SidebarMenuItem key={analysis.id}>
                  <div className="group flex items-center gap-2.5 rounded-xl border border-white/10 bg-white/[0.055] p-2 transition hover:border-white/20 hover:bg-white/[0.085]">
                    <Link href="/app" className="flex min-w-0 flex-1 items-center gap-2.5">
                      <div className="h-11 w-11 shrink-0 overflow-hidden rounded-lg border border-white/10 bg-black/20">
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
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-xs text-zinc-500">
                            —
                          </div>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-zinc-100">
                          Analyse #{analysis.version}
                        </p>
                        <p className="truncate text-xs text-zinc-400">
                          {new Intl.DateTimeFormat("fr-FR", {
                            day: "2-digit",
                            month: "short",
                            hour: "2-digit",
                            minute: "2-digit",
                          }).format(new Date(analysis.completed_at ?? analysis.created_at))}
                        </p>
                      </div>
                    </Link>
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
                        <DropdownMenuItem
                          className="cursor-pointer text-red-500 focus:text-red-500"
                          disabled={deleteAnalysisMutation.isPending}
                          onClick={() => deleteAnalysisMutation.mutate(analysis.id)}
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          <span>Supprimer</span>
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {adminItems.length > 0 ? (
          <>
            <SidebarSeparator className="my-2 bg-white/10" />
            <SidebarGroup>
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

      <SidebarRail />
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
    <SidebarProvider>
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
