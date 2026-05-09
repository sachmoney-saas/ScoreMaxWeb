import type { CapturedPose } from "@/lib/face-capture/CaptureSession";
import type { GuideTraceScanAssetCode } from "@shared/schema";

export type GuideTraceBlobUpload = {
  assetTypeCode: GuideTraceScanAssetCode;
  /** Suffixe de fichier lisible (sans extension). */
  fileLabel: string;
  blob: Blob;
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
        });
      }
      if (pose.annotatedNoseMouthGuideBlob) {
        uploads.push({
          assetTypeCode: "GUIDE_TRACE_FACE_FRONT_NOSE_MOUTH",
          fileLabel: "nose-mouth",
          blob: pose.annotatedNoseMouthGuideBlob,
        });
      }
      if (pose.annotatedVerticalThirdsGuideBlob) {
        uploads.push({
          assetTypeCode: "GUIDE_TRACE_FACE_FRONT_VERTICAL_THIRDS",
          fileLabel: "vertical-thirds",
          blob: pose.annotatedVerticalThirdsGuideBlob,
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
