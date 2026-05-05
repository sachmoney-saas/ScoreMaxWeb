import * as React from "react";
import { Switch, Route, Redirect } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/hooks/use-auth";
import { useOnboardingGate } from "@/hooks/use-onboarding-gate";
import { AppLayout } from "@/components/layout/AppLayout";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import NotFound from "@/pages/not-found";
import Landing from "@/pages/Landing";
import Onboarding from "@/pages/Onboarding";
import AuthPage from "@/pages/Auth";
import Dashboard from "@/pages/Dashboard";
import NewAnalysis from "@/pages/NewAnalysis";
import AnalysisDetails from "@/pages/AnalysisDetails";
import WorkerDetails from "@/pages/WorkerDetails";
import AgeDetails from "@/pages/AgeDetails";
import AdminPage from "@/pages/Admin";
import {
  AdminRecommendationsOverview,
  AdminRecommendationsWorker,
} from "@/pages/AdminRecommendations";
import Protocol from "@/pages/Protocol";
import Settings from "@/pages/Settings";
import Billing from "@/pages/Billing";
import MentionsLegales from "@/pages/MentionsLegales";
import CGU from "@/pages/CGU";
import Confidentialite from "@/pages/Confidentialite";
import { AUTH_CONFIG } from "@/config/auth";
import { LanguageProvider } from "@/lib/i18n";
import { BrandLoader } from "@/components/ui/brand-loader";

function FullScreenLoader() {
  return (
    <div className="flex h-[100dvh] w-full items-center justify-center bg-[hsl(var(--background))]">
      <BrandLoader size="lg" tone="on-dark" label="Chargement" />
    </div>
  );
}

// Protected Route Wrapper
function ProtectedRoute({
  component: Component,
}: {
  component: React.ComponentType;
}) {
  const { user } = useAuth();
  const { status } = useOnboardingGate();

  if (status === "loading") {
    return <FullScreenLoader />;
  }

  if (!user || status === "anon") {
    return <Redirect to={AUTH_CONFIG.LOGIN_PATH} />;
  }

  if (status === "needs_onboarding") {
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
  const { user, isLoading } = useAuth();
  const { status } = useOnboardingGate();

  if (isLoading || status === "loading") {
    return <FullScreenLoader />;
  }

  if (!user) {
    return <Redirect to={AUTH_CONFIG.LOGIN_PATH} />;
  }

  if (status === "ok") {
    return <Redirect to={AUTH_CONFIG.REDIRECT_PATH} />;
  }

  return (
    <ErrorBoundary>
      <Onboarding />
    </ErrorBoundary>
  );
}

function Router() {
  const { user, isLoading } = useAuth();
  const { status: gate } = useOnboardingGate();

  return (
    <LanguageProvider>
      <Switch>
        {/* Public Routes */}
        <Route path={AUTH_CONFIG.LANDING_PATH} component={Landing} />
        <Route path="/legal-notice" component={MentionsLegales} />
        <Route path="/terms" component={CGU} />
        <Route path="/privacy" component={Confidentialite} />
        <Route path="/mentions-legales">
          <Redirect to="/legal-notice" />
        </Route>
        <Route path="/cgu">
          <Redirect to="/terms" />
        </Route>
        <Route path="/confidentialite">
          <Redirect to="/privacy" />
        </Route>

        <Route path={AUTH_CONFIG.LOGIN_PATH}>
          {user ? (
            isLoading || gate === "loading" ? (
              <FullScreenLoader />
            ) : gate === "ok" ? (
              <Redirect to={AUTH_CONFIG.REDIRECT_PATH} />
            ) : (
              <Redirect to="/onboarding" />
            )
          ) : (
            <AuthPage />
          )}
        </Route>
        <Route path={AUTH_CONFIG.REGISTER_PATH}>
          {user ? (
            isLoading || gate === "loading" ? (
              <FullScreenLoader />
            ) : gate === "ok" ? (
              <Redirect to={AUTH_CONFIG.REDIRECT_PATH} />
            ) : (
              <Redirect to="/onboarding" />
            )
          ) : (
            <AuthPage />
          )}
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

        <Route path="/app/analyses/:jobId/workers/:worker">
          <ProtectedRoute component={WorkerDetails} />
        </Route>

        <Route path="/app/analyses/:jobId">
          <ProtectedRoute component={AnalysisDetails} />
        </Route>

        <Route path="/app/protocol">
          <ProtectedRoute component={Protocol} />
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
        <Route path="/admin/recommendations">
          <ProtectedRoute component={AdminRecommendationsOverview} />
        </Route>
        <Route path="/admin/recommendations/:worker">
          <ProtectedRoute component={AdminRecommendationsWorker} />
        </Route>

        {/* Fallback */}
        <Route component={NotFound} />
      </Switch>
    </LanguageProvider>
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
