import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(request: Request) {
    try {
        const supabase = await createClient();

        const {
            data: { user },
            error: authError,
        } = await supabase.auth.getUser();

        if (authError || !user) {
            return NextResponse.json(
                { error: "Unauthorized." },
                { status: 401 }
            );
        }

        const admin = createAdminClient();

        const { data: jury, error: juryError } =
            await admin
                .from("juries")
                .select("role")
                .eq("id", user.id)
                .single();

        if (
            juryError ||
            !jury ||
            (jury.role !== "admin" &&
                jury.role !== "management")
        ) {
            return NextResponse.json(
                { error: "Forbidden." },
                { status: 403 }
            );
        }

        const url = new URL(request.url);
        const submissionId =
            url.searchParams.get("submission_id");

        if (!submissionId) {
            return NextResponse.json(
                { error: "Submission ID is required." },
                { status: 400 }
            );
        }

        const { data: submission, error: submissionError } =
            await admin
                .from("film_submissions")
                .select("cast_crew_file_path")
                .eq("id", submissionId)
                .single();

        if (
            submissionError ||
            !submission?.cast_crew_file_path
        ) {
            return NextResponse.json(
                {
                    error:
                        "No Cast & Crew document was found for this submission.",
                },
                { status: 404 }
            );
        }

        const { data: signedUrl, error: signedUrlError } =
            await admin.storage
                .from("submission-attachments")
                .createSignedUrl(
                    submission.cast_crew_file_path,
                    300
                );

        if (signedUrlError || !signedUrl?.signedUrl) {
            console.error(
                "Signed URL error:",
                signedUrlError
            );

            return NextResponse.json(
                {
                    error:
                        "Unable to generate the document link.",
                },
                { status: 500 }
            );
        }

        return NextResponse.json({
            success: true,
            url: signedUrl.signedUrl,
        });
    } catch (error) {
        console.error(
            "Attachment API error:",
            error
        );

        return NextResponse.json(
            {
                error:
                    "Unable to open the Cast & Crew document.",
            },
            { status: 500 }
        );
    }
}