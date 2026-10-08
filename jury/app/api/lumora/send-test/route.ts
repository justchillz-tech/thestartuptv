import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { Resend } from "resend";
import { createAdminClient } from "@/lib/supabase/admin";

function escapeHtml(value: string): string {
    return value
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#39;");
}

function validateUrl(value: string, fieldName: string): string {
    try {
        const url = new URL(value);

        if (
            url.protocol !== "https:" &&
            url.protocol !== "http:"
        ) {
            throw new Error();
        }

        return url.toString();
    } catch {
        throw new Error(
            `${fieldName} must be a valid HTTP/HTTPS URL.`
        );
    }
}

function hashToken(token: string): string {
    return crypto
        .createHash("sha256")
        .update(token)
        .digest("hex");
}

type EmbeddedImage = {
    mimeType: string;
    base64: string;
    contentId: string;
    filename: string;
};

function extractEmbeddedImages(html: string) {
    let imageNumber = 0;

    const images: EmbeddedImage[] = [];

    const processedHtml = html.replace(
        /data:image\/([^;]+);base64,([^"')]+)/g,
        (_match, extension: string, base64: string) => {
            imageNumber++;

            const mimeType = `image/${extension}`;

            let contentId: string;
            let filename: string;

            if (imageNumber === 1) {
                contentId = "lumora-header";
                filename = "lumora-header.jpg";
            } else if (imageNumber === 2) {
                contentId = "lumora-hero";
                filename = "lumora-hero.jpg";
            } else if (imageNumber === 3) {
                contentId = "startup-tv-logo";
                filename = "startup-tv-logo.png";
            } else {
                contentId = `lumora-image-${imageNumber}`;
                filename = `lumora-image-${imageNumber}.${extension}`;
            }

            images.push({
                mimeType,
                base64,
                contentId,
                filename,
            });

            return `cid:${contentId}`;
        }
    );

    return {
        html: processedHtml,
        images,
    };
}

export async function POST(request: Request) {
    try {
        // ---------------------------------------------------------
        // 1. Environment
        // ---------------------------------------------------------

        const resendApiKey = process.env.RESEND_API_KEY;
        const fromEmail = process.env.LUMORA_FROM_EMAIL;
        const testEmail = process.env.LUMORA_TEST_EMAIL;
        const testSecret = process.env.LUMORA_TEST_SECRET;
        const appUrl = process.env.APP_URL;

        const mapsLink =
            process.env.LUMORA_MAPS_LINK ||
            "https://maps.app.goo.gl/4AEePEoyJ8NZ1JGc9";

        if (!resendApiKey) {
            return NextResponse.json(
                {
                    error:
                        "RESEND_API_KEY is not configured.",
                },
                { status: 500 }
            );
        }

        if (!fromEmail) {
            return NextResponse.json(
                {
                    error:
                        "LUMORA_FROM_EMAIL is not configured.",
                },
                { status: 500 }
            );
        }

        if (!testEmail) {
            return NextResponse.json(
                {
                    error:
                        "LUMORA_TEST_EMAIL is not configured.",
                },
                { status: 500 }
            );
        }

        if (!testSecret) {
            return NextResponse.json(
                {
                    error:
                        "LUMORA_TEST_SECRET is not configured.",
                },
                { status: 500 }
            );
        }

        if (!appUrl) {
            return NextResponse.json(
                {
                    error:
                        "APP_URL is not configured.",
                },
                { status: 500 }
            );
        }

        // ---------------------------------------------------------
        // 2. Protect test endpoint
        // ---------------------------------------------------------

        const authorization =
            request.headers.get("authorization");

        if (
            authorization !==
            `Bearer ${testSecret}`
        ) {
            return NextResponse.json(
                {
                    error: "Unauthorized.",
                },
                { status: 401 }
            );
        }

        // ---------------------------------------------------------
        // 3. Supabase
        // ---------------------------------------------------------

        const supabase = createAdminClient();

        // ---------------------------------------------------------
        // 4. Find the current #1 finalist
        // ---------------------------------------------------------

        const { data: evaluation, error: evaluationError } =
            await supabase
                .from("evaluations")
                .select(`
                    film_id,
                    total,
                    films!evaluations_film_id_fkey (
                        id,
                        film_code,
                        title,
                        director
                    )
                `)
                .order("total", {
                    ascending: false,
                })
                .limit(1)
                .maybeSingle();

        if (evaluationError) {
            console.error(
                "LUMORA finalist lookup error:",
                evaluationError
            );

            return NextResponse.json(
                {
                    error:
                        "Unable to load finalist from evaluations.",
                },
                { status: 500 }
            );
        }

        if (!evaluation?.film_id || !evaluation.films) {
            return NextResponse.json(
                {
                    error:
                        "No finalist was found.",
                },
                { status: 404 }
            );
        }

        const film = Array.isArray(evaluation.films)
            ? evaluation.films[0]
            : evaluation.films;

        if (!film) {
            return NextResponse.json(
                {
                    error:
                        "Finalist film data is invalid.",
                },
                { status: 500 }
            );
        }

        // ---------------------------------------------------------
        // 5. Find participant connected to the finalist
        // ---------------------------------------------------------

        const {
            data: submission,
            error: submissionError,
        } = await supabase
            .from("film_submissions")
            .select(`
                id,
                participant_name,
                participant_email,
                title
            `)
            .eq("approved_film_id", film.id)
            .maybeSingle();

        if (submissionError) {
            console.error(
                "LUMORA participant lookup error:",
                submissionError
            );

            return NextResponse.json(
                {
                    error:
                        "Unable to load finalist participant.",
                },
                { status: 500 }
            );
        }

        if (
            !submission?.participant_name ||
            !submission?.participant_email
        ) {
            return NextResponse.json(
                {
                    error:
                        "Finalist does not have a participant name/email.",
                    film: film.title,
                },
                { status: 422 }
            );
        }

        // ---------------------------------------------------------
        // 6. Generate secure confirmation token
        // ---------------------------------------------------------

        const rawToken =
            crypto.randomBytes(32).toString("hex");

        const tokenHash = hashToken(rawToken);

        // ---------------------------------------------------------
        // 7. Clean up previous TEST attendance record
        // ---------------------------------------------------------
        //
        // This is intentionally allowed here because this route
        // is TEST MODE only.
        //
        // The production sender will NOT do this.
        //

        const {
            error: deleteError,
        } = await supabase
            .from("lumora_attendance")
            .delete()
            .eq("film_id", film.id);

        if (deleteError) {
            console.error(
                "LUMORA test attendance cleanup error:",
                deleteError
            );

            return NextResponse.json(
                {
                    error:
                        "Unable to reset previous test attendance.",
                },
                { status: 500 }
            );
        }

        // ---------------------------------------------------------
        // 8. Create attendance record
        // ---------------------------------------------------------

        const {
            data: attendance,
            error: attendanceError,
        } = await supabase
            .from("lumora_attendance")
            .insert({
                film_id: film.id,
                submission_id: submission.id,
                token_hash: tokenHash,
                status: "pending",
                guest_count: 0,
            })
            .select("id")
            .single();

        if (attendanceError) {
            console.error(
                "LUMORA attendance creation error:",
                attendanceError
            );

            return NextResponse.json(
                {
                    error:
                        "Unable to create confirmation record.",
                },
                { status: 500 }
            );
        }

        // ---------------------------------------------------------
        // 9. Build confirmation URL
        // ---------------------------------------------------------

        const safeAppUrl = appUrl.replace(/\/+$/, "");

        const confirmationUrl =
            `${safeAppUrl}/lumora/confirm?token=${encodeURIComponent(
                rawToken
            )}`;

        const safeConfirmationLink =
            validateUrl(
                confirmationUrl,
                "confirmation URL"
            );

        const safeGoogleMapsLink =
            validateUrl(
                mapsLink,
                "Google Maps link"
            );

        // ---------------------------------------------------------
        // 10. Load LUMORA email template
        // ---------------------------------------------------------

        const templatePath = path.join(
            process.cwd(),
            "emails",
            "lumora-top10.html"
        );

        let html = await readFile(
            templatePath,
            "utf8"
        );

        // ---------------------------------------------------------
        // 11. Replace placeholders
        // ---------------------------------------------------------

        html = html
            .replaceAll(
                "{NAME}",
                escapeHtml(
                    submission.participant_name
                )
            )
            .replaceAll(
                "{FILM_TITLE}",
                escapeHtml(
                    submission.title ||
                    film.title
                )
            )
            .replaceAll(
                "{GOOGLE_MAPS_LINK}",
                safeGoogleMapsLink
            )
            .replaceAll(
                "{CONFIRMATION_LINK}",
                safeConfirmationLink
            );

        // ---------------------------------------------------------
        // 12. Convert base64 images to CID references
        // ---------------------------------------------------------

        const extracted =
            extractEmbeddedImages(html);

        html = extracted.html;

        // ---------------------------------------------------------
        // 13. Prepare inline attachments
        // ---------------------------------------------------------

        const attachments =
            extracted.images.map(
                (image) => ({
                    filename: image.filename,
                    content: Buffer.from(
                        image.base64,
                        "base64"
                    ),
                    contentId:
                        image.contentId,
                })
            );

        // ---------------------------------------------------------
        // 14. Send TEST email
        // ---------------------------------------------------------

        const resend =
            new Resend(resendApiKey);

        const {
            data,
            error,
        } = await resend.emails.send({
            from: fromEmail,
            to: [testEmail],
            subject:
                `LUMORA 2026 — Top 10 Finalist Invitation | ${film.title}`,
            html,
            attachments,
        });

        if (error) {
            console.error(
                "Resend error:",
                error
            );

            return NextResponse.json(
                {
                    error:
                        "Failed to send email.",
                    details: error.message,
                },
                { status: 502 }
            );
        }

        // ---------------------------------------------------------
        // 15. Return TEST result
        // ---------------------------------------------------------

        return NextResponse.json({
            success: true,

            mode: "TEST",

            message:
                "LUMORA Top 10 test invitation sent successfully.",

            emailId:
                data?.id ?? null,

            sentTo: testEmail,

            finalist: {
                filmId: film.id,
                filmCode: film.film_code,
                filmTitle: film.title,
                director: film.director,
                score: evaluation.total,
            },

            participant: {
                name:
                    submission.participant_name,
                email:
                    submission.participant_email,
                submissionId:
                    submission.id,
            },

            attendance: {
                id: attendance.id,
                status: "pending",
            },

            confirmationUrl,

            inlineImages:
                attachments.length,
        });
    } catch (error) {
        console.error(
            "LUMORA send-test error:",
            error
        );

        return NextResponse.json(
            {
                error:
                    error instanceof Error
                        ? error.message
                        : "Internal server error.",
            },
            { status: 500 }
        );
    }
}