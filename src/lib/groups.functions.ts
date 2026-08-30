import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const listGroups = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("groups")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const getGroup = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ context, data }) => {
    const { data: group, error } = await context.supabase
      .from("groups")
      .select("*")
      .eq("id", data.id)
      .single();

    if (error) throw new Error(error.message);
    return group;
  });

const createGroupSchema = z.object({
  name: z.string().min(1).max(100),
  settle_currency: z.string().min(1).max(3),
  image_url: z.string().max(400000).nullable().optional(),
});

export const createGroup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => createGroupSchema.parse(data))
  .handler(async ({ context, data }) => {
    const { data: group, error } = await context.supabase
      .from("groups")
      .insert({
        created_by: context.userId,
        name: data.name,
        settle_currency: data.settle_currency.toUpperCase(),
        image_url: data.image_url ?? null,
      })
      .select()
      .single();

    if (error) throw new Error(error.message);
    return group;
  });

export const updateGroup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        id: z.string().uuid(),
        name: z.string().min(1).max(100).optional(),
        settle_currency: z.string().min(1).max(3).optional(),
        image_url: z.string().max(400000).nullable().optional(),
      })
      .parse(data)
  )
  .handler(async ({ context, data }) => {
    const { data: group, error } = await context.supabase
      .from("groups")
      .update({
        ...(data.name ? { name: data.name } : {}),
        ...(data.settle_currency ? { settle_currency: data.settle_currency.toUpperCase() } : {}),
        ...(data.image_url !== undefined ? { image_url: data.image_url } : {}),
      })
      .eq("id", data.id)
      .select()
      .single();

    if (error) throw new Error(error.message);
    return group;
  });

export const deleteGroup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase.from("groups").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { success: true };
  });
