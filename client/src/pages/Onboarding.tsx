import * as React from "react";
import { useLocation } from "wouter";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowRight,
  BriefcaseBusiness,
  Heart,
  ImagePlus,
  Loader2,
  LogOut,
  ScanFace,
  Trash2,
  Users,
  MoreVertical,
} from "lucide-react";
import { AnalysisProcessingState } from "@/components/analysis/AnalysisProcessingState";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useAuth } from "@/hooks/use-auth";
import { useOnboardingScanStatus } from "@/hooks/use-supabase";
import { supabase } from "@/lib/supabase";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { AUTH_CONFIG } from "@/config/auth";

type OnboardingStep = {
  title: string;
  category: string;
  claim: string;
  source: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
};

type RequiredScanAsset = {
  code: string;
  label_fr: string;
};

type OnboardingAnalysisJob = {
  id: string;
  status: "queued" | "running" | "completed" | "failed";
  error_code?: string | null;
  error_message?: string | null;
};

const REQUIRED_SCAN_ASSETS: RequiredScanAsset[] = [
  { code: "FACE_FRONT", label_fr: "Visage de face" },
  { code: "PROFILE_LEFT", label_fr: "Profil gauche" },
  { code: "PROFILE_RIGHT", label_fr: "Profil droit" },
  { code: "LOOK_UP", label_fr: "Regarder en haut" },
  { code: "LOOK_DOWN", label_fr: "Regarder en bas" },
  { code: "SMILE", label_fr: "Sourire" },
  { code: "HAIR_BACK", label_fr: "Cheveux en arrière" },
  { code: "EYE_CLOSEUP", label_fr: "Gros plan œil" },
];

const steps: OnboardingStep[] = [
  {
    title: "Ton apparence influence directement tes revenus",
    category: "Finances",
    claim: "Les personnes attirantes gagnent 10-15% de plus.",
    source:
      "Hamermesh, D. S., and J. E. Biddle. (1994). The American Economic Review.",
    description:
      "Le beauty privilege se traduit concrètement dans la rémunération et les opportunités de carrière.",
    icon: BriefcaseBusiness,
  },
  {
    title: "Les entretiens sont aussi influencés par l'apparence",
    category: "Finances",
    claim: "Les candidats attirants sont perçus comme plus qualifiés.",
    source:
      "Puleo, R. (2006). Journal of Undergraduate Psychological Research.",
    description:
      "La première impression visuelle impacte l'évaluation avant même l'analyse en profondeur.",
    icon: Users,
  },
  {
    title: "L'apparence agit même sur les performances commerciales",
    category: "Finances",
    claim:
      "Les serveurs attirants reçoivent $1261 de pourboires en plus par an. Les clients ont 55% plus de chances d'acheter à des vendeurs attirants.",
    source:
      "Parrett, M. (2015). Journal of Economic Psychology. Reingen, P. H., and Kernan, J. B. (1993). Journal of Consumer Psychology.",
    description:
      "Dans les interactions transactionnelles, l'effet halo augmente la confiance et le passage à l'action.",
    icon: ArrowRight,
  },
  {
    title: "En rencontres, le visuel domine la première décision",
    category: "Rencontres",
    claim:
      "Sur les apps de rencontre, l'apparence compte environ 9 fois plus que la bio.",
    source:
      "Witmer, J., Rosenbusch, H., and Meral, E. O. (2025). Computers in Human Behavior Reports.",
    description:
      "Ton image est le filtre principal d'entrée: optimiser ta présentation change la qualité des opportunités.",
    icon: Heart,
  },
  {
    title: "L'effet halo transforme aussi ta vie sociale",
    category: "Vie sociale",
    claim:
      "Les personnes attirantes sont perçues comme plus morales et plus dignes de confiance.",
    source:
      "Shinners, E. (2009). UW-L Journal of Undergraduate Research; Klebl et al. (2022). Journal of Nonverbal Behavior.",
    description:
      "Confiance, crédibilité, leadership: l'apparence influence ces perceptions dans de nombreux contextes.",
    icon: Users,
  },
  {
    title: "Teste-toi et découvre ton potentiel",
    category: "ScoreMax",
    claim:
      "ScoreMax analyse ton visage pour te donner un diagnostic clair et actionnable.",
    source: "Analyse IA ScoreMax",
    description:
      "Tu identifies précisément tes points forts et tes axes d'amélioration pour un glow-up mesurable.",
    icon: ScanFace,
  },
  {
    title: "Lance ton analyse ScoreMax",
    category: "Analyse IA",
    claim: "Tes photos sont prêtes à être analysées par ScoreMax.",
    source: "ScoreMax Face Analysis",
    description:
      "Une fois les photos obligatoires ajoutées, l'analyse démarre et prépare ton diagnostic personnalisé.",
    icon: ScanFace,
  },
];

function OnboardingWaveBackground() {
  const canvasRef = React.useRef<HTMLCanvasElement | null>(null);

  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    const gl = canvas.getContext("webgl", {
      alpha: false,
      antialias: true,
      depth: false,
      stencil: false,
      premultipliedAlpha: false,
      preserveDrawingBuffer: false,
    });

    if (!gl) {
      return;
    }

    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    const vertexShaderSource = `
      attribute vec2 position;
      void main() {
        gl_Position = vec4(position, 0.0, 1.0);
      }
    `;

    const fragmentShaderSource = `
      precision mediump float;

      uniform float u_time;
      uniform vec2 u_resolution;

      vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
      vec2 mod289(vec2 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
      vec3 permute(vec3 x) { return mod289(((x * 34.0) + 1.0) * x); }

      float snoise(vec2 v) {
        const vec4 C = vec4(
          0.211324865405187,
          0.366025403784439,
         -0.577350269189626,
          0.024390243902439
        );

        vec2 i = floor(v + dot(v, C.yy));
        vec2 x0 = v - i + dot(i, C.xx);
        vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
        vec4 x12 = x0.xyxy + C.xxzz;
        x12.xy -= i1;
        i = mod289(i);

        vec3 p = permute(
          permute(i.y + vec3(0.0, i1.y, 1.0)) + i.x + vec3(0.0, i1.x, 1.0)
        );

        vec3 m = max(
          0.5 - vec3(dot(x0, x0), dot(x12.xy, x12.xy), dot(x12.zw, x12.zw)),
          0.0
        );
        m = m * m;
        m = m * m;

        vec3 x = 2.0 * fract(p * C.www) - 1.0;
        vec3 h = abs(x) - 0.5;
        vec3 ox = floor(x + 0.5);
        vec3 a0 = x - ox;

        m *= 1.79284291400159 - 0.85373472095314 * (a0 * a0 + h * h);

        vec3 g;
        g.x = a0.x * x0.x + h.x * x0.y;
        g.yz = a0.yz * x12.xz + h.yz * x12.yw;
        return 130.0 * dot(m, g);
      }

      float fbm(vec2 p) {
        float value = 0.0;
        float amplitude = 0.55;
        for (int i = 0; i < 4; i++) {
          value += amplitude * snoise(p);
          p = p * 1.85;
          amplitude *= 0.52;
        }
        return value;
      }

      void main() {
        vec2 st = gl_FragCoord.xy / u_resolution.xy;
        vec2 uv = st - 0.5;
        uv.x *= u_resolution.x / u_resolution.y;

        float t = u_time * 0.11;

        // Gros volumes lents (2-3 masses dominantes)
        vec2 pA = uv * 1.28 + vec2(t * 0.18, -t * 0.11);
        vec2 pB = uv * 1.05 + vec2(-t * 0.13, t * 0.09);

        float nA = fbm(pA);
        float nB = fbm(pB + nA * 0.28);
        float fluid = nA * 0.68 + nB * 0.32;
        fluid = fluid * 0.5 + 0.5;

        vec3 colorLight = vec3(0.75, 0.82, 0.85);
        vec3 colorDark = vec3(0.15, 0.25, 0.30);
        vec3 baseColor = mix(colorDark, colorLight, smoothstep(0.22, 0.84, fluid));

        // Contours doux modernes (2-3 lignes visibles, pas de géométrie angulaire)
        float line1 = smoothstep(0.48, 0.505, fluid) - smoothstep(0.505, 0.54, fluid);
        float line2 = smoothstep(0.64, 0.67, fluid) - smoothstep(0.67, 0.705, fluid);
        float line3 = smoothstep(0.79, 0.815, fluid) - smoothstep(0.815, 0.845, fluid);
        float lines = line1 * 0.8 + line2 * 0.65 + line3 * 0.5;

        vec3 contourColor = vec3(0.90, 0.95, 0.98) * lines;
        vec3 finalColor = baseColor + contourColor * 0.42;

        float vignette = smoothstep(1.1, 0.18, length(uv));
        finalColor = mix(vec3(0.10, 0.18, 0.22), finalColor, vignette);

        gl_FragColor = vec4(finalColor, 1.0);
      }
    `;

    const createShader = (type: number, source: string) => {
      const shader = gl.createShader(type);
      if (!shader) {
        return null;
      }
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        gl.deleteShader(shader);
        return null;
      }
      return shader;
    };

    const vertexShader = createShader(gl.VERTEX_SHADER, vertexShaderSource);
    const fragmentShader = createShader(
      gl.FRAGMENT_SHADER,
      fragmentShaderSource,
    );

    if (!vertexShader || !fragmentShader) {
      return;
    }

    const program = gl.createProgram();
    if (!program) {
      gl.deleteShader(vertexShader);
      gl.deleteShader(fragmentShader);
      return;
    }

    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      gl.deleteProgram(program);
      gl.deleteShader(vertexShader);
      gl.deleteShader(fragmentShader);
      return;
    }

    gl.useProgram(program);

    const positionBuffer = gl.createBuffer();
    if (!positionBuffer) {
      gl.deleteProgram(program);
      gl.deleteShader(vertexShader);
      gl.deleteShader(fragmentShader);
      return;
    }

    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
      gl.STATIC_DRAW,
    );

    const positionLocation = gl.getAttribLocation(program, "position");
    gl.enableVertexAttribArray(positionLocation);
    gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);

    const timeLocation = gl.getUniformLocation(program, "u_time");
    const resolutionLocation = gl.getUniformLocation(program, "u_resolution");

    let animationFrameId = 0;
    let startTime = performance.now();

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const width = Math.floor(window.innerWidth * dpr);
      const height = Math.floor(window.innerHeight * dpr);

      canvas.width = width;
      canvas.height = height;
      canvas.style.width = `${window.innerWidth}px`;
      canvas.style.height = `${window.innerHeight}px`;
      gl.viewport(0, 0, width, height);
    };

    const render = (now: number) => {
      const elapsed = (now - startTime) * 0.001;
      const animatedTime = prefersReducedMotion ? 0 : elapsed;

      if (timeLocation) {
        gl.uniform1f(timeLocation, animatedTime);
      }
      if (resolutionLocation) {
        gl.uniform2f(resolutionLocation, canvas.width, canvas.height);
      }

      gl.drawArrays(gl.TRIANGLES, 0, 6);

      if (!prefersReducedMotion) {
        animationFrameId = window.requestAnimationFrame(render);
      }
    };

    resize();
    animationFrameId = window.requestAnimationFrame(render);
    window.addEventListener("resize", resize);

    return () => {
      window.removeEventListener("resize", resize);
      if (animationFrameId) {
        window.cancelAnimationFrame(animationFrameId);
      }

      gl.deleteBuffer(positionBuffer);
      gl.deleteProgram(program);
      gl.deleteShader(vertexShader);
      gl.deleteShader(fragmentShader);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="DetailsForm-module-scss-module__Y0wOgG__background fixed inset-0 h-dvh w-dvw bg-[#9aaeb5]"
      aria-hidden="true"
    />
  );
}

export default function Onboarding() {
  const [, setLocation] = useLocation();
  const { user, profile } = useAuth();
  const [stepIndex, setStepIndex] = React.useState(0);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [analysisMessage, setAnalysisMessage] = React.useState<string | null>(
    null,
  );
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = React.useState(false);
  const [isDeletingAccount, setIsDeletingAccount] = React.useState(false);
  const [isUploadDialogOpen, setIsUploadDialogOpen] = React.useState(false);
  const [uploadingAssetCode, setUploadingAssetCode] = React.useState<string | null>(
    null,
  );
  const [uploadMessage, setUploadMessage] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!user) {
      setLocation(AUTH_CONFIG.LOGIN_PATH);
      return;
    }

    if (profile?.has_completed_onboarding) {
      setLocation(AUTH_CONFIG.REDIRECT_PATH);
    }
  }, [profile?.has_completed_onboarding, setLocation, user]);

  const currentStep = steps[stepIndex];
  const CurrentIcon = currentStep.icon;
  const isLastStep = stepIndex === steps.length - 1;
  const isAnalysisRunning = isLastStep && isSubmitting;

  const {
    data: scanStatus,
    isLoading: isScanStatusLoading,
    isError: isScanStatusError,
  } = useOnboardingScanStatus({ enabled: isLastStep && !!user?.id });

  const requiredAssetCount = scanStatus?.required_asset_count ?? 8;
  const completedAssetCount = scanStatus?.completed_asset_count ?? 0;
  const missingAssetTypes = scanStatus?.missing_asset_types ?? [];
  const missingAssetLabels = new Set(missingAssetTypes);
  const isScanReady = scanStatus?.is_ready ?? false;
  const canCompleteOnboarding = !isLastStep || isScanReady;
  const onboardingSessionId = scanStatus?.session_id;

  const markOnboardingCompleted = React.useCallback(async () => {
    if (!user?.id || isSubmitting) {
      return;
    }

    setIsSubmitting(true);
    setAnalysisMessage("Préparation des photos pour l'analyse...");

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;

      if (!accessToken) {
        throw new Error("Session Supabase introuvable");
      }

      const headers = { Authorization: `Bearer ${accessToken}` };
      const startResponse = await apiRequest(
        "POST",
        "/v1/onboarding/complete",
        undefined,
        headers,
      );
      const startPayload = (await startResponse.json()) as {
        data?: { job?: OnboardingAnalysisJob };
      };
      const jobId = startPayload.data?.job?.id;

      if (!jobId) {
        throw new Error("Job d'analyse introuvable");
      }

      setAnalysisMessage("Analyse ScoreMax lancée...");

      for (let attempt = 0; attempt < 120; attempt += 1) {
        await new Promise((resolve) => window.setTimeout(resolve, 1500));

        const statusResponse = await apiRequest(
          "GET",
          `/v1/onboarding/analysis/${jobId}`,
          undefined,
          headers,
        );
        const statusPayload = (await statusResponse.json()) as {
          data?: { job?: OnboardingAnalysisJob };
        };
        const job = statusPayload.data?.job;

        if (!job) {
          throw new Error("Statut d'analyse introuvable");
        }

        if (job.status === "queued") {
          setAnalysisMessage("Analyse en file d'attente...");
          continue;
        }

        if (job.status === "running") {
          setAnalysisMessage("Analyse ScoreMax en cours...");
          continue;
        }

        if (job.status === "failed") {
          throw new Error(
            job.error_message || job.error_code || "Analyse ScoreMax échouée",
          );
        }

        setAnalysisMessage("Analyse terminée, redirection vers votre dashboard...");
        await queryClient.invalidateQueries({ queryKey: ["profile", user.id] });
        await queryClient.invalidateQueries({
          queryKey: ["latest-face-analysis", user.id],
        });
        setLocation(AUTH_CONFIG.REDIRECT_PATH);
        return;
      }

      throw new Error("Analyse trop longue, réessaie dans quelques instants");
    } catch (error) {
      console.error("Unable to complete onboarding:", error);
      setAnalysisMessage(
        error instanceof Error
          ? error.message
          : "Impossible de lancer l'analyse pour le moment.",
      );
      setIsSubmitting(false);
    }
  }, [isSubmitting, setLocation, user?.id]);

  const handleLogout = React.useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  const handleDeleteAccount = React.useCallback(async () => {
    if (!user?.id) return;

    setIsDeletingAccount(true);

    try {
      const { error: deleteProfileError } = await supabase
        .from("profiles")
        .delete()
        .eq("id", user.id);

      if (deleteProfileError) {
        throw deleteProfileError;
      }

      const { error: deleteUserError } = await supabase.auth.admin.deleteUser(
        user.id,
      );

      if (deleteUserError) {
        throw deleteUserError;
      }

      await supabase.auth.signOut();
      queryClient.clear();
      setLocation(AUTH_CONFIG.LOGIN_PATH);
    } catch (error) {
      console.error("Erreur lors de la suppression du compte:", error);
      alert(
        "Impossible de supprimer le compte pour le moment. Réessaye plus tard.",
      );
    } finally {
      setIsDeletingAccount(false);
      setIsDeleteDialogOpen(false);
    }
  }, [user?.id, setLocation]);

  const handleManualAssetUpload = React.useCallback(
    async (assetTypeCode: string, file: File | null) => {
      if (!user?.id || !onboardingSessionId || !file || uploadingAssetCode) {
        return;
      }

      if (!["image/jpeg", "image/png"].includes(file.type)) {
        setUploadMessage("Utilise une image JPG ou PNG.");
        return;
      }

      setUploadingAssetCode(assetTypeCode);
      setUploadMessage(null);

      try {
        const extension = file.type === "image/png" ? "png" : "jpg";
        const storagePath = `${user.id}/${onboardingSessionId}/${assetTypeCode}-${Date.now()}.${extension}`;

        const { error: uploadError } = await supabase.storage
          .from("scan-assets")
          .upload(storagePath, file, {
            cacheControl: "3600",
            contentType: file.type,
            upsert: true,
          });

        if (uploadError) {
          throw uploadError;
        }

        const { error: insertError } = await supabase.from("scan_assets").insert({
          session_id: onboardingSessionId,
          user_id: user.id,
          asset_type_code: assetTypeCode,
          r2_bucket: "scan-assets",
          r2_key: storagePath,
          mime_type: file.type,
          byte_size: file.size,
          upload_status: "uploaded",
          captured_at: new Date().toISOString(),
        });

        if (insertError) {
          throw insertError;
        }

        await queryClient.invalidateQueries({
          queryKey: ["onboarding-scan-status", user.id],
        });
        setUploadMessage("Photo ajoutée.");
      } catch (error) {
        console.error("Unable to upload onboarding asset:", error);
        setUploadMessage("Impossible d'ajouter cette photo.");
      } finally {
        setUploadingAssetCode(null);
      }
    },
    [onboardingSessionId, uploadingAssetCode, user?.id],
  );

  const handleNext = React.useCallback(() => {
    if (stepIndex >= steps.length - 1) {
      markOnboardingCompleted();
      return;
    }

    setStepIndex((prev) => Math.min(prev + 1, steps.length - 1));
  }, [markOnboardingCompleted, stepIndex]);

  return (
    <div className="relative min-h-dvh overflow-y-auto bg-[#9aaeb5]">
      <OnboardingWaveBackground />

      {/* Account Menu */}
      <div className="absolute top-4 right-4 z-20">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="rounded-full bg-white/20 hover:bg-white/30"
            >
              <MoreVertical className="h-5 w-5 text-white" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem onClick={handleLogout}>
              <LogOut className="mr-2 h-4 w-4" />
              <span>Se déconnecter</span>
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => setIsDeleteDialogOpen(true)}
              className="text-red-600 focus:text-red-600"
            >
              <Trash2 className="mr-2 h-4 w-4" />
              <span>Supprimer le compte</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Delete Account Confirmation Dialog */}
      <AlertDialog
        open={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer le compte</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action est définitive. Ton compte et toutes tes données
              seront supprimés immédiatement. Tu ne pourras pas revenir en
              arrière.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex gap-2">
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteAccount}
              disabled={isDeletingAccount}
              className="bg-red-600 hover:bg-red-700"
            >
              {isDeletingAccount ? "Suppression..." : "Supprimer"}
            </AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>

      <div className="relative z-10 mx-auto flex min-h-dvh w-full max-w-3xl flex-col justify-center px-4 py-8 sm:px-6">
        <div className="my-auto space-y-4 py-4 sm:space-y-6">
          <div className="flex justify-center">
            <img
              src="/favicon.png"
              alt="Logo ScoreMax"
              className="h-10 w-10 rounded-xl border border-white/50 bg-white/80 p-1.5 shadow-[0_10px_28px_-18px_rgba(9,20,37,0.65)]"
            />
          </div>

          <div
            className="grid gap-1.5"
            style={{
              gridTemplateColumns: `repeat(${steps.length}, minmax(0, 1fr))`,
            }}
          >
            {steps.map((_, index) => (
              <div
                key={`step-segment-${index}`}
                className={`h-2 rounded-full transition-colors duration-200 ${
                  index <= stepIndex ? "bg-[#121826]" : "bg-white/50"
                }`}
              />
            ))}
          </div>

          <AnimatePresence mode="wait">
            <motion.article
              key={`onboarding-step-${stepIndex}`}
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -14 }}
              transition={{ duration: 0.22, ease: "easeOut" }}
              className="rounded-[2rem] border border-white/60 bg-white p-5 shadow-[0_24px_70px_-35px_rgba(9,20,37,0.55)] sm:p-8"
            >
              {isAnalysisRunning ? (
                <AnalysisProcessingState message={analysisMessage} />
              ) : (
                <div className="space-y-5">
                  <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 text-slate-700">
                  <CurrentIcon className="h-6 w-6" />
                </div>

                <div className="space-y-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                    {currentStep.category}
                  </p>
                  <h1 className="text-2xl font-display font-bold leading-tight tracking-tight text-slate-900 sm:text-[2rem]">
                    {currentStep.title}
                  </h1>
                  <p className="text-sm leading-relaxed text-slate-600 sm:text-base">
                    {currentStep.description}
                  </p>
                </div>

                <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-sm font-semibold leading-relaxed text-slate-900 sm:text-base">
                    {currentStep.claim}
                  </p>
                  <p className="text-xs leading-relaxed text-slate-500 sm:text-sm">
                    {currentStep.source}
                  </p>
                </div>

                {isLastStep ? (
                  <div className="space-y-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">
                          En attente des éléments d'analyse issus de l'application
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          {completedAssetCount}/{requiredAssetCount} éléments reçus
                        </p>
                      </div>
                      {isScanStatusLoading ? (
                        <Loader2 className="h-4 w-4 shrink-0 animate-spin text-slate-500" />
                      ) : null}
                    </div>

                    {isScanStatusError ? (
                      <p className="text-sm text-red-600">
                        Impossible de vérifier les éléments pour l'instant.
                        Réessaie dans quelques secondes.
                      </p>
                    ) : null}

                    {!isScanStatusLoading && !isScanStatusError && isScanReady ? (
                      <p className="text-sm font-semibold text-emerald-700">
                        Tous les éléments d'analyse sont prêts.
                      </p>
                    ) : null}

                    {!isScanReady ? (
                      <Dialog open={isUploadDialogOpen} onOpenChange={setIsUploadDialogOpen}>
                        <DialogTrigger asChild>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-auto w-fit p-0 text-xs font-semibold text-slate-500 underline-offset-4 hover:bg-transparent hover:text-slate-900 hover:underline"
                          >
                            Ajouter manuellement des photos
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="max-h-[85svh] overflow-y-auto rounded-3xl border-slate-200 bg-white text-slate-900 sm:max-w-2xl">
                          <DialogHeader>
                            <DialogTitle>Ajouter les éléments d'analyse</DialogTitle>
                            <DialogDescription>
                              Utilise cette option uniquement si les photos ne sont pas encore remontées depuis l'application.
                            </DialogDescription>
                          </DialogHeader>

                          <div className="space-y-3">
                            <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 p-3">
                              <p className="text-sm font-semibold text-slate-900">
                                Progression
                              </p>
                              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                                {completedAssetCount}/{requiredAssetCount}
                              </p>
                            </div>

                            <div className="grid gap-2 sm:grid-cols-2">
                              {REQUIRED_SCAN_ASSETS.map((assetType) => {
                                const isMissing = missingAssetLabels.has(
                                  assetType.label_fr,
                                );
                                const isUploading =
                                  uploadingAssetCode === assetType.code;

                                return (
                                  <label
                                    key={assetType.code}
                                    className={`flex cursor-pointer items-center gap-3 rounded-xl border p-3 text-sm transition ${
                                      isMissing
                                        ? "border-dashed border-slate-300 bg-white text-slate-700 hover:border-slate-400"
                                        : "border-emerald-200 bg-emerald-50 text-emerald-800"
                                    } ${uploadingAssetCode ? "pointer-events-none opacity-70" : ""}`}
                                  >
                                    <input
                                      type="file"
                                      accept="image/jpeg,image/png"
                                      className="sr-only"
                                      disabled={!isMissing || !!uploadingAssetCode}
                                      onChange={(event) => {
                                        const file = event.currentTarget.files?.[0] ?? null;
                                        void handleManualAssetUpload(
                                          assetType.code,
                                          file,
                                        );
                                        event.currentTarget.value = "";
                                      }}
                                    />
                                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
                                      {isUploading ? (
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                      ) : (
                                        <ImagePlus className="h-4 w-4" />
                                      )}
                                    </span>
                                    <span className="min-w-0 flex-1">
                                      <span className="block font-medium">
                                        {assetType.label_fr}
                                      </span>
                                      <span className="block text-xs text-slate-500">
                                        {isMissing ? "Déposer ou choisir" : "Ajoutée"}
                                      </span>
                                    </span>
                                  </label>
                                );
                              })}
                            </div>
                            {uploadMessage ? (
                              <p className="text-sm text-slate-600">
                                {uploadMessage}
                              </p>
                            ) : null}
                          </div>
                        </DialogContent>
                      </Dialog>
                    ) : null}
                  </div>
                ) : null}
              </div>
              )}

              {!isAnalysisRunning ? (
                <div className="mt-6 grid grid-cols-2 gap-3 sm:mt-8">
                <Button
                  type="button"
                  onClick={() => setStepIndex((prev) => Math.max(prev - 1, 0))}
                  disabled={stepIndex === 0 || isSubmitting}
                  className="rounded-xl bg-slate-800 text-white hover:bg-slate-700 disabled:opacity-40"
                >
                  Retour
                </Button>
                <Button
                  type="button"
                  onClick={handleNext}
                  disabled={isSubmitting || !canCompleteOnboarding}
                  className="rounded-xl bg-black text-white hover:bg-zinc-800"
                >
                  {isLastStep ? "Terminer" : "Continuer"}
                </Button>
              </div>
              ) : null}

              {!isAnalysisRunning && analysisMessage ? (
                <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex items-center justify-center gap-3 text-sm text-slate-700">
                    {isSubmitting ? (
                      <Loader2 className="h-4 w-4 animate-spin text-slate-500" />
                    ) : null}
                    <span>{analysisMessage}</span>
                  </div>
                  {isSubmitting ? (
                    <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-200">
                      <div className="h-full w-1/2 animate-pulse rounded-full bg-black" />
                    </div>
                  ) : null}
                </div>
              ) : null}
            </motion.article>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
