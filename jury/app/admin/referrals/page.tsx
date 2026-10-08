import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const VALID_STATUSES = new Set(["pending", "approved"]);

type Referrer = {
    id: string;
    name: string;
    email: string;
    contact_number: string | null;
    referral_code: string;
    is_active: boolean;
    created_at: string;
};

type Submission = {
    id: string;
    participant_email: string;
    participant_name: string | null;
    referrer_id: string | null;
    referral_code: string | null;
    status: string;
    submitted_at: string;
};

type ReferralCredit = {
    id: string;
    referrer_id: string;
    participant_email: string;
    submission_id: string;
    created_at: string;
};

export default async function ReferralDashboardPage() {
    /*
     * ---------------------------------------------------------
     * AUTHENTICATION
     * ---------------------------------------------------------
     */

    const supabase = await createClient();

    const { data: claimsData } = await supabase.auth.getClaims();

    if (!claimsData?.claims) {
        redirect("/login");
    }

    const userId = String(claimsData.claims.sub);

    const { data: jury } = await supabase
        .from("juries")
        .select("name, email, role")
        .eq("id", userId)
        .single();

    const role = jury?.role ?? "jury";

    /*
     * Referral dashboard is available to
     * administrators and management only.
     */

    if (role !== "admin" && role !== "management") {
        redirect("/dashboard");
    }

    /*
     * ---------------------------------------------------------
     * DATABASE
     * ---------------------------------------------------------
     *
     * Use the service-role client here because referral tables
     * are internal administrative data.
     */

    const admin = createAdminClient();

    const [
        { data: referrers, error: referrersError },
        { data: submissions, error: submissionsError },
        { data: credits, error: creditsError },
    ] = await Promise.all([
        admin
            .from("festival_referrers")
            .select(
                "id, name, email, contact_number, referral_code, is_active, created_at"
            )
            .order("created_at", { ascending: true }),

        admin
            .from("film_submissions")
            .select(
                "id, participant_email, participant_name, referrer_id, referral_code, status, submitted_at"
            )
            .not("referrer_id", "is", null),

        admin
            .from("festival_referral_credits")
            .select(
                "id, referrer_id, participant_email, submission_id, created_at"
            )
            .order("created_at", { ascending: true }),
    ]);

    if (referrersError || submissionsError || creditsError) {
        console.error("Referral dashboard query failed", {
            referrersError,
            submissionsError,
            creditsError,
        });

        throw new Error("Unable to load referral dashboard.");
    }

    const referrerList = (referrers ?? []) as Referrer[];
    const submissionList = (submissions ?? []) as Submission[];
    const creditList = (credits ?? []) as ReferralCredit[];

    /*
     * ---------------------------------------------------------
     * AGGREGATION
     * ---------------------------------------------------------
     */

    const submissionCounts = new Map<string, number>();
    const rejectedCounts = new Map<string, number>();
    const creditCounts = new Map<string, number>();

    for (const submission of submissionList) {
        if (!submission.referrer_id) continue;

        if (VALID_STATUSES.has(submission.status)) {
            submissionCounts.set(
                submission.referrer_id,
                (submissionCounts.get(submission.referrer_id) ?? 0) + 1
            );
        }

        if (submission.status === "rejected") {
            rejectedCounts.set(
                submission.referrer_id,
                (rejectedCounts.get(submission.referrer_id) ?? 0) + 1
            );
        }
    }

    for (const credit of creditList) {
        creditCounts.set(
            credit.referrer_id,
            (creditCounts.get(credit.referrer_id) ?? 0) + 1
        );
    }

    /*
     * Overall metrics
     */

    const totalReferrers = referrerList.length;

    const totalValidSubmissions = submissionList.filter((submission) =>
        VALID_STATUSES.has(submission.status)
    ).length;

    const totalUniqueFilmmakers = creditList.length;

    const activeReferrers = referrerList.filter(
        (referrer) => referrer.is_active
    ).length;

    /*
     * ---------------------------------------------------------
     * TABLE DATA
     * ---------------------------------------------------------
     */

    const rows = referrerList.map((referrer) => {
        const validSubmissions =
            submissionCounts.get(referrer.id) ?? 0;

        const rejectedSubmissions =
            rejectedCounts.get(referrer.id) ?? 0;

        const uniqueFilmmakers =
            creditCounts.get(referrer.id) ?? 0;

        return {
            ...referrer,
            validSubmissions,
            rejectedSubmissions,
            uniqueFilmmakers,
        };
    });

    /*
     * Highest referral activity first.
     *
     * We are not ranking people as "best/worst"; this is simply
     * an operational ordering by number of valid submissions.
     */

    rows.sort((a, b) => {
        if (b.validSubmissions !== a.validSubmissions) {
            return b.validSubmissions - a.validSubmissions;
        }

        return a.created_at.localeCompare(b.created_at);
    });

    return (
        <main className="portal-shell admin-shell">
            <header className="portal-header">
                <Link
                    href="/dashboard"
                    className="brand-lockup compact"
                >
                    <div className="brand-mark">STV</div>

                    <div>
                        <strong>Startup TV</strong>
                        <span>JURY PORTAL · ADMIN</span>
                    </div>
                </Link>

                <Link
                    href="/dashboard"
                    className="back-link"
                >
                    ← Jury dashboard
                </Link>
            </header>

            <section className="referral-wrap">

                {/* -------------------------------------------------
            HEADER
        -------------------------------------------------- */}

                <div className="referral-heading">
                    <div>
                        <div className="eyebrow">
                            <span />
                            REFERRAL PROGRAM
                        </div>

                        <h1>
                            Referral
                            <br />
                            <em>dashboard.</em>
                        </h1>

                        <p>
                            Track referral activity, valid film submissions,
                            and unique filmmakers credited to each referral
                            code.
                        </p>
                    </div>
                </div>

                {/* -------------------------------------------------
            SUMMARY
        -------------------------------------------------- */}

                <section className="referral-stats">

                    <article className="referral-stat">
                        <span>REFERRERS</span>
                        <strong>{totalReferrers}</strong>
                        <small>
                            {activeReferrers} active
                        </small>
                    </article>

                    <article className="referral-stat">
                        <span>VALID SUBMISSIONS</span>
                        <strong>{totalValidSubmissions}</strong>
                        <small>
                            pending + approved
                        </small>
                    </article>

                    <article className="referral-stat">
                        <span>UNIQUE FILMMAKERS</span>
                        <strong>{totalUniqueFilmmakers}</strong>
                        <small>
                            referral credits
                        </small>
                    </article>

                </section>

                {/* -------------------------------------------------
            REFERRER TABLE
        -------------------------------------------------- */}

                <section className="admin-panel referral-panel">

                    <div className="panel-title">
                        <div>
                            <span>REFERRAL ACTIVITY</span>
                            <h2>Referrers</h2>
                        </div>

                        <span className="panel-note">
                            {rows.length} registered
                        </span>
                    </div>

                    {rows.length === 0 ? (
                        <div className="empty-state">
                            <strong>No referrers registered yet.</strong>

                            <span>
                                Referrers created through the festival referral
                                page will appear here.
                            </span>
                        </div>
                    ) : (
                        <div className="referral-table">

                            <div className="referral-table-head">
                                <span>REFERRER</span>
                                <span>CODE</span>
                                <span>VALID SUBMISSIONS</span>
                                <span>UNIQUE FILMMAKERS</span>
                                <span>STATUS</span>
                            </div>

                            {rows.map((row) => (
                                <div
                                    className="referral-table-row"
                                    key={row.id}
                                >
                                    <div className="referrer-main">
                                        <strong>{row.name}</strong>
                                        <span>{row.email}</span>
                                    </div>

                                    <div className="referral-code">
                                        {row.referral_code}
                                    </div>

                                    <div className="referral-number">
                                        {row.validSubmissions}
                                    </div>

                                    <div className="referral-number">
                                        {row.uniqueFilmmakers}
                                    </div>

                                    <div>
                                        <span
                                            className={`referral-status ${row.is_active
                                                    ? "active"
                                                    : "inactive"
                                                }`}
                                        >
                                            {row.is_active
                                                ? "ACTIVE"
                                                : "INACTIVE"}
                                        </span>
                                    </div>
                                </div>
                            ))}

                        </div>
                    )}

                </section>

                {/* -------------------------------------------------
            NOTES
        -------------------------------------------------- */}

                <section className="referral-note">

                    <strong>Referral calculation</strong>

                    <p>
                        Valid submissions currently include films with
                        <b> pending</b> or <b> approved</b> status.
                        Rejected submissions are excluded from the valid
                        referral count.
                    </p>

                    <p>
                        Unique filmmaker counts come from the referral
                        credit table, which allows only one referral credit
                        per participant email.
                    </p>

                </section>

            </section>

            <style>{`
        .referral-wrap {
          width: min(1240px, 90vw);
          margin: 0 auto;
          padding: 75px 0 100px;
        }

        .referral-heading {
          margin-bottom: 45px;
        }

        .referral-heading h1 {
          margin: 15px 0 18px;
          font: 800 clamp(48px, 6vw, 76px)/.95 Poppins, sans-serif;
          letter-spacing: -.055em;
        }

        .referral-heading h1 em {
          font-style: normal;
          background: var(--gradient-main);
          -webkit-background-clip: text;
          background-clip: text;
          color: transparent;
        }

        .referral-heading p {
          max-width: 650px;
          margin: 0;
          color: var(--text-secondary);
          font-size: 14px;
          line-height: 1.8;
        }

        .referral-stats {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 14px;
          margin-bottom: 18px;
        }

        .referral-stat {
          padding: 24px;
          border: 1px solid var(--glass-border);
          background: var(--glass-bg);
          border-radius: 18px;
        }

        .referral-stat span,
        .referral-stat small {
          display: block;
          color: var(--text-secondary);
          font-size: 8px;
          letter-spacing: .16em;
        }

        .referral-stat strong {
          display: block;
          margin: 6px 0;
          font: 800 42px Poppins, sans-serif;
          background: var(--gradient-main);
          -webkit-background-clip: text;
          background-clip: text;
          color: transparent;
        }

        .referral-stat small {
          letter-spacing: .04em;
          font-size: 9px;
        }

        .referral-panel {
          margin-top: 0;
        }

        .referral-table {
          border: 1px solid rgba(255,255,255,.07);
          border-radius: 15px;
          overflow: hidden;
        }

        .referral-table-head,
        .referral-table-row {
          display: grid;
          grid-template-columns:
            minmax(220px, 1.5fr)
            minmax(120px, .8fr)
            minmax(150px, .9fr)
            minmax(150px, .9fr)
            100px;
          gap: 18px;
          align-items: center;
        }

        .referral-table-head {
          padding: 13px 18px;
          background: rgba(255,255,255,.035);
          color: var(--text-secondary);
          font-size: 8px;
          font-weight: 700;
          letter-spacing: .14em;
        }

        .referral-table-row {
          padding: 17px 18px;
          border-top: 1px solid rgba(255,255,255,.07);
        }

        .referrer-main {
          display: grid;
          gap: 5px;
          min-width: 0;
        }

        .referrer-main strong {
          font: 600 13px Poppins, sans-serif;
        }

        .referrer-main span {
          overflow: hidden;
          color: var(--text-secondary);
          font-size: 10px;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .referral-code {
          color: #f0a36b;
          font: 700 10px Poppins, sans-serif;
          letter-spacing: .08em;
        }

        .referral-number {
          font: 700 18px Poppins, sans-serif;
        }

        .referral-status {
          display: inline-block;
          padding: 6px 9px;
          border-radius: 999px;
          font-size: 8px;
          font-weight: 700;
          letter-spacing: .1em;
        }

        .referral-status.active {
          background: rgba(80,220,130,.10);
          color: #8ee6b2;
        }

        .referral-status.inactive {
          background: rgba(255,255,255,.07);
          color: var(--text-secondary);
        }

        .referral-note {
          margin-top: 18px;
          padding: 20px 22px;
          border: 1px solid rgba(255,255,255,.07);
          border-radius: 15px;
          background: rgba(255,255,255,.02);
        }

        .referral-note strong {
          display: block;
          margin-bottom: 9px;
          font-size: 11px;
        }

        .referral-note p {
          margin: 6px 0;
          color: var(--text-secondary);
          font-size: 10px;
          line-height: 1.7;
        }

        .referral-note b {
          color: #fff;
          font-weight: 600;
        }

        @media (max-width: 950px) {
          .referral-table {
            overflow-x: auto;
          }

          .referral-table-head,
          .referral-table-row {
            min-width: 850px;
          }
        }

        @media (max-width: 700px) {
          .referral-stats {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
        </main>
    );
}