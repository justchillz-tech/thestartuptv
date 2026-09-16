import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

function extractDriveFileId(url: string) {
    const value = url.trim();

    const patterns = [
        /\/file\/d\/([a-zA-Z0-9_-]+)/,
        /[?&]id=([a-zA-Z0-9_-]+)/,
        /\/open\?id=([a-zA-Z0-9_-]+)/,
    ];

    for (const pattern of patterns) {
        const match = value.match(pattern);
        if (match) return match[1];
    }

    return "";
}

function isYouTubeUrl(url: string) {
    try {
        const parsed = new URL(url);

        const hostname = parsed.hostname.toLowerCase();

        return (
            hostname === "youtube.com" ||
            hostname === "www.youtube.com" ||
            hostname === "m.youtube.com" ||
            hostname === "youtu.be" ||
            hostname === "www.youtu.be"
        );
    } catch {
        return false;
    }
}

function generateFilmCode() {
    return `STV-${Date.now().toString(36).toUpperCase()}`;
}

export async function POST(request: Request) {
    try {
        // Verify the logged-in user.
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
        const submissionId = String(body?.submission_id ?? "");

        if (!submissionId) {
            return NextResponse.json(
                { error: "Submission ID is required." },
                { status: 400 }
            );
        }

        // Server-side admin client.
        const admin = createAdminClient();

        const { data: submission, error: submissionError } = await admin
            .from("film_submissions")
            .select("*")
            .eq("id", submissionId)
            .single();

        if (submissionError || !submission) {
            return NextResponse.json(
                { error: "Submission not found." },
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

        if (
            !submission.title ||
            !submission.director_name ||
            !submission.duration ||
            !submission.language ||
            !submission.film_url
        ) {
            return NextResponse.json(
                {
                    error:
                        "This submission is missing required film information: title, director, duration, language or film URL.",
                },
                { status: 400 }
            );
        }

        const filmUrl = submission.film_url.trim();
        const driveFileId = extractDriveFileId(filmUrl);
        const youtubeUrl = isYouTubeUrl(filmUrl);

        if (!driveFileId && !youtubeUrl) {
            return NextResponse.json(
                {
                    error:
                        "The submitted Film URL must be a valid Google Drive or YouTube URL.",
                },
                { status: 400 }
            );
        }

        // Prevent the same Drive file from becoming two films.
        let existingFilm = null;

        if (driveFileId) {
            const { data } = await admin
                .from("films")
                .select("id, film_code, title")
                .eq("drive_file_id", driveFileId)
                .maybeSingle();

            existingFilm = data;
        } else if (youtubeUrl) {
            const { data } = await admin
                .from("films")
                .select("id, film_code, title")
                .eq("video_url", filmUrl)
                .maybeSingle();

            existingFilm = data;
        }

        if (existingFilm) {
            return NextResponse.json(
                {
                    error: `This video is already registered as ${existingFilm.film_code}.`,
                },
                { status: 409 }
            );
        }

        const filmCode = generateFilmCode();

        const { data: film, error: filmError } = await admin
            .from("films")
            .insert({
                film_code: filmCode,
                title: submission.title,
                director: submission.director_name,
                duration: submission.duration,
                language: submission.language,

                // Generic source URL for both Drive and YouTube.
                video_url: filmUrl,

                // Keep Drive-specific fields populated only for Drive submissions.
                drive_url: driveFileId ? filmUrl : null,
                drive_file_id: driveFileId || null,

                status: "active",
            })
            .select(
                "id, film_code, title, director, duration, language, drive_url"
            )
            .single();

        if (filmError || !film) {
            console.error("Film creation error:", filmError);

            return NextResponse.json(
                {
                    error: filmError?.message ?? "Failed to create film.",
                },
                { status: 500 }
            );
        }

        const { data: updatedSubmission, error: updateError } = await admin
            .from("film_submissions")
            .update({
                status: "approved",
                approved_film_id: film.id,
                reviewed_by: userId,
                reviewed_at: new Date().toISOString(),
                rejection_reason: null,
            })
            .eq("id", submissionId)
            .eq("status", "pending")
            .select("id, status, approved_film_id, reviewed_at")
            .single();

        if (updateError || !updatedSubmission) {
            console.error(
                "Submission approval update error:",
                updateError
            );

            // Roll back the film if approval could not be finalized.
            await admin
                .from("films")
                .delete()
                .eq("id", film.id);

            return NextResponse.json(
                {
                    error:
                        updateError?.message ??
                        "Failed to finalize submission approval.",
                },
                { status: 500 }
            );
        }

        return NextResponse.json({
            success: true,
            film,
            submission: updatedSubmission,
        });
    } catch (error) {
        console.error("Approve submission API error:", error);

        return NextResponse.json(
            { error: "Unable to approve submission." },
            { status: 500 }
        );
    }
}