/**
 * Default member name, offline-first.
 *
 * The value is cached per user in localStorage so trip creation works with no
 * network, and mirrored to the cloud profile when possible.
 */
import { getMyProfile, setDefaultMemberName } from "@/lib/profile.functions";

function key(userId: string | null) {
  return `splittrip:member-name:${userId ?? "signed-out"}`;
}

export function readCachedMemberName(userId: string | null): string | null {
  if (typeof localStorage === "undefined") return null;
  return localStorage.getItem(key(userId));
}

function writeCachedMemberName(userId: string | null, name: string) {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(key(userId), name);
}

/** Cached value first; refreshes from the cloud in the background when online. */
export async function loadMemberName(
  userId: string | null,
  fallback: string | null,
): Promise<string> {
  const cached = readCachedMemberName(userId);
  try {
    const profile = await getMyProfile();
    const remote = profile.default_member_name?.trim();
    if (remote) {
      writeCachedMemberName(userId, remote);
      return remote;
    }
    const seeded = cached || profile.display_name || fallback || "";
    if (seeded) {
      writeCachedMemberName(userId, seeded);
      void setDefaultMemberName({ data: { name: seeded } }).catch(() => {});
    }
    return seeded;
  } catch {
    return cached || fallback || "";
  }
}

export async function saveMemberName(userId: string | null, name: string): Promise<void> {
  const trimmed = name.trim();
  if (!trimmed) throw new Error("Pick a member name");
  writeCachedMemberName(userId, trimmed);
  try {
    await setDefaultMemberName({ data: { name: trimmed } });
  } catch {
    // Offline — the cached value is authoritative until the next visit online.
  }
}
