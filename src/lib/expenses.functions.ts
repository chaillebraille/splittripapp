import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const splitSchema = z.object({
  member_id: z.string().uuid(),
  amount: z.number().nonnegative(),
});

const createExpenseSchema = z.object({
  group_id: z.string().uuid(),
  amount: z.number().positive(),
  currency: z.string().length(3).toUpperCase(),
  exchange_rate: z.number().positive(),
  description: z.string().min(1).max(200),
  expense_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  payer_id: z.string().uuid(),
  splits: z.array(splitSchema).min(1),
});

export const listExpenses = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ group_id: z.string().uuid() }).parse(data))
  .handler(async ({ context, data }) => {
    const { data: expenses, error } = await context.supabase
      .from("expenses")
      .select("*, expense_splits(*), payer:members!expenses_payer_id_fkey(*)")
      .eq("group_id", data.group_id)
      .order("expense_date", { ascending: false })
      .order("created_at", { ascending: false });

    if (error) throw new Error(error.message);
    return expenses ?? [];
  });

export const getExpense = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ context, data }) => {
    const { data: expense, error } = await context.supabase
      .from("expenses")
      .select("*, expense_splits(*), payer:members!expenses_payer_id_fkey(*)")
      .eq("id", data.id)
      .single();

    if (error) throw new Error(error.message);
    return expense;
  });

export const createExpense = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => createExpenseSchema.parse(data))
  .handler(async ({ context, data }) => {
    const { data: expense, error: expenseError } = await context.supabase
      .from("expenses")
      .insert({
        group_id: data.group_id,
        amount: data.amount,
        currency: data.currency,
        exchange_rate: data.exchange_rate,
        description: data.description,
        expense_date: data.expense_date,
        payer_id: data.payer_id,
        created_by: context.userId,
      })
      .select()
      .single();

    if (expenseError) throw new Error(expenseError.message);

    const { error: splitsError } = await context.supabase.from("expense_splits").insert(
      data.splits.map((split) => ({
        expense_id: expense.id,
        member_id: split.member_id,
        amount: split.amount,
      }))
    );

    if (splitsError) throw new Error(splitsError.message);

    return expense;
  });

const updateExpenseSchema = createExpenseSchema.partial().extend({
  id: z.string().uuid(),
  splits: z.array(splitSchema).min(1).optional(),
});

export const updateExpense = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => updateExpenseSchema.parse(data))
  .handler(async ({ context, data }) => {
    const { id, splits, ...updates } = data;

    const { data: expense, error: expenseError } = await context.supabase
      .from("expenses")
      .update({
        ...(updates.amount !== undefined ? { amount: updates.amount } : {}),
        ...(updates.currency !== undefined ? { currency: updates.currency } : {}),
        ...(updates.exchange_rate !== undefined ? { exchange_rate: updates.exchange_rate } : {}),
        ...(updates.description !== undefined ? { description: updates.description } : {}),
        ...(updates.expense_date !== undefined ? { expense_date: updates.expense_date } : {}),
        ...(updates.payer_id !== undefined ? { payer_id: updates.payer_id } : {}),
      })
      .eq("id", id)
      .select()
      .single();

    if (expenseError) throw new Error(expenseError.message);

    if (splits) {
      const { error: deleteError } = await context.supabase
        .from("expense_splits")
        .delete()
        .eq("expense_id", id);
      if (deleteError) throw new Error(deleteError.message);

      const { error: insertError } = await context.supabase.from("expense_splits").insert(
        splits.map((split) => ({
          expense_id: id,
          member_id: split.member_id,
          amount: split.amount,
        }))
      );
      if (insertError) throw new Error(insertError.message);
    }

    return expense;
  });

export const deleteExpense = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase.from("expenses").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { success: true };
  });

const upsertExpenseSchema = z.object({
  id: z.string().uuid(),
  group_id: z.string().uuid(),
  amount: z.number().positive(),
  currency: z.string().length(3).toUpperCase(),
  exchange_rate: z.number().positive(),
  settle_amount: z.number(),
  description: z.string().min(1).max(200),
  expense_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  payer_id: z.string().uuid(),
  splits: z.array(splitSchema.extend({ id: z.string().uuid() })).min(1),
});

/** Used by the offline sync engine: writes an expense and its splits exactly as stored locally. */
export const upsertExpense = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => upsertExpenseSchema.parse(data))
  .handler(async ({ context, data }) => {
    // settle_amount is a generated column in the database.
    const { splits, settle_amount: _settleAmount, ...expense } = data;

    const { error: expenseError } = await context.supabase
      .from("expenses")
      .upsert({ ...expense, created_by: context.userId }, { onConflict: "id" });
    if (expenseError) throw new Error(expenseError.message);

    const { error: deleteError } = await context.supabase
      .from("expense_splits")
      .delete()
      .eq("expense_id", data.id);
    if (deleteError) throw new Error(deleteError.message);

    const { error: insertError } = await context.supabase.from("expense_splits").insert(
      splits.map((split) => ({
        id: split.id,
        expense_id: data.id,
        member_id: split.member_id,
        amount: split.amount,
      }))
    );
    if (insertError) throw new Error(insertError.message);

    return { success: true };
  });
