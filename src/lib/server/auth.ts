import { NextResponse } from "next/server";
import { createClient, SupabaseClient, User } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceRoleKey = process.env.SUPABASE_PRIVATE_KEY;

const ADMIN_EMAILS = Object.freeze(
  (process.env.NEXT_PUBLIC_ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)
);

export function isAdminEmail(email?: string | null): boolean {
  return !!email && ADMIN_EMAILS.includes(email.toLowerCase());
}

export function getBearerToken(request: Request): string | undefined {
  const authHeader =
    request.headers.get("authorization") ||
    request.headers.get("Authorization");
  if (!authHeader) return undefined;
  return authHeader.startsWith("Bearer ") ? authHeader.slice(7) : undefined;
}

export function getAnonClient(): SupabaseClient {
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Server is not configured correctly (anon client)");
  }
  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false },
  });
}

export function getAdminClient(): SupabaseClient {
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Server is not configured correctly (service role client)");
  }
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });
}

export async function getUserFromRequest(
  request: Request
): Promise<{ user: User | null; error: string | null }> {
  try {
    const token = getBearerToken(request);
    if (!token) return { user: null, error: "Unauthorized" };

    const supabase = getAnonClient();
    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data.user) return { user: null, error: "Unauthorized" };
    return { user: data.user, error: null };
  } catch (e) {
    return { user: null, error: "Unauthorized" };
  }
}

export async function requireAuth(
  request: Request
): Promise<User | NextResponse> {
  const { user, error } = await getUserFromRequest(request);
  if (error || !user) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401, headers: { "Cache-Control": "no-store" } }
    );
  }
  return user;
}

export async function requireAdmin(
  request: Request
): Promise<User | NextResponse> {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;
  if (!isAdminEmail(auth.email)) {
    return NextResponse.json(
      { error: "Forbidden" },
      { status: 403, headers: { "Cache-Control": "no-store" } }
    );
  }
  return auth;
}
