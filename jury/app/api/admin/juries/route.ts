import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: claimsData } = await supabase.auth.getClaims();
    if (!claimsData?.claims) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const userId = String(claimsData.claims.sub);
    const { data: adminJury } = await supabase.from("juries").select("role").eq("id", userId).single();
    if (adminJury?.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const body = await request.json();
    const name = String(body.name ?? "").trim();
    const email = String(body.email ?? "").trim().toLowerCase();
    if (!name || !email) return NextResponse.json({ error: "Name and email are required." }, { status: 400 });

    const admin = createAdminClient();
    const appUrl = process.env.APP_URL || new URL(request.url).origin;
    const { data: invited, error: inviteError } = await admin.auth.admin.inviteUserByEmail(email, {
      data: { name },
      redirectTo: `${appUrl}/auth/accept-invite`,
    });

    if (inviteError || !invited.user) {
      return NextResponse.json({ error: inviteError?.message ?? "Unable to create the invitation." }, { status: 400 });
    }

    const { error: profileError } = await admin.from("juries").insert({
      id: invited.user.id,
      name,
      email,
      role: "jury",
    });

    if (profileError) {
      await admin.auth.admin.deleteUser(invited.user.id);
      return NextResponse.json({ error: profileError.message }, { status: 400 });
    }

    return NextResponse.json({ message: `Invitation sent to ${email}.` });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unexpected server error." }, { status: 500 });
  }
}
