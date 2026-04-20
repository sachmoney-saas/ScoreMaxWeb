import { createClient } from "@supabase/supabase-js";
import { clientEnv } from "./env";

const supabaseUrl = clientEnv.VITE_SUPABASE_URL;
const supabaseAnonKey = clientEnv.VITE_SUPABASE_ANON_KEY;

// Singleton pattern for the Supabase client
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});
