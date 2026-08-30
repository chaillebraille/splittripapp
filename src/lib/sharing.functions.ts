import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const shareRoleSchema = z.enum(["viewer", "editor"]);

/** Owner: people this trip is shared with, including their emails. */
export const listShares = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ groupId: z.string().uuid() }).parse(data))
  .handler(async ({ context, data }) => {
    const { data: shares, error } = await context.supabase
      .from("group_shares")
      .select("id, user_id, role, created_at")
      .eq("group_id", data.groupId)
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);

    // Emails come from profiles (joiner-visible) — owner can see profiles of
    // people their trip is shared with via the share rows.
    const userIds = (shares ?? []).map((s) => s.user_id);
    let emails: Record<string, string> = {};
    if (userIds.length > 0) {
      const { data: profiles } = await context.supabase
        .from("profiles")
        .select("user_id, email, display_name")
        .in("user_id", userIds);
      emails = Object.fromEntries(
        (profiles ?? []).map((p) => [p.user_id, p.display_name || p.email || "Unknown"]),
      );
    }
    return (shares ?? []).map((s) => ({ ...s, label: emails[s.user_id] ?? "Unknown user" }));
  });

export const updateShareRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z.object({ shareId: z.string().uuid(), role: shareRoleSchema }).parse(data),
  )
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase
      .from("group_shares")
      .update({ role: data.role })
      .eq("id", data.shareId);
    if (error) throw new Error(error.message);
    return { success: true };
  });

export const removeShare = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ shareId: z.string().uuid() }).parse(data))
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase
      .from("group_shares")
      .delete()
      .eq("id", data.shareId);
    if (error) throw new Error(error.message);
    return { success: true };
  });

export const listInvites = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ groupId: z.string().uuid() }).parse(data))
  .handler(async ({ context, data }) => {
    const { data: invites, error } = await context.supabase
      .from("group_invites")
      .select("id, code, role, created_at, expires_at, revoked_at, uses")
      .eq("group_id", data.groupId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return invites ?? [];
  });

export const createInvite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z.object({ groupId: z.string().uuid(), role: shareRoleSchema }).parse(data),
  )
  .handler(async ({ context, data }) => {
    const code = crypto.randomUUID().replace(/-/g, "").slice(0, 12);
    const { data: invite, error } = await context.supabase
      .from("group_invites")
      .insert({
        group_id: data.groupId,
        code,
        role: data.role,
        created_by: context.userId,
      })
      .select("id, code, role, created_at, expires_at, revoked_at, uses")
      .single();
    if (error) throw new Error(error.message);
    return invite;
  });

export const revokeInvite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ inviteId: z.string().uuid() }).parse(data))
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase
      .from("group_invites")
      .update({ revoked_at: new Date().toISOString() })
      .eq("id", data.inviteId);
    if (error) throw new Error(error.message);
    return { success: true };
  });

/** Any signed-in user holding the link: join the trip. */
export const redeemInvite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ code: z.string().min(1).max(64) }).parse(data))
  .handler(async ({ context, data }) => {
    const { data: groupId, error } = await context.supabase.rpc("redeem_group_invite", {
      _code: data.code,
    });
    if (error) throw new Error(error.message);
    return { groupId: groupId as string };
  });
