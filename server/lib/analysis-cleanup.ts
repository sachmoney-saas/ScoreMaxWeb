import { ApiError } from "./errors";
import { deleteR2Objects, getDefaultR2Bucket } from "./r2-storage";
import { supabaseAdmin } from "./supabase-admin";

type AnalysisJobCleanupRow = {
  id: string;
  user_id: string;
  session_id: string | null;
  status: string;
};

type ScanAssetCleanupRow = {
  id: string;
  session_id: string;
  user_id: string;
  r2_bucket: string | null;
  r2_key: string;
};

type StorageObjectRef = {
  scanAssetId: string;
  bucket: string;
  path: string;
};

type StorageRemovalResult = {
  removedAssetIds: Set<string>;
  removedObjectCount: number;
  failedObjectCount: number;
};

export type DeleteAnalysisJobSummary = {
  id: string;
  user_id: string;
  session_id: string | null;
  deleted_scan_asset_count: number;
  deleted_storage_object_count: number;
  retained_shared_scan_asset_count: number;
  deleted_scan_session: boolean;
  cleanup_warning?: string;
};

function chunkArray<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];

  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }

  return chunks;
}

function getStorageBucket(asset: Pick<ScanAssetCleanupRow, "r2_bucket">): string {
  return asset.r2_bucket || getDefaultR2Bucket();
}

async function removeStorageObjects(refs: StorageObjectRef[]): Promise<StorageRemovalResult> {
  const refsByBucket = new Map<string, Map<string, Set<string>>>();

  for (const ref of refs) {
    if (!ref.path.trim()) {
      continue;
    }

    const pathsByAssetId = refsByBucket.get(ref.bucket) ?? new Map<string, Set<string>>();
    const assetIds = pathsByAssetId.get(ref.path) ?? new Set<string>();
    assetIds.add(ref.scanAssetId);
    pathsByAssetId.set(ref.path, assetIds);
    refsByBucket.set(ref.bucket, pathsByAssetId);
  }

  const removedAssetIds = new Set<string>();
  let removedObjectCount = 0;
  let failedObjectCount = 0;

  for (const bucket of Array.from(refsByBucket.keys())) {
    const pathsByAssetId = refsByBucket.get(bucket);
    if (!pathsByAssetId) {
      continue;
    }

    const paths = Array.from(pathsByAssetId.keys());

    for (const pathBatch of chunkArray<string>(paths, 1000)) {
      try {
        await deleteR2Objects({ bucket, keys: pathBatch });
      } catch {
        failedObjectCount += pathBatch.length;
        continue;
      }

      removedObjectCount += pathBatch.length;
      for (const path of pathBatch) {
        for (const assetId of Array.from(pathsByAssetId.get(path) ?? [])) {
          removedAssetIds.add(assetId);
        }
      }
    }
  }

  return { removedAssetIds, removedObjectCount, failedObjectCount };
}

export async function deleteAnalysisJobAndAssets(params: {
  jobId: string;
  userId?: string;
  failedOnly?: boolean;
  deleteSessionIfOrphaned?: boolean;
}): Promise<DeleteAnalysisJobSummary> {
  let jobQuery = supabaseAdmin
    .from("analysis_jobs")
    .select("id, user_id, session_id, status")
    .eq("id", params.jobId);

  if (params.userId) {
    jobQuery = jobQuery.eq("user_id", params.userId);
  }

  const { data: job, error: jobError } = await jobQuery.maybeSingle();

  if (jobError || !job) {
    throw new ApiError({
      code: "VALIDATION_ERROR",
      status: 404,
      message: "Analysis job not found",
      details: jobError,
    });
  }

  const analysisJob = job as AnalysisJobCleanupRow;

  if (params.failedOnly && analysisJob.status !== "failed") {
    throw new ApiError({
      code: "VALIDATION_ERROR",
      status: 409,
      message: "Only failed analysis jobs can be deleted from failure logs",
    });
  }

  const { data: jobAssets, error: jobAssetsLookupError } = await supabaseAdmin
    .from("analysis_job_assets")
    .select("scan_asset_id")
    .eq("analysis_job_id", params.jobId)
    .eq("user_id", analysisJob.user_id);

  if (jobAssetsLookupError) {
    throw new ApiError({
      code: "INTERNAL_SERVER_ERROR",
      status: 500,
      message: "Unable to load analysis assets",
      details: jobAssetsLookupError,
    });
  }

  const linkedScanAssetIds = Array.from(
    new Set(
      (jobAssets ?? [])
        .map((asset) => asset.scan_asset_id as string | null)
        .filter((assetId): assetId is string => typeof assetId === "string"),
    ),
  );

  let scanAssets: ScanAssetCleanupRow[] = [];
  let sharedScanAssetIds = new Set<string>();

  if (linkedScanAssetIds.length > 0) {
    const { data: loadedScanAssets, error: scanAssetsError } = await supabaseAdmin
      .from("scan_assets")
      .select("id, session_id, user_id, r2_bucket, r2_key")
      .in("id", linkedScanAssetIds)
      .eq("user_id", analysisJob.user_id);

    if (scanAssetsError) {
      throw new ApiError({
        code: "INTERNAL_SERVER_ERROR",
        status: 500,
        message: "Unable to load scan assets",
        details: scanAssetsError,
      });
    }

    scanAssets = (loadedScanAssets ?? []) as ScanAssetCleanupRow[];

    const { data: sharedAssetRows, error: sharedAssetsError } = await supabaseAdmin
      .from("analysis_job_assets")
      .select("scan_asset_id")
      .in("scan_asset_id", linkedScanAssetIds)
      .neq("analysis_job_id", params.jobId)
      .eq("user_id", analysisJob.user_id);

    if (sharedAssetsError) {
      throw new ApiError({
        code: "INTERNAL_SERVER_ERROR",
        status: 500,
        message: "Unable to check shared analysis assets",
        details: sharedAssetsError,
      });
    }

    sharedScanAssetIds = new Set(
      (sharedAssetRows ?? [])
        .map((asset) => asset.scan_asset_id as string | null)
        .filter((assetId): assetId is string => typeof assetId === "string"),
    );
  }

  const exclusiveScanAssets = scanAssets.filter((asset) => !sharedScanAssetIds.has(asset.id));

  const { error: resultsError } = await supabaseAdmin
    .from("analysis_results")
    .delete()
    .eq("analysis_job_id", params.jobId)
    .eq("user_id", analysisJob.user_id);

  if (resultsError) {
    throw new ApiError({
      code: "INTERNAL_SERVER_ERROR",
      status: 500,
      message: "Unable to delete analysis results",
      details: resultsError,
    });
  }

  const { error: assetsError } = await supabaseAdmin
    .from("analysis_job_assets")
    .delete()
    .eq("analysis_job_id", params.jobId)
    .eq("user_id", analysisJob.user_id);

  if (assetsError) {
    throw new ApiError({
      code: "INTERNAL_SERVER_ERROR",
      status: 500,
      message: "Unable to delete analysis assets",
      details: assetsError,
    });
  }

  let storageRemoval: StorageRemovalResult = {
    removedAssetIds: new Set<string>(),
    removedObjectCount: 0,
    failedObjectCount: 0,
  };

  if (exclusiveScanAssets.length > 0) {
    const exclusiveAssetIds = exclusiveScanAssets.map((asset) => asset.id);
    const { data: remainingAssetRefs, error: remainingRefsError } = await supabaseAdmin
      .from("analysis_job_assets")
      .select("scan_asset_id")
      .in("scan_asset_id", exclusiveAssetIds)
      .eq("user_id", analysisJob.user_id);

    if (remainingRefsError) {
      throw new ApiError({
        code: "INTERNAL_SERVER_ERROR",
        status: 500,
        message: "Unable to verify remaining scan asset references",
        details: remainingRefsError,
      });
    }

    const stillReferencedAssetIds = new Set(
      (remainingAssetRefs ?? [])
        .map((asset) => asset.scan_asset_id as string | null)
        .filter((assetId): assetId is string => typeof assetId === "string"),
    );
    const unreferencedAssets = exclusiveScanAssets.filter(
      (asset) => !stillReferencedAssetIds.has(asset.id),
    );

    storageRemoval = await removeStorageObjects(
      unreferencedAssets.map((asset) => ({
        scanAssetId: asset.id,
        bucket: getStorageBucket(asset),
        path: asset.r2_key,
      })),
    );

    const removedAssetIds = Array.from(storageRemoval.removedAssetIds);
    if (removedAssetIds.length > 0) {
      const { error: deleteScanAssetsError } = await supabaseAdmin
        .from("scan_assets")
        .delete()
        .in("id", removedAssetIds)
        .eq("user_id", analysisJob.user_id);

      if (deleteScanAssetsError) {
        throw new ApiError({
          code: "INTERNAL_SERVER_ERROR",
          status: 500,
          message: "Unable to delete scan asset metadata",
          details: deleteScanAssetsError,
        });
      }
    }
  }

  const { error: deleteJobError } = await supabaseAdmin
    .from("analysis_jobs")
    .delete()
    .eq("id", params.jobId)
    .eq("user_id", analysisJob.user_id);

  if (deleteJobError) {
    throw new ApiError({
      code: "INTERNAL_SERVER_ERROR",
      status: 500,
      message: "Unable to delete analysis job",
      details: deleteJobError,
    });
  }

  let deletedScanSession = false;
  if (analysisJob.session_id && params.deleteSessionIfOrphaned !== false) {
    const { data: remainingSessionJobs, error: remainingJobsError } = await supabaseAdmin
      .from("analysis_jobs")
      .select("id")
      .eq("session_id", analysisJob.session_id)
      .eq("user_id", analysisJob.user_id)
      .limit(1);

    if (remainingJobsError) {
      throw new ApiError({
        code: "INTERNAL_SERVER_ERROR",
        status: 500,
        message: "Unable to check remaining analysis jobs",
        details: remainingJobsError,
      });
    }

    const { data: remainingSessionAssets, error: remainingSessionAssetsError } = await supabaseAdmin
      .from("scan_assets")
      .select("id")
      .eq("session_id", analysisJob.session_id)
      .eq("user_id", analysisJob.user_id)
      .limit(1);

    if (remainingSessionAssetsError) {
      throw new ApiError({
        code: "INTERNAL_SERVER_ERROR",
        status: 500,
        message: "Unable to check remaining scan assets",
        details: remainingSessionAssetsError,
      });
    }

    if ((remainingSessionJobs ?? []).length === 0 && (remainingSessionAssets ?? []).length === 0) {
      const { error: deleteSessionError } = await supabaseAdmin
        .from("scan_sessions")
        .delete()
        .eq("id", analysisJob.session_id)
        .eq("user_id", analysisJob.user_id);

      if (deleteSessionError) {
        throw new ApiError({
          code: "INTERNAL_SERVER_ERROR",
          status: 500,
          message: "Unable to delete empty scan session",
          details: deleteSessionError,
        });
      }

      deletedScanSession = true;
    }
  }

  return {
    id: params.jobId,
    user_id: analysisJob.user_id,
    session_id: analysisJob.session_id,
    deleted_scan_asset_count: storageRemoval.removedAssetIds.size,
    deleted_storage_object_count: storageRemoval.removedObjectCount,
    retained_shared_scan_asset_count: sharedScanAssetIds.size,
    deleted_scan_session: deletedScanSession,
    ...(storageRemoval.failedObjectCount > 0
      ? {
          cleanup_warning:
            "Analysis was deleted, but some storage objects could not be removed.",
        }
      : {}),
  };
}

export type UserScanStoragePurgeSummary = {
  scan_asset_row_count: number;
  removed_storage_object_count: number;
  failed_storage_object_count: number;
};

/** Supprime les objets R2 liés aux scan_assets de l'utilisateur (avant suppression auth.users en cascade). */
export async function deleteAllScanAssetStorageForUser(userId: string): Promise<UserScanStoragePurgeSummary> {
  const { data: assets, error } = await supabaseAdmin
    .from("scan_assets")
    .select("id, r2_bucket, r2_key")
    .eq("user_id", userId);

  if (error) {
    throw new ApiError({
      code: "INTERNAL_SERVER_ERROR",
      status: 500,
      message: "Unable to load scan assets for account deletion",
      details: error,
    });
  }

  const rows = (assets ?? []) as Pick<ScanAssetCleanupRow, "id" | "r2_bucket" | "r2_key">[];
  const refs = rows
    .filter((row) => typeof row.r2_key === "string" && row.r2_key.trim() !== "")
    .map((row) => ({
      scanAssetId: row.id,
      bucket: getStorageBucket(row),
      path: row.r2_key as string,
    }));

  const removal = await removeStorageObjects(refs);

  return {
    scan_asset_row_count: rows.length,
    removed_storage_object_count: removal.removedObjectCount,
    failed_storage_object_count: removal.failedObjectCount,
  };
}
