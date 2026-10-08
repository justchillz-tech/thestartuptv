import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";

function hashToken(token: string): string {
    return crypto
        .createHash("sha256")
        .update(token)
        .digest("hex");
}

export async function GET(request: Request) {
    try {
        const url = new URL(request.url);
        const token = url.searchParams.get("token");

        if (!token) {
            return NextResponse.json(
                { error: "Confirmation token is required." },
                { status: 400 }
            );
        }

        const tokenHash = hashToken(token);
        const supabase = createAdminClient();

        const { data, error } = await supabase
            .from("lumora_attendance")
            .select(`
        id,
        film_id,
        submission_id,
        status,
        guest_count,
        confirmed_at,
        films (
          title,
          director
        )
      `)
            .eq("token_hash", tokenHash)
            .maybeSingle();

        if (error) {
            console.error("LUMORA confirmation lookup error:", error);

            return NextResponse.json(
                { error: "Unable to process confirmation." },
                { status: 500 }
            );
        }

        if (!data) {
            return NextResponse.json(
                { error: "Invalid confirmation link." },
                { status: 404 }
            );
        }

        let participant = null;

        if (data.submission_id) {
            const { data: submission, error: submissionError } =
                await supabase
                    .from("film_submissions")
                    .select("participant_name, participant_email, title")
                    .eq("id", data.submission_id)
                    .maybeSingle();

            if (submissionError) {
                console.error(
                    "LUMORA submission lookup error:",
                    submissionError
                );
            } else {
                participant = submission;
            }
        }

        return NextResponse.json({
            success: true,
            attendance: {
                id: data.id,
                film_id: data.film_id,
                status: data.status,
                guest_count: data.guest_count,
                confirmed_at: data.confirmed_at,
                film: data.films,
                participant,
            },
        });
    } catch (error) {
        console.error("LUMORA confirmation GET error:", error);

        return NextResponse.json(
            { error: "Internal server error." },
            { status: 500 }
        );
    }
}

export async function POST(request: Request) {
    try {
        const body = await request.json();

        const token =
            typeof body.token === "string"
                ? body.token.trim()
                : "";

        const status =
            body.status === "confirmed" || body.status === "declined"
                ? body.status
                : null;

        const guestCount =
            Number.isInteger(body.guestCount) &&
                body.guestCount >= 0 &&
                body.guestCount <= 10
                ? body.guestCount
                : null;

        if (!token) {
            return NextResponse.json(
                { error: "Confirmation token is required." },
                { status: 400 }
            );
        }

        if (!status) {
            return NextResponse.json(
                { error: "Invalid attendance status." },
                { status: 400 }
            );
        }

        if (guestCount === null) {
            return NextResponse.json(
                { error: "Guest count must be between 0 and 10." },
                { status: 400 }
            );
        }

        const tokenHash = hashToken(token);
        const supabase = createAdminClient();

        // Check that the token exists before updating.
        const { data: existing, error: lookupError } =
            await supabase
                .from("lumora_attendance")
                .select("id, status")
                .eq("token_hash", tokenHash)
                .maybeSingle();

        if (lookupError) {
            console.error(
                "LUMORA confirmation lookup error:",
                lookupError
            );

            return NextResponse.json(
                { error: "Unable to process confirmation." },
                { status: 500 }
            );
        }

        if (!existing) {
            return NextResponse.json(
                { error: "Invalid confirmation link." },
                { status: 404 }
            );
        }

        // Don't allow an already completed invitation to be changed.
        if (existing.status !== "pending") {
            return NextResponse.json(
                {
                    error: `This invitation has already been ${existing.status}.`,
                    status: existing.status,
                },
                { status: 409 }
            );
        }

        const updateData = {
            status,
            guest_count: status === "confirmed" ? guestCount : 0,
            confirmed_at:
                status === "confirmed" ? new Date().toISOString() : null,
        };

        const { data: updated, error: updateError } =
            await supabase
                .from("lumora_attendance")
                .update(updateData)
                .eq("id", existing.id)
                .eq("status", "pending")
                .select(
                    "id, film_id, status, guest_count, confirmed_at"
                )
                .single();

        if (updateError) {
            console.error(
                "LUMORA attendance update error:",
                updateError
            );

            return NextResponse.json(
                { error: "Unable to save attendance." },
                { status: 500 }
            );
        }

        return NextResponse.json({
            success: true,
            message:
                status === "confirmed"
                    ? "Attendance confirmed successfully."
                    : "Attendance declined successfully.",
            attendance: updated,
        });
    } catch (error) {
        console.error("LUMORA confirmation POST error:", error);

        return NextResponse.json(
            { error: "Internal server error." },
            { status: 500 }
        );
    }
}