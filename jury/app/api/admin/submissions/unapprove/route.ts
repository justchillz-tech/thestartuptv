import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
    try {
        const supabase = await createClient();

        const { data: claimsData } = await supabase.auth.getClaims();

        if (!claimsData?.claims) {
            return NextResponse.json(
                { error: "Unauthorized" },
                { status: 401 }
            );
        }

        const userId = String(claimsData.claims.sub);

        const { data: jury, error: juryError } = await supabase
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
        const submissionId = String(body?.submission_id ?? "").trim();

        if (!submissionId) {
            return NextResponse.json(
                { error: "Submission ID is required." },
                { status: 400 }
            );
        }

        const admin = createAdminClient();

        const { data: submission, error: submissionError } = await admin
            .from("film_submissions")
            .select(
                "id, status, approved_film_id, approval_exception, approval_exception_reason"
            )
            .eq("id", submissionId)
            .single();

        if (submissionError || !submission) {
            return NextResponse.json(
                { error: "Submission not found." },
                { status: 404 }
            );
        }

        if (submission.status !== "approved") {
            return NextResponse.json(
                {
                    error: `This submission is currently ${submission.status}.`,
                },
                { status: 409 }
            );
        }

        if (!submission.approved_film_id) {
            return NextResponse.json(
                {
                    error: "This approved submission has no linked film record.",
                },
                { status: 409 }
            );
        }

        const filmId = submission.approved_film_id;

        // Never unapprove a film that has already entered jury workflow.
        const { count: assignmentCount, error: assignmentError } =
            await admin
                .from("assignments")
                .select("id", { count: "exact", head: true })
                .eq("film_id", filmId);

        if (assignmentError) {
            console.error("Unapprove assignment check failed:", assignmentError);

            return NextResponse.json(
                { error: "Unable to verify film assignments." },
                { status: 500 }
            );
        }

        if ((assignmentCount ?? 0) > 0) {
            return NextResponse.json(
                {
                    error:
                        "This film has already been assigned to a jury and cannot be unapproved.",
                },
                { status: 409 }
            );
        }

        const { count: evaluationCount, error: evaluationError } =
            await admin
                .from("evaluations")
                .select("id", { count: "exact", head: true })
                .eq("film_id", filmId);

        if (evaluationError) {
            console.error(
                "Unapprove evaluation check failed:",
                evaluationError
            );

            return NextResponse.json(
                { error: "Unable to verify film evaluations." },
                { status: 500 }
            );
        }

        if ((evaluationCount ?? 0) > 0) {
            return NextResponse.json(
                {
                    error:
                        "This film has already been evaluated and cannot be unapproved.",
                },
                { status: 409 }
            );
        }

        // Remove the generated film record first.
        const { error: filmDeleteError } = await admin
            .from("films")
            .delete()
            .eq("id", filmId);

        if (filmDeleteError) {
            console.error(
                "Unapprove film deletion failed:",
                filmDeleteError
            );

            return NextResponse.json(
                { error: "Unable to remove the approved film record." },
                { status: 500 }
            );
        }

        // Return the original submission to pending review.
        const { data: updatedSubmission, error: updateError } = await admin
            .from("film_submissions")
            .update({
                status: "pending",
                approved_film_id: null,
                reviewed_by: null,
                reviewed_at: null,
                rejection_reason: null,
                approval_exception: false,
                approval_exception_reason: null,
            })
            .eq("id", submissionId)
            .eq("status", "approved")
            .select(
                "id, status, approved_film_id, reviewed_by, reviewed_at"
            )
            .single();

        if (updateError || !updatedSubmission) {
            console.error(
                "Unapprove submission update failed:",
                updateError
            );

            return NextResponse.json(
                {
                    error:
                        updateError?.message ??
                        "The film was removed, but the submission could not be returned to pending review. Please contact the administrator.",
                },
                { status: 500 }
            );
        }

        return NextResponse.json({
            success: true,
            submission: updatedSubmission,
        });
    } catch (error) {
        console.error("Unapprove submission API error:", error);

        return NextResponse.json(
            { error: "Unable to unapprove submission." },
            { status: 500 }
        );
    }
}