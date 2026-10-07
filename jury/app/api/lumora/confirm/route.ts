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

        return NextResponse.json({
            success: true,
            attendance: data,
        });
    } catch (error) {
        console.error("LUMORA confirmation error:", error);

        return NextResponse.json(
            { error: "Internal server error." },
            { status: 500 }
        );
    }
}