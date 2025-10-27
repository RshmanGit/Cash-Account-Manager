import { NextRequest, NextResponse } from "next/server";
import { getAdminClient, requireAuth, isAdminEmail } from "@/lib/server/auth";

type TransactionRow = {
  id: number;
  transaction_date_time: string;
  account_id: number;
  created_by: string;
  amount: string | number;
  balance: string | number;
  title: string;
  description: string | null;
};

function parsePaging(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const page = Math.max(1, Number(searchParams.get("page") ?? "1") || 1);
  const perPageRaw = Number(searchParams.get("perPage") ?? "25") || 25;
  const perPage = Math.min(100, Math.max(1, perPageRaw));
  return { page, perPage } as const;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await requireAuth(request);
  if (user instanceof NextResponse) return user;

  const admin = getAdminClient();
  const { id } = await params;
  const idParam = (id ?? "").trim();
  if (!/^\d+$/.test(idParam)) {
    return NextResponse.json(
      { error: "Invalid id" },
      { status: 400, headers: { "Cache-Control": "no-store" } }
    );
  }

  const isAdmin = isAdminEmail(user.email);
  if (!isAdmin) {
    const { data: memberRows, error: memberError } = await admin
      .from("account-member")
      .select("uid")
      .eq("account_id", idParam)
      .eq("uid", user.id)
      .limit(1);
    if (memberError)
      return NextResponse.json(
        { error: memberError.message },
        { status: 500, headers: { "Cache-Control": "no-store" } }
      );
    if (!memberRows || memberRows.length === 0) {
      return NextResponse.json(
        { error: "Forbidden" },
        { status: 403, headers: { "Cache-Control": "no-store" } }
      );
    }
  }

  const { page, perPage } = parsePaging(request);
  const from = (page - 1) * perPage;
  const to = from + perPage - 1;

  const { data, error, count } = await admin
    .from("transaction")
    .select(
      "id, transaction_date_time, account_id, created_by, amount, balance, title, description",
      { count: "exact" }
    )
    .eq("account_id", idParam)
    .order("transaction_date_time", { ascending: false })
    .order("id", { ascending: false })
    .range(from, to);

  if (error)
    return NextResponse.json(
      { error: error.message },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );

  return NextResponse.json({
    data: (data ?? []) as TransactionRow[],
    page,
    perPage,
    total: count ?? 0,
  });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await requireAuth(request);
  if (user instanceof NextResponse) return user;

  const admin = getAdminClient();
  const { id } = await params;
  const idParam = (id ?? "").trim();
  if (!/^\d+$/.test(idParam)) {
    return NextResponse.json(
      { error: "Invalid id" },
      { status: 400, headers: { "Cache-Control": "no-store" } }
    );
  }

  const isAdmin = isAdminEmail(user.email);
  if (!isAdmin) {
    const { data: memberRows, error: memberError } = await admin
      .from("account-member")
      .select("uid")
      .eq("account_id", idParam)
      .eq("uid", user.id)
      .eq("type", "EDITOR")
      .limit(1);
    if (memberError)
      return NextResponse.json(
        { error: memberError.message },
        { status: 500, headers: { "Cache-Control": "no-store" } }
      );
    if (!memberRows || memberRows.length === 0) {
      return NextResponse.json(
        { error: "Forbidden" },
        { status: 403, headers: { "Cache-Control": "no-store" } }
      );
    }
  }

  try {
    const body = await request.json().catch(() => ({} as any));
    const title = String(body?.title ?? "").trim();
    const description =
      body?.description == null ? null : String(body.description);
    const amountRaw = Number(body?.amount);
    const rawDate = body?.transaction_date_time as unknown;
    if (!title || title.length < 3 || title.length > 120)
      return NextResponse.json(
        { error: "Title must be 3-120 characters" },
        { status: 400, headers: { "Cache-Control": "no-store" } }
      );
    if (!Number.isFinite(amountRaw))
      return NextResponse.json(
        { error: "Amount must be a valid number" },
        { status: 400, headers: { "Cache-Control": "no-store" } }
      );

    // Parse/resolve transaction_date_time (IST default)
    const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
    function isIsoWithZone(v: unknown): v is string {
      return typeof v === "string" && /[zZ]|[+-]\d{2}:?\d{2}$/.test(v);
    }
    function isNaiveLocal(v: unknown): v is string {
      return typeof v === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(v);
    }
    function istLocalToUtcIso(local: string): string {
      const [datePart, timePart] = local.split("T");
      const [y, m, d] = datePart.split("-").map(Number);
      const [hh, mm] = timePart.split(":").map(Number);
      const ist = new Date(Date.UTC(y, m - 1, d, hh, mm));
      const utc = new Date(ist.getTime() - IST_OFFSET_MS);
      return utc.toISOString();
    }
    function nowIstUtcIso(): string {
      const now = new Date();
      const utc = new Date(now.getTime());
      return utc.toISOString();
    }

    let txDateIso: string;
    if (isIsoWithZone(rawDate)) {
      txDateIso = new Date(String(rawDate)).toISOString();
    } else if (isNaiveLocal(rawDate)) {
      txDateIso = istLocalToUtcIso(String(rawDate));
    } else if (rawDate == null) {
      // default: now, but DB default already applies; we set explicitly
      txDateIso = nowIstUtcIso();
    } else {
      return NextResponse.json(
        { error: "Invalid transaction_date_time format" },
        { status: 400, headers: { "Cache-Control": "no-store" } }
      );
    }

    // Compute new balance based on latest transaction by time
    const { data: latest, error: latestError } = await admin
      .from("transaction")
      .select("id,balance,transaction_date_time")
      .eq("account_id", idParam)
      .order("transaction_date_time", { ascending: false })
      .order("id", { ascending: false })
      .limit(1)
      .single();
    if (latestError && latestError.code !== "PGRST116") {
      // PGRST116: No rows found
      return NextResponse.json(
        { error: latestError.message },
        { status: 500, headers: { "Cache-Control": "no-store" } }
      );
    }
    const prevBalance = Number(latest?.balance ?? 0) || 0;
    const newBalance = prevBalance + amountRaw;
    if (!Number.isFinite(newBalance))
      return NextResponse.json(
        { error: "Computed balance is invalid" },
        { status: 400, headers: { "Cache-Control": "no-store" } }
      );

    // Enforce: cannot create with transaction_date_time earlier than latest
    if (latest && latest.transaction_date_time) {
      const latestTime = new Date(latest.transaction_date_time).getTime();
      const newTime = new Date(txDateIso).getTime();
      if (newTime < latestTime) {
        return NextResponse.json(
          {
            error:
              "Cannot create back-dated transaction; please use a later date/time",
          },
          { status: 400, headers: { "Cache-Control": "no-store" } }
        );
      }
    }

    const insertPayload = {
      account_id: Number(idParam),
      created_by: user.id,
      amount: amountRaw,
      balance: newBalance,
      title,
      description,
      transaction_date_time: txDateIso,
    };

    const { data, error } = await admin
      .from("transaction")
      .insert(insertPayload)
      .select(
        "id, transaction_date_time, account_id, created_by, amount, balance, title, description"
      )
      .single();

    if (error)
      return NextResponse.json(
        { error: error.message },
        { status: 500, headers: { "Cache-Control": "no-store" } }
      );

    return NextResponse.json({ data });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unexpected error";
    return NextResponse.json(
      { error: message },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}
