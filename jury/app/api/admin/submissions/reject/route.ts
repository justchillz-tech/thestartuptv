import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
    try {
        // Verify the logged-in user.
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

        // Only Admin can reject submissions.
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

        const rejectionReason = String(
            body?.rejection_reason ?? ""
        ).trim();

        if (!submissionId) {
            return NextResponse.json(
                {
                    error:
                        "Submission ID is required.",
                },
                { status: 400 }
            );
        }

        if (!rejectionReason) {
            return NextResponse.json(
                {
                    error:
                        "A rejection reason is required.",
                },
                { status: 400 }
            );
        }

        if (rejectionReason.length > 1000) {
            return NextResponse.json(
                {
                    error:
                        "Rejection reason must be 1000 characters or less.",
                },
                { status: 400 }
            );
        }

        const admin = createAdminClient();

        // Make sure the submission exists and is still pending.
        const {
            data: submission,
            error: submissionError,
        } = await admin
            .from("film_submissions")
            .select(
                "id, title, status, approved_film_id"
            )
            .eq("id", submissionId)
            .single();

        if (submissionError || !submission) {
            return NextResponse.json(
                {
                    error:
                        "Submission not found.",
                },
                { status: 404 }
            );
        }

        if (submission.status !== "pending") {
            return NextResponse.json(
                {
                    error: `This submission is already ${submission.status}.`,
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
                status: "rejected",
                rejection_reason: rejectionReason,
                reviewed_by: userId,
                reviewed_at:
                    new Date().toISOString(),
                approved_film_id: null,
            })
            .eq("id", submissionId)
            .eq("status", "pending")
            .select(
                "id, status, rejection_reason, reviewed_by, reviewed_at"
            )
            .single();

        if (updateError || !updatedSubmission) {
            console.error(
                "Submission rejection update error:",
                updateError
            );

            return NextResponse.json(
                {
                    error:
                        updateError?.message ??
                        "Failed to reject submission.",
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
            "Reject submission API error:",
            error
        );

        return NextResponse.json(
            {
                error:
                    "Unable to reject submission.",
            },
            { status: 500 }
        );
    }
}