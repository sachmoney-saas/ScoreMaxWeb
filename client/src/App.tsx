import * as React from "react";
import { Switch, Route, Redirect } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/hooks/use-auth";
import { useUserAccess } from "@/hooks/use-user-access";
import { useOnboardingPotentialImage } from "@/hooks/use-onboarding-potential-image";
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
import ErrorSupportClient from "@/pages/ErrorSupportClient";
import Billing from "@/pages/Billing";
import BillingSuccess from "@/pages/BillingSuccess";
import MentionsLegales from "@/pages/MentionsLegales";
import CGU from "@/pages/CGU";
import Confidentialite from "@/pages/Confidentialite";
import { AUTH_CONFIG } from "@/config/auth";
import { LanguageProvider } from "@/lib/i18n";
import { BrandLoader } from "@/components/ui/brand-loader";
import { useAuth } from "@/hooks/use-auth";
import { useOnboardingScanStatus } from "@/hooks/use-supabase";
import {
  readOnboardingFlowState,
  resolveOnboardingCaptureInitialStep,
  resolveOnboardingInitialStepForReturningUser,
} from "@/lib/onboarding-flow-storage";

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
  const access = useUserAccess();

  if (access.isLoading) {
    return <FullScreenLoader />;
  }

  if (!access.isAuthenticated) {
    return <Redirect to={AUTH_CONFIG.LOGIN_PATH} />;
  }

  if (access.shouldUseOnboardingFlow) {
    return <Redirect to="/onboarding" />;
  }

  if (!access.canAccessApp) {
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

function BillingLayout({ children }: { children: React.ReactNode }) {
  const access = useUserAccess();

  if (access.isLoading) {
    return <FullScreenLoader />;
  }

  if (!access.isAuthenticated) {
    return <Redirect to={AUTH_CONFIG.LOGIN_PATH} />;
  }

  if (access.shouldUseOnboardingFlow) {
    return <Redirect to="/onboarding" />;
  }

  return (
    <AppLayout>
      <ErrorBoundary>{children}</ErrorBoundary>
    </AppLayout>
  );
}

function OnboardingRoute() {
  const { user, profile } = useAuth();
  const access = useUserAccess();
  const shouldCheckPaywallFunnel =
    access.kind === "onboarding_paywall_funnel";
  const needsOnboardingCapture = access.kind === "needs_onboarding_capture";

  const {
    data: scanStatusForRoute,
    isLoading: isScanRouteLoading,
    isError: isScanRouteError,
  } = useOnboardingScanStatus({
    enabled: !!user?.id && needsOnboardingCapture,
  });

  const prefetchPotentialForOnboarding =
    shouldCheckPaywallFunnel || needsOnboardingCapture;
  const {
    data: potentialImage,
    isLoading: isPotentialImageLoading,
  } = useOnboardingPotentialImage({
    enabled: prefetchPotentialForOnboarding,
  });

  if (access.isLoading) {
    return <FullScreenLoader />;
  }

  if (!access.isAuthenticated) {
    return <Redirect to={AUTH_CONFIG.LOGIN_PATH} />;
  }

  if (access.canAccessApp) {
    return <Redirect to={AUTH_CONFIG.REDIRECT_PATH} />;
  }

  const persistedStep = readOnboardingFlowState(user?.id)?.step ?? null;

  if (shouldCheckPaywallFunnel) {
    const initialStep = resolveOnboardingInitialStepForReturningUser({
      persistedStep,
      hasPotentialImage: !!potentialImage,
    });

    if (
      initialStep === 2 &&
      isPotentialImageLoading &&
      !potentialImage &&
      (persistedStep ?? 0) < 2
    ) {
      return <FullScreenLoader />;
    }

    return (
      <ErrorBoundary>
        <Onboarding initialStep={initialStep} />
      </ErrorBoundary>
    );
  }

  if (needsOnboardingCapture) {
    const entry = resolveOnboardingCaptureInitialStep({
      persistedStep,
      hasCompletedOnboarding: profile?.has_completed_onboarding === true,
      scanStatus: scanStatusForRoute,
      isScanLoading: isScanRouteLoading,
      isScanError: isScanRouteError,
    });

    if (entry === "wait") {
      return <FullScreenLoader />;
    }

    if (
      entry === 2 &&
      isPotentialImageLoading &&
      !potentialImage &&
      (persistedStep ?? 0) < 2
    ) {
      return <FullScreenLoader />;
    }

    return (
      <ErrorBoundary>
        <Onboarding initialStep={entry} />
      </ErrorBoundary>
    );
  }

  return (
    <ErrorBoundary>
      <Onboarding />
    </ErrorBoundary>
  );
}

function AuthRedirectRoute() {
  const access = useUserAccess();

  if (access.isLoading) {
    return <FullScreenLoader />;
  }

  if (access.isAuthenticated) {
    return <Redirect to={access.postLoginPath} />;
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

        <Route path="/support/error" component={ErrorSupportClient} />

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
          <BillingLayout>
            <Billing />
          </BillingLayout>
        </Route>
        <Route path="/billing/success">
          <BillingLayout>
            <BillingSuccess />
          </BillingLayout>
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
