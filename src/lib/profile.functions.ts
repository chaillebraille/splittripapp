import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** The signed-in user's profile (username plus the default member name used in new trips). */
export const getMyProfile = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("profiles")
      .select("user_id, display_name, default_member_name")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return {
      user_id: context.userId,
      display_name: data?.display_name ?? null,
      default_member_name: data?.default_member_name ?? null,
    };
  });

export const setDefaultMemberName = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { name: string }) => {
    const name = String(data?.name ?? "").trim();
    if (!name) throw new Error("Pick a member name");
    if (name.length > 40) throw new Error("The member name is too long");
    return { name };
  })
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase
      .from("profiles")
      .update({ default_member_name: data.name })
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { success: true as const, name: data.name };
  });
