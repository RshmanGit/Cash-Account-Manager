"use client";

import * as React from "react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAccountsStore, AccountItem } from "@/store/accountsStore";
import { useAuthStore } from "@/store/authStore";
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

    const [title, setTitle] = React.useState("");
    const [description, setDescription] = React.useState<string>("");
    const [submitting, setSubmitting] = React.useState(false);

    React.useEffect(() => {
        if (editing) {
            setTitle(editing.title ?? "");
            setDescription(editing.description ?? "");
        } else {
            setTitle("");
            setDescription("");
        }
    }, [editing, open]);

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
        setSubmitting(true);
        try {
            if (editing) {
                await update(accessToken, editing.id, { title: t, description: description || null });
                toast.success("Account updated");
            } else {
                await create(accessToken, { title: t, description: description || null });
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
            </form>
        </Modal>
    );
}


