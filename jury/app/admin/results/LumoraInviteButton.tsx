"use client";

import { useState } from "react";

type Props = {
    filmId: string;
    initialStatus?: string | null;
};

export default function LumoraInviteButton({
    filmId,
    initialStatus,
}: Props) {
    const [status, setStatus] =
        useState(initialStatus ?? null);

    const [sending, setSending] =
        useState(false);

    const [message, setMessage] =
        useState("");

    const sendInvite = async () => {
        if (sending) return;

        const isResend =
            status === "pending";

        if (isResend) {
            const confirmed =
                window.confirm(
                    "Resend the LUMORA invitation to this finalist?"
                );

            if (!confirmed) return;
        }

        setSending(true);
        setMessage("");

        try {
            const response =
                await fetch(
                    "/api/lumora/send-invite",
                    {
                        method: "POST",
                        headers: {
                            "Content-Type":
                                "application/json",
                        },
                        body: JSON.stringify({
                            filmId,
                        }),
                    }
                );

            const data =
                await response.json();

            if (!response.ok) {
                throw new Error(
                    data.error ||
                    "Unable to send invitation."
                );
            }

            setStatus("pending");

            setMessage(
                data.message ||
                "Invitation sent."
            );
        } catch (error) {
            setMessage(
                error instanceof Error
                    ? error.message
                    : "Unable to send invitation."
            );
        } finally {
            setSending(false);
        }
    };

    if (
        status === "confirmed"
    ) {
        return (
            <div className="lumora-invite-status confirmed">
                ✓ Attendance confirmed
            </div>
        );
    }

    if (
        status === "declined"
    ) {
        return (
            <div className="lumora-invite-status declined">
                Invitation declined
            </div>
        );
    }

    return (
        <div className="lumora-invite-control">
            <button
                type="button"
                onClick={sendInvite}
                disabled={sending}
                className="lumora-invite-button"
            >
                {sending
                    ? "Sending…"
                    : status === "pending"
                        ? "↻ Resend Invite"
                        : "✉ Send LUMORA Invite"}
            </button>

            {message && (
                <span className="lumora-invite-message">
                    {message}
                </span>
            )}

            <style jsx>{`
        .lumora-invite-control {
          display: flex;
          align-items: center;
          gap: 10px;
          flex-wrap: wrap;
        }

        .lumora-invite-button {
          border: 1px solid
            rgba(243, 150, 31, 0.35);

          background:
            linear-gradient(
              90deg,
              rgba(243, 150, 31, 0.14),
              rgba(203, 29, 127, 0.12)
            );

          color: #f3961f;

          border-radius: 999px;

          padding:
            9px 14px;

          font-size: 10px;
          font-weight: 800;
          letter-spacing: 0.08em;

          cursor: pointer;

          transition:
            transform 0.2s ease,
            border-color 0.2s ease,
            background 0.2s ease;
        }

        .lumora-invite-button:hover {
          transform: translateY(-1px);

          border-color:
            rgba(243, 150, 31, 0.7);

          background:
            linear-gradient(
              90deg,
              rgba(243, 150, 31, 0.22),
              rgba(203, 29, 127, 0.18)
            );
        }

        .lumora-invite-button:disabled {
          opacity: 0.55;
          cursor: wait;
          transform: none;
        }

        .lumora-invite-message {
          color: #888894;
          font-size: 11px;
        }

        .lumora-invite-status {
          font-size: 10px;
          font-weight: 800;
          letter-spacing: 0.07em;
        }

        .lumora-invite-status.confirmed {
          color: #70d69a;
        }

        .lumora-invite-status.declined {
          color: #d98a8a;
        }
      `}</style>
        </div>
    );
}