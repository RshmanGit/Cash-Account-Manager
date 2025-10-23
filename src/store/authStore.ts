import { create } from "zustand";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";

interface AuthState {
  user: User | null;
  session: Session | null;
  loading: boolean;
  error: string | null;
}

interface AuthActions {
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  checkAuth: () => Promise<void>;
  setUser: (user: User | null) => void;
  setSession: (session: Session | null) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  clearError: () => void;
}

type AuthStore = AuthState & AuthActions;

export const useAuthStore = create<AuthStore>((set, get) => ({
  // Initial state
  user: null,
  session: null,
  loading: true,
  error: null,

  // Actions
  signIn: async (email: string, password: string) => {
    set({ loading: true, error: null });
    toast.loading("Signing in...", { id: "signin" });

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        toast.error("Sign in failed", {
          description: error.message,
          id: "signin",
        });
        set({ error: error.message, loading: false });
        return;
      }

      toast.success("Welcome back!", {
        description: "You have been successfully signed in.",
        id: "signin",
      });
      console.log("Sign in successful:", {
        user: data.user,
        session: data.session,
      });
      set({
        user: data.user,
        session: data.session,
        loading: false,
        error: null,
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "An unexpected error occurred";
      toast.error("Sign in failed", {
        description: errorMessage,
        id: "signin",
      });
      set({
        error: errorMessage,
        loading: false,
      });
    }
  },

  signOut: async () => {
    set({ loading: true, error: null });
    toast.loading("Signing out...", { id: "signout" });

    try {
      const { error } = await supabase.auth.signOut();

      if (error) {
        toast.error("Sign out failed", {
          description: error.message,
          id: "signout",
        });
        set({ error: error.message, loading: false });
        return;
      }

      toast.success("Signed out successfully", {
        description: "You have been signed out.",
        id: "signout",
      });
      set({
        user: null,
        session: null,
        loading: false,
        error: null,
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "An unexpected error occurred";
      toast.error("Sign out failed", {
        description: errorMessage,
        id: "signout",
      });
      set({
        error: errorMessage,
        loading: false,
      });
    }
  },

  checkAuth: async () => {
    set({ loading: true });

    try {
      const {
        data: { session },
        error,
      } = await supabase.auth.getSession();

      if (error) {
        toast.error("Session check failed", {
          description: error.message,
        });
        set({ error: error.message, loading: false });
        return;
      }

      // Only show success toast if there's an existing session
      if (session?.user) {
        toast.success("Session restored", {
          description: "Welcome back!",
        });
      }

      set({
        user: session?.user ?? null,
        session,
        loading: false,
        error: null,
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "An unexpected error occurred";
      toast.error("Session check failed", {
        description: errorMessage,
      });
      set({
        error: errorMessage,
        loading: false,
      });
    }
  },

  setUser: (user: User | null) => {
    console.log("Auth store - Setting user:", user);
    set({ user });
  },
  setSession: (session: Session | null) => set({ session }),
  setLoading: (loading: boolean) => set({ loading }),
  setError: (error: string | null) => set({ error }),
  clearError: () => set({ error: null }),
}));
