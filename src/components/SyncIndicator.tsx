import { useEffect, useState, useSyncExternalStore } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { CloudOff, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-provider";
import { getStatus, setSyncEnabled, subscribeStatus, syncNow } from "@/lib/local/sync";
import { ready } from "@/lib/local/store";
import { refreshRates } from "@/lib/data/rates";

const MANUAL_SYNC_COOLDOWN_MS = 10_000;

const serverStatus = {
  syncing: false,
  pending: 0,
  lastSyncedAt: null,
  online: true,
  error: null,
} as const;

export function useSyncStatus() {
  return useSyncExternalStore(subscribeStatus, getStatus, () => serverStatus);
}

/** Boots the local store, keeps the cloud in sync opportunistically, and shows offline state. */
export function SyncIndicator() {
  const { userId } = useAuth();
  const queryClient = useQueryClient();
  const status = useSyncStatus();
  const [lastManualSync, setLastManualSync] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    void ready().then(() => {
      if (!cancelled) queryClient.invalidateQueries();
    });
    return () => {
      cancelled = true;
    };
  }, [queryClient]);

  useEffect(() => {
    if (!userId) return;
    setSyncEnabled(true);

    async function run() {
      const changed = await syncNow();
      if (changed) queryClient.invalidateQueries();
      void refreshRates();
    }

    void run();

    const onOnline = () => void run();
    const onVisible = () => {
      if (document.visibilityState === "visible") void run();
    };
    window.addEventListener("online", onOnline);
    document.addEventListener("visibilitychange", onVisible);
    const interval = setInterval(() => void run(), 60_000);

    return () => {
      window.removeEventListener("online", onOnline);
      document.removeEventListener("visibilitychange", onVisible);
      clearInterval(interval);
    };
  }, [userId, queryClient]);

  if (status.online && status.pending === 0) return null;

  const canRetry =
    status.online &&
    !status.syncing &&
    (lastManualSync === null || Date.now() - lastManualSync >= MANUAL_SYNC_COOLDOWN_MS);

  async function handleRetry() {
    if (!canRetry) {
      const remaining = lastManualSync
        ? Math.ceil((MANUAL_SYNC_COOLDOWN_MS - (Date.now() - lastManualSync)) / 1000)
        : 0;
      toast.info(`Please wait ${remaining} second${remaining === 1 ? "" : "s"} before retrying.`);
      return;
    }
    setLastManualSync(Date.now());
    const changed = await syncNow();
    if (changed) queryClient.invalidateQueries();
    if (getStatus().pending === 0) {
      toast.success("Sync complete");
    } else if (getStatus().error) {
      toast.error(`Sync issue: ${getStatus().error}`);
    } else {
      toast.info("Syncing…");
    }
  }

  const label = status.online
    ? status.error && !status.syncing
      ? `Sync issue · ${status.pending} pending`
      : `${status.pending} change${status.pending === 1 ? "" : "s"} to sync`
    : status.pending > 0
      ? `Offline · ${status.pending} saved on device`
      : "Offline";

  return (
    <div className="fixed left-1/2 top-3 z-50 -translate-x-1/2">
      <button
        type="button"
        onClick={handleRetry}
        disabled={!canRetry}
        aria-label={`${label}. Click to retry sync.`}
        className="flex items-center gap-2 rounded-full bg-secondary/95 px-3 py-1.5 text-xs font-medium text-secondary-foreground shadow-sm backdrop-blur transition-opacity hover:opacity-90 disabled:opacity-60"
      >
        {status.online ? (
          <RefreshCw className={`h-3.5 w-3.5 ${status.syncing ? "animate-spin" : ""}`} />
        ) : (
          <CloudOff className="h-3.5 w-3.5" />
        )}
        {label}
      </button>
    </div>
  );
}
