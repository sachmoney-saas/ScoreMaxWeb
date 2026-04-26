import { useAuth } from "@/hooks/use-auth";
import { Link, useLocation } from "wouter";
import {
  LayoutDashboard,
  ShieldCheck,
  Users,
  LogOut,
  ChevronRight,
  Settings as SettingsIcon,
  CreditCard,
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
import { TermsGuard } from "./TermsGuard";

type SidebarNavItem = {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  isActive: (location: string) => boolean;
};

function ModernAppSidebar() {
  const [location] = useLocation();
  const { profile, isAdmin, signOut } = useAuth();
  const { state, isMobile, toggleSidebar } = useSidebar();

  const isCollapsed = state === "collapsed" && !isMobile;

  const mainItems: SidebarNavItem[] = [
    {
      href: "/app",
      label: "Dashboard",
      icon: LayoutDashboard,
      isActive: (path) => path === "/app",
    },
  ];

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
      className="relative z-40 border-r border-transparent [--sidebar-width:18rem]"
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
            Navigation
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {mainItems.map((item) => {
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
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
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
      <div className="flex min-h-screen w-full bg-background">
        <TermsGuard />
        <ModernAppSidebar />
        <SidebarInset className="bg-background">
          <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-border/70 bg-background/80 px-4 backdrop-blur-xl md:h-16 md:px-6">
            <SidebarTrigger className="h-8 w-8 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 md:hidden" />
            <div className="flex-1" />
          </header>
          <div className="flex-1 overflow-y-auto p-4 md:p-8 pt-6">
            <div className="mx-auto max-w-7xl animate-in fade-in slide-in-from-bottom-4 duration-500">
              {children}
            </div>
          </div>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}
