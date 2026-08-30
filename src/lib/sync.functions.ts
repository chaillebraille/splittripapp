import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** One-shot snapshot of everything this device's user can see, used by the offline sync engine. */
export const pullAll = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: groups, error: groupsError } = await context.supabase
      .from("groups")
      .select("id, name, settle_currency, image_url, created_at, created_by")
      .order("created_at", { ascending: false });
    if (groupsError) throw new Error(groupsError.message);

    // The caller's role per trip: owner, or the role granted by a share row.
    const { data: shares, error: sharesError } = await context.supabase
      .from("group_shares")
      .select("group_id, role")
      .eq("user_id", context.userId);
    if (sharesError) throw new Error(sharesError.message);
    const sharedRoles = new Map((shares ?? []).map((s) => [s.group_id, s.role]));

    const groupsWithRole = (groups ?? []).map((g) => ({
      ...g,
      my_role: (g.created_by === context.userId
        ? "owner"
        : (sharedRoles.get(g.id) ?? "viewer")) as "owner" | "editor" | "viewer",
    }));

    const groupIds = groupsWithRole.map((g) => g.id);
    if (groupIds.length === 0) {
      return { groups: groupsWithRole, members: [], expenses: [], splits: [] };
    }

    const { data: members, error: membersError } = await context.supabase
      .from("members")
      .select("id, group_id, name, initial, created_at")
      .in("group_id", groupIds)
      .order("created_at", { ascending: true });
    if (membersError) throw new Error(membersError.message);

    const { data: expenses, error: expensesError } = await context.supabase
      .from("expenses")
      .select(
        "id, group_id, amount, currency, exchange_rate, settle_amount, description, expense_date, payer_id, created_at",
      )
      .in("group_id", groupIds);
    if (expensesError) throw new Error(expensesError.message);

    const expenseIds = (expenses ?? []).map((e) => e.id);
    let splits: { id: string; expense_id: string; member_id: string; amount: number }[] = [];
    if (expenseIds.length > 0) {
      const { data: splitRows, error: splitsError } = await context.supabase
        .from("expense_splits")
        .select("id, expense_id, member_id, amount")
        .in("expense_id", expenseIds);
      if (splitsError) throw new Error(splitsError.message);
      splits = splitRows ?? [];
    }

    return {
      groups: groupsWithRole,
      members: members ?? [],
      expenses: expenses ?? [],
      splits,
    };
  });
