import { createClient } from "@supabase/supabase-js";
import { getSupabaseAdminEnv } from "./env";

const { url, serviceRoleKey } = getSupabaseAdminEnv();

export const supabaseAdmin = createClient(url, serviceRoleKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});
