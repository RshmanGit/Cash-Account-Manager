'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/store/authStore'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { toast } from 'sonner'
import { useUsersStore } from '@/store/usersStore'
import { AccountsTable } from '@/components/accounts/AccountsTable'
import { AccountFormModal } from '@/components/accounts/AccountFormModal'
import { useAccountsStore } from '@/store/accountsStore'

export default function DashboardPage() {
    const { user, loading, signOut, isAdmin } = useAuthStore()
    const router = useRouter()
    const { users, loading: usersLoading, error: usersError } = useUsersStore()
    const { editing, setEditing } = useAccountsStore()
    const [open, setOpen] = useState(false)

    // Redirect if not authenticated
    useEffect(() => {
        console.log("Dashboard page - Auth state:", { user, loading });
        if (!loading && !user) {
            console.log("No user found, redirecting to login...");
            toast.error("Authentication required", {
                description: "Please sign in to access the dashboard.",
            });
            router.replace('/')
        }
    }, [user, loading, router])

    // Show welcome message when user first loads dashboard
    useEffect(() => {
        if (user && !loading) {
            toast.success("Welcome to your dashboard!", {
                description: `Hello, ${user.email}!`,
            });
        }
    }, [user, loading])

    const handleSignOut = async () => {
        await signOut()
        router.push('/')
    }

    if (loading) {
        return (
            <div className="flex min-h-screen items-center justify-center">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
                    <p className="mt-2 text-muted-foreground">Loading...</p>
                </div>
            </div>
        )
    }

    if (!user) {
        return null // Will redirect via useEffect
    }

    return (
        <div className="min-h-screen bg-background">
            <div className="container mx-auto px-4 py-8">
                <div className="flex justify-between items-center mb-8">
                    <div>
                        <h1 className="text-3xl font-bold">Dashboard
                            {isAdmin && (
                                <span className="ml-2 inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                                    Admin
                                </span>
                            )}
                        </h1>
                        <p className="text-muted-foreground">
                            Welcome back, {user.email}
                        </p>
                    </div>
                    <Button onClick={handleSignOut} variant="outline">
                        Sign Out
                    </Button>
                </div>

                <div className="grid gap-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>Accounts</CardTitle>
                            <CardDescription>Manage and view your accounts</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <AccountsTable onCreate={() => setOpen(true)} onEdit={(item) => { setEditing(item); setOpen(true); }} />
                        </CardContent>
                    </Card>
                </div>
            </div>
            <AccountFormModal open={open} onOpenChange={(o) => { if (!o) setEditing(null); setOpen(o); }} editing={editing ?? undefined} />
        </div>
    )
}
