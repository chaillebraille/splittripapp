import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const listMembers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ group_id: z.string().uuid() }).parse(data))
  .handler(async ({ context, data }) => {
    const { data: members, error } = await context.supabase
      .from("members")
      .select("*")
      .eq("group_id", data.group_id)
      .order("created_at", { ascending: true });

    if (error) throw new Error(error.message);
    return members ?? [];
  });

const createMemberSchema = z.object({
  group_id: z.string().uuid(),
  name: z.string().min(1).max(100),
  initial: z.string().max(2).optional(),
});

export const createMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => createMemberSchema.parse(data))
  .handler(async ({ context, data }) => {
    const initial =
      data.initial?.trim() || data.name.trim().slice(0, 1).toUpperCase();

    const { data: member, error } = await context.supabase
      .from("members")
      .insert({
        group_id: data.group_id,
        name: data.name.trim(),
        initial,
      })
      .select()
      .single();

    if (error) throw new Error(error.message);
    return member;
  });

export const deleteMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase.from("members").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { success: true };
  });

export const suggestMembers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("members")
      .select("name, initial, groups!inner(created_by)")
      .eq("groups.created_by", context.userId);

    if (error) throw new Error(error.message);

    const seen = new Map<string, { name: string; initial: string }>();
    for (const row of data ?? []) {
      const key = row.name.toLowerCase();
      if (!seen.has(key)) {
        seen.set(key, { name: row.name, initial: row.initial ?? "" });
      }
    }
    return Array.from(seen.values());
  });
