import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

const ALLOWED_ORIGIN = "https://festival.thestartuptv.com";

const ALLOWED_MIME_TYPES = [
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];

const MAX_FILE_SIZE = 10 * 1024 * 1024;

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

function clean(value: FormDataEntryValue | null) {
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

function safeFileName(name: string) {
    return name
        .replace(/[^a-zA-Z0-9._-]/g, "_")
        .replace(/_+/g, "_");
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

        const formData = await request.formData();

        const participantName = clean(
            formData.get("participant_name")
        );

        const participantEmail = clean(
            formData.get("participant_email")
        ).toLowerCase();

        const contactNumber = clean(
            formData.get("contact_number")
        );

        const organization = clean(
            formData.get("organization")
        );

        const title = clean(formData.get("title"));
        const genre = clean(formData.get("genre"));
        const duration = clean(formData.get("duration"));

        const productionYear = clean(
            formData.get("production_year")
        );

        const directorName = clean(
            formData.get("director_name")
        );

        const producerName = clean(
            formData.get("producer_name")
        );

        const language = clean(
            formData.get("language")
        );

        const synopsis = clean(
            formData.get("synopsis")
        );

        const castCrew = clean(
            formData.get("cast_crew")
        );

        const filmUrl = clean(
            formData.get("film_url")
        );

        const rightsConfirmation =
            formData.get("rights_confirmation") === "true";

        const uploadedFile = formData.get(
            "cast_crew_file"
        );

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
                {
                    error:
                        "Please provide a valid email address.",
                },
                400
            );
        }

        if (!isValidUrl(filmUrl)) {
            return response(
                {
                    error:
                        "Please provide a valid film link.",
                },
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
            (!Number.isInteger(year) ||
                year < 2024 ||
                year > 2100)
        ) {
            return response(
                {
                    error:
                        "Please enter a valid production year.",
                },
                400
            );
        }

        let uploadedFilePath: string | null = null;

        /*
         * Validate and upload Cast & Crew document.
         */
        if (
            uploadedFile instanceof File &&
            uploadedFile.size > 0
        ) {
            if (uploadedFile.size > MAX_FILE_SIZE) {
                return response(
                    {
                        error:
                            "Cast & Crew document must be 10 MB or smaller.",
                    },
                    400
                );
            }

            if (
                !ALLOWED_MIME_TYPES.includes(
                    uploadedFile.type
                )
            ) {
                return response(
                    {
                        error:
                            "Cast & Crew document must be a PDF, DOC or DOCX file.",
                    },
                    400
                );
            }

            const admin = createAdminClient();

            const fileName = safeFileName(
                uploadedFile.name
            );

            const filePath =
                `submissions/${crypto.randomUUID()}-${fileName}`;

            const { error: uploadError } =
                await admin.storage
                    .from("submission-attachments")
                    .upload(
                        filePath,
                        uploadedFile,
                        {
                            contentType:
                                uploadedFile.type,
                            upsert: false,
                        }
                    );

            if (uploadError) {
                console.error(
                    "Cast & Crew upload error:",
                    uploadError
                );

                return response(
                    {
                        error:
                            "We could not upload the Cast & Crew document. Please try again.",
                    },
                    500
                );
            }

            uploadedFilePath = filePath;
        }

        /*
         * Save submission record.
         */
        const admin = createAdminClient();

        const { data, error } = await admin
            .from("film_submissions")
            .insert({
                source_row_id:
                    `native_${crypto.randomUUID()}`,

                submitted_at:
                    new Date().toISOString(),

                participant_email:
                    participantEmail,

                submitted_email:
                    participantEmail,

                participant_name:
                    participantName,

                contact_number:
                    contactNumber || null,

                organization:
                    organization || null,

                title,

                genre:
                    genre || null,

                duration,

                production_year:
                    year ? String(year) : null,

                director_name:
                    directorName,

                producer_name:
                    producerName || null,

                language,

                synopsis:
                    synopsis || null,

                cast_crew:
                    castCrew || null,

                cast_crew_file_path:
                    uploadedFilePath,

                film_url:
                    filmUrl,

                status:
                    "pending",
            })
            .select(
                "id, title, status, cast_crew_file_path"
            )
            .single();

        if (error) {
            console.error(
                "Public film submission database error:",
                error
            );

            /*
             * Remove the uploaded file if the database
             * insert fails, preventing orphaned files.
             */
            if (uploadedFilePath) {
                await admin.storage
                    .from("submission-attachments")
                    .remove([uploadedFilePath]);
            }

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
        console.error(
            "Public submission API error:",
            error
        );

        return response(
            {
                error:
                    "Something went wrong while processing your submission.",
            },
            500
        );
    }
}