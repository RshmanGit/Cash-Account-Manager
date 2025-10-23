"use client";

import * as React from "react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAccountsStore, AccountItem } from "@/store/accountsStore";
import { useAuthStore } from "@/store/authStore";
import { useUsersStore } from "@/store/usersStore";
import { MultiSelect } from "@/components/ui/multi-select";
import { toast } from "sonner";

interface Props {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    editing?: AccountItem | null;
}

export function AccountFormModal({ open, onOpenChange, editing }: Props) {
    const { session, isAdmin } = useAuthStore();
    const accessToken = session?.access_token;
    const { create, update } = useAccountsStore();
    const { users, initialize, initialized } = useUsersStore();

    const [title, setTitle] = React.useState("");
    const [description, setDescription] = React.useState<string>("");
    const [submitting, setSubmitting] = React.useState(false);
    const [editorIds, setEditorIds] = React.useState<string[]>([]);
    const [viewerIds, setViewerIds] = React.useState<string[]>([]);
    const [formError, setFormError] = React.useState<string | null>(null);
    const [membersLoading, setMembersLoading] = React.useState(false);

    React.useEffect(() => {
        if (editing) {
            setTitle(editing.title ?? "");
            setDescription(editing.description ?? "");
            // members will be prefetched when opening edit via onOpenChange effect below
        } else {
            setTitle("");
            setDescription("");
            setEditorIds([]);
            setViewerIds([]);
        }
    }, [editing, open]);

    // Load users for selects when modal opens
    React.useEffect(() => {
        if (open && accessToken && !initialized) {
            void initialize(accessToken);
        }
    }, [open, accessToken, initialized, initialize]);

    // When opening in edit mode, fetch current members for prefill
    React.useEffect(() => {
        async function loadMembers() {
            if (!open || !editing || !accessToken) return;
            setMembersLoading(true);
            try {
                const res = await fetch(`/api/accounts/${editing.id}`, {
                    headers: { Authorization: `Bearer ${accessToken}` },
                    cache: "no-store",
                });
                if (res.ok) {
                    const json = (await res.json()) as { members?: { uid: string; type: string }[] };
                    const editors = (json.members ?? []).filter((m) => m.type === "EDITOR").map((m) => m.uid);
                    const viewers = (json.members ?? []).filter((m) => m.type === "VIEWER").map((m) => m.uid);
                    setEditorIds(editors);
                    setViewerIds(viewers);
                }
            } catch {
                // ignore prefill errors
            } finally {
                setMembersLoading(false);
            }
        }
        void loadMembers();
    }, [open, editing, accessToken]);

    function onChangeMulti(setter: (v: string[]) => void) {
        return (e: React.ChangeEvent<HTMLSelectElement>) => {
            const options = Array.from(e.target.selectedOptions).map((o) => o.value);
            setter(options);
        };
    }

    async function onSubmit(e: React.FormEvent) {
        e.preventDefault();
        if (!isAdmin) {
            toast.error("Only admins can perform this action");
            return;
        }
        if (!accessToken) {
            toast.error("Not authenticated");
            return;
        }
        const t = title.trim();
        if (t.length < 3 || t.length > 80) {
            toast.error("Title must be 3-80 characters");
            return;
        }
        // Validate overlap
        const overlap = new Set(editorIds.filter((id) => viewerIds.includes(id)));
        if (overlap.size > 0) {
            setFormError("A user cannot be both EDITOR and VIEWER");
            return;
        }
        setFormError(null);
        setSubmitting(true);
        try {
            if (editing) {
                await update(accessToken, editing.id, { title: t, description: description || null, editors: editorIds, viewers: viewerIds });
                toast.success("Account updated");
            } else {
                await create(accessToken, { title: t, description: description || null, editors: editorIds, viewers: viewerIds });
                toast.success("Account created");
            }
            onOpenChange(false);
        } catch (e) {
            const message = e instanceof Error ? e.message : "Unexpected error";
            toast.error(message);
        } finally {
            setSubmitting(false);
        }
    }

    return (
        <Modal
            open={open}
            onOpenChange={onOpenChange}
            title={editing ? "Edit Account" : "New Account"}
            description={editing ? "Update account details" : "Create a new account"}
            footer={
                <div className="flex gap-2">
                    <Button variant="outline" type="button" onClick={() => onOpenChange(false)} disabled={submitting}>
                        Cancel
                    </Button>
                    <Button type="submit" form="account-form" disabled={submitting}>
                        {submitting ? "Saving..." : "Save"}
                    </Button>
                </div>
            }
        >
            <form id="account-form" className="space-y-4" onSubmit={onSubmit}>
                <div className="space-y-2">
                    <label className="text-sm font-medium">Title</label>
                    <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Account title" required minLength={3} maxLength={80} />
                </div>
                <div className="space-y-2">
                    <label className="text-sm font-medium">Description</label>
                    <Input value={description ?? ""} onChange={(e) => setDescription(e.target.value)} placeholder="Optional description" maxLength={500} />
                </div>
                <div className="space-y-2">
                    <label className="text-sm font-medium">Editors</label>
                    <MultiSelect
                        options={users.map((u) => ({ value: u.id, label: u.email ?? u.id }))}
                        value={editorIds}
                        onChange={setEditorIds}
                        placeholder="Select editors"
                        disabled={membersLoading}
                    />
                </div>
                <div className="space-y-2">
                    <label className="text-sm font-medium">Viewers</label>
                    <MultiSelect
                        options={users.map((u) => ({ value: u.id, label: u.email ?? u.id }))}
                        value={viewerIds}
                        onChange={setViewerIds}
                        placeholder="Select viewers"
                        disabled={membersLoading}
                    />
                </div>
                {formError && <p className="text-sm text-red-600">{formError}</p>}
            </form>
        </Modal>
    );
}


