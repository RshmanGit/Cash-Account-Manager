"use client";

import * as React from "react";
import { useAccountsStore, AccountItem } from "@/store/accountsStore";
import { useAuthStore } from "@/store/authStore";
import { Button } from "@/components/ui/button";
import { Menu, MenuItem } from "@/components/ui/menu";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

interface Props {
    onCreate: () => void;
    onEdit: (item: AccountItem) => void;
}

export function AccountsTable({ onCreate, onEdit }: Props) {
    const router = useRouter();
    const { session, isAdmin } = useAuthStore();
    const accessToken = session?.access_token;
    const { items, page, perPage, total, loading, error, fetch, remove, setPage } = useAccountsStore();

    React.useEffect(() => {
        if (accessToken) fetch(accessToken, 1);
    }, [accessToken]);

    const totalPages = Math.max(1, Math.ceil(total / perPage));

    function goto(n: number) {
        if (!accessToken) return;
        setPage(n);
        fetch(accessToken, n);
    }

    async function onDelete(item: AccountItem) {
        if (!isAdmin || !accessToken) return;
        const confirm = window.confirm(`Delete account "${item.title}"? This cannot be undone.`);
        if (!confirm) return;
        await remove(accessToken, item.id);
        toast.success("Account deleted");
    }

    return (
        <div className="space-y-3">
            <div className="flex items-center justify-between">
                <h3 className="font-semibold">Accounts</h3>
                {isAdmin && (
                    <Button onClick={onCreate} className="bg-green-600 text-white hover:bg-green-700">
                        New Account
                    </Button>
                )}
            </div>

            {error && <div className="text-sm text-red-600">{error}</div>}
            <div className="border rounded-md">
                <table className="w-full text-sm">
                    <thead className="bg-muted/50">
                        <tr>
                            <th className="text-left px-3 py-2">Title</th>
                            <th className="text-left px-3 py-2">Description</th>
                            <th className="text-left px-3 py-2">Created At</th>
                            <th className="text-right px-3 py-2">{isAdmin ? "Actions" : ""}</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading && (
                            <tr>
                                <td colSpan={4} className="px-3 py-6 text-center text-muted-foreground">
                                    Loading...
                                </td>
                            </tr>
                        )}
                        {!loading && items.length === 0 && (
                            <tr>
                                <td colSpan={4} className="px-3 py-6 text-center text-muted-foreground">
                                    No accounts found
                                </td>
                            </tr>
                        )}
                        {!loading &&
                            items.map((item) => (
                                <tr key={item.id} className="hover:bg-muted/40 cursor-pointer" onClick={() => router.push(`/dashboard/${item.id}`)}>
                                    <td className="px-3 py-2">{item.title}</td>
                                    <td className="px-3 py-2 text-muted-foreground">{item.description ?? "—"}</td>
                                    <td className="px-3 py-2">{new Date(item.created_at).toLocaleString()}</td>
                                    <td className="px-3 py-2 text-right" onClick={(e) => e.stopPropagation()}>
                                        {isAdmin && (
                                            <Menu trigger={<span>⋯</span>}>
                                                <MenuItem onClick={() => onEdit(item)}>Edit</MenuItem>
                                                <MenuItem className="text-red-600" onClick={() => onDelete(item)}>
                                                    Delete
                                                </MenuItem>
                                            </Menu>
                                        )}
                                    </td>
                                </tr>
                            ))}
                    </tbody>
                </table>
            </div>

            <div className="flex items-center justify-between text-sm">
                <div>
                    Page {page} of {totalPages} · {total} total
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" size="sm" disabled={page <= 1 || loading} onClick={() => goto(page - 1)}>
                        Prev
                    </Button>
                    <Button variant="outline" size="sm" disabled={page >= totalPages || loading} onClick={() => goto(page + 1)}>
                        Next
                    </Button>
                </div>
            </div>
        </div>
    );
}


