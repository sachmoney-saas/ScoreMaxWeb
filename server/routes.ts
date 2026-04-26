import type { Express } from "express";
import type { Server } from "http";
import { api } from "@shared/routes";

import { logger } from "./lib/logger";
import { getSupabaseAdminEnv } from "./lib/env";
import { createClient } from "@supabase/supabase-js";
import { createV1PublicRouter } from "./routes/v1-public";
import { createV1ProtectedRouter } from "./routes/v1-protected";
import { createV1AdminApiKeysRouter } from "./routes/v1-admin-api-keys";

export async function registerRoutes(
  httpServer: Server,
  app: Express,
): Promise<Server> {
  app.get(api.health.path, (_req, res) => {
    res.json({ status: "ok" });
  });

  app.use("/v1/public", createV1PublicRouter());
  app.use("/v1", createV1ProtectedRouter());
  app.use("/v1/admin/api-keys", createV1AdminApiKeysRouter());

  // Debug endpoint to check all profiles (admin only, uses service role)
  app.get("/api/debug/profiles", async (_req, res) => {
    try {
      const { supabaseUrl, serviceRoleKey } = getSupabaseAdminEnv();

      const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);
      const { data, error } = await supabaseAdmin.from("profiles").select("*");

      if (error) {
        logger.error({ err: error }, "Error fetching profiles");
        return res.status(500).json({ message: error.message });
      }

      res.json(data);
    } catch (error: any) {
      logger.error({ err: error }, "Debug endpoint error");
      res.status(500).json({ message: error.message });
    }
  });

  // Debug endpoint to check auth.users vs profiles
  app.get("/api/debug/auth-users", async (_req, res) => {
    try {
      const { supabaseUrl, serviceRoleKey } = getSupabaseAdminEnv();

      const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);
      const { data, error } = await supabaseAdmin.auth.admin.listUsers();

      if (error) {
        logger.error({ err: error }, "Error fetching auth users");
        return res.status(500).json({ message: error.message });
      }

      const users = data.users.map((u) => ({
        id: u.id,
        email: u.email,
        provider: u.app_metadata?.provider,
        created_at: u.created_at,
        user_metadata: u.user_metadata,
      }));

      res.json(users);
    } catch (error: any) {
      logger.error({ err: error }, "Debug auth-users endpoint error");
      res.status(500).json({ message: error.message });
    }
  });

  return httpServer;
}
