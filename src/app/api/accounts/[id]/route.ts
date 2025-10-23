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
  // Fetch members for prefill
  const { data: members, error: membersError } = await admin
    .from("account-member")
    .select("uid, type")
    .eq("account_id", idParam);
  if (membersError)
    return NextResponse.json(
      { error: membersError.message },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  return NextResponse.json({ data, members: members ?? [] });
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
    // Replace memberships
    const editors = Array.isArray(body?.editors)
      ? (body.editors as unknown[])
      : [];
    const viewers = Array.isArray(body?.viewers)
      ? (body.viewers as unknown[])
      : [];
    const uuidRe =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    const norm = (arr: unknown[]) =>
      Array.from(
        new Set(
          arr.filter(
            (v) => typeof v === "string" && uuidRe.test(v as string)
          ) as string[]
        )
      );
    const editorsClean = norm(editors);
    const viewersClean = norm(viewers);
    const overlap = new Set(
      editorsClean.filter((id) => viewersClean.includes(id))
    );
    if (overlap.size > 0) {
      return NextResponse.json(
        { error: "A user cannot be both EDITOR and VIEWER" },
        { status: 400, headers: { "Cache-Control": "no-store" } }
      );
    }

    // Delete existing memberships
    const { error: delError } = await admin
      .from("account-member")
      .delete()
      .eq("account_id", idParam);
    if (delError)
      return NextResponse.json(
        { error: delError.message },
        { status: 500, headers: { "Cache-Control": "no-store" } }
      );

    // Insert new memberships if any
    if (editorsClean.length > 0 || viewersClean.length > 0) {
      const memberRows = [
        ...editorsClean.map((uid) => ({
          account_id: Number(idParam),
          uid,
          type: "EDITOR",
        })),
        ...viewersClean.map((uid) => ({
          account_id: Number(idParam),
          uid,
          type: "VIEWER",
        })),
      ];
      const { error: insError } = await admin
        .from("account-member")
        .insert(memberRows);
      if (insError)
        return NextResponse.json(
          { error: insError.message },
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
