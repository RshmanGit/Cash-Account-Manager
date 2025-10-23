'use client'

import { useEffect } from 'react'
import { useAuthStore } from '@/store/authStore'
import { useUsersStore } from '@/store/usersStore'

export default function DashboardLayout({
    children,
}: Readonly<{ children: React.ReactNode }>) {
    const { user, loading: authLoading, session } = useAuthStore()
    const { initialize, initialized } = useUsersStore()

    useEffect(() => {
        if (!authLoading && user && session?.access_token && !initialized) {
            void initialize(session.access_token)
        }
    }, [authLoading, user, session?.access_token, initialized, initialize])

    return <>{children}</>
}


