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
import { WaveBackground } from "@/components/background/WaveBackground";
import { authPageOverlayClassName } from "@/lib/auth-page-shell-styles";
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
import AdminAnalysisJobDetailPage from "@/pages/AdminAnalysisJobDetail";
import AdminAiPromptsPage from "@/pages/AdminAiPrompts";
import {
  AdminRecommendationsOverview,
  AdminRecommendationsWorker,
} from "@/pages/AdminRecommendations";
import Protocol from "@/pages/Protocol";
import ProtocolRecommendations from "@/pages/ProtocolRecommendations";
import Settings from "@/pages/Settings";
import SupportClient from "@/pages/SupportClient";
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

// Protected Route Wrapper — onboarding terminé **et** abonnement (ou admin)
function ProtectedRoute({
  component: Component,
}: {
  component: React.ComponentType;
}) {
  const { status } = useOnboardingGate();
  const { hasPremiumAccess, isAdmin, isLoading: authLoading } = useAuth();

  if (status === "loading" || authLoading) {
    return <FullScreenLoader />;
  }

  if (status === "anon") {
    return <Redirect to={AUTH_CONFIG.LOGIN_PATH} />;
  }

  if (status === "needs_onboarding") {
    return <Redirect to="/onboarding" />;
  }

  if (!hasPremiumAccess && !isAdmin) {
    return <Redirect to="/billing" />;
  }

  return (
    <AppLayout>
      <ErrorBoundary>
        <Component />
      </ErrorBoundary>
    </AppLayout>
  );
}

function BillingRoute() {
  const { status } = useOnboardingGate();
  const { user, hasPremiumAccess, isAdmin, isLoading: authLoading } = useAuth();

  if (status === "loading" || authLoading) {
    return <FullScreenLoader />;
  }

  if (!user || status === "anon") {
    return <Redirect to={AUTH_CONFIG.LOGIN_PATH} />;
  }

  if (status === "needs_onboarding") {
    return <Redirect to="/onboarding" />;
  }

  const standalonePaywall = !hasPremiumAccess && !isAdmin;

  if (standalonePaywall) {
    return (
      <ErrorBoundary>
        <div className="relative isolate flex min-h-dvh max-h-[100dvh] flex-col overflow-x-hidden overflow-y-auto bg-[#9aaeb5]">
          <WaveBackground
            useContainerSize
            className="pointer-events-none z-0 bg-[#9aaeb5]"
            canvasClassName="bg-transparent"
          />
          <div className={authPageOverlayClassName} aria-hidden />
          <div className="relative z-10 mx-auto w-full max-w-5xl flex-1 px-4 py-10 sm:px-8">
            <Billing />
          </div>
        </div>
      </ErrorBoundary>
    );
  }

  return (
    <AppLayout>
      <ErrorBoundary>
        <Billing />
      </ErrorBoundary>
    </AppLayout>
  );
}

function OnboardingRoute() {
  const { status } = useOnboardingGate();
  const { user, hasPremiumAccess, isAdmin, isLoading: authLoading } = useAuth();

  if (status === "loading" || authLoading) {
    return <FullScreenLoader />;
  }

  if (!user) {
    return <Redirect to={AUTH_CONFIG.LOGIN_PATH} />;
  }

  if (status === "ok" && (hasPremiumAccess || isAdmin)) {
    return <Redirect to={AUTH_CONFIG.REDIRECT_PATH} />;
  }

  if (status === "ok" && !hasPremiumAccess && !isAdmin) {
    return <Redirect to="/billing" />;
  }

  return (
    <ErrorBoundary>
      <Onboarding />
    </ErrorBoundary>
  );
}

function AuthRedirectRoute() {
  const { status } = useOnboardingGate();
  const { hasPremiumAccess, isAdmin, isLoading: authLoading } = useAuth();

  if (status === "loading" || authLoading) {
    return <FullScreenLoader />;
  }

  if (status === "ok" && (hasPremiumAccess || isAdmin)) {
    return <Redirect to={AUTH_CONFIG.REDIRECT_PATH} />;
  }

  if (status === "ok" && !hasPremiumAccess && !isAdmin) {
    return <Redirect to="/billing" />;
  }

  if (status === "needs_onboarding") {
    return <Redirect to="/onboarding" />;
  }

  return <AuthPage />;
}

function Router() {
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
          <AuthRedirectRoute />
        </Route>
        <Route path={AUTH_CONFIG.REGISTER_PATH}>
          <AuthRedirectRoute />
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

        <Route path="/app/protocol/recommendations">
          <ProtectedRoute component={ProtocolRecommendations} />
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

        <Route path="/support-client">
          <ProtectedRoute component={SupportClient} />
        </Route>

        <Route path="/billing">
          <BillingRoute />
        </Route>

        {/* Admin Route */}
        <Route path="/admin">
          <ProtectedRoute component={AdminPage} />
        </Route>
        <Route path="/admin/users">
          <ProtectedRoute component={AdminPage} />
        </Route>
        <Route path="/admin/analysis">
          <ProtectedRoute component={AdminPage} />
        </Route>
        <Route path="/admin/client-errors">
          <ProtectedRoute component={AdminPage} />
        </Route>
        <Route path="/admin/analysis-failures">
          <Redirect to="/admin/analysis" />
        </Route>
        <Route path="/admin/analysis-jobs/:jobId">
          <ProtectedRoute component={AdminAnalysisJobDetailPage} />
        </Route>
        <Route path="/admin/recommendations">
          <ProtectedRoute component={AdminRecommendationsOverview} />
        </Route>
        <Route path="/admin/recommendations/:worker">
          <ProtectedRoute component={AdminRecommendationsWorker} />
        </Route>
        <Route path="/admin/ai-prompts">
          <ProtectedRoute component={AdminAiPromptsPage} />
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
