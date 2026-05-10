import type { CapturedPose } from "@/lib/face-capture/CaptureSession";
import {
  CAPTURE_META_FRONT_JAW_ANGLE_DEG,
  CAPTURE_META_MOUTH_TO_NOSE_WIDTH_RATIO,
  CAPTURE_META_OVAL_MOUTH_OVER_UPPER_WIDTH_RATIO,
  type GuideTraceScanAssetCode,
} from "@shared/schema";

export type GuideTraceBlobUpload = {
  assetTypeCode: GuideTraceScanAssetCode;
  /** Suffixe de fichier lisible (sans extension). */
  fileLabel: string;
  blob: Blob;
  captureMetadata?: Record<string, unknown>;
};

/**
 * Associe une pose capturée aux PNG repères disponibles (`CapturedPose`).
 * Les poses sans aplats renvoient un tableau vide pour ces fichiers guide.
 */
export function guideTraceBlobUploadsFromCapturedPose(
  pose: CapturedPose,
): GuideTraceBlobUpload[] {
  const uploads: GuideTraceBlobUpload[] = [];

  switch (pose.poseId) {
    case "frontal":
      if (pose.annotatedOvalGuideBlob) {
        const meta: Record<string, unknown> | undefined =
          pose.ovalMouthOverUpperLineWidthRatio !== undefined
            ? {
                [CAPTURE_META_OVAL_MOUTH_OVER_UPPER_WIDTH_RATIO]:
                  pose.ovalMouthOverUpperLineWidthRatio,
              }
            : undefined;
        uploads.push({
          assetTypeCode: "GUIDE_TRACE_FACE_FRONT_OVAL",
          fileLabel: "oval",
          blob: pose.annotatedOvalGuideBlob,
          ...(meta ? { captureMetadata: meta } : {}),
        });
      }
      if (pose.annotatedNoseMouthGuideBlob) {
        const meta: Record<string, unknown> | undefined =
          pose.mouthToNoseWidthRatio !== undefined
            ? { [CAPTURE_META_MOUTH_TO_NOSE_WIDTH_RATIO]: pose.mouthToNoseWidthRatio }
            : undefined;
        uploads.push({
          assetTypeCode: "GUIDE_TRACE_FACE_FRONT_NOSE_MOUTH",
          fileLabel: "nose-mouth",
          blob: pose.annotatedNoseMouthGuideBlob,
          ...(meta ? { captureMetadata: meta } : {}),
        });
      }
      if (pose.annotatedVerticalThirdsGuideBlob) {
        uploads.push({
          assetTypeCode: "GUIDE_TRACE_FACE_FRONT_VERTICAL_THIRDS",
          fileLabel: "vertical-thirds",
          blob: pose.annotatedVerticalThirdsGuideBlob,
        });
      }
      if (pose.annotatedJawAngleGuideBlob) {
        const meta: Record<string, unknown> | undefined =
          pose.frontalJawAngleDeg !== undefined
            ? { [CAPTURE_META_FRONT_JAW_ANGLE_DEG]: pose.frontalJawAngleDeg }
            : undefined;
        uploads.push({
          assetTypeCode: "GUIDE_TRACE_FACE_FRONT_JAW_ANGLE",
          fileLabel: "jaw-angle",
          blob: pose.annotatedJawAngleGuideBlob,
          ...(meta ? { captureMetadata: meta } : {}),
        });
      }
      break;
    case "profile-left":
      if (pose.annotatedProfileJawGuideBlob) {
        uploads.push({
          assetTypeCode: "GUIDE_TRACE_PROFILE_LEFT_JAW",
          fileLabel: "profile-jaw",
          blob: pose.annotatedProfileJawGuideBlob,
        });
      }
      break;
    case "profile-right":
      if (pose.annotatedProfileJawGuideBlob) {
        uploads.push({
          assetTypeCode: "GUIDE_TRACE_PROFILE_RIGHT_JAW",
          fileLabel: "profile-jaw",
          blob: pose.annotatedProfileJawGuideBlob,
        });
      }
      break;
    case "jaw-up":
      if (pose.annotatedJawUpLowerArcGuideBlob) {
        uploads.push({
          assetTypeCode: "GUIDE_TRACE_LOOK_UP_JAW_ARC",
          fileLabel: "jaw-arc",
          blob: pose.annotatedJawUpLowerArcGuideBlob,
        });
      }
      break;
    case "crown-down":
      if (pose.annotatedCrownPhotoFlatBlob) {
        uploads.push({
          assetTypeCode: "GUIDE_TRACE_LOOK_DOWN_CROWN_MIRROR",
          fileLabel: "crown-photo",
          blob: pose.annotatedCrownPhotoFlatBlob,
        });
      }
      break;
    case "closeup-smile":
      if (pose.annotatedSmileLipsGuideBlob) {
        uploads.push({
          assetTypeCode: "GUIDE_TRACE_SMILE_LIPS",
          fileLabel: "smile-lips",
          blob: pose.annotatedSmileLipsGuideBlob,
        });
      }
      break;
    default:
      break;
  }

  return uploads;
}
