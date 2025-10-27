"use client";

import { use, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/store/authStore";
import { useUsersStore } from "@/store/usersStore";
import { useAccountsStore, type AccountItem } from "@/store/accountsStore";
import { AccountFormModal } from "@/components/accounts/AccountFormModal";
import { toast } from "sonner";
import { Pencil, Trash2 } from "lucide-react";
import { TransactionsTable } from "@/components/transactions/TransactionsTable";

interface Props {
    params: Promise<{ accountId: string }>;
}

type MemberRow = { uid: string; type: "EDITOR" | "VIEWER" };

export default function AccountDetailPage({ params }: Props) {
    const { accountId } = use(params);
    const router = useRouter();

    const { user, session, loading: authLoading, isAdmin, signOut } = useAuthStore();
    const accessToken = session?.access_token;
    const { users, initialize: initUsers, initialized: usersInitialized } = useUsersStore();
    const { remove, setEditing } = useAccountsStore();

    const [open, setOpen] = useState(false);
    const [account, setAccount] = useState<AccountItem | null>(null);
    const [members, setMembers] = useState<MemberRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Auth guard
    useEffect(() => {
        if (!authLoading && !user) {
            toast.error("Authentication required", { description: "Please sign in." });
            router.replace("/");
        }
    }, [authLoading, user, router]);

    // Load users for mapping emails when modal opens
    useEffect(() => {
        if (open && accessToken && !usersInitialized) {
            void initUsers(accessToken);
        }
    }, [open, accessToken, usersInitialized, initUsers]);

    // Ensure users are loaded for avatar tooltips on page load as well
    useEffect(() => {
        if (accessToken && !usersInitialized) {
            void initUsers(accessToken);
        }
    }, [accessToken, usersInitialized, initUsers]);

    async function fetchAccountDetails() {
        if (!accessToken) return;
        setLoading(true);
        setError(null);
        try {
            const res = await fetch(`/api/accounts/${accountId}`, {
                headers: { Authorization: `Bearer ${accessToken}` },
                cache: "no-store",
            });
            if (!res.ok) {
                const body = await res.json().catch(() => ({}));
                const message = body?.error || `Request failed with ${res.status}`;
                setError(message);
                setAccount(null);
                setMembers([]);
                return;
            }
            const json = (await res.json()) as { data: AccountItem; members: MemberRow[] };
            setAccount(json.data);
            setMembers(json.members ?? []);
        } catch (e) {
            const message = e instanceof Error ? e.message : "Unexpected error";
            setError(message);
            setAccount(null);
            setMembers([]);
        } finally {
            setLoading(false);
        }
    }

    // Initial fetch and when deps change
    useEffect(() => {
        if (accessToken && accountId) void fetchAccountDetails();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [accessToken, accountId]);

    const editors = useMemo(() => members.filter((m) => m.type === "EDITOR").map((m) => m.uid), [members]);
    const viewers = useMemo(() => members.filter((m) => m.type === "VIEWER").map((m) => m.uid), [members]);

    const emailById = useMemo(() => {
        const map = new Map(users.map((u) => [u.id, u.email ?? u.id] as const));
        return (id: string) => map.get(id) ?? id;
    }, [users]);

    function getInitials(email: string): string {
        const source = email && email.includes("@") ? email.split("@")[0] : email;
        const cleaned = source.replace(/[^a-zA-Z]/g, " ").trim();
        const parts = cleaned.split(/\s+/).filter(Boolean);
        const first = parts[0]?.[0] ?? source[0] ?? "?";
        const second = parts[1]?.[0] ?? source[1] ?? "";
        return (first + second).toUpperCase();
    }

    function AvatarGroup({ ids }: { ids: string[] }) {
        const maxVisible = 5;
        const visible = ids.slice(0, maxVisible);
        const hidden = ids.slice(maxVisible);
        const extra = Math.max(0, ids.length - visible.length);
        return (
            <div className="flex items-center gap-2 flex-wrap">
                {visible.map((id) => {
                    const email = emailById(id);
                    const initials = getInitials(email);
                    return (
                        <div key={id} className="relative group">
                            <div className="w-8 h-8 rounded-full bg-muted text-foreground/90 border flex items-center justify-center text-xs font-medium uppercase">
                                {initials}
                            </div>
                            <div className="pointer-events-none absolute -top-2 left-1/2 -translate-x-1/2 -translate-y-full whitespace-nowrap rounded bg-popover text-popover-foreground px-2 py-1 text-xs shadow z-50 opacity-0 group-hover:opacity-100 transition-opacity">
                                {email}
                            </div>
                        </div>
                    );
                })}
                {extra > 0 && (
                    <div className="relative group">
                        <div className="w-8 h-8 rounded-full bg-muted-foreground/10 text-muted-foreground border flex items-center justify-center text-xs font-medium">
                            +{extra}
                        </div>
                        <div className="pointer-events-none absolute -top-2 left-1/2 -translate-x-1/2 -translate-y-full rounded bg-popover text-popover-foreground px-2 py-2 text-xs shadow z-50 opacity-0 group-hover:opacity-100 transition-opacity max-h-60 overflow-auto whitespace-normal text-left min-w-[12rem]">
                            <ul className="list-disc pl-4 space-y-0.5">
                                {hidden.map((id) => (
                                    <li key={id}>{emailById(id)}</li>
                                ))}
                            </ul>
                        </div>
                    </div>
                )}
            </div>
        );
    }

    const onBack = () => router.push("/dashboard");
    const onSignOut = async () => {
        await signOut();
        router.push("/");
    };

    const onEdit = () => {
        if (!account) return;
        setEditing(account);
        setOpen(true);
    };

    const onDelete = async () => {
        if (!isAdmin || !accessToken || !account) return;
        const confirm = window.confirm(`Delete account "${account.title}"? This cannot be undone.`);
        if (!confirm) return;
        await remove(accessToken, account.id);
        toast.success("Account deleted");
        router.push("/dashboard");
    };

    if (authLoading || loading) {
        return (
            <div className="flex min-h-screen items-center justify-center">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
                    <p className="mt-2 text-muted-foreground">Loading...</p>
                </div>
            </div>
        );
    }

    if (!user) return null;

    if (error) {
        return (
            <div className="min-h-screen bg-background">
                <div className="container mx-auto px-4 py-8">
                    <div className="mb-6 flex items-center justify-between">
                        <Button variant="outline" onClick={onBack}>Back to Dashboard</Button>
                        <Button variant="outline" onClick={onSignOut}>Sign Out</Button>
                    </div>
                    <Card>
                        <CardHeader>
                            <CardTitle>Error</CardTitle>
                            <CardDescription>{error}</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <Button onClick={onBack}>Go Back</Button>
                        </CardContent>
                    </Card>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-background">
            <div className="container mx-auto px-4 py-8">
                <div className="mb-6 flex items-center justify-between">
                    <Button variant="outline" onClick={onBack}>Back to Dashboard</Button>
                    <Button variant="outline" onClick={onSignOut}>Sign Out</Button>
                </div>

                <Card className="mb-6">
                    <CardHeader className="flex flex-row items-start justify-between space-y-0">
                        <div>
                            <CardTitle className="text-2xl">{account?.title}</CardTitle>
                            <CardDescription>
                                {account?.description ? account.description : "No description"}
                            </CardDescription>
                        </div>
                        {isAdmin && (
                            <div className="flex gap-2">
                                <div className="relative group">
                                    <Button
                                        variant="ghost"
                                        size="icon-sm"
                                        aria-label="Edit account"
                                        onClick={onEdit}
                                        className="text-primary hover:bg-primary/10"
                                    >
                                        <Pencil className="size-4" />
                                    </Button>
                                    <div className="pointer-events-none absolute -top-2 left-1/2 -translate-x-1/2 -translate-y-full whitespace-nowrap rounded bg-popover text-popover-foreground px-2 py-1 text-xs shadow z-50 opacity-0 group-hover:opacity-100 transition-opacity">
                                        Edit
                                    </div>
                                </div>
                                <div className="relative group">
                                    <Button
                                        variant="ghost"
                                        size="icon-sm"
                                        aria-label="Delete account"
                                        onClick={onDelete}
                                        className="text-destructive hover:bg-destructive/10"
                                    >
                                        <Trash2 className="size-4" />
                                    </Button>
                                    <div className="pointer-events-none absolute -top-2 left-1/2 -translate-x-1/2 -translate-y-full whitespace-nowrap rounded bg-popover text-popover-foreground px-2 py-1 text-xs shadow z-50 opacity-0 group-hover:opacity-100 transition-opacity">
                                        Delete
                                    </div>
                                </div>
                            </div>
                        )}
                    </CardHeader>
                    <CardContent className="space-y-2">
                        <div className="text-sm text-muted-foreground">
                            Created at: {account ? new Date(account.created_at).toLocaleString(undefined, { timeZone: 'Asia/Kolkata' }) : "—"}
                        </div>
                    </CardContent>
                </Card>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-base">Editors</CardTitle>
                            <CardDescription>Users with edit permissions</CardDescription>
                        </CardHeader>
                        <CardContent>
                            {editors.length === 0 ? (
                                <p className="text-sm text-muted-foreground">None</p>
                            ) : (
                                <AvatarGroup ids={editors} />
                            )}
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle className="text-base">Viewers</CardTitle>
                            <CardDescription>Users with view-only access</CardDescription>
                        </CardHeader>
                        <CardContent>
                            {viewers.length === 0 ? (
                                <p className="text-sm text-muted-foreground">None</p>
                            ) : (
                                <AvatarGroup ids={viewers} />
                            )}
                        </CardContent>
                    </Card>
                </div>
            </div>
            <AccountFormModal open={open} onOpenChange={(o) => { if (!o) { setEditing(null); setOpen(o); void fetchAccountDetails(); } else { setOpen(o); } }} editing={account ?? undefined} />
            {account && (
                <div className="container mx-auto px-4 pb-8">
                    <div className="mt-6">
                        <TransactionsTable accountId={account.id} />
                    </div>
                </div>
            )}
        </div>
    );
}
