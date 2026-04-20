import { useAuth } from "@/hooks/use-auth";
import { Link, useLocation } from "wouter";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  SidebarFooter,
  useSidebar,
} from "@/components/ui/sidebar";
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
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { TermsGuard } from "./TermsGuard";

function AppSidebar() {
  const [location] = useLocation();
  const { profile, isAdmin, signOut } = useAuth();
  const { state, isMobile } = useSidebar();

  const isCollapsed = state === "collapsed" && !isMobile;

  const isActive = (path: string) => location === path;

  return (
    <Sidebar collapsible="icon" className="border-r border-border/40">
      <SidebarHeader className="h-16 flex items-center justify-center border-b border-border/20 overflow-hidden">
        <Link
          href="/app"
          className="flex items-center justify-center gap-2 px-2 w-full hover:opacity-80 transition-opacity"
        >
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold">
            S
          </div>
          {!isCollapsed && (
            <span className="font-display font-bold text-lg truncate animate-in fade-in duration-300">
              ScoreMax
            </span>
          )}
        </Link>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="group-data-[collapsible=icon]:hidden">
            Application
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  isActive={isActive("/app")}
                  tooltip="App"
                >
                  <Link href="/app" className="flex items-center gap-2 w-full">
                    <LayoutDashboard className="shrink-0" />
                    {!isCollapsed && <span className="truncate">App</span>}
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {isAdmin && (
          <SidebarGroup>
            <SidebarGroupLabel className="group-data-[collapsible=icon]:hidden">
              Administration
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    asChild
                    isActive={isActive("/admin")}
                    tooltip="Aperçu Admin"
                  >
                    <Link
                      href="/admin"
                      className="flex items-center gap-2 w-full"
                    >
                      <ShieldCheck className="shrink-0" />
                      {!isCollapsed && (
                        <span className="truncate">Aperçu Admin</span>
                      )}
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    asChild
                    isActive={isActive("/admin/users")}
                    tooltip="Gestion Utilisateurs"
                  >
                    <Link
                      href="/admin/users"
                      className="flex items-center gap-2 w-full"
                    >
                      <Users className="shrink-0" />
                      {!isCollapsed && (
                        <span className="truncate">Utilisateurs</span>
                      )}
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>

      <SidebarFooter className="border-t border-border/20 p-2 overflow-hidden">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground flex items-center justify-center cursor-pointer"
            >
              <Avatar className="h-8 w-8 rounded-lg shrink-0">
                <AvatarFallback className="rounded-lg bg-primary/10 text-primary">
                  {profile?.email?.substring(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              {!isCollapsed && (
                <>
                  <div className="grid flex-1 text-left text-sm leading-tight animate-in fade-in duration-300">
                    <span className="truncate font-semibold">
                      {profile?.role === "admin"
                        ? "Administrateur"
                        : "Utilisateur"}
                    </span>
                    <span className="truncate text-xs">{profile?.email}</span>
                  </div>
                  <ChevronRight className="ml-auto size-4 shrink-0" />
                </>
              )}
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-[--radix-dropdown-menu-trigger-width] min-w-56 rounded-lg"
            side="bottom"
            align="end"
            sideOffset={4}
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
            <div className="my-1 h-px bg-muted" />
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
        <AppSidebar />
        <main className="flex-1 overflow-hidden flex flex-col min-w-0 transition-[margin]">
          <header className="flex h-16 items-center gap-4 border-b border-border/75 bg-background/70 px-6 backdrop-blur-xl transition-[width,height] ease-linear group-has-[[data-collapsible=icon]]/sidebar-wrapper:h-12">
            <SidebarTrigger />
            <div className="flex-1">{/* Breadcrumbs could go here */}</div>
          </header>
          <div className="flex-1 overflow-y-auto p-4 md:p-8 pt-6">
            <div className="mx-auto max-w-7xl animate-in fade-in slide-in-from-bottom-4 duration-500">
              {children}
            </div>
          </div>
        </main>
      </div>
    </SidebarProvider>
  );
}
