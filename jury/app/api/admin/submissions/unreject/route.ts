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

        const userId = String(
            claimsData.claims.sub
        );

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
                {
                    error: "Submission ID is required.",
                },
                { status: 400 }
            );
        }

        const admin = createAdminClient();

        const {
            data: submission,
            error: submissionError,
        } = await admin
            .from("film_submissions")
            .select(
                "id, status, rejection_reason, approved_film_id"
            )
            .eq("id", submissionId)
            .single();

        if (submissionError || !submission) {
            return NextResponse.json(
                {
                    error: "Submission not found.",
                },
                { status: 404 }
            );
        }

        if (submission.status !== "rejected") {
            return NextResponse.json(
                {
                    error:
                        `This submission is currently ${submission.status}.`,
                },
                { status: 409 }
            );
        }

        if (submission.approved_film_id) {
            return NextResponse.json(
                {
                    error:
                        "This submission is already linked to an approved film.",
                },
                { status: 409 }
            );
        }

        const {
            data: updatedSubmission,
            error: updateError,
        } = await admin
            .from("film_submissions")
            .update({
                status: "pending",
                rejection_reason: null,
                approval_exception: false,
                approval_exception_reason: null,
                approved_film_id: null,
                reviewed_by: null,
                reviewed_at: null,
            })
            .eq("id", submissionId)
            .eq("status", "rejected")
            .select(
                "id, status, rejection_reason, reviewed_by, reviewed_at"
            )
            .single();

        if (updateError || !updatedSubmission) {
            console.error(
                "Submission unreject update error:",
                updateError
            );

            return NextResponse.json(
                {
                    error:
                        updateError?.message ??
                        "Failed to unreject submission.",
                },
                { status: 500 }
            );
        }

        return NextResponse.json({
            success: true,
            submission: updatedSubmission,
        });
    } catch (error) {
        console.error(
            "Unreject submission API error:",
            error
        );

        return NextResponse.json(
            {
                error:
                    "Unable to unreject submission.",
            },
            { status: 500 }
        );
    }
}