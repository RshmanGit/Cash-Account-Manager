import { create } from "zustand";

export interface AccountItem {
  id: number;
  created_at: string;
  title: string;
  description: string | null;
  created_by: string;
}

interface AccountsState {
  items: AccountItem[];
  page: number;
  perPage: number;
  total: number;
  loading: boolean;
  error: string | null;
  editing: AccountItem | null;
}

interface AccountsActions {
  fetch: (accessToken?: string, page?: number) => Promise<void>;
  create: (
    accessToken: string,
    payload: {
      title: string;
      description?: string | null;
      editors?: string[];
      viewers?: string[];
    }
  ) => Promise<void>;
  update: (
    accessToken: string,
    id: number,
    payload: {
      title?: string;
      description?: string | null;
      editors?: string[];
      viewers?: string[];
    }
  ) => Promise<void>;
  remove: (accessToken: string, id: number) => Promise<void>;
  setPage: (n: number) => void;
  setEditing: (item: AccountItem | null) => void;
  reset: () => void;
}

type AccountsStore = AccountsState & AccountsActions;

export const useAccountsStore = create<AccountsStore>((set, get) => ({
  items: [],
  page: 1,
  perPage: 25,
  total: 0,
  loading: false,
  error: null,
  editing: null,

  setPage: (n: number) => set({ page: Math.max(1, n) }),
  setEditing: (item: AccountItem | null) => set({ editing: item }),

  reset: () =>
    set({
      items: [],
      page: 1,
      perPage: 25,
      total: 0,
      loading: false,
      error: null,
      editing: null,
    }),

  fetch: async (accessToken?: string, page?: number) => {
    const current = get();
    if (!accessToken) return;
    const nextPage = page ?? current.page;
    set({ loading: true, error: null });
    try {
      const params = new URLSearchParams({
        page: String(nextPage),
        perPage: String(current.perPage),
        sort: "title",
        order: "asc",
      });
      const response = await fetch(`/api/accounts?${params.toString()}`, {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        cache: "no-store",
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        const message = body?.error || `Request failed with ${response.status}`;
        set({ loading: false, error: message, items: [], total: 0 });
        return;
      }
      const { data, total } = (await response.json()) as {
        data: AccountItem[];
        total: number;
      };
      set({
        items: data ?? [],
        total: total ?? 0,
        page: nextPage,
        loading: false,
        error: null,
      });
    } catch (e) {
      const message = e instanceof Error ? e.message : "Unexpected error";
      set({ loading: false, error: message });
    }
  },

  create: async (
    accessToken: string,
    payload: {
      title: string;
      description?: string | null;
      editors?: string[];
      viewers?: string[];
    }
  ) => {
    set({ loading: true, error: null });
    try {
      const response = await fetch(`/api/accounts`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        const message = body?.error || `Request failed with ${response.status}`;
        set({ loading: false, error: message });
        return;
      }
      // Refresh first page after create
      await get().fetch(accessToken, 1);
    } catch (e) {
      const message = e instanceof Error ? e.message : "Unexpected error";
      set({ loading: false, error: message });
    }
  },

  update: async (
    accessToken: string,
    id: number,
    payload: {
      title?: string;
      description?: string | null;
      editors?: string[];
      viewers?: string[];
    }
  ) => {
    set({ loading: true, error: null });
    try {
      const response = await fetch(`/api/accounts/${id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        const message = body?.error || `Request failed with ${response.status}`;
        set({ loading: false, error: message });
        return;
      }
      await get().fetch(accessToken);
    } catch (e) {
      const message = e instanceof Error ? e.message : "Unexpected error";
      set({ loading: false, error: message });
    }
  },

  remove: async (accessToken: string, id: number) => {
    set({ loading: true, error: null });
    try {
      const response = await fetch(`/api/accounts/${id}`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        const message = body?.error || `Request failed with ${response.status}`;
        set({ loading: false, error: message });
        return;
      }
      await get().fetch(accessToken);
    } catch (e) {
      const message = e instanceof Error ? e.message : "Unexpected error";
      set({ loading: false, error: message });
    }
  },
}));
