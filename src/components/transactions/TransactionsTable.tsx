"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/store/authStore";
import { toast } from "sonner";
import { TransactionFormModal, type TransactionRow } from "./TransactionFormModal";

interface Props {
    accountId: number;
}

export function TransactionsTable({ accountId }: Props) {
    const { session, isAdmin, user } = useAuthStore();
    const accessToken = session?.access_token;

    const [items, setItems] = React.useState<TransactionRow[]>([]);
    const [page, setPage] = React.useState(1);
    const perPage = 25;
    const [total, setTotal] = React.useState(0);
    const [loading, setLoading] = React.useState(false);
    const [error, setError] = React.useState<string | null>(null);
    const [hasMore, setHasMore] = React.useState(true);

    const [open, setOpen] = React.useState(false);
    const [editing, setEditing] = React.useState<TransactionRow | null>(null);

    const [canCreate, setCanCreate] = React.useState<boolean>(isAdmin);

    // Determine editor membership for this account (client-side convenience; server enforces anyway)
    React.useEffect(() => {
        let cancelled = false;
        async function checkMembership() {
            if (!accessToken || !user) return;
            if (isAdmin) {
                setCanCreate(true);
                return;
            }
            try {
                const res = await fetch(`/api/accounts/${accountId}`, {
                    headers: { Authorization: `Bearer ${accessToken}` },
                    cache: "no-store",
                });
                if (!res.ok) {
                    setCanCreate(isAdmin);
                    return;
                }
                const json = (await res.json()) as { members?: { uid: string; type: string }[] };
                const members = json.members ?? [];
                const isEditorMember = members.some((m) => m.uid === user.id && m.type === "EDITOR");
                if (!cancelled) setCanCreate(isEditorMember || isAdmin);
            } catch {
                if (!cancelled) setCanCreate(isAdmin);
            }
        }
        void checkMembership();
        return () => {
            cancelled = true;
        };
    }, [accessToken, user, isAdmin, accountId]);

    const sentinelRef = React.useRef<HTMLDivElement | null>(null);

    const fetchPage = React.useCallback(
        async (n: number) => {
            if (!accessToken) return;
            setLoading(true);
            setError(null);
            try {
                const res = await fetch(`/api/accounts/${accountId}/transactions?page=${n}&perPage=${perPage}`, {
                    headers: { Authorization: `Bearer ${accessToken}` },
                    cache: "no-store",
                });
                if (!res.ok) {
                    const body = await res.json().catch(() => ({}));
                    const message = body?.error || `Request failed with ${res.status}`;
                    setError(message);
                    setLoading(false);
                    return;
                }
                const json = (await res.json()) as { data: TransactionRow[]; total: number };
                setItems((prev) => (n === 1 ? json.data : [...prev, ...json.data]));
                setTotal(json.total ?? 0);
                setHasMore((json.data ?? []).length === perPage);
                setPage(n);
            } catch (e) {
                const message = e instanceof Error ? e.message : "Unexpected error";
                setError(message);
            } finally {
                setLoading(false);
            }
        },
        [accessToken, accountId]
    );

    React.useEffect(() => {
        if (accessToken) void fetchPage(1);
    }, [accessToken, fetchPage]);

    React.useEffect(() => {
        if (!sentinelRef.current) return;
        const observer = new IntersectionObserver(
            (entries) => {
                const first = entries[0];
                if (first.isIntersecting && hasMore && !loading) {
                    void fetchPage(page + 1);
                }
            },
            { root: null, rootMargin: "0px", threshold: 1.0 }
        );
        observer.observe(sentinelRef.current);
        return () => observer.disconnect();
    }, [page, hasMore, loading, fetchPage]);

    const latestId = items[0]?.id;

    async function onDelete(row: TransactionRow) {
        if (!isAdmin || !accessToken) return;
        const confirm = window.confirm(`Delete transaction "${row.title}"? This cannot be undone.`);
        if (!confirm) return;
        const res = await fetch(`/api/accounts/${accountId}/transactions/${row.id}`, {
            method: "DELETE",
            headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (!res.ok) {
            const body = await res.json().catch(() => ({}));
            const message = body?.error || `Request failed with ${res.status}`;
            toast.error(message);
            return;
        }
        toast.success("Transaction deleted");
        // refresh first page
        void fetchPage(1);
    }

    function formatAmount(n: number | string) {
        const v = Number(n);
        const abs = Math.abs(v);
        const isDeposit = v >= 0;
        return (
            <span className={isDeposit ? "text-green-600" : "text-red-600"}>
                {abs.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
        );
    }

    return (
        <div className="space-y-3">
            <div className="flex items-center justify-between">
                <h3 className="font-semibold">Transactions</h3>
                {canCreate && (
                    <Button onClick={() => { setEditing(null); setOpen(true); }} className="bg-green-600 text-white hover:bg-green-700">
                        Add transaction
                    </Button>
                )}
            </div>

            {error && <div className="text-sm text-red-600">{error}</div>}

            <div className="border rounded-md overflow-x-auto">
                <table className="w-full text-sm">
                    <thead className="bg-muted/50">
                        <tr>
                            <th className="text-left px-3 py-2">Date</th>
                            <th className="text-left px-3 py-2">Title</th>
                            <th className="text-left px-3 py-2">Description</th>
                            <th className="text-right px-3 py-2">Amount</th>
                            <th className="text-right px-3 py-2">Balance</th>
                            <th className="text-right px-3 py-2">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading && items.length === 0 && (
                            <tr>
                                <td colSpan={6} className="px-3 py-6 text-center text-muted-foreground">Loading...</td>
                            </tr>
                        )}
                        {!loading && items.length === 0 && (
                            <tr>
                                <td colSpan={6} className="px-3 py-6 text-center text-muted-foreground">No transactions found</td>
                            </tr>
                        )}
                        {items.map((row, idx) => (
                            <tr key={row.id} className="hover:bg-muted/40">
                                <td className="px-3 py-2">{new Date(row.transaction_date_time).toLocaleString(undefined, { timeZone: 'Asia/Kolkata' })}</td>
                                <td className="px-3 py-2">{row.title}</td>
                                <td className="px-3 py-2 text-muted-foreground">{row.description ?? "—"}</td>
                                <td className="px-3 py-2 text-right">{formatAmount(row.amount)}</td>
                                <td className="px-3 py-2 text-right">{Number(row.balance).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                <td className="px-3 py-2 text-right">
                                    {isAdmin && latestId === row.id ? (
                                        <div className="flex justify-end gap-2">
                                            <Button size="sm" variant="outline" onClick={() => { setEditing(row); setOpen(true); }}>Edit</Button>
                                            <Button size="sm" variant="destructive" onClick={() => onDelete(row)}>Delete</Button>
                                        </div>
                                    ) : null}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <div ref={sentinelRef} />

            <TransactionFormModal
                open={open}
                onOpenChange={(o) => { setOpen(o); if (!o) void fetchPage(1); }}
                accountId={accountId}
                editing={editing ?? undefined}
                onSaved={() => void fetchPage(1)}
            />
        </div>
    );
}


