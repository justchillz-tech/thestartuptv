import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

const ALLOWED_ORIGIN = "https://festival.thestartuptv.com";

function corsHeaders() {
    return {
        "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
    };
}

function response(
    body: Record<string, unknown>,
    status = 200
) {
    return NextResponse.json(body, {
        status,
        headers: corsHeaders(),
    });
}

function clean(value: unknown) {
    return typeof value === "string" ? value.trim() : "";
}

function isValidUrl(value: string) {
    try {
        const url = new URL(value);

        return (
            url.protocol === "https:" ||
            url.protocol === "http:"
        );
    } catch {
        return false;
    }
}

function isValidEmail(value: string) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export async function OPTIONS() {
    return new NextResponse(null, {
        status: 204,
        headers: corsHeaders(),
    });
}

export async function POST(request: Request) {
    try {
        const origin = request.headers.get("origin");

        if (origin !== ALLOWED_ORIGIN) {
            return response(
                { error: "Invalid submission origin." },
                403
            );
        }

        const body = await request.json();

        const participantName = clean(body.participant_name);
        const participantEmail = clean(body.participant_email).toLowerCase();
        const contactNumber = clean(body.contact_number);
        const organization = clean(body.organization);

        const title = clean(body.title);
        const genre = clean(body.genre);
        const duration = clean(body.duration);
        const productionYear = clean(body.production_year);
        const directorName = clean(body.director_name);
        const producerName = clean(body.producer_name);
        const language = clean(body.language);
        const synopsis = clean(body.synopsis);
        const castCrew = clean(body.cast_crew);

        const filmUrl = clean(body.film_url);
        const rightsConfirmation = body.rights_confirmation === true;

        if (
            !participantName ||
            !participantEmail ||
            !title ||
            !directorName ||
            !duration ||
            !language ||
            !filmUrl
        ) {
            return response(
                {
                    error:
                        "Please complete all required submission fields.",
                },
                400
            );
        }

        if (!isValidEmail(participantEmail)) {
            return response(
                { error: "Please provide a valid email address." },
                400
            );
        }

        if (!isValidUrl(filmUrl)) {
            return response(
                { error: "Please provide a valid film link." },
                400
            );
        }

        if (!rightsConfirmation) {
            return response(
                {
                    error:
                        "You must confirm that you have the necessary rights and permissions to submit the film.",
                },
                400
            );
        }

        const year = productionYear
            ? Number(productionYear)
            : null;

        if (
            year !== null &&
            (!Number.isInteger(year) || year < 2024 || year > 2100)
        ) {
            return response(
                {
                    error:
                        "Please enter a valid production year.",
                },
                400
            );
        }

        const admin = createAdminClient();

        const { data, error } = await admin
            .from("film_submissions")
            .insert({
                source_row_id: `native_${crypto.randomUUID()}`,
                submitted_at: new Date().toISOString(),

                participant_email: participantEmail,
                submitted_email: participantEmail,
                participant_name: participantName,
                contact_number: contactNumber || null,
                organization: organization || null,

                title,
                genre: genre || null,
                duration,
                production_year: year ? String(year) : null,
                director_name: directorName,
                producer_name: producerName || null,
                language,
                synopsis: synopsis || null,
                cast_crew: castCrew || null,
                film_url: filmUrl,

                status: "pending",
            })
            .select("id, title, status")
            .single();

        if (error) {
            console.error("Public film submission error:", error);

            return response(
                {
                    error:
                        "We could not save your submission. Please try again.",
                },
                500
            );
        }

        return response(
            {
                success: true,
                message:
                    "Your film has been submitted successfully.",
                submission: data,
            },
            201
        );
    } catch (error) {
        console.error("Public submission API error:", error);

        return response(
            {
                error:
                    "Something went wrong while processing your submission.",
            },
            500
        );
    }
}