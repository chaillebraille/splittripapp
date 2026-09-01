import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

/**
 * Public, read-only preview of an invite link: the trip name and whether the
 * link grants view or edit access. Used for the shared link's page title.
 */
export const getInvitePreview = createServerFn({ method: "GET" })
  .inputValidator((data: { code: string }) => ({ code: String(data?.code ?? "") }))
  .handler(async ({ data }) => {
    const key = process.env['SUPABASE_PUBLISHABLE_KEY']!;
    const url = process.env['SUPABASE_URL']!;
    if (!key || !url) return { name: null as string | null, role: null as string | null };
    const client = createClient<Database>(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: {
        fetch: (input, init) => {
          const headers = new Headers(init?.headers);
          if (key.startsWith("sb_") && headers.get("Authorization") === `Bearer ${key}`) {
            headers.delete("Authorization");
          }
          headers.set("apikey", key);
          return fetch(input, { ...init, headers });
        },
      },
    });
    const { data: rows, error } = await client.rpc("invite_preview", { _code: data.code });
    if (error || !rows || rows.length === 0) return { name: null, role: null };
    const row = rows[0]!;
    return { name: row.group_name ?? null, role: row.role ?? null };
  });
