import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

type SubmissionPayload = {
    source_row_id: string;
    submitted_at?: string | null;
    participant_email?: string | null;
    submitted_email?: string | null;
    participant_name: string;
    contact_number?: string | null;
    organization?: string | null;
    title: string;
    genre?: string | null;
    duration?: string | null;
    production_year?: string | null;
    director_name?: string | null;
    producer_name?: string | null;
    language?: string | null;
    synopsis?: string | null;
    cast_crew?: string | null;
    film_url?: string | null;
};

export async function POST(request: NextRequest) {
    try {
        const supabaseAdmin = createAdminClient();
        const secret = request.headers.get("x-participant-sync-secret");

        if (
            !secret ||
            secret !== process.env.PARTICIPANT_SYNC_SECRET
        ) {
            return NextResponse.json(
                { error: "Unauthorized" },
                { status: 401 }
            );
        }

        const body = await request.json();

        const submissions: SubmissionPayload[] = Array.isArray(body)
            ? body
            : [body];

        if (submissions.length === 0) {
            return NextResponse.json(
                { error: "No submissions supplied." },
                { status: 400 }
            );
        }

        for (const submission of submissions) {
            if (
                !submission.source_row_id ||
                !submission.participant_name ||
                !submission.title
            ) {
                return NextResponse.json(
                    {
                        error:
                            "Each submission requires source_row_id, participant_name and title.",
                    },
                    { status: 400 }
                );
            }
        }

        const { data, error } = await supabaseAdmin
            .from("film_submissions")
            .upsert(
                submissions.map((submission) => ({
                    source_row_id: submission.source_row_id,
                    submitted_at: submission.submitted_at || null,
                    participant_email: submission.participant_email || null,
                    submitted_email: submission.submitted_email || null,
                    participant_name: submission.participant_name,
                    contact_number: submission.contact_number || null,
                    organization: submission.organization || null,
                    title: submission.title,
                    genre: submission.genre || null,
                    duration: submission.duration || null,
                    production_year: submission.production_year || null,
                    director_name: submission.director_name || null,
                    producer_name: submission.producer_name || null,
                    language: submission.language || null,
                    synopsis: submission.synopsis || null,
                    cast_crew: submission.cast_crew || null,
                    film_url: submission.film_url || null,
                })),
                {
                    onConflict: "source_row_id",
                    ignoreDuplicates: false,
                }
            )
            .select("id, source_row_id, status");

        if (error) {
            console.error("Participant submission sync error:", error);

            return NextResponse.json(
                {
                    error: "Failed to save submissions.",
                    details: error.message,
                },
                { status: 500 }
            );
        }

        return NextResponse.json({
            success: true,
            count: data?.length ?? 0,
            submissions: data ?? [],
        });
    } catch (error) {
        console.error("Participant submission API error:", error);

        return NextResponse.json(
            { error: "Invalid request." },
            { status: 400 }
        );
    }
}