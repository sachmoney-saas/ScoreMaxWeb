import { pgTable, text, timestamp, uuid, boolean, integer, bigint, jsonb, primaryKey } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const profiles = pgTable("profiles", {
  id: uuid("id").primaryKey(),
  email: text("email"),
  full_name: text("full_name"),
  avatar_url: text("avatar_url"),
  role: text("role", { enum: ["user", "admin"] }).default("user").notNull(),
  is_subscriber: boolean("is_subscriber").default(false).notNull(),
  stripe_customer_id: text("stripe_customer_id"),
  stripe_subscription_id: text("stripe_subscription_id"),
  /**
   * Dodo Payments customer id (`cus_...`). Set on first successful checkout,
   * reused for portal sessions and reconciliation across webhooks.
   */
  dodo_customer_id: text("dodo_customer_id"),
  subscription_status: text("subscription_status"),
  has_accepted_terms: boolean("has_accepted_terms").default(false).notNull(),
  has_completed_onboarding: boolean("has_completed_onboarding").default(false).notNull(),
  last_active_at: timestamp("last_active_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

export const scanAssetTypes = pgTable("scan_asset_types", {
  code: text("code").primaryKey(),
  label_fr: text("label_fr").notNull(),
  is_required_onboarding: boolean("is_required_onboarding").default(true).notNull(),
  sort_order: integer("sort_order").notNull(),
  is_active: boolean("is_active").default(true).notNull(),
  created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updated_at: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const scanSessions = pgTable("scan_sessions", {
  id: uuid("id").defaultRandom().primaryKey(),
  user_id: uuid("user_id").notNull(),
  source: text("source", { enum: ["onboarding", "manual_rescan", "automated"] }).default("onboarding").notNull(),
  status: text("status", { enum: ["collecting", "ready", "processing", "completed", "failed", "abandoned"] }).default("collecting").notNull(),
  required_asset_count: integer("required_asset_count").default(8).notNull(),
  completed_asset_count: integer("completed_asset_count").default(0).notNull(),
  started_at: timestamp("started_at", { withTimezone: true }).defaultNow().notNull(),
  ready_at: timestamp("ready_at", { withTimezone: true }),
  completed_at: timestamp("completed_at", { withTimezone: true }),
  created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updated_at: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const scanAssets = pgTable("scan_assets", {
  id: uuid("id").defaultRandom().primaryKey(),
  session_id: uuid("session_id").notNull(),
  user_id: uuid("user_id").notNull(),
  asset_type_code: text("asset_type_code").notNull(),
  r2_bucket: text("r2_bucket"),
  r2_key: text("r2_key").notNull(),
  mime_type: text("mime_type", { enum: ["image/jpeg", "image/png"] }).notNull(),
  byte_size: bigint("byte_size", { mode: "number" }),
  checksum_sha256: text("checksum_sha256"),
  upload_status: text("upload_status", { enum: ["pending", "uploaded", "validated", "failed"] }).default("pending").notNull(),
  /** Métriques côté client (repères, etc.) pour l’asset correspondant. */
  capture_metadata: jsonb("capture_metadata").$type<Record<string, unknown>>().default({}).notNull(),
  captured_at: timestamp("captured_at", { withTimezone: true }),
  created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updated_at: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

/** Clé JSON dans `scan_assets.capture_metadata` — largeur bouche / largeur nez (segments repère 61↔291 vs 98↔327). */
export const CAPTURE_META_MOUTH_TO_NOSE_WIDTH_RATIO = "mouth_to_nose_width_ratio" as const;
/** Corde bouche sur ovale / corde ligne du haut (même géométrie que `GUIDE_TRACE_FACE_FRONT_OVAL`). */
export const CAPTURE_META_OVAL_MOUTH_OVER_UPPER_WIDTH_RATIO =
  "oval_mouth_over_upper_line_width_ratio" as const;
/** Angle au sommet du repère V mâchoire (degrés), face de face. */
export const CAPTURE_META_FRONT_JAW_ANGLE_DEG = "front_jaw_angle_deg" as const;

/**
 * Clé sous `AnalysesRequest.metadata` : mesures issues de `scan_assets.capture_metadata`,
 * relues côté serveur au lancement (nombres finis uniquement ; rien d’inventé).
 */
export const ANALYSIS_METADATA_GUIDE_TRACE_METRICS = "guide_trace_metrics" as const;

/** PNG repère frontal dont les métriques `CAPTURE_META_*` sont fusionnées pour l’analyse. */
export const FRONTAL_GUIDE_TRACE_METRIC_ASSET_CODES = [
  "GUIDE_TRACE_FACE_FRONT_NOSE_MOUTH",
  "GUIDE_TRACE_FACE_FRONT_OVAL",
  "GUIDE_TRACE_FACE_FRONT_JAW_ANGLE",
] as const;

export type FrontalGuideTraceMetricAssetCode =
  (typeof FRONTAL_GUIDE_TRACE_METRIC_ASSET_CODES)[number];

/** Métriques des repères 2D face de face, jointes au payload vers ScanFace. */
export type GuideTraceMetricsForAnalysis = {
  [CAPTURE_META_MOUTH_TO_NOSE_WIDTH_RATIO]?: number;
  [CAPTURE_META_OVAL_MOUTH_OVER_UPPER_WIDTH_RATIO]?: number;
  [CAPTURE_META_FRONT_JAW_ANGLE_DEG]?: number;
};

export const analysisJobs = pgTable("analysis_jobs", {
  id: uuid("id").defaultRandom().primaryKey(),
  user_id: uuid("user_id").notNull(),
  session_id: uuid("session_id").notNull(),
  trigger_source: text("trigger_source", { enum: ["onboarding_auto", "user_rerun", "admin"] }).default("onboarding_auto").notNull(),
  tier: text("tier", { enum: ["freemium", "standard"] }).default("standard").notNull(),
  status: text("status", { enum: ["queued", "running", "completed", "failed"] }).default("queued").notNull(),
  request_payload: jsonb("request_payload").$type<Record<string, unknown>>().default({}).notNull(),
  version: integer("version").default(1).notNull(),
  parent_analysis_job_id: uuid("parent_analysis_job_id"),
  upstream_job_id: text("upstream_job_id"),
  error_code: text("error_code"),
  error_message: text("error_message"),
  started_at: timestamp("started_at", { withTimezone: true }),
  completed_at: timestamp("completed_at", { withTimezone: true }),
  failed_at: timestamp("failed_at", { withTimezone: true }),
  created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updated_at: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const analysisJobAssets = pgTable(
  "analysis_job_assets",
  {
    analysis_job_id: uuid("analysis_job_id").notNull(),
    asset_type_code: text("asset_type_code").notNull(),
    scan_asset_id: uuid("scan_asset_id").notNull(),
    user_id: uuid("user_id").notNull(),
    created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.analysis_job_id, table.asset_type_code] }),
  ],
);

export const analysisResults = pgTable("analysis_results", {
  id: uuid("id").defaultRandom().primaryKey(),
  analysis_job_id: uuid("analysis_job_id").notNull(),
  user_id: uuid("user_id").notNull(),
  worker: text("worker").notNull(),
  prompt_version: text("prompt_version").notNull(),
  provider: text("provider"),
  result: jsonb("result").notNull(),
  created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const userSubscriptions = pgTable("user_subscriptions", {
  id: uuid("id").defaultRandom().primaryKey(),
  user_id: uuid("user_id").notNull(),
  status: text("status", { enum: ["active", "canceled", "expired"] }).notNull(),
  source: text("source", { enum: ["manual_admin", "dodo", "stripe"] }).notNull(),
  current_period_start: timestamp("current_period_start", { withTimezone: true }),
  current_period_end: timestamp("current_period_end", { withTimezone: true }),
  granted_by: uuid("granted_by"),
  granted_reason: text("granted_reason"),
  external_subscription_id: text("external_subscription_id"),
  metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}).notNull(),
  created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updated_at: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const subscriptionEvents = pgTable("subscription_events", {
  id: uuid("id").defaultRandom().primaryKey(),
  user_id: uuid("user_id").notNull(),
  subscription_id: uuid("subscription_id"),
  event_type: text("event_type", {
    enum: ["granted", "revoked", "expired", "renewed", "period_updated", "admin_note"],
  }).notNull(),
  source: text("source", {
    enum: ["manual_admin", "dodo", "stripe", "system"],
  }).notNull(),
  actor_user_id: uuid("actor_user_id"),
  reason: text("reason"),
  metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}).notNull(),
  created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const insertProfileSchema = createInsertSchema(profiles, {
  email: z.string().email(),
  full_name: z.string().min(2).max(100).optional(),
});

export const updateProfileSchema = insertProfileSchema.partial();

export type Profile = typeof profiles.$inferSelect;
export type InsertProfile = z.infer<typeof insertProfileSchema>;
export type UpdateProfileRequest = z.infer<typeof updateProfileSchema>;
export type ScanAssetType = typeof scanAssetTypes.$inferSelect;
export type ScanSession = typeof scanSessions.$inferSelect;
export type ScanAsset = typeof scanAssets.$inferSelect;
export type AnalysisJob = typeof analysisJobs.$inferSelect;
export type AnalysisJobAsset = typeof analysisJobAssets.$inferSelect;
export type AnalysisResult = typeof analysisResults.$inferSelect;
export type UserSubscription = typeof userSubscriptions.$inferSelect;
export type SubscriptionEvent = typeof subscriptionEvents.$inferSelect;

export type SubscriptionStatus = UserSubscription["status"];
export type SubscriptionSource = UserSubscription["source"];
export type SubscriptionEventType = SubscriptionEvent["event_type"];

/**
 * Wire-level subscription summary returned by API responses.
 * Timestamps are ISO 8601 strings; this matches what Supabase / JSON return
 * to clients and avoids the Drizzle `Date` inference at the network boundary.
 */
export type ActiveSubscriptionSummary = {
  id: string;
  status: SubscriptionStatus;
  source: SubscriptionSource;
  current_period_start: string | null;
  current_period_end: string | null;
  granted_reason: string | null;
  created_at: string;
};

/** Premium-features state that the API exposes for any user (free, sub, admin). */
export type PremiumAccessState = {
  /** Effective access to premium features (admin OR active subscription). */
  has_premium_access: boolean;
  /** True when the user has an active subscription row, regardless of admin role. */
  is_subscriber: boolean;
  is_admin: boolean;
  active_subscription: ActiveSubscriptionSummary | null;
};

/**
 * ScoreMax subscription plans exposed at checkout.
 * Pricing lives in the Dodo Payments dashboard — these constants only
 * carry display metadata and the dashboard product mapping (via env).
 */
export const SUBSCRIPTION_PLANS = ["monthly", "yearly"] as const;
export type Plan = (typeof SUBSCRIPTION_PLANS)[number];

export type PlanDisplay = {
  id: Plan;
  /** Marketing label rendered in the UI. */
  label_fr: string;
  /** Pre-tax price displayed in the UI. Stays in sync with the Dodo product. */
  price_label_fr: string;
  /** Billing cadence, used for the "/mois" or "/an" suffix. */
  cadence_fr: "mois" | "an";
  /** Optional short tagline shown under the price. */
  tagline_fr?: string;
};

export const PLAN_DISPLAY: Record<Plan, PlanDisplay> = {
  monthly: {
    id: "monthly",
    label_fr: "Mensuel",
    price_label_fr: "24,80 €",
    cadence_fr: "mois",
  },
  yearly: {
    id: "yearly",
    label_fr: "Annuel",
    price_label_fr: "178 €",
    cadence_fr: "an",
    tagline_fr: "Économisez environ 40 % vs mensuel",
  },
};

export function isPlan(value: string): value is Plan {
  return (SUBSCRIPTION_PLANS as readonly string[]).includes(value);
}

/**
 * Huit clichés JPEG requis pour l’onboarding / une analyse complète ScanFace.
 * Ne pas étendre ce tuple sans mettre à jour les workers ni `SCAN_ASSET_TO_CANONICAL_SLOT`.
 */
export const REQUIRED_ONBOARDING_SCAN_ASSET_CODES = [
  "FACE_FRONT",
  "PROFILE_LEFT",
  "PROFILE_RIGHT",
  "LOOK_UP",
  "LOOK_DOWN",
  "SMILE",
  "HAIR_BACK",
  "EYE_CLOSEUP",
] as const;

export type OnboardingScanAssetCode =
  (typeof REQUIRED_ONBOARDING_SCAN_ASSET_CODES)[number];

/**
 * PNG de repères (aplats tutoriels). Stockés comme `scan_assets` mais
 * `scan_asset_types.is_required_onboarding = false` pour ne pas bloquer
 * la progression de session ni les workers ML.
 *
 * Ces codes correspondent aux blobs facultatifs sur `CapturedPose` côté client.
 */
export const GUIDE_TRACE_SCAN_ASSET_CODES = [
  "GUIDE_TRACE_FACE_FRONT_OVAL",
  "GUIDE_TRACE_FACE_FRONT_NOSE_MOUTH",
  "GUIDE_TRACE_FACE_FRONT_VERTICAL_THIRDS",
  "GUIDE_TRACE_FACE_FRONT_JAW_ANGLE",
  "GUIDE_TRACE_FACE_FRONT_SHAPE_CONTOUR",
  /**
   * Cliché frontal selfie : voile sombre 40 % sur la photo puis masque facial
   * 3D (Wireframe + ovale comme en capture live), sans grille 2D ; image
   * recadrée sur l’ovale MediaPipe avec marge. Vignette d’analyse — préférée à
   * `FACE_FRONT` pour la sidebar dès qu’elle est disponible.
   */
  "GUIDE_TRACE_FACE_FRONT_MASK_OVERLAY",
  /**
   * Variante « lèvres » prise sur la pose de face (mêmes calques que
   * `GUIDE_TRACE_SMILE_LIPS` : remplissage bleu intérieur lèvres + voile
   * noir opaque partout sauf le ring lèvres). Complète le repère sourire
   * pour analyser les lèvres au repos.
   */
  "GUIDE_TRACE_FACE_FRONT_LIPS",
  "GUIDE_TRACE_PROFILE_LEFT_JAW",
  "GUIDE_TRACE_PROFILE_RIGHT_JAW",
  "GUIDE_TRACE_PROFILE_LEFT_NOSE",
  "GUIDE_TRACE_PROFILE_RIGHT_NOSE",
  "GUIDE_TRACE_LOOK_UP_JAW_ARC",
  "GUIDE_TRACE_SMILE_LIPS",
  /**
   * Variante « dents » du repère sourire : photo + voile noir opaque partout
   * SAUF l’intérieur de la bouche (pas de remplissage ni contour des lèvres),
   * pour faire ressortir la teinte naturelle des dents.
   */
  "GUIDE_TRACE_SMILE_TEETH",
  "GUIDE_TRACE_EYE_CLOSEUP_CONTOURS",
] as const;

export type GuideTraceScanAssetCode =
  (typeof GUIDE_TRACE_SCAN_ASSET_CODES)[number];

export type SignedUploadScanAssetCode =
  OnboardingScanAssetCode
  | GuideTraceScanAssetCode;

/** Jetons acceptés pour `POST /v1/analyses/scan-assets/signed-upload`. */
export const SIGNED_UPLOAD_SCAN_ASSET_CODES: readonly SignedUploadScanAssetCode[] =
  [
    ...(REQUIRED_ONBOARDING_SCAN_ASSET_CODES as readonly SignedUploadScanAssetCode[]),
    ...(GUIDE_TRACE_SCAN_ASSET_CODES as readonly SignedUploadScanAssetCode[]),
  ];

const signedUploadScanAssetCodesSet = new Set<string>(
  SIGNED_UPLOAD_SCAN_ASSET_CODES,
);

export function isSignedUploadScanAssetCode(
  value: string,
): value is SignedUploadScanAssetCode {
  return signedUploadScanAssetCodesSet.has(value);
}

/**
 * Canonical ScanFace image slot names (cf. ScanFace API docs).
 *
 * The API expects `images[].imageId` to use these names so it can match
 * each worker prompt's `requiredImageSlots`. Keeping the mapping
 * centralized lets server + client + shared schemas stay aligned.
 */
export const SCANFACE_CANONICAL_IMAGE_SLOTS = [
  "front_face",
  "left_profile",
  "right_profile",
  "look_up",
  "look_down",
  "smile",
  "hair_back_hand",
  "closeup_eye",
] as const;

export type ScanFaceCanonicalSlot =
  (typeof SCANFACE_CANONICAL_IMAGE_SLOTS)[number];

export const SCAN_ASSET_TO_CANONICAL_SLOT: Record<
  OnboardingScanAssetCode,
  ScanFaceCanonicalSlot
> = {
  FACE_FRONT: "front_face",
  PROFILE_LEFT: "left_profile",
  PROFILE_RIGHT: "right_profile",
  LOOK_UP: "look_up",
  LOOK_DOWN: "look_down",
  SMILE: "smile",
  HAIR_BACK: "hair_back_hand",
  EYE_CLOSEUP: "closeup_eye",
};

export const CANONICAL_SLOT_TO_SCAN_ASSET: Record<
  ScanFaceCanonicalSlot,
  OnboardingScanAssetCode
> = {
  front_face: "FACE_FRONT",
  left_profile: "PROFILE_LEFT",
  right_profile: "PROFILE_RIGHT",
  look_up: "LOOK_UP",
  look_down: "LOOK_DOWN",
  smile: "SMILE",
  hair_back_hand: "HAIR_BACK",
  closeup_eye: "EYE_CLOSEUP",
};

export type OnboardingScanStatus = {
  session_id: string;
  required_asset_count: number;
  completed_asset_count: number;
  is_ready: boolean;
  missing_asset_types: string[];
};
