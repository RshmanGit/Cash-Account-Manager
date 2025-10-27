import { NextRequest, NextResponse } from "next/server";
import { getAdminClient, requireAdmin } from "@/lib/server/auth";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; txId: string }> }
) {
  const adminUser = await requireAdmin(request);
  if (adminUser instanceof NextResponse) return adminUser;

  const admin = getAdminClient();
  const { id, txId } = await params;
  const idParam = (id ?? "").trim();
  const txIdParam = (txId ?? "").trim();
  if (!/^\d+$/.test(idParam) || !/^\d+$/.test(txIdParam)) {
    return NextResponse.json(
      { error: "Invalid id" },
      { status: 400, headers: { "Cache-Control": "no-store" } }
    );
  }

  // Ensure target is latest transaction for this account by transaction_date_time desc, id desc
  const { data: latest, error: latestErr } = await admin
    .from("transaction")
    .select("id, amount, transaction_date_time")
    .eq("account_id", idParam)
    .order("transaction_date_time", { ascending: false })
    .order("id", { ascending: false })
    .limit(1)
    .single();
  if (latestErr)
    return NextResponse.json(
      { error: latestErr.message },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  if (!latest || String(latest.id) !== txIdParam) {
    return NextResponse.json(
      { error: "Only latest transaction can be modified" },
      { status: 409, headers: { "Cache-Control": "no-store" } }
    );
  }

  try {
    const body = await request.json().catch(() => ({} as any));
    const patch: Record<string, unknown> = {};
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
    if (typeof body.title === "string") {
      const t = body.title.trim();
      if (!t || t.length < 3 || t.length > 120) {
        return NextResponse.json(
          { error: "Title must be 3-120 characters" },
          { status: 400, headers: { "Cache-Control": "no-store" } }
        );
      }
      patch.title = t;
    }
    if ("description" in body) {
      patch.description =
        body.description == null ? null : String(body.description);
    }
    if (body.transaction_date_time != null) {
      const raw = body.transaction_date_time as unknown;
      if (isIsoWithZone(raw)) {
        patch.transaction_date_time = new Date(String(raw)).toISOString();
      } else if (isNaiveLocal(raw)) {
        patch.transaction_date_time = istLocalToUtcIso(String(raw));
      } else {
        return NextResponse.json(
          { error: "Invalid transaction_date_time format" },
          { status: 400, headers: { "Cache-Control": "no-store" } }
        );
      }
    }
    let amount: number | undefined = undefined;
    if (body.amount != null) {
      const a = Number(body.amount);
      if (!Number.isFinite(a))
        return NextResponse.json(
          { error: "Amount must be a valid number" },
          { status: 400, headers: { "Cache-Control": "no-store" } }
        );
      amount = a;
    }

    // Recompute balance relative to immediate previous by transaction_date_time
    if (amount != null) {
      // Determine effective date for this patch (provided or keep current latest.transaction_date_time)
      const effectiveIso =
        (patch.transaction_date_time as string | undefined) ??
        latest.transaction_date_time;
      const { data: prev, error: prevErr } = await admin
        .from("transaction")
        .select("id, balance, transaction_date_time")
        .eq("account_id", idParam)
        .lt("transaction_date_time", effectiveIso)
        .order("transaction_date_time", { ascending: false })
        .order("id", { ascending: false })
        .limit(1)
        .single();
      if (prevErr && prevErr.code !== "PGRST116")
        return NextResponse.json(
          { error: prevErr.message },
          { status: 500, headers: { "Cache-Control": "no-store" } }
        );
      const prevBalance = Number(prev?.balance ?? 0) || 0;
      const newBalance = prevBalance + amount;
      if (!Number.isFinite(newBalance))
        return NextResponse.json(
          { error: "Computed balance is invalid" },
          { status: 400, headers: { "Cache-Control": "no-store" } }
        );
      patch.amount = amount;
      patch.balance = newBalance;
    }

    if (Object.keys(patch).length === 0) {
      return NextResponse.json(
        { error: "No changes provided" },
        { status: 400, headers: { "Cache-Control": "no-store" } }
      );
    }

    const { data, error } = await admin
      .from("transaction")
      .update(patch)
      .eq("id", txIdParam)
      .eq("account_id", idParam)
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

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; txId: string }> }
) {
  const adminUser = await requireAdmin(request);
  if (adminUser instanceof NextResponse) return adminUser;

  const admin = getAdminClient();
  const { id, txId } = await params;
  const idParam = (id ?? "").trim();
  const txIdParam = (txId ?? "").trim();
  if (!/^\d+$/.test(idParam) || !/^\d+$/.test(txIdParam)) {
    return NextResponse.json(
      { error: "Invalid id" },
      { status: 400, headers: { "Cache-Control": "no-store" } }
    );
  }

  const { data: latest, error: latestErr } = await admin
    .from("transaction")
    .select("id, transaction_date_time")
    .eq("account_id", idParam)
    .order("transaction_date_time", { ascending: false })
    .order("id", { ascending: false })
    .limit(1)
    .single();
  if (latestErr)
    return NextResponse.json(
      { error: latestErr.message },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  if (!latest || String(latest.id) !== txIdParam) {
    return NextResponse.json(
      { error: "Only latest transaction can be modified" },
      { status: 409, headers: { "Cache-Control": "no-store" } }
    );
  }

  const { error } = await admin
    .from("transaction")
    .delete()
    .eq("id", txIdParam)
    .eq("account_id", idParam);
  if (error)
    return NextResponse.json(
      { error: error.message },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  return NextResponse.json({ ok: true });
}
