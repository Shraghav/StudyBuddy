import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://fobmuwhfmpsokrlptbgi.supabase.co";
const supabaseAnonKey = "sb_publishable_FnL6hhH2IMqNLJW3ecUZmg_Jd6Gyfr_";

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error("Supabase URL and Key must be provided in .env");
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
