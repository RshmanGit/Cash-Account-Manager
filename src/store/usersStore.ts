import { create } from "zustand";

export interface PublicUserInfo {
  id: string;
  email: string | null;
}

interface UsersState {
  users: PublicUserInfo[];
  loading: boolean;
  error: string | null;
  initialized: boolean;
}

interface UsersActions {
  initialize: (accessToken?: string) => Promise<void>;
  reset: () => void;
}

type UsersStore = UsersState & UsersActions;

export const useUsersStore = create<UsersStore>((set, get) => ({
  users: [],
  loading: false,
  error: null,
  initialized: false,

  initialize: async (accessToken?: string) => {
    const { initialized, loading } = get();
    if (initialized || loading) return;

    // Wait until we have a token; caller should pass it when auth is ready
    if (!accessToken) return;

    set({ loading: true, error: null });
    try {
      const response = await fetch("/api/users", {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        },
        cache: "no-store",
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        const message = body?.error || `Request failed with ${response.status}`;
        set({ error: message, loading: false, initialized: true, users: [] });
        return;
      }

      const data = (await response.json()) as { users: PublicUserInfo[] };
      set({
        users: data.users ?? [],
        loading: false,
        error: null,
        initialized: true,
      });
    } catch (e) {
      const message = e instanceof Error ? e.message : "Unexpected error";
      set({ error: message, loading: false, initialized: true, users: [] });
    }
  },

  reset: () =>
    set({ users: [], loading: false, error: null, initialized: false }),
}));
