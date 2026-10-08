import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { Resend } from "resend";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

function escapeHtml(value: string): string {
    return value
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#39;");
}

function hashToken(token: string): string {
    return crypto
        .createHash("sha256")
        .update(token)
        .digest("hex");
}

function extractEmbeddedImages(html: string) {
    let imageNumber = 0;

    const images: {
        base64: string;
        contentId: string;
        filename: string;
    }[] = [];

    const processedHtml = html.replace(
        /data:image\/([^;]+);base64,([^"')]+)/g,
        (_match, extension: string, base64: string) => {
            imageNumber++;

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
        // 1. Verify logged-in admin / management user
        // ---------------------------------------------------------

        const authClient = await createClient();

        const { data: claimsData } =
            await authClient.auth.getClaims();

        if (!claimsData?.claims) {
            return NextResponse.json(
                { error: "Unauthorized." },
                { status: 401 }
            );
        }

        const userId =
            String(claimsData.claims.sub);

        const { data: currentUser } =
            await authClient
                .from("juries")
                .select("role")
                .eq("id", userId)
                .single();

        if (
            currentUser?.role !== "admin" &&
            currentUser?.role !== "management"
        ) {
            return NextResponse.json(
                { error: "Forbidden." },
                { status: 403 }
            );
        }

        // ---------------------------------------------------------
        // 2. Environment
        // ---------------------------------------------------------

        const resendApiKey =
            process.env.RESEND_API_KEY;

        const fromEmail =
            process.env.LUMORA_FROM_EMAIL;

        const appUrl =
            process.env.APP_URL;

        const mapsLink =
            process.env.LUMORA_MAPS_LINK ||
            "https://maps.app.goo.gl/4AEePEoyJ8NZ1JGc9";

        if (
            !resendApiKey ||
            !fromEmail ||
            !appUrl
        ) {
            return NextResponse.json(
                {
                    error:
                        "LUMORA email environment is not fully configured.",
                },
                { status: 500 }
            );
        }

        // ---------------------------------------------------------
        // 3. Request
        // ---------------------------------------------------------

        const body = await request.json();

        const filmId =
            typeof body.filmId === "string"
                ? body.filmId.trim()
                : "";

        if (!filmId) {
            return NextResponse.json(
                {
                    error: "filmId is required.",
                },
                { status: 400 }
            );
        }

        // ---------------------------------------------------------
        // 4. Admin Supabase client
        // ---------------------------------------------------------

        const supabase =
            createAdminClient();

        // ---------------------------------------------------------
        // 5. Load film
        // ---------------------------------------------------------

        const {
            data: film,
            error: filmError,
        } = await supabase
            .from("films")
            .select(
                "id, film_code, title, director"
            )
            .eq("id", filmId)
            .maybeSingle();

        if (filmError) {
            console.error(
                "LUMORA film lookup error:",
                filmError
            );

            return NextResponse.json(
                {
                    error:
                        "Unable to load film.",
                },
                { status: 500 }
            );
        }

        if (!film) {
            return NextResponse.json(
                {
                    error:
                        "Film not found.",
                },
                { status: 404 }
            );
        }

        // ---------------------------------------------------------
        // 6. Load participant
        // ---------------------------------------------------------

        const {
            data: submission,
            error: submissionError,
        } = await supabase
            .from("film_submissions")
            .select(
                "id, participant_name, participant_email, title"
            )
            .eq("approved_film_id", film.id)
            .maybeSingle();

        if (submissionError) {
            console.error(
                "LUMORA submission lookup error:",
                submissionError
            );

            return NextResponse.json(
                {
                    error:
                        "Unable to load finalist information.",
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
                        "This finalist does not have a valid participant name/email.",
                },
                { status: 422 }
            );
        }

        // ---------------------------------------------------------
        // 7. Existing attendance record
        // ---------------------------------------------------------

        const {
            data: existing,
            error: existingError,
        } = await supabase
            .from("lumora_attendance")
            .select(
                "id, status"
            )
            .eq("film_id", film.id)
            .maybeSingle();

        if (existingError) {
            console.error(
                "LUMORA attendance lookup error:",
                existingError
            );

            return NextResponse.json(
                {
                    error:
                        "Unable to check invitation status.",
                },
                { status: 500 }
            );
        }

        /*
         * Don't allow an ordinary resend to overwrite a
         * confirmed or declined response.
         */
        if (
            existing?.status === "confirmed"
        ) {
            return NextResponse.json(
                {
                    error:
                        "This finalist has already confirmed attendance.",
                    status: "confirmed",
                },
                { status: 409 }
            );
        }

        if (
            existing?.status === "declined"
        ) {
            return NextResponse.json(
                {
                    error:
                        "This finalist has already declined the invitation.",
                    status: "declined",
                },
                { status: 409 }
            );
        }

        // ---------------------------------------------------------
        // 8. Generate new secure token
        // ---------------------------------------------------------

        const rawToken =
            crypto.randomBytes(32).toString("hex");

        const tokenHash =
            hashToken(rawToken);

        // ---------------------------------------------------------
        // 9. Create or refresh attendance record
        // ---------------------------------------------------------

        if (existing?.id) {
            const {
                error: updateError,
            } = await supabase
                .from("lumora_attendance")
                .update({
                    token_hash: tokenHash,
                    status: "pending",
                    guest_count: 0,
                    confirmed_at: null,
                })
                .eq("id", existing.id);

            if (updateError) {
                console.error(
                    "LUMORA attendance update error:",
                    updateError
                );

                return NextResponse.json(
                    {
                        error:
                            "Unable to refresh invitation.",
                    },
                    { status: 500 }
                );
            }
        } else {
            const {
                error: insertError,
            } = await supabase
                .from("lumora_attendance")
                .insert({
                    film_id: film.id,
                    submission_id: submission.id,
                    token_hash: tokenHash,
                    status: "pending",
                    guest_count: 0,
                });

            if (insertError) {
                console.error(
                    "LUMORA attendance insert error:",
                    insertError
                );

                return NextResponse.json(
                    {
                        error:
                            "Unable to create invitation.",
                    },
                    { status: 500 }
                );
            }
        }

        // ---------------------------------------------------------
        // 10. Build confirmation URL
        // ---------------------------------------------------------

        const confirmationUrl =
            `${appUrl.replace(/\/+$/, "")}/lumora/confirm?token=${encodeURIComponent(
                rawToken
            )}`;

        // ---------------------------------------------------------
        // 11. Load email template
        // ---------------------------------------------------------

        const templatePath =
            path.join(
                process.cwd(),
                "emails",
                "lumora-top10.html"
            );

        let html =
            await readFile(
                templatePath,
                "utf8"
            );

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
                mapsLink
            )
            .replaceAll(
                "{CONFIRMATION_LINK}",
                confirmationUrl
            );

        // ---------------------------------------------------------
        // 12. Convert embedded images to CID
        // ---------------------------------------------------------

        const extracted =
            extractEmbeddedImages(html);

        const attachments =
            extracted.images.map(
                (image) => ({
                    filename:
                        image.filename,

                    content:
                        Buffer.from(
                            image.base64,
                            "base64"
                        ),

                    contentId:
                        image.contentId,
                })
            );

        // ---------------------------------------------------------
        // 13. Send real invitation
        // ---------------------------------------------------------

        const resend =
            new Resend(
                resendApiKey
            );

        const {
            data,
            error,
        } = await resend.emails.send({
            from: fromEmail,

            to: [
                submission.participant_email,
            ],

            subject:
                `LUMORA 2026 — Top 10 Finalist Invitation | ${film.title}`,

            html: extracted.html,

            attachments,
        });

        if (error) {
            console.error(
                "LUMORA Resend error:",
                error
            );

            return NextResponse.json(
                {
                    error:
                        "Email could not be sent.",
                    details: error.message,
                },
                { status: 502 }
            );
        }

        return NextResponse.json({
            success: true,

            message:
                existing?.id
                    ? "LUMORA invitation resent successfully."
                    : "LUMORA invitation sent successfully.",

            emailId:
                data?.id ?? null,

            film: {
                id: film.id,
                title: film.title,
            },

            recipient:
                submission.participant_email,

            status: "pending",
        });

    } catch (error) {
        console.error(
            "LUMORA send-invite error:",
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