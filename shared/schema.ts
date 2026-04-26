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
  captured_at: timestamp("captured_at", { withTimezone: true }),
  created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updated_at: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const analysisJobs = pgTable("analysis_jobs", {
  id: uuid("id").defaultRandom().primaryKey(),
  user_id: uuid("user_id").notNull(),
  session_id: uuid("session_id").notNull(),
  trigger_source: text("trigger_source", { enum: ["onboarding_auto", "user_rerun", "admin"] }).default("onboarding_auto").notNull(),
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

export type OnboardingScanAssetCode =
  | "FACE_FRONT"
  | "PROFILE_LEFT"
  | "PROFILE_RIGHT"
  | "LOOK_UP"
  | "LOOK_DOWN"
  | "SMILE"
  | "HAIR_BACK"
  | "EYE_CLOSEUP";

export type OnboardingScanStatus = {
  session_id: string;
  required_asset_count: number;
  completed_asset_count: number;
  is_ready: boolean;
  missing_asset_types: string[];
};
