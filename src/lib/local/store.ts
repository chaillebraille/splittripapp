/**
 * Offline-first local store.
 *
 * The whole dataset (trips, members, expenses, splits, pending sync ops and the
 * cached exchange-rate table) lives in a single IndexedDB record. It is loaded
 * into memory once and written back on every mutation, so all reads are
 * instant and work with no network at all.
 */

export type TripRole = "owner" | "editor" | "viewer";

export type LocalGroup = {
  id: string;
  name: string;
  settle_currency: string;
  image_url: string | null;
  created_at: string;
  /** Owner's user id (may be missing on legacy local data). */
  created_by?: string | null;
  /** The signed-in user's role for this trip; undefined is treated as owner. */
  my_role?: TripRole;
};

export type LocalMember = {
  id: string;
  group_id: string;
  name: string;
  initial: string;
  created_at: string;
};

export type LocalSplit = {
  id: string;
  expense_id: string;
  member_id: string;
  amount: number;
};

export type LocalExpense = {
  id: string;
  group_id: string;
  amount: number;
  currency: string;
  exchange_rate: number;
  settle_amount: number;
  description: string;
  expense_date: string;
  payer_id: string;
  created_at: string;
};

export type SyncOp =
  | { id: string; ts: number; kind: "group.create"; payload: LocalGroup }
  | {
      id: string;
      ts: number;
      kind: "group.update";
      payload: { id: string; name?: string; settle_currency?: string; image_url?: string | null };
    }
  | { id: string; ts: number; kind: "group.delete"; payload: { id: string } }
  | { id: string; ts: number; kind: "member.create"; payload: LocalMember }
  | { id: string; ts: number; kind: "member.delete"; payload: { id: string } }
  | {
      id: string;
      ts: number;
      kind: "expense.upsert";
      payload: { expense: LocalExpense; splits: LocalSplit[] };
    }
  | { id: string; ts: number; kind: "expense.delete"; payload: { id: string } };

export type LocalState = {
  groups: LocalGroup[];
  members: LocalMember[];
  expenses: LocalExpense[];
  splits: LocalSplit[];
  outbox: SyncOp[];
  ratesPerEur: Record<string, number> | null;
  ratesFetchedAt: string | null;
  lastSyncedAt: string | null;
};

function emptyState(): LocalState {
  return {
    groups: [],
    members: [],
    expenses: [],
    splits: [],
    outbox: [],
    ratesPerEur: null,
    ratesFetchedAt: null,
    lastSyncedAt: null,
  };
}

const DB_NAME = "splittrip";
const DB_VERSION = 1;
const STORE = "kv";
/** Per-user storage key so two accounts on one device never see each other's data. */
let storageKey = "state:signed-out";
const CHANNEL_NAME = "splittrip-local-state";

let state: LocalState = emptyState();
let readyPromise: Promise<void> | null = null;
const listeners = new Set<() => void>();
const stateChannel =
  typeof window !== "undefined" && typeof BroadcastChannel !== "undefined"
    ? new BroadcastChannel(CHANNEL_NAME)
    : null;

function canUseIdb() {
  return typeof indexedDB !== "undefined";
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function readPersisted(): Promise<LocalState | null> {
  if (!canUseIdb()) return null;
  try {
    const db = await openDb();
    return await new Promise<LocalState | null>((resolve, reject) => {
      const tx = db.transaction(STORE, "readonly");
      const req = tx.objectStore(STORE).get(storageKey);
      req.onsuccess = () => resolve((req.result as LocalState | undefined) ?? null);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return null;
  }
}

let writeQueue: Promise<void> = Promise.resolve();
let refreshPromise: Promise<void> | null = null;

function refreshFromPersistence(): Promise<void> {
  if (!refreshPromise) {
    refreshPromise = (async () => {
      await writeQueue;
      const persisted = await readPersisted();
      if (persisted) {
        state = { ...emptyState(), ...persisted };
        notify();
      }
    })().finally(() => {
      refreshPromise = null;
    });
  }
  return refreshPromise;
}

if (stateChannel) {
  stateChannel.onmessage = () => {
    void refreshFromPersistence();
  };
}

function persist() {
  if (!canUseIdb()) return;
  const snapshot = state;
  writeQueue = writeQueue.then(async () => {
    try {
      const db = await openDb();
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE, "readwrite");
        tx.objectStore(STORE).put(snapshot, storageKey);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
      stateChannel?.postMessage("changed");
    } catch (error) {
      console.error("Failed to persist local data", error);
    }
  });
}

export function ready(): Promise<void> {
  if (!readyPromise) {
    readyPromise = (async () => {
      const persisted = await readPersisted();
      if (persisted) state = { ...emptyState(), ...persisted };
    })();
  }
  return readyPromise;
}

/**
 * Switches the local dataset to another signed-in user (or signed-out).
 * Each account gets its own IndexedDB record so data never leaks across users
 * on a shared device.
 */
export async function switchUser(userId: string | null): Promise<void> {
  const nextKey = `state:${userId ?? "signed-out"}`;
  if (nextKey === storageKey) {
    await ready();
    return;
  }
  await writeQueue;
  storageKey = nextKey;
  state = emptyState();
  readyPromise = null;
  notify();
  await ready();
  notify();
}

export function getState(): LocalState {
  return state;
}

export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function notify() {
  for (const listener of listeners) listener();
}

export function setState(updater: (current: LocalState) => LocalState): LocalState {
  state = updater(state);
  persist();
  notify();
  return state;
}

export function newId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  // Fallback UUID v4.
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export function enqueue(state_: LocalState, op: Omit<SyncOp, "id" | "ts">): LocalState {
  const full = { ...op, id: newId(), ts: Date.now() } as SyncOp;
  return { ...state_, outbox: [...state_.outbox, full] };
}
