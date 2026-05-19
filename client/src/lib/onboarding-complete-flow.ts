import type {
  OnboardingScanAssetCode,
  SignedUploadScanAssetCode,
} from "@shared/schema";
import type { CapturedPose } from "@/lib/face-capture/CaptureSession";
import type { PoseId } from "@/lib/face-capture/types";
import {
  uploadScanAsset,
  type ScanAssetUploadProgress,
} from "@/lib/face-analysis";
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
  onUploadProgress?: (progress: ScanAssetUploadProgress) => void;
}): Promise<void> {
  const code = ONBOARDING_POSE_TO_ASSET[params.pose.poseId];
  if (!code) return;

  const uploads: Array<{
    assetTypeCode: SignedUploadScanAssetCode;
    file: File;
    captureMetadata?: Record<string, unknown>;
  }> = [
    {
      assetTypeCode: code,
      file: new File([params.pose.blob], `${params.pose.poseId}.jpg`, {
        type: "image/jpeg",
      }),
    },
    ...guideTraceBlobUploadsFromCapturedPose(params.pose).map((trace) => ({
      assetTypeCode: trace.assetTypeCode,
      file: new File(
        [trace.blob],
        `${params.pose.poseId}-guide-${trace.fileLabel}.png`,
        { type: "image/png" },
      ),
      captureMetadata: trace.captureMetadata,
    })),
  ];
  const loadedBytesByUpload = uploads.map(() => 0);
  const totalBytes = uploads.reduce((total, upload) => total + upload.file.size, 0);

  const notifyProgress = () => {
    const loadedBytes = loadedBytesByUpload.reduce(
      (total, loaded) => total + loaded,
      0,
    );
    params.onUploadProgress?.({
      loadedBytes,
      totalBytes,
    });
  };

  params.onUploadProgress?.({ loadedBytes: 0, totalBytes });

  for (let index = 0; index < uploads.length; index += 1) {
    const upload = uploads[index];
    await uploadScanAsset({
      userId: params.userId,
      sessionId: params.sessionId,
      assetTypeCode: upload.assetTypeCode,
      file: upload.file,
      lang: params.language,
      captureMetadata: upload.captureMetadata,
      onUploadProgress: ({ loadedBytes }) => {
        loadedBytesByUpload[index] = loadedBytes;
        notifyProgress();
      },
    });
    loadedBytesByUpload[index] = upload.file.size;
    notifyProgress();
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
