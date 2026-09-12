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

function clean(value: FormDataEntryValue | null) {
    return typeof value === "string" ? value.trim() : "";
}

function isValidEmail(value: string) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function generateReferralCode() {
    const characters = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

    let code = "STV-";

    for (let i = 0; i < 5; i++) {
        code +=
            characters[
            Math.floor(Math.random() * characters.length)
            ];
    }

    return code;
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
                { error: "Invalid registration origin." },
                403
            );
        }

        const formData = await request.formData();

        const name = clean(formData.get("name"));

        const email = clean(
            formData.get("email")
        ).toLowerCase();

        const contactNumber = clean(
            formData.get("contact_number")
        );

        if (!name || !email) {
            return response(
                {
                    error:
                        "Please provide your name and email address.",
                },
                400
            );
        }

        if (!isValidEmail(email)) {
            return response(
                {
                    error:
                        "Please provide a valid email address.",
                },
                400
            );
        }

        const admin = createAdminClient();

        /*
         * Check whether this email is already registered.
         */
        const { data: existingReferrer, error: lookupError } =
            await admin
                .from("festival_referrers")
                .select("id, referral_code, is_active")
                .eq("email", email)
                .maybeSingle();

        if (lookupError) {
            console.error(
                "Referrer lookup database error:",
                lookupError
            );

            return response(
                {
                    error:
                        "We could not process your registration. Please try again.",
                },
                500
            );
        }

        if (existingReferrer) {
            return response(
                {
                    error:
                        existingReferrer.is_active
                            ? "This email address is already registered as a referrer."
                            : "This referrer account is currently inactive.",
                },
                409
            );
        }

        /*
         * Generate a unique referral code.
         */
        let referralCode = "";
        let codeExists = true;

        for (let attempt = 0; attempt < 5; attempt++) {
            referralCode = generateReferralCode();

            const { data: existingCode, error: codeLookupError } =
                await admin
                    .from("festival_referrers")
                    .select("id")
                    .eq("referral_code", referralCode)
                    .maybeSingle();

            if (codeLookupError) {
                console.error(
                    "Referral code lookup database error:",
                    codeLookupError
                );

                return response(
                    {
                        error:
                            "We could not generate a referral code. Please try again.",
                    },
                    500
                );
            }

            if (!existingCode) {
                codeExists = false;
                break;
            }
        }

        if (codeExists) {
            return response(
                {
                    error:
                        "We could not generate a unique referral code. Please try again.",
                },
                500
            );
        }

        /*
         * Create the referrer.
         */
        const { data: referrer, error: insertError } =
            await admin
                .from("festival_referrers")
                .insert({
                    name,
                    email,
                    contact_number:
                        contactNumber || null,
                    referral_code: referralCode,
                    is_active: true,
                })
                .select(
                    "id, name, email, contact_number, referral_code, is_active, created_at"
                )
                .single();

        if (insertError) {
            console.error(
                "Referrer registration database error:",
                insertError
            );

            /*
             * A unique constraint may have been hit because
             * another registration was created at the same time.
             */
            if (insertError.code === "23505") {
                return response(
                    {
                        error:
                            "This email address or referral code is already registered. Please try again.",
                    },
                    409
                );
            }

            return response(
                {
                    error:
                        "We could not complete your registration. Please try again.",
                },
                500
            );
        }

        return response(
            {
                success: true,

                message:
                    "Your referral account has been created successfully.",

                referrer,

                referral_url:
                    `https://festival.thestartuptv.com/r/${referralCode}`,
            },
            201
        );
    } catch (error) {
        console.error(
            "Public referrer registration API error:",
            error
        );

        return response(
            {
                error:
                    "Something went wrong while processing your registration.",
            },
            500
        );
    }
}