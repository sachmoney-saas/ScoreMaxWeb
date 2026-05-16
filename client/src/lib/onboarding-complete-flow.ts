import type { OnboardingScanAssetCode } from "@shared/schema";
import type { CapturedPose } from "@/lib/face-capture/CaptureSession";
import type { PoseId } from "@/lib/face-capture/types";
import { uploadScanAsset } from "@/lib/face-analysis";
import { guideTraceBlobUploadsFromCapturedPose } from "@/lib/guide-trace-scan-uploads";
import { apiRequest } from "@/lib/queryClient";
import { i18n, type AppLanguage } from "@/lib/i18n";

export const ONBOARDING_POSE_TO_ASSET: Record<PoseId, OnboardingScanAssetCode> = {
  frontal: "FACE_FRONT",
  "profile-right": "PROFILE_RIGHT",
  "profile-left": "PROFILE_LEFT",
  "jaw-up": "LOOK_UP",
  "crown-down": "LOOK_DOWN",
  "closeup-eye": "EYE_CLOSEUP",
  "closeup-smile": "SMILE",
};

export async function uploadCapturedOnboardingPoses(params: {
  userId: string;
  sessionId: string;
  poses: CapturedPose[];
  language: AppLanguage;
}): Promise<void> {
  for (const pose of params.poses) {
    const code = ONBOARDING_POSE_TO_ASSET[pose.poseId];
    if (!code) continue;
    await uploadScanAsset({
      userId: params.userId,
      sessionId: params.sessionId,
      assetTypeCode: code,
      file: new File([pose.blob], `${pose.poseId}.jpg`, {
        type: "image/jpeg",
      }),
      lang: params.language,
    });

    for (const trace of guideTraceBlobUploadsFromCapturedPose(pose)) {
      await uploadScanAsset({
        userId: params.userId,
        sessionId: params.sessionId,
        assetTypeCode: trace.assetTypeCode,
        file: new File(
          [trace.blob],
          `${pose.poseId}-guide-${trace.fileLabel}.png`,
          { type: "image/png" },
        ),
        lang: params.language,
        captureMetadata: trace.captureMetadata,
      });
    }
  }
}

export type CompleteOnboardingResult = {
  generationId: string;
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
  if (!generationId) {
    throw new Error(
      i18n(params.language, {
        en: "Unable to start preview generation",
        fr: "Impossible de lancer la génération",
      }),
    );
  }

  return { generationId };
}
