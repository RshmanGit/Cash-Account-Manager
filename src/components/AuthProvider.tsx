'use client'

import { useEffect } from 'react'
import { useAuthStore } from '@/store/authStore'
import { supabase } from '@/lib/supabase'
import type { User, Session } from '@supabase/supabase-js'

interface AuthProviderProps {
    children: React.ReactNode
}

export function AuthProvider({ children }: AuthProviderProps) {
    const { setUser, setSession, setLoading, checkAuth } = useAuthStore()

    useEffect(() => {
        // Check initial auth state
        checkAuth()

        // Listen for auth state changes
        const {
            data: { subscription },
        } = supabase.auth.onAuthStateChange(async (event, session) => {
            console.log("Auth state change:", { event, session, user: session?.user });
            console.log("Setting user to:", session?.user);
            setSession(session)
            setUser(session?.user ?? null)
            setLoading(false)
        })

        return () => subscription.unsubscribe()
    }, [setUser, setSession, setLoading, checkAuth])

    return <>{children}</>
}
