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

  try {
    const body = await request.json().catch(() => ({} as any));

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

    const title = typeof body.title === "string" ? body.title.trim() : null;
    if (title != null && (title.length < 3 || title.length > 120)) {
      return NextResponse.json(
        { error: "Title must be 3-120 characters" },
        { status: 400, headers: { "Cache-Control": "no-store" } }
      );
    }
    const descriptionIsSet = Object.prototype.hasOwnProperty.call(
      body,
      "description"
    );
    const description = descriptionIsSet
      ? body.description == null
        ? null
        : String(body.description)
      : null;

    let amount: number | null = null;
    if (body.amount != null) {
      const a = Number(body.amount);
      if (!Number.isFinite(a))
        return NextResponse.json(
          { error: "Amount must be a valid number" },
          { status: 400, headers: { "Cache-Control": "no-store" } }
        );
      amount = a;
    }

    let timeIso: string | null = null;
    if (body.transaction_date_time != null) {
      const raw = body.transaction_date_time as unknown;
      if (isIsoWithZone(raw)) timeIso = new Date(String(raw)).toISOString();
      else if (isNaiveLocal(raw)) timeIso = istLocalToUtcIso(String(raw));
      else
        return NextResponse.json(
          { error: "Invalid transaction_date_time format" },
          { status: 400, headers: { "Cache-Control": "no-store" } }
        );
    }

    if (
      title == null &&
      !descriptionIsSet &&
      amount == null &&
      timeIso == null
    ) {
      return NextResponse.json(
        { error: "No changes provided" },
        { status: 400, headers: { "Cache-Control": "no-store" } }
      );
    }

    const { data, error } = await admin.rpc(
      "fn_transaction_update_and_recompute",
      {
        p_account_id: Number(idParam),
        p_tx_id: Number(txIdParam),
        p_title: title,
        p_description: description,
        p_amount: amount,
        p_transaction_date_time: timeIso,
        p_description_is_set: descriptionIsSet,
      }
    );

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

  const { error } = await admin.rpc("fn_transaction_delete_and_recompute", {
    p_account_id: Number(idParam),
    p_tx_id: Number(txIdParam),
  });
  if (error)
    return NextResponse.json(
      { error: error.message },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  return NextResponse.json({ ok: true });
}
