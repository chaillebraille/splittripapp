import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { ArrowLeft, Copy, Eye, Link2, Pencil, Plus, Trash2, X } from "lucide-react";
import { deleteGroup, forgetGroup, getGroup, updateGroup } from "@/lib/data/groups";
import { createMember, deleteMember, listMembers, suggestMembers } from "@/lib/data/members";
import {
  createInvite,
  leaveTrip,
  listInvites,
  listShares,
  removeShare,
  revokeInvite,
  updateShareRole,
} from "@/lib/sharing.functions";
import { TripImagePicker } from "@/components/TripImagePicker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { CurrencyPicker } from "@/components/CurrencyPicker";

export const Route = createFileRoute("/groups/$groupId/profile")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Trip profile — SplitTrip" },
      { name: "description", content: "Edit this trip's photo, name, settle currency, members, and sharing." },
      { property: "og:title", content: "Trip profile — SplitTrip" },
      { property: "og:description", content: "Edit this trip's photo, name, settle currency, members, and sharing." },
    ],
  }),
  component: TripProfilePage,
});


function initialFromName(name: string) {
  const trimmed = name.trim();
  if (!trimmed) return "";
  const parts = trimmed.split(/\s+/).filter(Boolean);
  if (parts.length > 1) {
    return ((parts[0] ?? "").charAt(0) + (parts[1] ?? "").charAt(0)).toUpperCase();
  }
  return trimmed.slice(0, 1).toUpperCase();
}

function inviteLink(code: string) {
  return `${window.location.origin}/join/${code}`;
}

function SharingSection({ groupId }: { groupId: string }) {
  const queryClient = useQueryClient();
  const { data: shares = [] } = useQuery({
    queryKey: ["shares", groupId],
    queryFn: () => listShares({ data: { groupId } }),
  });
  const { data: invites = [] } = useQuery({
    queryKey: ["invites", groupId],
    queryFn: () => listInvites({ data: { groupId } }),
  });

  async function refresh() {
    await queryClient.invalidateQueries({ queryKey: ["shares", groupId] });
    await queryClient.invalidateQueries({ queryKey: ["invites", groupId] });
  }

  async function handleCreateInvite(role: "viewer" | "editor") {
    try {
      const invite = await createInvite({ data: { groupId, role } });
      await refresh();
      await navigator.clipboard.writeText(inviteLink(invite.code)).catch(() => {});
      toast.success(`${role === "editor" ? "Edit" : "View"} link created and copied`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not create the link");
    }
  }

  async function handleCopy(code: string) {
    try {
      await navigator.clipboard.writeText(inviteLink(code));
      toast.success("Link copied");
    } catch {
      toast.message(inviteLink(code));
    }
  }

  const activeInvites = invites.filter((i) => !i.revoked_at);

  return (
    <div className="space-y-3 border-t border-border pt-6">
      <Label>Sharing</Label>
      <p className="text-xs text-muted-foreground">
        Share a link to let others see this trip. People with a view link can only look; people
        with an edit link can add and change expenses and the trip photo.
      </p>

      <div className="flex gap-2">
        <Button
          type="button"
          variant="secondary"
          className="flex-1 rounded-xl"
          onClick={() => void handleCreateInvite("viewer")}
        >
          <Eye className="mr-2 h-4 w-4" />
          New view link
        </Button>
        <Button
          type="button"
          variant="secondary"
          className="flex-1 rounded-xl"
          onClick={() => void handleCreateInvite("editor")}
        >
          <Pencil className="mr-2 h-4 w-4" />
          New edit link
        </Button>
      </div>

      {activeInvites.length > 0 && (
        <div className="space-y-2">
          {activeInvites.map((invite) => (
            <div
              key={invite.id}
              className="flex items-center gap-2 rounded-xl bg-card p-3 shadow-sm"
            >
              <Link2 className="h-4 w-4 shrink-0 text-muted-foreground" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-card-foreground">
                  {invite.role === "editor" ? "Edit link" : "View link"}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {invite.uses} joined · {invite.code}
                </p>
              </div>
              <button
                type="button"
                onClick={() => void handleCopy(invite.code)}
                aria-label="Copy invite link"
                className="rounded-full p-1.5 text-muted-foreground hover:bg-accent"
              >
                <Copy className="h-4 w-4" />
              </button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <button
                    type="button"
                    aria-label="Revoke invite link"
                    className="rounded-full p-1.5 text-destructive hover:bg-destructive/10"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Revoke link?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will revoke that link so that it will no longer be possible to use it to
                      join this trip as a {invite.role === "editor" ? "editor" : "viewer"}.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() =>
                        void revokeInvite({ data: { inviteId: invite.id } })
                          .then(refresh)
                          .then(() => toast.success("Link revoked"))
                          .catch((err) =>
                            toast.error(
                              err instanceof Error ? err.message : "Could not revoke the link",
                            ),
                          )
                      }
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      Revoke link
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          ))}
        </div>
      )}

      {shares.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">People with access</p>
          {shares.map((share) => (
            <div
              key={share.id}
              className="flex items-center gap-2 rounded-xl bg-card p-3 shadow-sm"
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-bold text-secondary-foreground">
                {share.label.slice(0, 1).toUpperCase()}
              </span>
              <p className="min-w-0 flex-1 truncate text-sm font-medium text-card-foreground">
                {share.label}
              </p>
              <select
                value={share.role}
                onChange={(e) =>
                  void updateShareRole({
                    data: { shareId: share.id, role: e.target.value as "viewer" | "editor" },
                  })
                    .then(refresh)
                    .catch((err) =>
                      toast.error(err instanceof Error ? err.message : "Could not change the role"),
                    )
                }
                aria-label={`Role for ${share.label}`}
                className="rounded-lg border border-input bg-background px-2 py-1 text-xs text-foreground"
              >
                <option value="viewer">View</option>
                <option value="editor">Edit</option>
              </select>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <button
                    type="button"
                    aria-label={`Remove access for ${share.label}`}
                    className="rounded-full p-1.5 text-destructive hover:bg-destructive/10"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Remove user?</AlertDialogTitle>
                    <AlertDialogDescription>
                      {share.label} will be removed from the list of sharing users and will be
                      required to use a valid share link to rejoin.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() =>
                        void removeShare({ data: { shareId: share.id } })
                          .then(refresh)
                          .then(() => toast.success("Access removed"))
                          .catch((err) =>
                            toast.error(
                              err instanceof Error ? err.message : "Could not remove access",
                            ),
                          )
                      }
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      Remove user
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function TripProfilePage() {
  const { groupId } = Route.useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const fetchGroup = getGroup;
  const fetchMembers = listMembers;
  const fetchSuggestions = suggestMembers;
  const update = updateGroup;
  const addMemberFn = createMember;
  const removeMemberFn = deleteMember;

  const { data: group } = useQuery({
    queryKey: ["group", groupId],
    queryFn: () => fetchGroup({ data: { id: groupId } }),
  });
  const { data: members = [] } = useQuery({
    queryKey: ["members", groupId],
    queryFn: () => fetchMembers({ data: { group_id: groupId } }),
  });
  const myRole = group?.my_role ?? "owner";
  const isOwner = myRole === "owner";
  const canEditPhoto = myRole === "owner" || myRole === "editor";
  const { data: suggestions = [] } = useQuery({
    queryKey: ["member-suggestions"],
    queryFn: fetchSuggestions,
    enabled: isOwner,
  });

  const [name, setName] = useState("");
  const [currency, setCurrency] = useState("EUR");
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [newMemberName, setNewMemberName] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);

  useEffect(() => {
    if (!group) return;
    setName(group.name);
    setCurrency(group.settle_currency);
    setImageUrl(group.image_url ?? null);
  }, [group]);

  async function refreshMembers() {
    await queryClient.invalidateQueries({ queryKey: ["members", groupId] });
    await queryClient.invalidateQueries({ queryKey: ["balances", groupId] });
  }

  async function handleAddMember(memberName: string, initial?: string) {
    const trimmed = memberName.trim();
    if (!trimmed) return;
    if (members.some((m) => m.name.toLowerCase() === trimmed.toLowerCase())) return;
    try {
      await addMemberFn({
        data: {
          group_id: groupId,
          name: trimmed,
          initial: initial?.toUpperCase() || initialFromName(trimmed),
        },
      });
      setNewMemberName("");
      await refreshMembers();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not add member");
    }
  }

  async function handleRemoveMember(id: string) {
    try {
      const result = await removeMemberFn({ data: { id } });
      if (!result.success) {
        toast.error(result.error ?? "Could not remove member");
        return;
      }
      await refreshMembers();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not remove member");
    }
  }

  async function handleDeleteTrip() {
    if (isDeleting) return;
    setIsDeleting(true);
    try {
      await deleteGroup({ data: { id: groupId } });
      await queryClient.invalidateQueries({ queryKey: ["groups"] });
      toast.success("Trip deleted");
      navigate({ to: "/" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not delete the trip");
      setIsDeleting(false);
    }
  }

  async function handleLeaveTrip() {
    if (isLeaving) return;
    setIsLeaving(true);
    try {
      await leaveTrip({ data: { group_id: groupId } });
      await forgetGroup({ data: { id: groupId } });
      await queryClient.invalidateQueries();
      toast.success("Trip removed");
      navigate({ to: "/" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not remove the trip");
      setIsLeaving(false);
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (isSaving) return;
    if (isOwner && !name.trim()) return;
    setIsSaving(true);
    try {
      await update({
        data: isOwner
          ? { id: groupId, name: name.trim(), image_url: imageUrl }
          : { id: groupId, image_url: imageUrl },
      });
      await queryClient.invalidateQueries({ queryKey: ["group", groupId] });
      await queryClient.invalidateQueries({ queryKey: ["groups"] });
      await queryClient.invalidateQueries({ queryKey: ["balances", groupId] });
      toast.success("Trip updated");
      navigate({ to: "/groups/$groupId", params: { groupId } });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save the trip");
    } finally {
      setIsSaving(false);
    }
  }

  const visibleSuggestions = suggestions.filter(
    (s) => !members.some((m) => m.name.toLowerCase() === s.name.toLowerCase()),
  );

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col bg-background">
      <header className="flex items-center gap-3 px-6 pt-8 pb-4">
        <button
          onClick={() => navigate({ to: "/groups/$groupId", params: { groupId } })}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-secondary text-secondary-foreground"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="font-display text-3xl font-bold text-foreground">Trip profile</h1>
      </header>

      <form onSubmit={handleSave} className="flex-1 px-6 pb-28">
        <div className="space-y-6">
          {myRole === "viewer" && (
            <p className="rounded-xl bg-secondary px-4 py-3 text-sm text-secondary-foreground">
              This trip was shared with you as read-only. Only the owner can change its settings.
            </p>
          )}

          <div className="space-y-2">
            <Label>Trip photo</Label>
            <TripImagePicker
              value={imageUrl}
              onChange={canEditPhoto ? setImageUrl : () => {}}
              fallback={name.trim().slice(0, 1).toUpperCase()}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="name">Trip name</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={!isOwner}
              className="rounded-xl"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="currency">Settle currency</Label>
            <CurrencyPicker id="currency" value={currency} onChange={setCurrency} disabled className="py-2.5" title="Settle currency" />
            <p className="text-xs text-muted-foreground">
              The settle currency is fixed once the trip is created and cannot be changed.
            </p>
          </div>

          <div className="space-y-3">
            <Label>Members</Label>
            {members.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {members.map((member) => (
                  <div
                    key={member.id}
                    className="flex items-center gap-2 rounded-full bg-secondary px-3 py-1.5 text-sm font-medium text-secondary-foreground"
                  >
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                      {member.initial || member.name.slice(0, 1).toUpperCase()}
                    </span>
                    {member.name}
                    {isOwner && (
                      <button
                        type="button"
                        onClick={() => handleRemoveMember(member.id)}
                        aria-label={`Remove ${member.name}`}
                        className="ml-1 rounded-full p-0.5 hover:bg-secondary-foreground/10"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}

            {isOwner && (
              <>
                <div className="flex gap-2">
                  <Input
                    value={newMemberName}
                    onChange={(e) => setNewMemberName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        void handleAddMember(newMemberName);
                      }
                    }}
                    placeholder="Add a member"
                    className="rounded-xl"
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => void handleAddMember(newMemberName)}
                    aria-label="Add member"
                    className="shrink-0 rounded-xl"
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>

                {visibleSuggestions.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs text-muted-foreground">Suggested from previous trips</p>
                    <div className="flex flex-wrap gap-2">
                      {visibleSuggestions.map((s) => (
                        <button
                          key={s.name}
                          type="button"
                          onClick={() => void handleAddMember(s.name, s.initial)}
                          className="rounded-full border border-input bg-card px-3 py-1.5 text-sm font-medium text-card-foreground transition-colors hover:bg-accent"
                        >
                          + {s.name}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          {isOwner && <SharingSection groupId={groupId} />}

          {!isOwner && (
            <div className="space-y-2 border-t border-border pt-6">
              <Label className="text-destructive">Danger zone</Label>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={isLeaving}
                    className="w-full rounded-xl border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Remove trip
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Remove this trip?</AlertDialogTitle>
                    <AlertDialogDescription>
                      {group?.name ? `"${group.name}"` : "This trip"} will be removed from your
                      device and you'll lose access to it. The trip itself is not deleted — opening
                      the invite link again restores your access.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => void handleLeaveTrip()}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      Remove trip
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          )}

          {isOwner && (
            <div className="space-y-2 border-t border-border pt-6">
              <Label className="text-destructive">Danger zone</Label>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={isDeleting}
                    className="w-full rounded-xl border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete trip
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete this trip?</AlertDialogTitle>
                    <AlertDialogDescription>
                      {group?.name ? `"${group.name}"` : "This trip"} and all its members and
                      expenses will be permanently removed. This can't be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => void handleDeleteTrip()}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      Delete trip
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          )}
        </div>

        {myRole !== "viewer" && (
          <div className="fixed bottom-0 left-0 right-0 z-10 border-t border-border bg-background/95 p-4 backdrop-blur-sm">
            <div className="mx-auto max-w-md">
              <Button
                type="submit"
                disabled={(isOwner && !name.trim()) || isSaving}
                className="w-full rounded-xl bg-primary py-6 text-base font-semibold text-primary-foreground"
              >
                Save trip
              </Button>
            </div>
          </div>
        )}
      </form>
    </div>
  );
}
