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

  // Ensure target is latest transaction for this account
  const { data: latest, error: latestErr } = await admin
    .from("transaction")
    .select("id, amount")
    .eq("account_id", idParam)
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

    // Recompute balance relative to second-latest
    if (amount != null) {
      const { data: prev, error: prevErr } = await admin
        .from("transaction")
        .select("id, balance")
        .eq("account_id", idParam)
        .lt("id", txIdParam)
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
        "id, created_at, account_id, created_by, amount, balance, title, description"
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
    .select("id")
    .eq("account_id", idParam)
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
