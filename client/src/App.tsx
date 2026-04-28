import * as React from "react";
import { Switch, Route, Redirect } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/hooks/use-auth";
import { AppLayout } from "@/components/layout/AppLayout";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import NotFound from "@/pages/not-found";
import Landing from "@/pages/Landing";
import Onboarding from "@/pages/Onboarding";
import AuthPage from "@/pages/Auth";
import Dashboard from "@/pages/Dashboard";
import NewAnalysis from "@/pages/NewAnalysis";
import AgeDetails from "@/pages/AgeDetails";
import AdminPage from "@/pages/Admin";
import Settings from "@/pages/Settings";
import Billing from "@/pages/Billing";
import MentionsLegales from "@/pages/MentionsLegales";
import CGU from "@/pages/CGU";
import Confidentialite from "@/pages/Confidentialite";
import { Loader2 } from "lucide-react";
import { AUTH_CONFIG } from "@/config/auth";

function FullScreenLoader() {
  return (
    <div className="flex h-screen w-full items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );
}

// Protected Route Wrapper
function ProtectedRoute({
  component: Component,
}: {
  component: React.ComponentType;
}) {
  const { user, profile, isLoading } = useAuth();

  if (isLoading) {
    return <FullScreenLoader />;
  }

  if (!user) {
    return <Redirect to={AUTH_CONFIG.LOGIN_PATH} />;
  }

  if (!profile) {
    return <Redirect to="/onboarding" />;
  }

  if (!profile?.has_completed_onboarding) {
    return <Redirect to="/onboarding" />;
  }

  return (
    <AppLayout>
      <ErrorBoundary>
        <Component />
      </ErrorBoundary>
    </AppLayout>
  );
}

function OnboardingRoute() {
  const { user, profile, isLoading } = useAuth();

  if (isLoading) {
    return <FullScreenLoader />;
  }

  if (!user) {
    return <Redirect to={AUTH_CONFIG.LOGIN_PATH} />;
  }

  if (profile?.has_completed_onboarding) {
    return <Redirect to={AUTH_CONFIG.REDIRECT_PATH} />;
  }

  return (
    <ErrorBoundary>
      <Onboarding />
    </ErrorBoundary>
  );
}

function Router() {
  const { user, profile } = useAuth();
  const postAuthRedirectPath = profile?.has_completed_onboarding
    ? AUTH_CONFIG.REDIRECT_PATH
    : "/onboarding";

  return (
    <Switch>
      {/* Public Routes */}
      <Route path={AUTH_CONFIG.LANDING_PATH} component={Landing} />
      <Route path="/mentions-legales" component={MentionsLegales} />
      <Route path="/cgu" component={CGU} />
      <Route path="/confidentialite" component={Confidentialite} />

      <Route path={AUTH_CONFIG.LOGIN_PATH}>
        {user ? <Redirect to={postAuthRedirectPath} /> : <AuthPage />}
      </Route>
      <Route path={AUTH_CONFIG.REGISTER_PATH}>
        {user ? <Redirect to={postAuthRedirectPath} /> : <AuthPage />}
      </Route>

      <Route path="/onboarding">
        <OnboardingRoute />
      </Route>

      {/* Protected Routes */}
      <Route path="/app/age">
        <ProtectedRoute component={AgeDetails} />
      </Route>

      <Route path="/app/new-analysis">
        <ProtectedRoute component={NewAnalysis} />
      </Route>

      <Route path="/app">
        <ProtectedRoute component={Dashboard} />
      </Route>

      <Route path="/settings">
        <ProtectedRoute component={Settings} />
      </Route>

      <Route path="/billing">
        <ProtectedRoute component={Billing} />
      </Route>

      {/* Admin Route */}
      <Route path="/admin">
        <ProtectedRoute component={AdminPage} />
      </Route>
      <Route path="/admin/users">
        <ProtectedRoute component={AdminPage} />
      </Route>
      <Route path="/admin/analysis-failures">
        <ProtectedRoute component={AdminPage} />
      </Route>

      {/* Fallback */}
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <Router />
          <Toaster />
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
