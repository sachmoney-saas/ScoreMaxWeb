import type { LandmarkPoint } from "@/lib/face-capture/types";

const STORAGE_KEY = "sm_onb_mesh_replay";

export type OnboardingMeshReplaySnapshot = {
  v: 1;
  userId: string;
  frontal: {
    landmarks: LandmarkPoint[];
    landmarkFrameWidth: number;
    landmarkFrameHeight: number;
  };
  eye: {
    landmarks: LandmarkPoint[];
    landmarkFrameWidth: number;
    landmarkFrameHeight: number;
  } | null;
};

function isLandmarkPoint(v: unknown): v is LandmarkPoint {
  return (
    typeof v === "object" &&
    v !== null &&
    typeof (v as LandmarkPoint).x === "number" &&
    typeof (v as LandmarkPoint).y === "number" &&
    typeof (v as LandmarkPoint).z === "number"
  );
}

function scrub(
  raw: string,
  forUserId: string,
): OnboardingMeshReplaySnapshot | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw) as unknown;
  } catch {
    return null;
  }

  if (!parsed || typeof parsed !== "object") return null;
  const rec = parsed as Record<string, unknown>;
  if (rec.v !== 1 || typeof rec.userId !== "string" || rec.userId !== forUserId) {
    return null;
  }
  if (!rec.frontal || typeof rec.frontal !== "object") return null;
  const f = rec.frontal as Record<string, unknown>;
  if (!Array.isArray(f.landmarks) || f.landmarks.length === 0) return null;
  if (!f.landmarks.every(isLandmarkPoint)) return null;
  const fw = f.landmarkFrameWidth;
  const fh = f.landmarkFrameHeight;
  if (typeof fw !== "number" || typeof fh !== "number" || fw <= 0 || fh <= 0) {
    return null;
  }

  let eye: OnboardingMeshReplaySnapshot["eye"] = null;
  if (rec.eye != null && typeof rec.eye === "object") {
    const e = rec.eye as Record<string, unknown>;
    if (
      Array.isArray(e.landmarks) &&
      e.landmarks.length > 0 &&
      e.landmarks.every(isLandmarkPoint)
    ) {
      const ew = e.landmarkFrameWidth;
      const eh = e.landmarkFrameHeight;
      if (
        typeof ew === "number" &&
        typeof eh === "number" &&
        ew > 0 &&
        eh > 0
      ) {
        eye = {
          landmarks: e.landmarks as LandmarkPoint[],
          landmarkFrameWidth: ew,
          landmarkFrameHeight: eh,
        };
      }
    }
  }

  return {
    v: 1,
    userId: rec.userId,
    frontal: {
      landmarks: f.landmarks as LandmarkPoint[],
      landmarkFrameWidth: fw,
      landmarkFrameHeight: fh,
    },
    eye,
  };
}

export function readOnboardingMeshReplay(
  forUserId: string | null | undefined,
): OnboardingMeshReplaySnapshot | null {
  if (typeof window === "undefined" || !forUserId) return null;
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const valid = scrub(raw, forUserId);
    if (valid) return valid;
    window.sessionStorage.removeItem(STORAGE_KEY);
    return null;
  } catch {
    return null;
  }
}

export function writeOnboardingMeshReplay(
  snapshot: Omit<OnboardingMeshReplaySnapshot, "v">,
): void {
  if (typeof window === "undefined") return;
  try {
    const payload: OnboardingMeshReplaySnapshot = { v: 1, ...snapshot };
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {
    /* quota / private mode */
  }
}

export function clearOnboardingMeshReplay(): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    /* noop */
  }
}

async function meshReplayApiRequest(
  method: "GET" | "POST",
  data: unknown | undefined,
  accessToken: string,
): Promise<Response> {
  const response = await fetch("/v1/onboarding/mesh-replay", {
    method,
    headers: {
      ...(data ? { "Content-Type": "application/json" } : {}),
      Authorization: `Bearer ${accessToken}`,
    },
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
  });

  if (!response.ok) {
    const text = (await response.text()) || response.statusText;
    throw new Error(`${response.status}: ${text}`);
  }

  return response;
}

export async function fetchOnboardingMeshReplayFromServer(
  accessToken: string,
  userId: string,
): Promise<OnboardingMeshReplaySnapshot | null> {
  const response = await meshReplayApiRequest(
    "GET",
    undefined,
    accessToken,
  );
  const json = (await response.json()) as {
    data?: { mesh_replay?: unknown };
  };
  const raw = json.data?.mesh_replay;
  if (!raw) return null;
  return scrub(JSON.stringify(raw), userId);
}

export async function saveOnboardingMeshReplayToServer(params: {
  accessToken: string;
  sessionId: string;
  snapshot: Omit<OnboardingMeshReplaySnapshot, "v">;
}): Promise<OnboardingMeshReplaySnapshot> {
  const response = await meshReplayApiRequest(
    "POST",
    {
      sessionId: params.sessionId,
      frontal: params.snapshot.frontal,
      eye: params.snapshot.eye,
    },
    params.accessToken,
  );
  const json = (await response.json()) as {
    data?: { mesh_replay?: unknown };
  };
  const saved = json.data?.mesh_replay;
  const parsed = scrub(JSON.stringify(saved), params.snapshot.userId);
  if (!parsed) {
    throw new Error("Invalid onboarding mesh replay response");
  }
  return parsed;
}
