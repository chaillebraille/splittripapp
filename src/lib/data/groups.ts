import { enqueue, getState, newId, ready, setState, type LocalGroup } from "@/lib/local/store";
import { requestSync } from "@/lib/local/sync";

export type Group = LocalGroup;

export async function listGroups(): Promise<Group[]> {
  await ready();
  return [...getState().groups].sort((a, b) => b.created_at.localeCompare(a.created_at));
}

export async function getGroup({ data }: { data: { id: string } }): Promise<Group | null> {
  await ready();
  return getState().groups.find((g) => g.id === data.id) ?? null;
}

export async function createGroup({
  data,
}: {
  data: { name: string; settle_currency: string; image_url?: string | null };
}): Promise<Group> {
  await ready();
  const group: Group = {
    id: newId(),
    name: data.name.trim(),
    settle_currency: data.settle_currency.toUpperCase(),
    image_url: data.image_url ?? null,
    created_at: new Date().toISOString(),
  };
  setState((s) => enqueue({ ...s, groups: [group, ...s.groups] }, { kind: "group.create", payload: group }));
  requestSync();
  return group;
}

export async function updateGroup({
  data,
}: {
  data: { id: string; name?: string; settle_currency?: string; image_url?: string | null };
}): Promise<Group> {
  await ready();
  const patch = {
    ...(data.name !== undefined ? { name: data.name.trim() } : {}),
    ...(data.settle_currency !== undefined
      ? { settle_currency: data.settle_currency.toUpperCase() }
      : {}),
    ...(data.image_url !== undefined ? { image_url: data.image_url } : {}),
  };
  const next = setState((s) =>
    enqueue(
      { ...s, groups: s.groups.map((g) => (g.id === data.id ? { ...g, ...patch } : g)) },
      { kind: "group.update", payload: { id: data.id, ...patch } },
    ),
  );
  requestSync();
  return next.groups.find((g) => g.id === data.id)!;
}

export async function deleteGroup({ data }: { data: { id: string } }) {
  await ready();
  setState((s) => {
    const expenseIds = s.expenses.filter((e) => e.group_id === data.id).map((e) => e.id);
    return enqueue(
      {
        ...s,
        groups: s.groups.filter((g) => g.id !== data.id),
        members: s.members.filter((m) => m.group_id !== data.id),
        expenses: s.expenses.filter((e) => e.group_id !== data.id),
        splits: s.splits.filter((sp) => !expenseIds.includes(sp.expense_id)),
      },
      { kind: "group.delete", payload: { id: data.id } },
    );
  });
  requestSync();
  return { success: true };
}

/** Drops a shared trip from this device without asking the cloud to delete it. */
export async function forgetGroup({ data }: { data: { id: string } }) {
  await ready();
  setState((s) => {
    const expenseIds = s.expenses.filter((e) => e.group_id === data.id).map((e) => e.id);
    return {
      ...s,
      groups: s.groups.filter((g) => g.id !== data.id),
      members: s.members.filter((m) => m.group_id !== data.id),
      expenses: s.expenses.filter((e) => e.group_id !== data.id),
      splits: s.splits.filter((sp) => !expenseIds.includes(sp.expense_id)),
    };
  });
  return { success: true };
}
