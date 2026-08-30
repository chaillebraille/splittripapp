/**
 * Opportunistic cloud sync.
 *
 * Every mutation is written locally first and appended to an outbox. Whenever
 * the device is online (and signed in) we replay the outbox against the cloud
 * and then pull a fresh snapshot back down. Nothing here is required for the
 * app to work — offline it simply keeps queueing.
 */
import { getState, ready, setState, subscribe, type SyncOp } from "./store";
import { createGroup, deleteGroup, updateGroup } from "@/lib/groups.functions";
import { createMember, deleteMember } from "@/lib/members.functions";
import { deleteExpense, upsertExpense } from "@/lib/expenses.functions";
import { pullAll } from "@/lib/sync.functions";

export type SyncStatus = {
  syncing: boolean;
  pending: number;
  lastSyncedAt: string | null;
  online: boolean;
  error: string | null;
};

let syncing = false;
let error: string | null = null;
let queued = false;
let enabled = false;
const MAX_OP_ATTEMPTS = 3;
const failureCounts = new Map<string, number>();

const statusListeners = new Set<() => void>();

function notifyStatus() {
  for (const listener of statusListeners) listener();
}

export function subscribeStatus(listener: () => void): () => void {
  statusListeners.add(listener);
  const unsubscribeStore = subscribe(listener);
  return () => {
    statusListeners.delete(listener);
    unsubscribeStore();
  };
}

let cachedStatus: SyncStatus = {
  syncing: false,
  pending: 0,
  lastSyncedAt: null,
  online: true,
  error: null,
};

export function getStatus(): SyncStatus {
  const state = getState();
  const online = typeof navigator === "undefined" ? true : navigator.onLine;
  if (
    cachedStatus.syncing !== syncing ||
    cachedStatus.pending !== state.outbox.length ||
    cachedStatus.lastSyncedAt !== state.lastSyncedAt ||
    cachedStatus.online !== online ||
    cachedStatus.error !== error
  ) {
    cachedStatus = {
      syncing,
      pending: state.outbox.length,
      lastSyncedAt: state.lastSyncedAt,
      online,
      error,
    };
  }
  return cachedStatus;
}

async function applyOp(op: SyncOp): Promise<void> {
  switch (op.kind) {
    case "group.create":
      await createGroup({
        data: {
          id: op.payload.id,
          name: op.payload.name,
          settle_currency: op.payload.settle_currency,
          image_url: op.payload.image_url,
        },
      });
      return;
    case "group.update":
      await updateGroup({ data: op.payload });
      return;
    case "group.delete":
      await deleteGroup({ data: op.payload });
      return;
    case "member.create":
      await createMember({
        data: {
          id: op.payload.id,
          group_id: op.payload.group_id,
          name: op.payload.name,
          initial: op.payload.initial,
        },
      });
      return;
    case "member.delete":
      await deleteMember({ data: op.payload });
      return;
    case "expense.upsert":
      await upsertExpense({
        data: {
          ...op.payload.expense,
          splits: op.payload.splits.map((split) => ({
            id: split.id,
            member_id: split.member_id,
            amount: split.amount,
          })),
        },
      });
      return;
    case "expense.delete":
      await deleteExpense({ data: op.payload });
      return;
  }
}

/** Runs a full sync cycle. Safe to call often; it no-ops while offline or busy. */
export async function syncNow(): Promise<boolean> {
  if (!enabled || syncing) return false;
  if (typeof navigator !== "undefined" && navigator.onLine === false) return false;

  await ready();
  syncing = true;
  error = null;
  notifyStatus();

  let changed = false;
  try {
    // 1. Replay pending local mutations, oldest first. A single bad op must not
    //    block the whole queue forever: retry it a few times, then drop it.
    let guard = 0;
    while (getState().outbox.length > 0 && guard < 500) {
      guard += 1;
      const op = getState().outbox[0]!;
      try {
        await applyOp(op);
        failureCounts.delete(op.id);
      } catch (err) {
        if (typeof navigator !== "undefined" && navigator.onLine === false) throw err;
        const attempts = (failureCounts.get(op.id) ?? 0) + 1;
        failureCounts.set(op.id, attempts);
        error = err instanceof Error ? err.message : "Sync failed";
        if (attempts < MAX_OP_ATTEMPTS) {
          // Leave it queued and stop this cycle; a later cycle retries it.
          throw err;
        }
        console.warn("Dropping sync operation after repeated failures", op.kind, error);
        failureCounts.delete(op.id);
      }
      setState((s) => ({ ...s, outbox: s.outbox.filter((o) => o.id !== op.id) }));
    }

    // 2. Pull the cloud snapshot back down (safe: the outbox is empty now).
    const snapshot = await pullAll();

    setState((s) => ({
      ...s,
      groups: snapshot.groups.map((g) => ({
        id: g.id,
        name: g.name,
        settle_currency: g.settle_currency,
        image_url: g.image_url ?? null,
        created_at: g.created_at,
      })),
      members: snapshot.members.map((m) => ({
        id: m.id,
        group_id: m.group_id,
        name: m.name,
        initial: m.initial ?? "",
        created_at: m.created_at,
      })),
      expenses: snapshot.expenses.map((e) => ({
        id: e.id,
        group_id: e.group_id,
        amount: Number(e.amount),
        currency: e.currency,
        exchange_rate: Number(e.exchange_rate),
        settle_amount: Number(e.settle_amount ?? Number(e.amount) * Number(e.exchange_rate)),
        description: e.description ?? "",
        expense_date: e.expense_date,
        payer_id: e.payer_id as string,
        created_at: e.created_at,
      })),
      splits: snapshot.splits.map((sp) => ({
        id: sp.id,
        expense_id: sp.expense_id,
        member_id: sp.member_id,
        amount: Number(sp.amount),
      })),
      lastSyncedAt: new Date().toISOString(),
    }));
    changed = true;
  } catch (err) {
    error = err instanceof Error ? err.message : "Sync failed";
  } finally {
    syncing = false;
    notifyStatus();
  }

  if (queued) {
    queued = false;
    void syncNow();
  }
  return changed;
}

let debounceTimer: ReturnType<typeof setTimeout> | null = null;

/** Asks for a sync soon; coalesces bursts of mutations. */
export function requestSync() {
  if (!enabled) return;
  if (syncing) {
    queued = true;
    return;
  }
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    debounceTimer = null;
    void syncNow();
  }, 800);
}

/** Enabled once an auth session exists, so sync calls are never made unauthenticated. */
export function setSyncEnabled(value: boolean) {
  enabled = value;
  notifyStatus();
}

export function isSyncEnabled() {
  return enabled;
}
