import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
    try {
        const supabase = await createClient();

        const { data: claimsData } =
            await supabase.auth.getClaims();

        if (!claimsData?.claims) {
            return NextResponse.json(
                { error: "Unauthorized" },
                { status: 401 }
            );
        }

        const userId = String(claimsData.claims.sub);

        const { data: jury, error: juryError } =
            await supabase
                .from("juries")
                .select("role")
                .eq("id", userId)
                .single();

        if (juryError || jury?.role !== "admin") {
            return NextResponse.json(
                { error: "Forbidden" },
                { status: 403 }
            );
        }

        const body = await request.json();

        const submissionId = String(
            body?.submission_id ?? ""
        ).trim();

        if (!submissionId) {
            return NextResponse.json(
                { error: "Submission ID is required." },
                { status: 400 }
            );
        }

        const admin = createAdminClient();

        const { data, error } = await admin.rpc(
            "unapprove_submission",
            {
                p_submission_id: submissionId,
                p_admin_id: userId,
            }
        );

        if (error) {
            console.error(
                "Unapprove RPC failed:",
                error
            );

            if (error.code === "42501") {
                return NextResponse.json(
                    { error: "Forbidden" },
                    { status: 403 }
                );
            }

            if (error.code === "P0002") {
                return NextResponse.json(
                    { error: "Submission not found." },
                    { status: 404 }
                );
            }

            if (error.code === "P0001") {
                return NextResponse.json(
                    { error: error.message },
                    { status: 409 }
                );
            }

            return NextResponse.json(
                {
                    error:
                        "Unable to unapprove submission.",
                },
                { status: 500 }
            );
        }

        return NextResponse.json({
            success: true,
            result: data,
        });
    } catch (error) {
        console.error(
            "Unapprove submission API error:",
            error
        );

        return NextResponse.json(
            {
                error:
                    "Unable to unapprove submission.",
            },
            { status: 500 }
        );
    }
}