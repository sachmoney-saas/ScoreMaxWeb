import type { OnboardingScanAssetCode } from "@shared/schema";
import type { CapturedPose } from "@/lib/face-capture/CaptureSession";
import type { PoseId } from "@/lib/face-capture/types";
import { uploadScanAsset } from "@/lib/face-analysis";
import { guideTraceBlobUploadsFromCapturedPose } from "@/lib/guide-trace-scan-uploads";
import { apiRequest } from "@/lib/queryClient";
import type { AppLanguage } from "@/lib/i18n";

export const ONBOARDING_POSE_TO_ASSET: Record<PoseId, OnboardingScanAssetCode> = {
  frontal: "FACE_FRONT",
  "profile-right": "PROFILE_RIGHT",
  "profile-left": "PROFILE_LEFT",
  "jaw-up": "LOOK_UP",
  "crown-down": "LOOK_DOWN",
  "closeup-eye": "EYE_CLOSEUP",
  "closeup-smile": "SMILE",
};

export async function uploadCapturedOnboardingPose(params: {
  userId: string;
  sessionId: string;
  pose: CapturedPose;
  language: AppLanguage;
}): Promise<void> {
  const code = ONBOARDING_POSE_TO_ASSET[params.pose.poseId];
  if (!code) return;

  await uploadScanAsset({
    userId: params.userId,
    sessionId: params.sessionId,
    assetTypeCode: code,
    file: new File([params.pose.blob], `${params.pose.poseId}.jpg`, {
      type: "image/jpeg",
    }),
    lang: params.language,
  });

  for (const trace of guideTraceBlobUploadsFromCapturedPose(params.pose)) {
    await uploadScanAsset({
      userId: params.userId,
      sessionId: params.sessionId,
      assetTypeCode: trace.assetTypeCode,
      file: new File(
        [trace.blob],
        `${params.pose.poseId}-guide-${trace.fileLabel}.png`,
        { type: "image/png" },
      ),
      lang: params.language,
      captureMetadata: trace.captureMetadata,
    });
  }
}

export async function uploadCapturedOnboardingPoses(params: {
  userId: string;
  sessionId: string;
  poses: CapturedPose[];
  language: AppLanguage;
}): Promise<void> {
  for (const pose of params.poses) {
    await uploadCapturedOnboardingPose({
      userId: params.userId,
      sessionId: params.sessionId,
      pose,
      language: params.language,
    });
  }
}

export type CompleteOnboardingResult = {
  generationId: string | null;
};

export async function completeOnboardingApi(params: {
  accessToken: string;
  language: AppLanguage;
}): Promise<CompleteOnboardingResult> {
  const completeResponse = await apiRequest(
    "POST",
    "/v1/onboarding/complete",
    { lang: params.language },
    { Authorization: `Bearer ${params.accessToken}` },
  );
  const completePayload = (await completeResponse.json()) as {
    data?: { generation?: { id?: string } };
  };

  const generationId = completePayload.data?.generation?.id;
  return { generationId: generationId ?? null };
}

/**
 * Démarre la génération d’image potentiel (OneShot) dès que le scan est complet,
 * **sans** marquer l’onboarding terminé sur le profil (réservé à `/onboarding/complete`).
 * Permet d’attendre la fin du job avant d’afficher l’écran mesh.
 */
export async function startOnboardingPotentialGenerationApi(params: {
  accessToken: string;
  language: AppLanguage;
}): Promise<{ generationId: string | null }> {
  const res = await apiRequest(
    "POST",
    "/v1/onboarding/start-potential-generation",
    undefined,
    { Authorization: `Bearer ${params.accessToken}` },
  );
  const body = (await res.json()) as {
    data?: { generation?: { id?: string } };
  };

  const generationId = body.data?.generation?.id;
  return { generationId: generationId ?? null };
}
