import { NextResponse } from "next/server";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { Resend } from "resend";

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

        if (url.protocol !== "https:" && url.protocol !== "http:") {
            throw new Error();
        }

        return escapeHtml(url.toString());
    } catch {
        throw new Error(`${fieldName} must be a valid HTTP/HTTPS URL.`);
    }
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

        if (!resendApiKey) {
            return NextResponse.json(
                { error: "RESEND_API_KEY is not configured." },
                { status: 500 }
            );
        }

        if (!fromEmail) {
            return NextResponse.json(
                { error: "LUMORA_FROM_EMAIL is not configured." },
                { status: 500 }
            );
        }

        if (!testEmail) {
            return NextResponse.json(
                { error: "LUMORA_TEST_EMAIL is not configured." },
                { status: 500 }
            );
        }

        if (!testSecret) {
            return NextResponse.json(
                { error: "LUMORA_TEST_SECRET is not configured." },
                { status: 500 }
            );
        }

        // ---------------------------------------------------------
        // 2. Protect test endpoint
        // ---------------------------------------------------------

        const authorization = request.headers.get("authorization");

        if (authorization !== `Bearer ${testSecret}`) {
            return NextResponse.json(
                { error: "Unauthorized." },
                { status: 401 }
            );
        }

        // ---------------------------------------------------------
        // 3. Request body
        // ---------------------------------------------------------

        const body = await request.json();

        const name =
            typeof body.name === "string" ? body.name.trim() : "";

        const filmTitle =
            typeof body.filmTitle === "string"
                ? body.filmTitle.trim()
                : "";

        const googleMapsLink =
            typeof body.googleMapsLink === "string"
                ? body.googleMapsLink.trim()
                : "";

        const confirmationLink =
            typeof body.confirmationLink === "string"
                ? body.confirmationLink.trim()
                : "";

        if (!name || !filmTitle || !googleMapsLink || !confirmationLink) {
            return NextResponse.json(
                {
                    error:
                        "name, filmTitle, googleMapsLink and confirmationLink are required.",
                },
                { status: 400 }
            );
        }

        // ---------------------------------------------------------
        // 4. Validate URLs
        // ---------------------------------------------------------

        const safeGoogleMapsLink = validateUrl(
            googleMapsLink,
            "googleMapsLink"
        );

        const safeConfirmationLink = validateUrl(
            confirmationLink,
            "confirmationLink"
        );

        // ---------------------------------------------------------
        // 5. Load template
        // ---------------------------------------------------------

        const templatePath = path.join(
            process.cwd(),
            "emails",
            "lumora-top10.html"
        );

        let html = await readFile(templatePath, "utf8");

        // ---------------------------------------------------------
        // 6. Replace finalist placeholders
        // ---------------------------------------------------------

        html = html
            .replaceAll("{NAME}", escapeHtml(name))
            .replaceAll("{FILM_TITLE}", escapeHtml(filmTitle))
            .replaceAll("{GOOGLE_MAPS_LINK}", safeGoogleMapsLink)
            .replaceAll("{CONFIRMATION_LINK}", safeConfirmationLink);

        // ---------------------------------------------------------
        // 7. Convert base64 images to CID references
        // ---------------------------------------------------------

        const extracted = extractEmbeddedImages(html);

        html = extracted.html;

        // ---------------------------------------------------------
        // 8. Prepare inline attachments
        // ---------------------------------------------------------

        const attachments = extracted.images.map((image) => ({
            filename: image.filename,
            content: Buffer.from(image.base64, "base64"),
            contentId: image.contentId,
        }));

        // ---------------------------------------------------------
        // 9. Send
        // ---------------------------------------------------------

        const resend = new Resend(resendApiKey);

        const { data, error } = await resend.emails.send({
            from: fromEmail,
            to: [testEmail],
            subject: `LUMORA 2026 — Top 10 Finalist Invitation | ${filmTitle}`,
            html,
            attachments,
        });

        if (error) {
            console.error("Resend error:", error);

            return NextResponse.json(
                {
                    error: "Failed to send email.",
                    details: error.message,
                },
                { status: 502 }
            );
        }

        return NextResponse.json({
            success: true,
            message: "LUMORA test email sent successfully.",
            emailId: data?.id ?? null,
            recipient: testEmail,
            inlineImages: attachments.length,
        });
    } catch (error) {
        console.error("LUMORA send-test error:", error);

        return NextResponse.json(
            {
                error: "Internal server error.",
            },
            { status: 500 }
        );
    }
}