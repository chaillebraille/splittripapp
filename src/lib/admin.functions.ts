import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { USERNAME_PATTERN, normalizeUsername, usernameToEmail } from "@/lib/username";

const usernameSchema = z
  .string()
  .transform((v) => normalizeUsername(v))
  .refine((v) => USERNAME_PATTERN.test(v), "Invalid username");


type AdminContext = { supabase: any; userId: string };

async function assertAdmin(context: AdminContext) {
  const { data } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "admin",
  });
  if (!data) throw new Error("Admins only");
}

async function loadAdmin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

/** Public: does the app still need its very first admin account? */
export const getSetupStatus = createServerFn({ method: "GET" }).handler(async () => {
  const admin = await loadAdmin();
  const { data, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (error) throw new Error(error.message);
  const realUsers = (data?.users ?? []).filter((u) => !u.is_anonymous);
  return { needsSetup: realUsers.length === 0 };
});

/** Public only while zero accounts exist: creates the first admin user. */
export const bootstrapAdmin = createServerFn({ method: "POST" })
  .inputValidator((data) =>
    z
      .object({
        email: z.string().email(),
        password: z.string().min(8),
        displayName: z.string().min(1).max(60),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const admin = await loadAdmin();
    const { data: users, error: listError } = await admin.auth.admin.listUsers({
      page: 1,
      perPage: 1000,
    });
    if (listError) throw new Error(listError.message);
    if ((users?.users ?? []).some((u) => !u.is_anonymous)) {
      throw new Error("Setup is already complete");
    }

    const { data: created, error } = await admin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: { display_name: data.displayName },
    });
    if (error) throw new Error(error.message);

    const { error: roleError } = await admin
      .from("user_roles")
      .insert({ user_id: created.user.id, role: "admin" });
    if (roleError) throw new Error(roleError.message);
    return { success: true };
  });

export const listUsers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const admin = await loadAdmin();
    const { data, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    if (error) throw new Error(error.message);
    const { data: roles } = await admin.from("user_roles").select("user_id, role");
    const adminIds = new Set(
      (roles ?? []).filter((r) => r.role === "admin").map((r) => r.user_id),
    );
    return (data?.users ?? [])
      .filter((u) => !u.is_anonymous)
      .map((u) => ({
        id: u.id,
        email: u.email ?? "",
        display_name:
          ((u.user_metadata as { display_name?: string } | null)?.display_name ?? "").trim() ||
          (u.email ?? ""),
        created_at: u.created_at,
        last_sign_in_at: u.last_sign_in_at ?? null,
        disabled: Boolean((u as { banned_until?: string | null }).banned_until),
        is_admin: adminIds.has(u.id),
      }));
  });

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  displayName: z.string().min(1).max(60),
});

export const adminCreateUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => credentialsSchema.parse(data))
  .handler(async ({ context, data }) => {
    await assertAdmin(context);
    const admin = await loadAdmin();
    const { error } = await admin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: { display_name: data.displayName },
    });
    if (error) throw new Error(error.message);
    return { success: true };
  });

export const adminResetPassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z.object({ userId: z.string().uuid(), password: z.string().min(8) }).parse(data),
  )
  .handler(async ({ context, data }) => {
    await assertAdmin(context);
    const admin = await loadAdmin();
    const { error } = await admin.auth.admin.updateUserById(data.userId, {
      password: data.password,
    });
    if (error) throw new Error(error.message);
    return { success: true };
  });

export const adminSetUserDisabled = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z.object({ userId: z.string().uuid(), disabled: z.boolean() }).parse(data),
  )
  .handler(async ({ context, data }) => {
    await assertAdmin(context);
    if (data.userId === context.userId && data.disabled) {
      return { success: false as const, error: "You can't disable your own account" };
    }
    const admin = await loadAdmin();
    // Ban duration: ~100 years when disabling, "none" when re-enabling.
    const { error } = await admin.auth.admin.updateUserById(data.userId, {
      ban_duration: data.disabled ? "876000h" : "none",
    });
    if (error) return { success: false as const, error: error.message };
    return { success: true as const };
  });

export const adminDeleteUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ userId: z.string().uuid() }).parse(data))
  .handler(async ({ context, data }) => {
    await assertAdmin(context);
    if (data.userId === context.userId) {
      return { success: false as const, error: "You can't delete your own account" };
    }
    const admin = await loadAdmin();
    const { error } = await admin.auth.admin.deleteUser(data.userId);
    if (error) return { success: false as const, error: error.message };
    return { success: true as const };
  });
