"use client";

import * as React from "react";
import { useAccountsStore, AccountItem } from "@/store/accountsStore";
import { useAuthStore } from "@/store/authStore";
import { Button } from "@/components/ui/button";
import { Menu, MenuItem } from "@/components/ui/menu";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Pencil, Trash2, MoreVertical } from "lucide-react";

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
                    <Button onClick={onCreate} className="bg-green-600 text-white hover:bg-green-700 touch-manipulation">
                        <span className="hidden sm:inline">New Account</span>
                        <span className="sm:hidden">New</span>
                    </Button>
                )}
            </div>

            {error && <div className="text-sm text-red-600">{error}</div>}

            {/* Desktop Table View */}
            <div className="hidden md:block border rounded-md">
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

            {/* Mobile Card View */}
            <div className="md:hidden space-y-3">
                {loading && (
                    <div className="text-center py-8 text-muted-foreground">
                        Loading...
                    </div>
                )}
                {!loading && items.length === 0 && (
                    <div className="text-center py-8 text-muted-foreground">
                        No accounts found
                    </div>
                )}
                {!loading && items.map((item) => (
                    <div
                        key={item.id}
                        className="border rounded-lg p-4 bg-card hover:bg-muted/40 transition-colors touch-manipulation"
                        onClick={() => router.push(`/dashboard/${item.id}`)}
                    >
                        <div className="flex items-start justify-between gap-3">
                            <div className="flex-1 min-w-0">
                                <h4 className="font-semibold text-base mb-1 truncate">{item.title}</h4>
                                {item.description && (
                                    <p className="text-sm text-muted-foreground mb-2 line-clamp-2">{item.description}</p>
                                )}
                                <p className="text-xs text-muted-foreground">
                                    {new Date(item.created_at).toLocaleString()}
                                </p>
                            </div>
                            {isAdmin && (
                                <div className="flex gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                                    <button
                                        onClick={() => onEdit(item)}
                                        className="p-2 rounded-md hover:bg-blue-50 text-blue-600 hover:text-blue-700 transition-colors touch-manipulation"
                                        aria-label="Edit account"
                                    >
                                        <Pencil className="w-4 h-4" />
                                    </button>
                                    <button
                                        onClick={() => onDelete(item)}
                                        className="p-2 rounded-md hover:bg-red-50 text-red-600 hover:text-red-700 transition-colors touch-manipulation"
                                        aria-label="Delete account"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                ))}
            </div>

            <div className="flex items-center justify-between text-sm flex-wrap gap-2">
                <div className="text-muted-foreground">
                    Page {page} of {totalPages} · {total} total
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" size="sm" disabled={page <= 1 || loading} onClick={() => goto(page - 1)} className="touch-manipulation">
                        Prev
                    </Button>
                    <Button variant="outline" size="sm" disabled={page >= totalPages || loading} onClick={() => goto(page + 1)} className="touch-manipulation">
                        Next
                    </Button>
                </div>
            </div>
        </div>
    );
}


