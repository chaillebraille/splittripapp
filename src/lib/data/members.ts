import { enqueue, getState, newId, ready, setState, type LocalMember } from "@/lib/local/store";
import { requestSync } from "@/lib/local/sync";

export type Member = LocalMember;

export async function listMembers({ data }: { data: { group_id: string } }): Promise<Member[]> {
  await ready();
  return getState()
    .members.filter((m) => m.group_id === data.group_id)
    .sort((a, b) => a.created_at.localeCompare(b.created_at));
}

export async function createMember({
  data,
}: {
  data: { group_id: string; name: string; initial?: string };
}): Promise<Member> {
  await ready();
  const member: Member = {
    id: newId(),
    group_id: data.group_id,
    name: data.name.trim(),
    initial: data.initial?.trim().toUpperCase() || data.name.trim().slice(0, 1).toUpperCase(),
    created_at: new Date().toISOString(),
  };
  setState((s) =>
    enqueue({ ...s, members: [...s.members, member] }, { kind: "member.create", payload: member }),
  );
  requestSync();
  return member;
}

export async function deleteMember({ data }: { data: { id: string } }) {
  await ready();
  const state = getState();
  const isPayer = state.expenses.some((e) => e.payer_id === data.id);
  const inSplit = state.splits.some((s) => s.member_id === data.id);
  if (isPayer || inSplit) {
    return {
      success: false as const,
      error:
        "This member is tied to existing expenses and can't be removed. Remove or reassign those expenses first.",
    };
  }

  setState((s) =>
    enqueue(
      { ...s, members: s.members.filter((m) => m.id !== data.id) },
      { kind: "member.delete", payload: { id: data.id } },
    ),
  );
  requestSync();
  return { success: true as const, error: null };
}

export async function suggestMembers(): Promise<{ name: string; initial: string }[]> {
  await ready();
  const seen = new Map<string, { name: string; initial: string }>();
  for (const member of getState().members) {
    const key = member.name.toLowerCase();
    if (!seen.has(key)) seen.set(key, { name: member.name, initial: member.initial ?? "" });
  }
  return Array.from(seen.values());
}
