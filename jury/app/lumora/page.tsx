"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

type Attendance = {
    id: string;
    film_id: string;
    status: "pending" | "confirmed" | "declined";
    guest_count: number;
    confirmed_at: string | null;
    film:
    | {
        title: string;
        director: string;
    }
    | null;
};

function LumoraConfirmationContent() {
    const searchParams = useSearchParams();
    const token = searchParams.get("token");

    const [attendance, setAttendance] = useState<Attendance | null>(null);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState("");
    const [guestCount, setGuestCount] = useState(0);
    const [result, setResult] = useState<
        "confirmed" | "declined" | null
    >(null);

    useEffect(() => {
        if (!token) {
            setError("Invalid confirmation link.");
            setLoading(false);
            return;
        }

        async function loadConfirmation() {
            try {
                const response = await fetch(
                    `/api/lumora/confirm?token=${encodeURIComponent(token!)}`
                );

                const data = await response.json();

                if (!response.ok) {
                    throw new Error(
                        data.error || "Unable to load confirmation."
                    );
                }

                setAttendance(data.attendance);

                if (data.attendance.status === "confirmed") {
                    setResult("confirmed");
                }

                if (data.attendance.status === "declined") {
                    setResult("declined");
                }
            } catch (err) {
                setError(
                    err instanceof Error
                        ? err.message
                        : "Unable to load confirmation."
                );
            } finally {
                setLoading(false);
            }
        }

        loadConfirmation();
    }, [token]);

    async function submitAttendance(
        status: "confirmed" | "declined"
    ) {
        if (!token) return;

        setSubmitting(true);
        setError("");

        try {
            const response = await fetch("/api/lumora/confirm", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    token,
                    status,
                    guestCount,
                }),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(
                    data.error || "Unable to update attendance."
                );
            }

            setResult(status);

            setAttendance((current) =>
                current
                    ? {
                        ...current,
                        status,
                        guest_count:
                            status === "confirmed" ? guestCount : 0,
                    }
                    : current
            );
        } catch (err) {
            setError(
                err instanceof Error
                    ? err.message
                    : "Unable to update attendance."
            );
        } finally {
            setSubmitting(false);
        }
    }

    if (loading) {
        return (
            <main className="min-h-screen bg-[#12090a] text-white flex items-center justify-center px-6">
                <div className="text-center">
                    <div className="text-2xl font-semibold">
                        LUMORA 2026
                    </div>
                    <p className="mt-3 text-white/60">
                        Loading your invitation...
                    </p>
                </div>
            </main>
        );
    }

    if (error) {
        return (
            <main className="min-h-screen bg-[#12090a] text-white flex items-center justify-center px-6">
                <div className="w-full max-w-xl text-center">
                    <div className="text-4xl mb-6">LUMORA</div>

                    <h1 className="text-2xl font-semibold">
                        Invalid Confirmation Link
                    </h1>

                    <p className="mt-4 text-white/60">
                        {error}
                    </p>

                    <p className="mt-8 text-sm text-white/40">
                        If you believe you received this link in error,
                        please contact the LUMORA team.
                    </p>
                </div>
            </main>
        );
    }

    if (!attendance) {
        return null;
    }

    const filmTitle =
        attendance.film?.title || "Your selected film";

    if (result === "confirmed") {
        return (
            <main className="min-h-screen bg-[#12090a] text-white flex items-center justify-center px-6 py-12">
                <div className="w-full max-w-2xl text-center">
                    <div className="mb-10">
                        <div className="text-4xl font-bold tracking-wide">
                            LUMORA
                        </div>

                        <div className="mt-2 text-sm tracking-[0.35em] text-white/50">
                            SHORT FILM FESTIVAL
                        </div>
                    </div>

                    <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-8 md:p-12">
                        <div className="text-5xl mb-6">✓</div>

                        <h1 className="text-3xl md:text-4xl font-bold">
                            You're Confirmed.
                        </h1>

                        <p className="mt-5 text-white/70 leading-relaxed">
                            Thank you for confirming your attendance at
                            LUMORA 2026.
                        </p>

                        <div className="mt-8 rounded-2xl bg-white/[0.05] p-6">
                            <p className="text-sm uppercase tracking-[0.2em] text-white/40">
                                Selected Film
                            </p>

                            <p className="mt-3 text-xl font-semibold">
                                {filmTitle}
                            </p>

                            {guestCount > 0 && (
                                <p className="mt-3 text-white/60">
                                    Additional guests: {guestCount}
                                </p>
                            )}
                        </div>

                        <div className="mt-8 text-white/60">
                            <p className="font-medium text-white">
                                17 October 2026
                            </p>

                            <p className="mt-1">
                                Startup Park, Bengaluru
                            </p>
                        </div>

                        <a
                            href="https://maps.app.goo.gl/4AEePEoyJ8NZ1JGc9"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-block mt-8 rounded-full bg-white px-7 py-3 text-sm font-semibold text-black transition hover:scale-105"
                        >
                            View Venue on Google Maps
                        </a>
                    </div>
                </div>
            </main>
        );
    }

    if (result === "declined") {
        return (
            <main className="min-h-screen bg-[#12090a] text-white flex items-center justify-center px-6 py-12">
                <div className="w-full max-w-2xl text-center">
                    <div className="text-4xl font-bold tracking-wide">
                        LUMORA
                    </div>

                    <div className="mt-10 rounded-3xl border border-white/10 bg-white/[0.04] p-8 md:p-12">
                        <h1 className="text-3xl font-bold">
                            Attendance Declined
                        </h1>

                        <p className="mt-5 text-white/60 leading-relaxed">
                            We've recorded that you won't be attending
                            LUMORA 2026.
                        </p>

                        <p className="mt-8 text-sm text-white/40">
                            If this was selected by mistake, please contact
                            the LUMORA team.
                        </p>
                    </div>
                </div>
            </main>
        );
    }

    return (
        <main className="min-h-screen bg-[#12090a] text-white flex items-center justify-center px-6 py-12">
            <div className="w-full max-w-2xl">
                <div className="text-center mb-10">
                    <div className="text-4xl font-bold tracking-wide">
                        LUMORA
                    </div>

                    <div className="mt-2 text-sm tracking-[0.35em] text-white/50">
                        SHORT FILM FESTIVAL
                    </div>
                </div>

                <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-8 md:p-12">
                    <p className="text-sm uppercase tracking-[0.2em] text-white/40">
                        Top 10 Finalist
                    </p>

                    <h1 className="mt-4 text-3xl md:text-4xl font-bold">
                        Confirm Your Attendance
                    </h1>

                    <p className="mt-5 text-white/70 leading-relaxed">
                        We're delighted to welcome you to LUMORA 2026.
                        Please confirm whether you'll be joining us for
                        the festival.
                    </p>

                    <div className="mt-8 rounded-2xl bg-white/[0.05] p-6">
                        <p className="text-sm text-white/40">
                            Selected Film
                        </p>

                        <p className="mt-2 text-xl font-semibold">
                            {filmTitle}
                        </p>

                        <div className="mt-5">
                            <p className="text-sm text-white/40">
                                Date
                            </p>

                            <p className="mt-1 font-medium">
                                17 October 2026
                            </p>
                        </div>

                        <div className="mt-4">
                            <p className="text-sm text-white/40">
                                Venue
                            </p>

                            <p className="mt-1 font-medium">
                                Startup Park, Bengaluru
                            </p>
                        </div>
                    </div>

                    <div className="mt-8">
                        <label
                            htmlFor="guestCount"
                            className="block text-sm font-medium"
                        >
                            Additional guests
                        </label>

                        <select
                            id="guestCount"
                            value={guestCount}
                            onChange={(event) =>
                                setGuestCount(Number(event.target.value))
                            }
                            className="mt-2 w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-white outline-none focus:border-white/30"
                        >
                            {Array.from({ length: 6 }, (_, index) => (
                                <option
                                    key={index}
                                    value={index}
                                    className="bg-[#12090a]"
                                >
                                    {index === 0
                                        ? "No additional guests"
                                        : `${index} guest${index > 1 ? "s" : ""}`}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className="mt-8 grid gap-4 sm:grid-cols-2">
                        <button
                            type="button"
                            disabled={submitting}
                            onClick={() => submitAttendance("confirmed")}
                            className="rounded-xl bg-white px-6 py-4 font-semibold text-black transition hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            {submitting
                                ? "Processing..."
                                : "YES, I'LL ATTEND"}
                        </button>

                        <button
                            type="button"
                            disabled={submitting}
                            onClick={() => submitAttendance("declined")}
                            className="rounded-xl border border-white/15 px-6 py-4 font-semibold text-white transition hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            I CAN'T ATTEND
                        </button>
                    </div>

                    <a
                        href="https://maps.app.goo.gl/4AEePEoyJ8NZ1JGc9"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block mt-6 text-center text-sm text-white/50 hover:text-white transition"
                    >
                        View venue on Google Maps →
                    </a>
                </div>
            </div>
        </main>
    );
}
export default function LumoraConfirmationPage() {
    return (
        <Suspense
            fallback={
                <main className="min-h-screen bg-[#12090a] text-white flex items-center justify-center px-6">
                    <div className="text-center">
                        <div className="text-2xl font-semibold">
                            LUMORA 2026
                        </div>

                        <p className="mt-3 text-white/60">
                            Loading your invitation...
                        </p>
                    </div>
                </main>
            }
        >
            <LumoraConfirmationContent />
        </Suspense>
    );
}