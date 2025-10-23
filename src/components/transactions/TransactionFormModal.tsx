"use client";

import * as React from "react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuthStore } from "@/store/authStore";
import { toast } from "sonner";

export type TransactionRow = {
    id: number;
    created_at: string;
    account_id: number;
    created_by: string;
    amount: number | string;
    balance: number | string;
    title: string;
    description: string | null;
};

interface Props {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    accountId: number;
    editing?: TransactionRow | null;
    onSaved?: () => void;
}

export function TransactionFormModal({ open, onOpenChange, accountId, editing, onSaved }: Props) {
    const { session, isAdmin } = useAuthStore();
    const accessToken = session?.access_token;

    const [title, setTitle] = React.useState("");
    const [description, setDescription] = React.useState("");
    const [type, setType] = React.useState<"DEPOSIT" | "WITHDRAW">("DEPOSIT");
    const [amount, setAmount] = React.useState("");
    const [submitting, setSubmitting] = React.useState(false);

    React.useEffect(() => {
        if (editing) {
            setTitle(editing.title ?? "");
            setDescription(editing.description ?? "");
            const amt = Number(editing.amount);
            setType(amt >= 0 ? "DEPOSIT" : "WITHDRAW");
            setAmount(String(Math.abs(amt)));
        } else {
            setTitle("");
            setDescription("");
            setType("DEPOSIT");
            setAmount("");
        }
    }, [editing, open]);

    async function onSubmit(e: React.FormEvent) {
        e.preventDefault();
        if (!accessToken) {
            toast.error("Not authenticated");
            return;
        }
        const t = title.trim();
        if (t.length < 3 || t.length > 120) {
            toast.error("Title must be 3-120 characters");
            return;
        }
        const amtNum = Number(amount);
        if (!Number.isFinite(amtNum) || amtNum <= 0) {
            toast.error("Enter a valid amount greater than 0");
            return;
        }
        const signed = type === "DEPOSIT" ? amtNum : -amtNum;
        setSubmitting(true);
        try {
            const url = editing
                ? `/api/accounts/${accountId}/transactions/${editing.id}`
                : `/api/accounts/${accountId}/transactions`;
            const method = editing ? "PATCH" : "POST";
            const payload = editing
                ? { title: t, description: description || null, amount: signed }
                : { title: t, description: description || null, amount: signed };
            const res = await fetch(url, {
                method,
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${accessToken}`,
                },
                body: JSON.stringify(payload),
            });
            if (!res.ok) {
                const body = await res.json().catch(() => ({}));
                const message = body?.error || `Request failed with ${res.status}`;
                toast.error(message);
                return;
            }
            toast.success(editing ? "Transaction updated" : "Transaction created");
            onOpenChange(false);
            onSaved?.();
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
            title={editing ? "Edit Transaction" : "Add Transaction"}
            description={editing ? "Update the transaction details" : "Create a new transaction"}
            footer={
                <div className="flex gap-2">
                    <Button variant="outline" type="button" onClick={() => onOpenChange(false)} disabled={submitting}>
                        Cancel
                    </Button>
                    <Button type="submit" form="tx-form" disabled={submitting}>
                        {submitting ? "Saving..." : "Save"}
                    </Button>
                </div>
            }
        >
            <form id="tx-form" className="space-y-4" onSubmit={onSubmit}>
                <div className="space-y-2">
                    <label className="text-sm font-medium">Title</label>
                    <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Transaction title" required minLength={3} maxLength={120} />
                </div>
                <div className="space-y-2">
                    <label className="text-sm font-medium">Description</label>
                    <Input value={description ?? ""} onChange={(e) => setDescription(e.target.value)} placeholder="Optional description" maxLength={500} />
                </div>
                <div className="space-y-2">
                    <label className="text-sm font-medium">Type</label>
                    <div className="inline-flex rounded-md border p-1 bg-muted/40">
                        <button
                            type="button"
                            className={`px-3 py-1.5 text-sm rounded ${type === "DEPOSIT" ? "bg-green-600 text-white" : "hover:bg-green-600/10 text-foreground"}`}
                            onClick={() => setType("DEPOSIT")}
                        >
                            Deposit
                        </button>
                        <button
                            type="button"
                            className={`px-3 py-1.5 text-sm rounded ${type === "WITHDRAW" ? "bg-red-600 text-white" : "hover:bg-red-600/10 text-foreground"}`}
                            onClick={() => setType("WITHDRAW")}
                        >
                            Withdraw
                        </button>
                    </div>
                </div>
                <div className="space-y-2">
                    <label className="text-sm font-medium">Amount</label>
                    <Input value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" inputMode="decimal" />
                    <p className="text-xs text-muted-foreground">Amount will be applied as {type === "DEPOSIT" ? "positive (green)" : "negative (red)"}.</p>
                </div>
            </form>
        </Modal>
    );
}


