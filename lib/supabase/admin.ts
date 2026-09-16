import { createClient } from "@supabase/supabase-js";

/**
 * Service-role client. Bypasses RLS entirely — never import this into
 * anything that runs in the browser, and only use it for operations the
 * anon key structurally cannot do (here: deleting an auth.users row).
 */
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}
