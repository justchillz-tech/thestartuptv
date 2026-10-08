"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

type AttendanceData = {
    id: string;
    film_id: string;
    status: "pending" | "confirmed" | "declined";
    guest_count: number;
    confirmed_at: string | null;
    film: {
        title: string;
        director: string;
    } | null;
    participant: {
        participant_name: string;
        participant_email: string;
        title: string;
    } | null;
};

function LumoraConfirmationContent() {
    const searchParams = useSearchParams();
    const token = searchParams.get("token");

    const [attendance, setAttendance] =
        useState<AttendanceData | null>(null);

    const [guestCount, setGuestCount] =
        useState(0);

    const [loading, setLoading] =
        useState(true);

    const [submitting, setSubmitting] =
        useState(false);

    const [error, setError] =
        useState("");

    const [success, setSuccess] =
        useState("");

    useEffect(() => {
        if (!token) {
            setError("Invalid confirmation link.");
            setLoading(false);
            return;
        }

        const loadConfirmation = async () => {
            try {
                const response = await fetch(
                    `/api/lumora/confirm?token=${encodeURIComponent(token)}`
                );

                const data = await response.json();

                if (!response.ok) {
                    throw new Error(
                        data.error ||
                        "Unable to load your invitation."
                    );
                }

                setAttendance(data.attendance);
                setGuestCount(
                    data.attendance.guest_count ?? 0
                );
            } catch (err) {
                setError(
                    err instanceof Error
                        ? err.message
                        : "Unable to load your invitation."
                );
            } finally {
                setLoading(false);
            }
        };

        loadConfirmation();
    }, [token]);

    const submitAttendance = async (
        status: "confirmed" | "declined"
    ) => {
        if (!token) return;

        setSubmitting(true);
        setError("");
        setSuccess("");

        try {
            const response = await fetch(
                "/api/lumora/confirm",
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        token,
                        status,
                        guestCount,
                    }),
                }
            );

            const data = await response.json();

            if (!response.ok) {
                throw new Error(
                    data.error ||
                    "Unable to save your response."
                );
            }

            setAttendance((current) =>
                current
                    ? {
                        ...current,
                        status:
                            data.attendance.status,
                        guest_count:
                            data.attendance.guest_count,
                        confirmed_at:
                            data.attendance.confirmed_at,
                    }
                    : current
            );

            setSuccess(data.message);
        } catch (err) {
            setError(
                err instanceof Error
                    ? err.message
                    : "Unable to save your response."
            );
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) {
        return (
            <div className="lumora-page">
                <div className="lumora-shell">
                    <div className="lumora-loading">
                        <div className="lumora-spinner" />
                        <p>Loading your invitation…</p>
                    </div>
                </div>
            </div>
        );
    }

    if (error && !attendance) {
        return (
            <div className="lumora-page">
                <div className="lumora-shell lumora-small-shell">
                    <div className="lumora-brand">
                        LUMORA 2026
                    </div>

                    <div className="lumora-error-card">
                        <div className="lumora-error-icon">
                            !
                        </div>

                        <h1>
                            Invitation unavailable
                        </h1>

                        <p>{error}</p>

                        <span>
                            If you believe this link was sent to you
                            by mistake, please contact the festival
                            team.
                        </span>
                    </div>

                    <LumoraFooter />
                </div>
            </div>
        );
    }

    const filmTitle =
        attendance?.film?.title ||
        attendance?.participant?.title ||
        "Your selected film";

    const director =
        attendance?.film?.director || "";

    const isConfirmed =
        attendance?.status === "confirmed";

    const isDeclined =
        attendance?.status === "declined";

    return (
        <div className="lumora-page">
            <div className="lumora-shell">

                <header className="lumora-header">
                    <div className="lumora-brand">
                        LUMORA <span>2026</span>
                    </div>

                    <div className="lumora-header-line" />
                </header>

                <main>

                    <section className="lumora-hero">
                        <div className="lumora-eyebrow">
                            TOP 10 FINALIST INVITATION
                        </div>

                        <h1>
                            Confirm Your
                            <br />
                            <em>Attendance.</em>
                        </h1>

                        <div className="lumora-orange-line" />
                    </section>

                    {attendance?.participant && (
                        <section className="lumora-welcome">
                            <p className="lumora-label">
                                CONGRATULATIONS
                            </p>

                            <h2>
                                {attendance.participant.participant_name}
                            </h2>

                            <p>
                                Your film has been selected among
                                the Top 10 finalists for LUMORA
                                2026. We would be delighted to
                                welcome you to the festival.
                            </p>
                        </section>
                    )}

                    <section className="lumora-film-card">
                        <div className="film-card-label">
                            SELECTED FILM
                        </div>

                        <h2>{filmTitle}</h2>

                        {director && (
                            <p>
                                Directed by{" "}
                                <strong>{director}</strong>
                            </p>
                        )}
                    </section>

                    <section className="lumora-info-grid">

                        <div className="lumora-info-card">
                            <span>DATE</span>
                            <strong>
                                17 October 2026
                            </strong>
                        </div>

                        <div className="lumora-info-card">
                            <span>VENUE</span>
                            <strong>
                                Startup Park,
                                <br />
                                Bengaluru
                            </strong>
                        </div>

                    </section>

                    {isConfirmed ? (
                        <section className="lumora-response confirmed">
                            <div className="response-icon">
                                ✓
                            </div>

                            <p className="lumora-label">
                                ATTENDANCE CONFIRMED
                            </p>

                            <h2>
                                We&apos;ll see you there.
                            </h2>

                            <p>
                                Your attendance has been
                                successfully recorded.
                            </p>

                            <a
                                href="https://maps.app.goo.gl/4AEePEoyJ8NZ1JGc9"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="lumora-map-button"
                            >
                                View Location on Google Maps
                                <span>↗</span>
                            </a>
                        </section>
                    ) : isDeclined ? (
                        <section className="lumora-response declined">
                            <div className="response-icon">
                                ✓
                            </div>

                            <p className="lumora-label">
                                RESPONSE RECORDED
                            </p>

                            <h2>
                                We&apos;re sorry to miss you.
                            </h2>

                            <p>
                                Your response has been recorded.
                                Thank you for letting us know.
                            </p>
                        </section>
                    ) : (
                        <section className="lumora-attendance">

                            <div className="lumora-section-heading">
                                <span>01</span>

                                <div>
                                    <p className="lumora-label">
                                        ATTENDANCE
                                    </p>

                                    <h2>
                                        Will you be joining us?
                                    </h2>
                                </div>
                            </div>

                            <div className="lumora-guest-box">
                                <label htmlFor="guest-count">
                                    NUMBER OF GUESTS
                                </label>

                                <p>
                                    Please include yourself in the
                                    total number of guests attending.
                                </p>

                                <select
                                    id="guest-count"
                                    value={guestCount}
                                    onChange={(event) =>
                                        setGuestCount(
                                            Number(event.target.value)
                                        )
                                    }
                                    disabled={submitting}
                                >
                                    {Array.from(
                                        { length: 6 },
                                        (_, index) => (
                                            <option
                                                key={index}
                                                value={index}
                                            >
                                                {index}{" "}
                                                {index === 1
                                                    ? "guest"
                                                    : "guests"}
                                            </option>
                                        )
                                    )}
                                </select>
                            </div>

                            {error && (
                                <div className="lumora-inline-error">
                                    {error}
                                </div>
                            )}

                            <div className="lumora-actions">

                                <button
                                    type="button"
                                    className="lumora-primary-button"
                                    disabled={submitting}
                                    onClick={() =>
                                        submitAttendance("confirmed")
                                    }
                                >
                                    {submitting
                                        ? "SAVING…"
                                        : "YES, I'LL ATTEND"}
                                </button>

                                <button
                                    type="button"
                                    className="lumora-secondary-button"
                                    disabled={submitting}
                                    onClick={() =>
                                        submitAttendance("declined")
                                    }
                                >
                                    I CAN&apos;T ATTEND
                                </button>

                            </div>

                        </section>
                    )}

                    {success &&
                        !isConfirmed &&
                        !isDeclined && (
                            <div className="lumora-success">
                                {success}
                            </div>
                        )}

                    {!isDeclined && !isConfirmed && (
                        <a
                            href="https://maps.app.goo.gl/4AEePEoyJ8NZ1JGc9"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="lumora-map-link"
                        >
                            View Location on Google Maps
                            <span>↗</span>
                        </a>
                    )}

                </main>

                <LumoraFooter />

            </div>

            <style jsx global>{`

        * {
          box-sizing: border-box;
        }

        html,
        body {
          margin: 0;
          padding: 0;
        }

        body {
          background: #08080d;
        }

        .lumora-page {
          min-height: 100vh;
          background:
            radial-gradient(
              circle at 50% 0%,
              rgba(203, 29, 127, .12),
              transparent 35%
            ),
            radial-gradient(
              circle at 90% 50%,
              rgba(150, 54, 148, .08),
              transparent 30%
            ),
            #08080d;

          color: #fff;

          font-family:
            Arial,
            Helvetica,
            sans-serif;

          padding:
            28px 16px 40px;
        }

        .lumora-shell {
          width: 100%;
          max-width: 760px;
          margin: 0 auto;
        }

        .lumora-small-shell {
          max-width: 600px;
        }

        .lumora-header {
          display: flex;
          align-items: center;
          gap: 22px;
          margin-bottom: 70px;
        }

        .lumora-brand {
          color: #fff;
          font-size: 15px;
          font-weight: 800;
          letter-spacing: .18em;
        }

        .lumora-brand span {
          color: #F3961F;
        }

        .lumora-header-line {
          height: 1px;
          flex: 1;
          background:
            linear-gradient(
              90deg,
              rgba(243,150,31,.45),
              rgba(203,29,127,0)
            );
        }

        .lumora-hero {
          margin-bottom: 55px;
        }

        .lumora-eyebrow,
        .lumora-label,
        .film-card-label,
        .lumora-info-card span,
        .lumora-guest-box label {
          font-size: 10px;
          font-weight: 800;
          letter-spacing: .22em;
          color: #F3961F;
        }

        .lumora-hero h1 {
          margin:
            18px 0 22px;

          font-size:
            clamp(42px, 8vw, 72px);

          line-height: .94;
          letter-spacing: -.045em;
        }

        .lumora-hero h1 em {
          font-style: normal;
          background:
            linear-gradient(
              90deg,
              #F3961F,
              #EF6A37,
              #CB1D7F
            );
          -webkit-background-clip: text;
          background-clip: text;
          color: transparent;
        }

        .lumora-orange-line {
          width: 70px;
          height: 3px;
          background:
            linear-gradient(
              90deg,
              #F3961F,
              #CB1D7F
            );
        }

        .lumora-welcome {
          margin-bottom: 38px;
        }

        .lumora-welcome h2 {
          margin:
            10px 0 14px;

          font-size: 28px;
          line-height: 1.1;
        }

        .lumora-welcome > p:last-child {
          max-width: 680px;
          margin: 0;

          color: #a7a7b2;
          font-size: 15px;
          line-height: 1.8;
        }

        .lumora-film-card {
          padding: 30px;
          margin-bottom: 18px;

          border:
            1px solid rgba(255,255,255,.09);

          border-radius: 18px;

          background:
            linear-gradient(
              135deg,
              rgba(255,255,255,.065),
              rgba(255,255,255,.025)
            );

          box-shadow:
            0 25px 80px rgba(0,0,0,.28);
        }

        .lumora-film-card h2 {
          margin:
            12px 0 8px;

          font-size:
            clamp(28px, 5vw, 42px);

          letter-spacing: -.03em;
        }

        .lumora-film-card p {
          margin: 0;
          color: #8f8f9b;
        }

        .lumora-film-card strong {
          color: #fff;
        }

        .lumora-info-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 18px;
          margin-bottom: 55px;
        }

        .lumora-info-card {
          padding: 25px;
          border-radius: 16px;
          border:
            1px solid rgba(255,255,255,.07);
          background:
            rgba(255,255,255,.025);
        }

        .lumora-info-card strong {
          display: block;
          margin-top: 12px;
          color: #fff;
          font-size: 18px;
          line-height: 1.4;
        }

        .lumora-section-heading {
          display: flex;
          gap: 20px;
          align-items: flex-start;
          margin-bottom: 28px;
        }

        .lumora-section-heading > span {
          color: #CB1D7F;
          font-size: 12px;
          font-weight: 800;
          letter-spacing: .12em;
        }

        .lumora-section-heading h2 {
          margin:
            8px 0 0;

          font-size: 30px;
          letter-spacing: -.03em;
        }

        .lumora-guest-box {
          padding: 25px;
          border:
            1px solid rgba(255,255,255,.08);
          border-radius: 16px;
          background: rgba(255,255,255,.025);
        }

        .lumora-guest-box p {
          margin:
            10px 0 20px;

          color: #8f8f9b;
          font-size: 13px;
          line-height: 1.6;
        }

        .lumora-guest-box select {
          width: 100%;
          padding: 15px 16px;

          border:
            1px solid rgba(255,255,255,.12);

          border-radius: 10px;

          background: #111119;
          color: #fff;

          font-size: 15px;
          outline: none;
        }

        .lumora-actions {
          display: grid;
          grid-template-columns: 1.5fr 1fr;
          gap: 12px;
          margin-top: 18px;
        }

        .lumora-primary-button,
        .lumora-secondary-button,
        .lumora-map-button {
          border: 0;
          border-radius: 999px;
          padding: 16px 20px;

          font-size: 11px;
          font-weight: 800;
          letter-spacing: .1em;

          cursor: pointer;
          text-decoration: none;

          transition:
            transform .2s ease,
            opacity .2s ease,
            box-shadow .2s ease;
        }

        .lumora-primary-button {
          color: #10090a;

          background:
            linear-gradient(
              90deg,
              #F3961F,
              #EF6A37
            );

          box-shadow:
            0 12px 30px
            rgba(239,106,55,.18);
        }

        .lumora-secondary-button {
          color: #fff;

          background:
            rgba(255,255,255,.06);

          border:
            1px solid rgba(255,255,255,.12);
        }

        .lumora-primary-button:hover,
        .lumora-secondary-button:hover,
        .lumora-map-button:hover {
          transform: translateY(-2px);
        }

        .lumora-primary-button:disabled,
        .lumora-secondary-button:disabled {
          opacity: .5;
          cursor: not-allowed;
          transform: none;
        }

        .lumora-map-link {
          display: flex;
          justify-content: center;
          align-items: center;
          gap: 8px;

          margin-top: 30px;

          color: #F3961F;
          text-decoration: none;

          font-size: 12px;
          font-weight: 700;
          letter-spacing: .05em;
        }

        .lumora-map-button {
          display: inline-flex;
          margin-top: 25px;
          color: #10090a;

          background:
            linear-gradient(
              90deg,
              #F3961F,
              #EF6A37
            );
        }

        .lumora-response {
          text-align: center;
          padding: 48px 30px;

          border:
            1px solid rgba(255,255,255,.08);

          border-radius: 20px;
          background:
            rgba(255,255,255,.025);
        }

        .response-icon {
          display: flex;
          align-items: center;
          justify-content: center;

          width: 58px;
          height: 58px;
          margin: 0 auto 20px;

          border-radius: 50%;

          background:
            linear-gradient(
              135deg,
              #F3961F,
              #CB1D7F
            );

          color: #fff;
          font-size: 25px;
          font-weight: 800;
        }

        .lumora-response h2 {
          margin:
            10px 0;

          font-size: 30px;
        }

        .lumora-response > p:not(.lumora-label) {
          color: #90909b;
          margin: 0;
        }

        .lumora-success,
        .lumora-inline-error {
          margin-top: 18px;
          padding: 13px 16px;
          border-radius: 10px;
          font-size: 13px;
        }

        .lumora-success {
          color: #b7f5ce;
          background: rgba(60,190,110,.09);
          border:
            1px solid rgba(60,190,110,.18);
        }

        .lumora-inline-error {
          color: #ffb4b4;
          background: rgba(255,70,70,.08);
          border:
            1px solid rgba(255,70,70,.16);
        }

        .lumora-error-card {
          padding: 45px 30px;
          text-align: center;

          border:
            1px solid rgba(255,255,255,.08);

          border-radius: 20px;
          background: rgba(255,255,255,.025);
        }

        .lumora-error-icon {
          width: 54px;
          height: 54px;

          display: flex;
          align-items: center;
          justify-content: center;

          margin: 0 auto 20px;

          border-radius: 50%;

          background:
            rgba(203,29,127,.14);

          color: #EF6A37;
          font-size: 25px;
          font-weight: 800;
        }

        .lumora-error-card h1 {
          margin:
            0 0 12px;

          font-size: 30px;
        }

        .lumora-error-card p {
          margin:
            0 auto 12px;

          color: #b4b4bf;
        }

        .lumora-error-card span {
          color: #6f6f7b;
          font-size: 12px;
        }

        .lumora-loading {
          min-height: 70vh;

          display: flex;
          align-items: center;
          justify-content: center;
          flex-direction: column;

          gap: 18px;

          color: #8f8f9b;
        }

        .lumora-spinner {
          width: 34px;
          height: 34px;

          border:
            2px solid rgba(255,255,255,.12);

          border-top-color: #F3961F;

          border-radius: 50%;

          animation:
            lumora-spin .8s linear infinite;
        }

        @keyframes lumora-spin {
          to {
            transform: rotate(360deg);
          }
        }

        .lumora-footer {
          margin-top: 70px;
          padding-top: 24px;

          border-top:
            1px solid rgba(255,255,255,.07);

          text-align: center;
        }

        .lumora-footer strong {
          display: block;

          color: #fff;

          font-size: 12px;
          letter-spacing: .16em;
        }

        .lumora-footer span {
          display: block;

          margin-top: 8px;

          color: #64646f;

          font-size: 11px;
        }

        @media (max-width: 600px) {

          .lumora-page {
            padding:
              22px 14px 30px;
          }

          .lumora-header {
            margin-bottom: 50px;
          }

          .lumora-info-grid,
          .lumora-actions {
            grid-template-columns: 1fr;
          }

          .lumora-film-card,
          .lumora-info-card,
          .lumora-guest-box {
            padding: 22px;
          }

          .lumora-section-heading h2 {
            font-size: 25px;
          }

        }

      `}</style>
        </div>
    );
}

function LumoraFooter() {
    return (
        <footer className="lumora-footer">
            <strong>
                LUMORA 2026
            </strong>

            <span>
                A Startup TV Initiative
                <br />
                contact@thestartuptv.com · +91 90350 64016
            </span>
        </footer>
    );
}

export default function LumoraConfirmationPage() {
    return (
        <Suspense
            fallback={
                <div className="lumora-page">
                    <div className="lumora-loading">
                        Loading…
                    </div>
                </div>
            }
        >
            <LumoraConfirmationContent />
        </Suspense>
    );
}