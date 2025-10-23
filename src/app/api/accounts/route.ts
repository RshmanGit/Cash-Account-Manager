import { NextRequest, NextResponse } from "next/server";
import { getAdminClient, requireAdmin, requireAuth } from "@/lib/server/auth";

type AccountRow = {
  id: number;
  created_at: string;
  title: string;
  description: string | null;
  created_by: string;
};

function parsePaging(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const page = Math.max(1, Number(searchParams.get("page") ?? "1") || 1);
  const perPageRaw = Number(searchParams.get("perPage") ?? "25") || 25;
  const perPage = Math.min(100, Math.max(1, perPageRaw));
  const sort = (searchParams.get("sort") ?? "title").toString();
  const order =
    (searchParams.get("order") ?? "asc").toLowerCase() === "desc"
      ? "desc"
      : "asc";
  return { page, perPage, sort, order } as const;
}

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  const isAdmin =
    !!auth.email &&
    (process.env.NEXT_PUBLIC_ADMIN_EMAILS ?? "")
      .toLowerCase()
      .split(",")
      .map((e) => e.trim())
      .includes(auth.email.toLowerCase());

  const { page, perPage, sort, order } = parsePaging(request);
  const from = (page - 1) * perPage;
  const to = from + perPage - 1;

  const admin = getAdminClient();

  try {
    let accountIds: number[] | null = null;

    if (!isAdmin) {
      // Fetch member account ids for the user
      const { data: memberRows, error: memberError } = await admin
        .from("account-member")
        .select("account_id")
        .eq("uid", auth.id);

      if (memberError) {
        return NextResponse.json(
          { error: memberError.message },
          { status: 500, headers: { "Cache-Control": "no-store" } }
        );
      }
      accountIds = (memberRows ?? []).map((r: any) => r.account_id);
      if (accountIds.length === 0) {
        return NextResponse.json({ data: [], page, perPage, total: 0 });
      }
    }

    // Build base query
    let query = admin
      .from("account")
      .select("id, created_at, title, description, created_by", {
        count: "exact",
      })
      .order(sort, { ascending: order === "asc" });

    if (accountIds) {
      query = query.in("id", accountIds);
    }

    const { data, error, count } = await query.range(from, to);
    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500, headers: { "Cache-Control": "no-store" } }
      );
    }

    return NextResponse.json({
      data: (data ?? []) as AccountRow[],
      page,
      perPage,
      total: count ?? 0,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unexpected error";
    return NextResponse.json(
      { error: message },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}

export async function POST(request: NextRequest) {
  const adminUser = await requireAdmin(request);
  if (adminUser instanceof NextResponse) return adminUser;

  const admin = getAdminClient();

  try {
    const body = await request.json().catch(() => ({} as any));
    const title = String(body?.title ?? "").trim();
    const description =
      body?.description == null ? null : String(body.description);

    if (!title || title.length < 3 || title.length > 80) {
      return NextResponse.json(
        { error: "Title must be 3-80 characters" },
        { status: 400, headers: { "Cache-Control": "no-store" } }
      );
    }

    const payload = {
      title,
      description,
      created_by: adminUser.id,
    };

    const { data, error } = await admin
      .from("account")
      .insert(payload)
      .select("id, created_at, title, description, created_by")
      .single();

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500, headers: { "Cache-Control": "no-store" } }
      );
    }

    return NextResponse.json({ data });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unexpected error";
    return NextResponse.json(
      { error: message },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}
