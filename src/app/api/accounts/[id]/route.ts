import { NextRequest, NextResponse } from "next/server";
import { getAdminClient, requireAdmin } from "@/lib/server/auth";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const adminUser = await requireAdmin(request);
  if (adminUser instanceof NextResponse) return adminUser;

  const admin = getAdminClient();
  const { id } = await params;
  const idParam = (id ?? "").trim();
  if (!/^\d+$/.test(idParam)) {
    return NextResponse.json(
      { error: "Invalid id" },
      { status: 400, headers: { "Cache-Control": "no-store" } }
    );
  }

  const { data, error } = await admin
    .from("account")
    .select("id, created_at, title, description, created_by")
    .eq("id", idParam)
    .single();

  if (error)
    return NextResponse.json(
      { error: error.message },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  return NextResponse.json({ data });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const adminUser = await requireAdmin(request);
  if (adminUser instanceof NextResponse) return adminUser;

  const admin = getAdminClient();
  const { id } = await params;
  const idParam = (id ?? "").trim();
  if (!/^\d+$/.test(idParam)) {
    return NextResponse.json(
      { error: "Invalid id" },
      { status: 400, headers: { "Cache-Control": "no-store" } }
    );
  }

  try {
    const body = await request.json().catch(() => ({} as any));
    const patch: Record<string, unknown> = {};
    if (typeof body.title === "string") {
      const t = body.title.trim();
      if (!t || t.length < 3 || t.length > 80) {
        return NextResponse.json(
          { error: "Title must be 3-80 characters" },
          { status: 400, headers: { "Cache-Control": "no-store" } }
        );
      }
      patch.title = t;
    }
    if ("description" in body) {
      patch.description =
        body.description == null ? null : String(body.description);
    }

    if (Object.keys(patch).length === 0) {
      return NextResponse.json(
        { error: "No changes provided" },
        { status: 400, headers: { "Cache-Control": "no-store" } }
      );
    }

    const { data, error } = await admin
      .from("account")
      .update(patch)
      .eq("id", idParam)
      .select("id, created_at, title, description, created_by")
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
  { params }: { params: Promise<{ id: string }> }
) {
  const adminUser = await requireAdmin(request);
  if (adminUser instanceof NextResponse) return adminUser;

  const admin = getAdminClient();
  const { id } = await params;
  const idParam = (id ?? "").trim();
  if (!/^\d+$/.test(idParam)) {
    return NextResponse.json(
      { error: "Invalid id" },
      { status: 400, headers: { "Cache-Control": "no-store" } }
    );
  }

  const { error } = await admin.from("account").delete().eq("id", idParam);
  if (error) {
    // FK/constraint errors typically include relation names in details
    const isConstraint =
      /violat/i.test(error.message) || /constraint/i.test(error.message);
    const status = isConstraint ? 409 : 500;
    const message = isConstraint
      ? "Cannot delete account with related records"
      : error.message;
    return NextResponse.json(
      { error: message },
      { status, headers: { "Cache-Control": "no-store" } }
    );
  }
  return NextResponse.json({ ok: true });
}
