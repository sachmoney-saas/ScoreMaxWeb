import type { Express } from "express";
import type { Server } from "http";
import { api } from "@shared/routes";

import { validateRequest } from "./lib/validate";
import { updateProfileSchema } from "@shared/schema";
import { logger } from "./lib/logger";
import { getSupabaseAdminEnv } from "./lib/env";
import { createClient } from "@supabase/supabase-js";

export async function registerRoutes(
  httpServer: Server,
  app: Express,
): Promise<Server> {
  // All profile operations are handled frontend-side directly via Supabase client.
  // These routes are kept as lightweight shells if needed for future server-side logic.

  app.get(api.health.path, (req, res) => {
    res.json({ status: "ok" });
  });

  // Debug endpoint to check all profiles (admin only, uses service role)
  app.get("/api/debug/profiles", async (req, res) => {
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
  app.get("/api/debug/auth-users", async (req, res) => {
    try {
      const { supabaseUrl, serviceRoleKey } = getSupabaseAdminEnv();

      const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);
      const { data, error } = await supabaseAdmin.auth.admin.listUsers();

      if (error) {
        logger.error({ err: error }, "Error fetching auth users");
        return res.status(500).json({ message: error.message });
      }

      // Return simplified user info
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
