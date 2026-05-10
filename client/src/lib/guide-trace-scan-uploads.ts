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
        uploads.push({
          assetTypeCode: "GUIDE_TRACE_FACE_FRONT_OVAL",
          fileLabel: "oval",
          blob: pose.annotatedOvalGuideBlob,
          captureMetadata: {
            [CAPTURE_META_OVAL_MOUTH_OVER_UPPER_WIDTH_RATIO]:
              pose.ovalMouthOverUpperLineWidthRatio ?? null,
          },
        });
      }
      if (pose.annotatedNoseMouthGuideBlob) {
        uploads.push({
          assetTypeCode: "GUIDE_TRACE_FACE_FRONT_NOSE_MOUTH",
          fileLabel: "nose-mouth",
          blob: pose.annotatedNoseMouthGuideBlob,
          captureMetadata: {
            [CAPTURE_META_MOUTH_TO_NOSE_WIDTH_RATIO]: pose.mouthToNoseWidthRatio ?? null,
          },
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
        uploads.push({
          assetTypeCode: "GUIDE_TRACE_FACE_FRONT_JAW_ANGLE",
          fileLabel: "jaw-angle",
          blob: pose.annotatedJawAngleGuideBlob,
          captureMetadata: {
            [CAPTURE_META_FRONT_JAW_ANGLE_DEG]: pose.frontalJawAngleDeg ?? null,
          },
        });
      }
      if (pose.annotatedFaceShapeContourGuideBlob) {
        uploads.push({
          assetTypeCode: "GUIDE_TRACE_FACE_FRONT_SHAPE_CONTOUR",
          fileLabel: "face-shape-contour",
          blob: pose.annotatedFaceShapeContourGuideBlob,
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
      if (pose.annotatedProfileNoseGuideBlob) {
        uploads.push({
          assetTypeCode: "GUIDE_TRACE_PROFILE_LEFT_NOSE",
          fileLabel: "profile-nose",
          blob: pose.annotatedProfileNoseGuideBlob,
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
      if (pose.annotatedProfileNoseGuideBlob) {
        uploads.push({
          assetTypeCode: "GUIDE_TRACE_PROFILE_RIGHT_NOSE",
          fileLabel: "profile-nose",
          blob: pose.annotatedProfileNoseGuideBlob,
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
    case "closeup-eye":
      if (pose.annotatedCloseupEyeContoursGuideBlob) {
        uploads.push({
          assetTypeCode: "GUIDE_TRACE_EYE_CLOSEUP_CONTOURS",
          fileLabel: "eye-contours",
          blob: pose.annotatedCloseupEyeContoursGuideBlob,
        });
      }
      break;
    default:
      break;
  }

  return uploads;
}
