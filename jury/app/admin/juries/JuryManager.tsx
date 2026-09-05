"use client";

import { FormEvent, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type AccountRole = "jury" | "management";

type JuryMember = {
  id: string;
  name: string;
  email: string;
  role: AccountRole | "admin";
  created_at: string;
};

export default function JuryManager() {
  const supabase = createClient();

  const [juries, setJuries] = useState<JuryMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const [form, setForm] = useState<{
    name: string;
    email: string;
    role: AccountRole;
  }>({
    name: "",
    email: "",
    role: "jury",
  });

  async function loadJuries() {
    setLoading(true);
    setError("");

    const { data, error: loadError } = await supabase
      .from("juries")
      .select("id, name, email, role, created_at")
      .order("created_at", { ascending: true });

    if (loadError) {
      setError(loadError.message);
    } else {
      setJuries((data ?? []) as JuryMember[]);
    }

    setLoading(false);
  }

  useEffect(() => {
    loadJuries();
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setError("");
    setMessage("");
    setSaving(true);

    try {
      const response = await fetch("/api/admin/juries", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(form),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result.error ?? "Unable to invite jury member."
        );
      }

      setForm({
        name: "",
        email: "",
        role: "jury",
      });

      setMessage(result.message);

      await loadJuries();
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Unable to invite jury member."
      );
    } finally {
      setSaving(false);
    }
  }

  const juryCount = juries.filter(
    (member) => member.role === "jury"
  ).length;

  const managementCount = juries.filter(
    (member) => member.role === "management"
  ).length;

  return (
    <main className="portal-shell admin-shell">

      {/* ─────────────────────────────────────────
          HEADER
      ───────────────────────────────────────── */}

      <header className="portal-header">
        <a
          href="/dashboard"
          className="brand-lockup compact"
        >
          <div className="brand-mark">
            STV
          </div>

          <div>
            <strong>Startup TV</strong>
            <span>JURY PORTAL · ADMIN</span>
          </div>
        </a>

        <a
          href="/dashboard"
          className="back-link"
        >
          ← Jury dashboard
        </a>
      </header>


      {/* ─────────────────────────────────────────
          PAGE CONTENT
      ───────────────────────────────────────── */}

      <section className="admin-wrap">

        {/* ─────────────────────────────────────────
            PAGE INTRO
        ───────────────────────────────────────── */}

        <div className="admin-heading">

          <div>
            <div className="eyebrow">
              <span />
              JURY MANAGEMENT
            </div>

            <h1>
              Build the
              <br />
              <em>jury.</em>
            </h1>

            <p>
              Invite jury members and management users to the
              portal. Each account receives the appropriate level
              of access based on its account type.
            </p>
          </div>


          {/* COUNT CARDS */}

          <div className="count-group">

            <div className="admin-count">
              <span>JURORS</span>
              <strong>{juryCount}</strong>
              <small>in system</small>
            </div>

            <div className="admin-count management-count">
              <span>MANAGEMENT</span>
              <strong>{managementCount}</strong>
              <small>in system</small>
            </div>

          </div>

        </div>


        {/* ─────────────────────────────────────────
            INVITATION FORM
        ───────────────────────────────────────── */}

        <section className="admin-panel">

          <div className="panel-title">

            <div>
              <span>NEW ACCOUNT</span>
              <h2>Send an invitation</h2>
            </div>

            <span className="panel-note">
              Name, email and account type required
            </span>

          </div>


          <form
            className="admin-form"
            onSubmit={handleSubmit}
          >

            {/* FULL NAME */}

            <label>
              Full Name

              <input
                value={form.name}
                onChange={(event) =>
                  setForm({
                    ...form,
                    name: event.target.value,
                  })
                }
                placeholder="Full name"
                required
              />
            </label>


            {/* EMAIL */}

            <label>
              Email Address

              <input
                type="email"
                value={form.email}
                onChange={(event) =>
                  setForm({
                    ...form,
                    email: event.target.value,
                  })
                }
                placeholder="name@example.com"
                required
              />
            </label>


            {/* ACCOUNT TYPE */}

            <label>
              Account Type

              <select
                value={form.role}
                onChange={(event) =>
                  setForm({
                    ...form,
                    role: event.target.value as AccountRole,
                  })
                }
              >
                <option value="jury">
                  Jury Member
                </option>

                <option value="management">
                  Management
                </option>
              </select>
            </label>


            {/* ERROR */}

            {error && (
              <div className="form-error wide-field">
                {error}
              </div>
            )}


            {/* SUCCESS */}

            {message && (
              <div className="form-success wide-field">
                {message}
              </div>
            )}


            {/* FORM ACTION */}

            <div className="wide-field form-actions">

              <span>
                The invitation lets the user set up their
                own password.
              </span>

              <button
                type="submit"
                className="button button-primary"
                disabled={saving}
              >
                {saving
                  ? "Sending…"
                  : form.role === "management"
                    ? "Invite Management"
                    : "Invite Jury Member"}

                <span>↗</span>
              </button>

            </div>

          </form>

        </section>


        {/* ─────────────────────────────────────────
            ACCOUNT LIST
        ───────────────────────────────────────── */}

        <section className="admin-panel">

          <div className="panel-title">

            <div>
              <span>ACCOUNTS</span>
              <h2>Members in the system</h2>
            </div>

          </div>


          {loading ? (

            <div className="empty-state">
              Loading accounts…
            </div>

          ) : juries.length === 0 ? (

            <div className="empty-state">
              <strong>
                No accounts added yet.
              </strong>

              <span>
                Invited users will appear here.
              </span>
            </div>

          ) : (

            <div className="jury-admin-list">

              {juries.map((member) => (

                <article
                  className="jury-admin-row"
                  key={member.id}
                >

                  <div className="jury-avatar">
                    {member.name
                      ?.slice(0, 1)
                      .toUpperCase()}
                  </div>


                  <div className="jury-main">

                    <strong>
                      {member.name}
                    </strong>

                    <span>
                      {member.email}
                    </span>

                  </div>


                  <div
                    className={`jury-role ${member.role}`}
                  >
                    {member.role === "jury"
                      ? "Jury"
                      : member.role === "management"
                        ? "Management"
                        : "Admin"}
                  </div>

                </article>

              ))}

            </div>

          )}

        </section>

      </section>


      {/* ─────────────────────────────────────────
          PAGE STYLES
      ───────────────────────────────────────── */}

      <style jsx>{`

        .admin-wrap {
          width: min(1240px, 90vw);
          margin: 0 auto;
          padding: 75px 0 100px;
        }


        /* ─────────────────────────────────────────
           PAGE INTRO
        ───────────────────────────────────────── */

        .admin-heading {
          display: flex;
          justify-content: space-between;
          align-items: flex-end;
          gap: 50px;
          margin-bottom: 45px;
        }

        .admin-heading h1 {
          margin: 15px 0 18px;
          font: 800 clamp(48px, 6vw, 76px) / 0.95
            Poppins, sans-serif;
          letter-spacing: -0.055em;
        }

        .admin-heading h1 em {
          font-style: normal;
          background: var(--gradient-main);
          -webkit-background-clip: text;
          background-clip: text;
          color: transparent;
        }

        .admin-heading p {
          max-width: 610px;
          margin: 0;
          color: var(--text-secondary);
          font-size: 14px;
          line-height: 1.8;
        }


        /* ─────────────────────────────────────────
           COUNT CARDS
        ───────────────────────────────────────── */

        .count-group {
          display: flex;
          gap: 12px;
          flex-shrink: 0;
        }

        .admin-count {
          width: 150px;
          padding: 22px;
          border: 1px solid var(--glass-border);
          background: var(--glass-bg);
          border-radius: 18px;
        }

        .admin-count span,
        .admin-count small {
          display: block;
          color: var(--text-secondary);
          font-size: 8px;
          letter-spacing: 0.16em;
        }

        .admin-count strong {
          display: block;
          margin: 5px 0;
          font: 800 40px Poppins, sans-serif;
          background: var(--gradient-main);
          -webkit-background-clip: text;
          background-clip: text;
          color: transparent;
        }

        .management-count strong {
          background: linear-gradient(
            135deg,
            #c084fc,
            #a855f7
          );
          -webkit-background-clip: text;
          background-clip: text;
          color: transparent;
        }


        /* ─────────────────────────────────────────
           PANELS
        ───────────────────────────────────────── */

        .admin-panel {
          margin-top: 18px;
          padding: 28px;
          border: 1px solid var(--glass-border);
          background:
            linear-gradient(
              145deg,
              rgba(255, 255, 255, 0.055),
              rgba(255, 255, 255, 0.025)
            );
          border-radius: 20px;
        }


        /* ─────────────────────────────────────────
           PANEL TITLE
        ───────────────────────────────────────── */

        .panel-title {
          display: flex;
          align-items: flex-end;
          justify-content: space-between;
          gap: 20px;
          margin-bottom: 25px;
        }

        .panel-title > div > span {
          color: var(--text-secondary);
          font-size: 9px;
          font-weight: 700;
          letter-spacing: 0.16em;
        }

        .panel-title h2 {
          margin: 7px 0 0;
          font: 700 22px Poppins, sans-serif;
        }

        .panel-note {
          color: var(--text-secondary);
          font-size: 10px;
        }


        /* ─────────────────────────────────────────
           FORM
        ───────────────────────────────────────── */

        .admin-form {
          display: grid;
          grid-template-columns:
            repeat(2, minmax(0, 1fr));
          gap: 17px;
        }

        .admin-form label {
          display: grid;
          gap: 8px;
          color: #eee;
          font-size: 11px;
          font-weight: 700;
        }

        .admin-form input,
        .admin-form select {
          width: 100%;
          box-sizing: border-box;
          border: 1px solid var(--glass-border);
          outline: none;
          color: white;
          background: rgba(255, 255, 255, 0.045);
          border-radius: 12px;
          padding: 13px 14px;
          font: inherit;
        }

        .admin-form input::placeholder {
          color: rgba(255, 255, 255, 0.35);
        }

        .admin-form input:focus,
        .admin-form select:focus {
          border-color: rgba(243, 150, 31, 0.65);
          background: rgba(255, 255, 255, 0.065);
        }

        .admin-form select {
          cursor: pointer;
          appearance: auto;
        }

        .admin-form select option {
          background: #0b0e1d;
          color: white;
        }

        .wide-field {
          grid-column: 1 / -1;
        }


        /* ─────────────────────────────────────────
           FORM ACTIONS
        ───────────────────────────────────────── */

        .form-actions {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 20px;
          padding-top: 5px;
          color: var(--text-secondary);
          font-size: 10px;
        }

        .form-actions > span {
          max-width: 500px;
          line-height: 1.6;
        }


        /* ─────────────────────────────────────────
           MESSAGES
        ───────────────────────────────────────── */

        .form-success {
          border: 1px solid rgba(80, 220, 130, 0.3);
          background: rgba(80, 220, 130, 0.08);
          color: #a8efbd;
          padding: 12px 13px;
          border-radius: 10px;
          font-size: 11px;
        }

        .form-error {
          border: 1px solid rgba(240, 90, 70, 0.35);
          background: rgba(240, 90, 70, 0.08);
          color: #ffb0a5;
          padding: 12px 13px;
          border-radius: 10px;
          font-size: 11px;
        }


        /* ─────────────────────────────────────────
           ACCOUNT LIST
        ───────────────────────────────────────── */

        .jury-admin-list {
          border: 1px solid rgba(255, 255, 255, 0.07);
          border-radius: 15px;
          overflow: hidden;
        }

        .jury-admin-row {
          display: grid;
          grid-template-columns:
            42px minmax(0, 1fr) 100px;
          gap: 15px;
          align-items: center;
          padding: 16px 18px;
          border-top: 1px solid
            rgba(255, 255, 255, 0.07);
        }

        .jury-admin-row:first-child {
          border-top: 0;
        }


        /* ─────────────────────────────────────────
           AVATAR
        ───────────────────────────────────────── */

        .jury-avatar {
          width: 36px;
          height: 36px;
          display: grid;
          place-items: center;
          border-radius: 50%;
          background: var(--gradient-main);
          color: white;
          font: 700 12px Poppins, sans-serif;
        }


        /* ─────────────────────────────────────────
           MEMBER DETAILS
        ───────────────────────────────────────── */

        .jury-main {
          display: grid;
          gap: 4px;
          min-width: 0;
        }

        .jury-main strong {
          font: 600 13px Poppins, sans-serif;
        }

        .jury-main span {
          color: var(--text-secondary);
          font-size: 10px;
          overflow: hidden;
          text-overflow: ellipsis;
        }


        /* ─────────────────────────────────────────
           ROLE BADGES
        ───────────────────────────────────────── */

        .jury-role {
          text-align: right;
          color: var(--text-secondary);
          font-size: 9px;
          text-transform: uppercase;
          letter-spacing: 0.12em;
        }

        .jury-role.admin {
          color: #f5a35d;
        }

        .jury-role.management {
          color: #c084fc;
        }

        .jury-role.jury {
          color: var(--text-secondary);
        }


        /* ─────────────────────────────────────────
           MOBILE
        ───────────────────────────────────────── */

        @media (max-width: 800px) {

          .admin-wrap {
            padding-top: 45px;
          }

          .admin-heading {
            flex-direction: column;
            align-items: flex-start;
          }

          .count-group {
            width: 100%;
          }

          .admin-count {
            flex: 1;
          }

          .admin-form {
            grid-template-columns: 1fr;
          }

          .jury-admin-row {
            grid-template-columns:
              42px minmax(0, 1fr);
          }

          .jury-role {
            grid-column: 2;
            text-align: left;
          }

          .form-actions {
            align-items: flex-start;
            flex-direction: column;
          }

          .form-actions button {
            width: 100%;
          }

          .panel-title {
            align-items: flex-start;
            flex-direction: column;
          }

        }

      `}</style>

    </main>
  );
}