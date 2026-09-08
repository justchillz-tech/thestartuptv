import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import SignOutButton from "./SignOutButton";

type RecentSubmission = {
  id: string;
  title: string;
  participant_name: string | null;
  organization: string | null;
  status: string;
  submitted_at: string;
};

type JuryProgress = {
  id: string;
  name: string;
  assigned: number;
  reviewed: number;
  pending: number;
};

export default async function DashboardPage() {
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

  const isAdmin = role === "admin";
  const isManagement = role === "management";

  /*
   * ---------------------------------------------------------
   * JURY DASHBOARD
   * ---------------------------------------------------------
   * Keep the existing jury experience completely separate.
   */
  if (!isAdmin && !isManagement) {
    const { data: assignments } = await supabase
      .from("assignments")
      .select(
        "id, status, films(id, title, director, duration, language, drive_url, video_url)"
      )
      .eq("jury_id", userId)
      .order("created_at", { ascending: true });

    return (
      <main className="portal-shell">
        <header className="portal-header">
          <Link href="/dashboard" className="brand-lockup compact">
            <div className="brand-mark">STV</div>
            <div>
              <strong>Startup TV</strong>
              <span>JURY PORTAL</span>
            </div>
          </Link>

          <div className="header-user">
            <div>
              <strong>{jury?.name ?? "Jury Member"}</strong>
              <span>{jury?.email ?? ""}</span>
            </div>

            <SignOutButton />
          </div>
        </header>

        <section className="dashboard-intro">
          <div>
            <div className="eyebrow">
              <span /> YOUR ASSIGNMENTS
            </div>

            <h1>
              Films waiting
              <br />
              <em>for your eye.</em>
            </h1>

            <p>
              Watch each assigned film and submit one evaluation. Once an
              evaluation is submitted, that film is locked for your account.
            </p>
          </div>

          <div className="completion-card">
            <span>ASSIGNMENTS</span>
            <strong>{assignments?.length ?? 0}</strong>
            <small>films assigned</small>
          </div>
        </section>

        <section className="film-grid">
          {(assignments ?? []).map((assignment) => {
            const film = Array.isArray(assignment.films)
              ? assignment.films[0]
              : assignment.films;

            if (!film) return null;

            const completed = assignment.status === "completed";
            const filmUrl = film.video_url || film.drive_url;

            return (
              <article
                className={`film-card ${completed ? "completed" : ""}`}
                key={assignment.id}
              >
                <div className="film-card-top">
                  <span className="film-status">
                    {completed ? "✓ EVALUATED" : "● PENDING"}
                  </span>
                  <span>STV FILM FESTIVAL</span>
                </div>

                <h2>{film.title}</h2>

                <div className="film-meta">
                  <span>
                    Director <strong>{film.director}</strong>
                  </span>
                  <span>
                    Duration <strong>{film.duration}</strong>
                  </span>
                  <span>
                    Language <strong>{film.language}</strong>
                  </span>
                </div>

                {completed ? (
                  <div className="locked-message">
                    Evaluation submitted. This film is locked for your
                    account.
                  </div>
                ) : (
                  <div className="film-card-actions">
                    {filmUrl && (
                      <a
                        className="button button-secondary"
                        href={filmUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        Watch Film <span>↗</span>
                      </a>
                    )}

                    <Link
                      className="button button-primary"
                      href={`/evaluate/${film.id}`}
                    >
                      Open Evaluation <span>↗</span>
                    </Link>
                  </div>
                )}
              </article>
            );
          })}

          {(!assignments || assignments.length === 0) && (
            <div className="empty-state">
              <strong>No films assigned yet.</strong>
              <span>
                Your assigned films will appear here when the festival
                administrator publishes them.
              </span>
            </div>
          )}
        </section>

        <style>{`
          .film-card-actions {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 10px;
            margin-top: 22px;
          }

          .film-card-actions .button {
            width: 100%;
            box-sizing: border-box;
            text-align: center;
          }

          .button-secondary {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
            border: 1px solid var(--glass-border);
            background: rgba(255, 255, 255, .045);
            color: #fff;
            border-radius: 999px;
            padding: 12px 18px;
            font-size: 10px;
            font-weight: 600;
            text-decoration: none;
            transition:
              background .2s ease,
              border-color .2s ease,
              transform .2s ease;
          }

          .button-secondary:hover {
            background: rgba(255, 255, 255, .08);
            border-color: rgba(255, 255, 255, .22);
            transform: translateY(-1px);
          }

          @media (max-width: 650px) {
            .film-card-actions {
              grid-template-columns: 1fr;
            }
          }
        `}</style>
      </main>
    );
  }

  /*
   * ---------------------------------------------------------
   * ADMIN / MANAGEMENT ANALYTICS
   * ---------------------------------------------------------
   */

  const [
    { data: submissions, error: submissionsError },
    { data: films, error: filmsError },
    { data: evaluations, error: evaluationsError },
    { data: juries, error: juriesError },
  ] = await Promise.all([
    supabase
      .from("film_submissions")
      .select(
        "id, title, participant_name, organization, status, submitted_at"
      )
      .order("submitted_at", { ascending: false }),

    supabase
      .from("films")
      .select("id, film_code, title, director, status, created_at")
      .order("created_at", { ascending: false }),

    supabase
      .from("evaluations")
      .select("id, film_id, jury_id, total, submitted_at")
      .order("submitted_at", { ascending: false }),

    supabase
      .from("juries")
      .select("id, name, role, created_at")
      .order("created_at", { ascending: true }),
  ]);

  if (
    submissionsError ||
    filmsError ||
    evaluationsError ||
    juriesError
  ) {
    console.error("Dashboard analytics query failed", {
      submissionsError,
      filmsError,
      evaluationsError,
      juriesError,
    });

    throw new Error("Unable to load festival dashboard.");
  }

  /*
   * Admin gets assignment statistics.
   *
   * Management does not need assignment-table access for the
   * dashboard, preserving the existing read-only permission model.
   */
  let assignments: {
    id: string;
    jury_id: string;
    film_id: string;
    status: string;
  }[] = [];

  if (isAdmin) {
    const { data: assignmentData, error: assignmentsError } =
      await supabase
        .from("assignments")
        .select("id, jury_id, film_id, status");

    if (assignmentsError) {
      console.error("Assignment analytics query failed", assignmentsError);
      throw new Error("Unable to load assignment analytics.");
    }

    assignments = assignmentData ?? [];
  }

  /*
   * Submission metrics
   */
  const totalSubmissions = submissions?.length ?? 0;

  const pendingSubmissions =
    submissions?.filter((item) => item.status === "pending").length ?? 0;

  const approvedSubmissions =
    submissions?.filter((item) => item.status === "approved").length ?? 0;

  const rejectedSubmissions =
    submissions?.filter((item) => item.status === "rejected").length ?? 0;

  /*
   * Film metrics
   */
  const totalFilms = films?.length ?? 0;

  /*
   * Evaluation metrics
   */
  const totalEvaluations = evaluations?.length ?? 0;

  const evaluatedFilmIds = new Set(
    (evaluations ?? []).map((evaluation) => evaluation.film_id)
  );

  const evaluatedFilms = evaluatedFilmIds.size;

  const awaitingEvaluation = Math.max(
    totalFilms - evaluatedFilms,
    0
  );

  /*
   * Assignment metrics
   */
  const totalAssignments = assignments.length;

  const completedAssignments = assignments.filter(
    (assignment) => assignment.status === "completed"
  ).length;

  const pendingAssignments = assignments.filter(
    (assignment) => assignment.status !== "completed"
  ).length;

  const assignmentCompletion =
    totalAssignments > 0
      ? Math.round((completedAssignments / totalAssignments) * 100)
      : 0;

  /*
   * Score metrics
   */
  const scores = (evaluations ?? [])
    .map((evaluation) => Number(evaluation.total))
    .filter((score) => Number.isFinite(score));

  const averageScore =
    scores.length > 0
      ? scores.reduce((sum, score) => sum + score, 0) / scores.length
      : 0;

  const highestScore =
    scores.length > 0 ? Math.max(...scores) : 0;

  const lowestScore =
    scores.length > 0 ? Math.min(...scores) : 0;

  /*
   * Jury metrics
   */
  const juryMembers =
    juries?.filter((member) => member.role === "jury").length ?? 0;

  const managementMembers =
    juries?.filter((member) => member.role === "management").length ?? 0;

  const juryProgress: JuryProgress[] = (juries ?? [])
    .filter((member) => member.role === "jury")
    .map((member) => {
      const assignedFilmIds = new Set(
        assignments
          .filter(
            (assignment) =>
              assignment.jury_id === member.id
          )
          .map((assignment) => assignment.film_id)
      );

      const reviewedFilmIds = new Set(
        (evaluations ?? [])
          .filter(
            (evaluation) =>
              evaluation.jury_id === member.id
          )
          .map((evaluation) => evaluation.film_id)
      );

      const assignedCount = isAdmin
        ? assignedFilmIds.size
        : reviewedFilmIds.size;

      const reviewedCount = reviewedFilmIds.size;

      return {
        id: member.id,
        name: member.name,
        assigned: assignedCount,
        reviewed: reviewedCount,
        pending: Math.max(
          assignedCount - reviewedCount,
          0
        ),
      };
    });
  /*
   * Recent submissions
   */
  const recentSubmissions: RecentSubmission[] = (
    submissions ?? []
  ).slice(0, 5);

  return (
    <main className="portal-shell">
      <header className="portal-header">
        <Link href="/dashboard" className="brand-lockup compact">
          <div className="brand-mark">STV</div>

          <div>
            <strong>Startup TV</strong>
            <span>JURY PORTAL</span>
          </div>
        </Link>

        <div className="header-user">
          <div className="admin-links">
            <Link href="/admin/submissions">Submissions</Link>

            {isAdmin && (
              <>
                <Link href="/admin/films">Films</Link>
                <Link href="/admin/juries">Jury</Link>
                <Link href="/admin/assignments">
                  Assignments
                </Link>
              </>
            )}

            <Link href="/admin/results">Results</Link>
            <Link href="/admin/activity">Activity</Link>
          </div>

          <div>
            <strong>{jury?.name ?? "User"}</strong>
            <span>{jury?.email ?? ""}</span>
          </div>

          <SignOutButton />
        </div>
      </header>

      <section className="analytics-intro">
        <div>
          <div className="eyebrow">
            <span />
            {isAdmin ? "ADMIN OVERVIEW" : "MANAGEMENT OVERVIEW"}
          </div>

          <h1>
            Festival
            <br />
            <em>control room.</em>
          </h1>

          <p>
            A live overview of submissions, films, jury progress and
            evaluation activity across the festival.
          </p>
        </div>

        <div className="analytics-date">
          <span>STV FILM FESTIVAL</span>
          <strong>LIVE OVERVIEW</strong>
          <small>Data from the jury system</small>
        </div>
      </section>

      {/* -------------------------------------------------- */}
      {/* SUBMISSION FUNNEL */}
      {/* -------------------------------------------------- */}

      <section className="analytics-section">
        <div className="analytics-section-head">
          <div>
            <span>SUBMISSIONS</span>
            <h2>Submission pipeline</h2>
          </div>

          <Link href="/admin/submissions">
            View submissions ↗
          </Link>
        </div>

        <div className="analytics-grid analytics-grid-four">
          <div className="metric-card">
            <span>TOTAL SUBMISSIONS</span>
            <strong>{totalSubmissions}</strong>
            <small>all participant entries</small>
          </div>

          <div className="metric-card metric-highlight">
            <span>PENDING REVIEW</span>
            <strong>{pendingSubmissions}</strong>
            <small>awaiting admin review</small>
          </div>

          <div className="metric-card">
            <span>APPROVED</span>
            <strong>{approvedSubmissions}</strong>
            <small>accepted into festival</small>
          </div>

          <div className="metric-card">
            <span>REJECTED</span>
            <strong>{rejectedSubmissions}</strong>
            <small>not accepted</small>
          </div>
        </div>
      </section>

      {/* -------------------------------------------------- */}
      {/* FESTIVAL PIPELINE */}
      {/* -------------------------------------------------- */}

      <section className="analytics-section">
        <div className="analytics-section-head">
          <div>
            <span>FESTIVAL PIPELINE</span>
            <h2>Films &amp; evaluations</h2>
          </div>

          <Link href="/admin/results">
            View results ↗
          </Link>
        </div>

        <div className="analytics-grid analytics-grid-four">
          <div className="metric-card">
            <span>TOTAL FILMS</span>
            <strong>{totalFilms}</strong>
            <small>published to jury system</small>
          </div>

          <div className="metric-card">
            <span>EVALUATIONS</span>
            <strong>{totalEvaluations}</strong>
            <small>scores submitted</small>
          </div>

          <div className="metric-card">
            <span>AWAITING EVALUATION</span>
            <strong>{awaitingEvaluation}</strong>
            <small>films still in review</small>
          </div>

          <div className="metric-card metric-highlight">
            <span>EVALUATED FILMS</span>
            <strong>{evaluatedFilms}</strong>
            <small>films with at least one score</small>
          </div>
        </div>
      </section>

      {/* -------------------------------------------------- */}
      {/* JURY PROGRESS */}
      {/* -------------------------------------------------- */}

      <section className="analytics-section">
        <div className="analytics-section-head">
          <div>
            <span>JURY ROOM</span>
            <h2>Evaluation progress</h2>
          </div>

          {isAdmin && (
            <Link href="/admin/assignments">
              Manage assignments ↗
            </Link>
          )}
        </div>

        <div className="progress-panel">
          <div className="progress-top">
            <div>
              <span>OVERALL COMPLETION</span>
              <strong>
                {isAdmin ? `${assignmentCompletion}%` : `${evaluatedFilms}`}
              </strong>
            </div>

            <div className="progress-meta">
              {isAdmin
                ? `${completedAssignments} of ${totalAssignments} assignments completed`
                : `${evaluatedFilms} of ${totalFilms} films evaluated`}
            </div>
          </div>

          <div className="progress-track">
            <div
              className="progress-fill"
              style={{
                width: `${isAdmin
                  ? assignmentCompletion
                  : totalFilms > 0
                    ? Math.round(
                      (evaluatedFilms / totalFilms) * 100
                    )
                    : 0
                  }%`,
              }}
            />
          </div>

          <div className="progress-bottom">
            <span>
              {isAdmin
                ? `${pendingAssignments} assignments pending`
                : `${awaitingEvaluation} films awaiting evaluation`}
            </span>

            <span>
              {juryMembers} jury members · {managementMembers} management
            </span>
          </div>
          <div className="jury-progress-list">
            <div className="jury-progress-list-head">
              <span>JURY MEMBER</span>
              <span>REVIEWED</span>
              <span>PROGRESS</span>
            </div>

            {juryProgress.map((member) => {
              const percentage =
                member.assigned > 0
                  ? Math.round(
                    (member.reviewed / member.assigned) * 100
                  )
                  : 0;

              return (
                <div
                  className="jury-progress-row"
                  key={member.id}
                >
                  <div className="jury-progress-name">
                    <strong>{member.name}</strong>

                    <small>
                      {member.reviewed} reviewed
                      {isAdmin &&
                        ` · ${member.pending} pending`}
                    </small>
                  </div>

                  <strong className="jury-progress-count">
                    {member.reviewed}
                    {isAdmin && (
                      <small>
                        / {member.assigned}
                      </small>
                    )}
                  </strong>

                  <div className="jury-progress-bar-wrap">
                    <div className="jury-progress-bar">
                      <div
                        className="jury-progress-fill"
                        style={{
                          width: `${percentage}%`,
                        }}
                      />
                    </div>

                    <span>{percentage}%</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* -------------------------------------------------- */}
      {/* SCORE OVERVIEW */}
      {/* -------------------------------------------------- */}

      <section className="analytics-section">
        <div className="analytics-section-head">
          <div>
            <span>SCORING</span>
            <h2>Evaluation snapshot</h2>
          </div>

          <Link href="/admin/results">
            Full scoring breakdown ↗
          </Link>
        </div>

        <div className="analytics-grid analytics-grid-three">
          <div className="score-card">
            <span>AVERAGE SCORE</span>
            <strong>{averageScore.toFixed(1)}</strong>
            <small>out of 100</small>
          </div>

          <div className="score-card">
            <span>HIGHEST SCORE</span>
            <strong>{highestScore}</strong>
            <small>highest submitted evaluation</small>
          </div>

          <div className="score-card">
            <span>LOWEST SCORE</span>
            <strong>{lowestScore}</strong>
            <small>lowest submitted evaluation</small>
          </div>
        </div>
      </section>

      {/* -------------------------------------------------- */}
      {/* RECENT SUBMISSIONS + QUICK ACTIONS */}
      {/* -------------------------------------------------- */}

      <section className="dashboard-bottom-grid">
        <div className="recent-panel">
          <div className="analytics-section-head">
            <div>
              <span>RECENT ACTIVITY</span>
              <h2>Latest submissions</h2>
            </div>

            <Link href="/admin/submissions">
              All ↗
            </Link>
          </div>

          {recentSubmissions.length === 0 ? (
            <div className="analytics-empty">
              <strong>No submissions yet.</strong>
              <span>
                New participant submissions will appear here.
              </span>
            </div>
          ) : (
            <div className="recent-list">
              {recentSubmissions.map((submission) => (
                <div className="recent-item" key={submission.id}>
                  <div className="recent-main">
                    <strong>{submission.title}</strong>

                    <span>
                      {submission.participant_name ||
                        "Participant"}
                      {submission.organization
                        ? ` · ${submission.organization}`
                        : ""}
                    </span>
                  </div>

                  <div className="recent-side">
                    <span
                      className={`status-pill status-${submission.status}`}
                    >
                      {submission.status.toUpperCase()}
                    </span>

                    <small>
                      {new Date(
                        submission.submitted_at
                      ).toLocaleDateString()}
                    </small>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="quick-panel">
          <div className="analytics-section-head">
            <div>
              <span>QUICK ACTIONS</span>
              <h2>Control room</h2>
            </div>
          </div>

          <div className="quick-actions">
            <Link href="/admin/submissions">
              <span>Review submissions</span>
              <strong>↗</strong>
            </Link>

            {isAdmin && (
              <>
                <Link href="/admin/films">
                  <span>Manage films</span>
                  <strong>↗</strong>
                </Link>

                <Link href="/admin/juries">
                  <span>Manage jury</span>
                  <strong>↗</strong>
                </Link>

                <Link href="/admin/assignments">
                  <span>Manage assignments</span>
                  <strong>↗</strong>
                </Link>
              </>
            )}

            <Link href="/admin/results">
              <span>View results</span>
              <strong>↗</strong>
            </Link>
          </div>
        </div>
      </section>

      <style>{`
        .analytics-intro {
          width: min(1240px, 90vw);
          margin: 0 auto;
          display: flex;
          align-items: flex-end;
          justify-content: space-between;
          gap: 40px;
          padding: 100px 0 60px;
        }

        .analytics-intro > div:first-child {
          max-width: 760px;
        }

        .analytics-intro h1 {
          margin: 18px 0 20px;
        }

        .analytics-intro p {
          max-width: 650px;
        }

        .analytics-date {
          min-width: 220px;
          padding: 22px;
          border: 1px solid var(--glass-border);
          border-radius: 18px;
          background: rgba(255, 255, 255, .025);
        }

        .analytics-date span,
        .analytics-date small {
          display: block;
          color: rgba(255,255,255,.48);
          font-size: 9px;
          letter-spacing: .14em;
        }

        .analytics-date strong {
          display: block;
          margin: 8px 0;
          font-size: 13px;
          letter-spacing: .08em;
        }

        .analytics-section {
          width: min(1240px, 90vw);
          margin: 0 auto 58px;
        }

        .analytics-section-head {
          display: flex;
          align-items: flex-end;
          justify-content: space-between;
          gap: 20px;
          margin-bottom: 18px;
        }

        .analytics-section-head > div > span {
          display: block;
          margin-bottom: 6px;
          color: rgba(255,255,255,.42);
          font-size: 9px;
          font-weight: 600;
          letter-spacing: .16em;
        }

        .analytics-section-head h2 {
          margin: 0;
          font-size: 25px;
          letter-spacing: -.02em;
        }

        .analytics-section-head > a {
          color: rgba(255,255,255,.58);
          font-size: 10px;
          font-weight: 600;
          text-decoration: none;
          transition: color .2s ease;
        }

        .analytics-section-head > a:hover {
          color: #fff;
        }

        .analytics-grid {
          display: grid;
          gap: 12px;
        }

        .analytics-grid-four {
          grid-template-columns: repeat(4, minmax(0, 1fr));
        }

        .analytics-grid-three {
          grid-template-columns: repeat(3, minmax(0, 1fr));
        }

        .metric-card,
        .score-card {
          min-height: 145px;
          padding: 24px;
          border: 1px solid var(--glass-border);
          border-radius: 18px;
          background: rgba(255,255,255,.025);
          box-sizing: border-box;
        }

        .metric-card > span,
        .score-card > span {
          display: block;
          color: rgba(255,255,255,.42);
          font-size: 9px;
          font-weight: 600;
          letter-spacing: .14em;
        }

        .metric-card > strong,
        .score-card > strong {
          display: block;
          margin: 13px 0 5px;
          font-size: 42px;
          line-height: 1;
          letter-spacing: -.04em;
        }

        .metric-card > small,
        .score-card > small {
          color: rgba(255,255,255,.43);
          font-size: 10px;
        }

        .metric-highlight {
          background:
            linear-gradient(
              145deg,
              rgba(243,150,31,.10),
              rgba(203,29,127,.055)
            );
          border-color: rgba(243,150,31,.18);
        }

        .metric-highlight > strong {
          background: linear-gradient(
            90deg,
            #f3961f,
            #ef6a37,
            #cb1d7f,
            #963694
          );
          -webkit-background-clip: text;
          background-clip: text;
          color: transparent;
        }

        .progress-panel {
          padding: 28px;
          border: 1px solid var(--glass-border);
          border-radius: 20px;
          background: rgba(255,255,255,.025);
        }

        .progress-top {
          display: flex;
          align-items: flex-end;
          justify-content: space-between;
          gap: 20px;
        }

        .progress-top span {
          display: block;
          color: rgba(255,255,255,.42);
          font-size: 9px;
          font-weight: 600;
          letter-spacing: .14em;
        }

        .progress-top strong {
          display: block;
          margin-top: 8px;
          font-size: 36px;
          letter-spacing: -.04em;
        }

        .progress-meta {
          color: rgba(255,255,255,.48);
          font-size: 10px;
        }

        .progress-track {
          height: 8px;
          margin: 24px 0 15px;
          overflow: hidden;
          border-radius: 999px;
          background: rgba(255,255,255,.07);
        }

        .progress-fill {
          height: 100%;
          border-radius: inherit;
          background: linear-gradient(
            90deg,
            #f3961f,
            #ef6a37,
            #cb1d7f,
            #963694
          );
          transition: width .4s ease;
        }

        .progress-bottom {
          display: flex;
          justify-content: space-between;
          gap: 20px;
          color: rgba(255,255,255,.38);
          font-size: 9px;
        }

        .score-card {
          min-height: 155px;
        }

        .score-card > strong {
          font-size: 48px;
        }

        .dashboard-bottom-grid {
          width: min(1240px, 90vw);
          margin: 0 auto 70px;
          display: grid;
          grid-template-columns: minmax(0, 1.5fr) minmax(280px, .7fr);
          gap: 14px;
          margin-bottom: 70px;
        }

        .recent-panel,
        .quick-panel {
          padding: 26px;
          border: 1px solid var(--glass-border);
          border-radius: 20px;
          background: rgba(255,255,255,.02);
        }

        .recent-panel .analytics-section-head,
        .quick-panel .analytics-section-head {
          margin-bottom: 18px;
        }

        .recent-list {
          border-top: 1px solid rgba(255,255,255,.07);
        }

        .recent-item {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 20px;
          padding: 17px 0;
          border-bottom: 1px solid rgba(255,255,255,.06);
        }

        .recent-main strong {
          display: block;
          margin-bottom: 5px;
          font-size: 13px;
        }

        .recent-main span {
          display: block;
          color: rgba(255,255,255,.42);
          font-size: 10px;
        }

        .recent-side {
          flex-shrink: 0;
          text-align: right;
        }

        .recent-side small {
          display: block;
          margin-top: 6px;
          color: rgba(255,255,255,.32);
          font-size: 9px;
        }

        .status-pill {
          display: inline-block;
          padding: 5px 8px;
          border-radius: 999px;
          background: rgba(255,255,255,.07);
          color: rgba(255,255,255,.68);
          font-size: 8px;
          font-weight: 700;
          letter-spacing: .08em;
        }

        .status-approved {
          background: rgba(50, 200, 120, .10);
          color: rgba(100, 230, 160, .9);
        }

        .status-pending {
          background: rgba(243, 150, 31, .10);
          color: rgba(255, 190, 90, .95);
        }

        .status-rejected {
          background: rgba(220, 70, 90, .10);
          color: rgba(255, 120, 140, .9);
        }

        .analytics-empty {
          display: flex;
          flex-direction: column;
          gap: 7px;
          padding: 35px 0 10px;
        }

        .analytics-empty strong {
          font-size: 14px;
        }

        .analytics-empty span {
          color: rgba(255,255,255,.4);
          font-size: 10px;
        }

        .quick-actions {
          display: flex;
          flex-direction: column;
        }

        .quick-actions a {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 20px;
          padding: 17px 0;
          border-bottom: 1px solid rgba(255,255,255,.06);
          color: #fff;
          font-size: 11px;
          font-weight: 600;
          text-decoration: none;
          transition: padding .2s ease;
        }

        .quick-actions a:hover {
          padding-left: 5px;
        }

        .quick-actions strong {
          color: rgba(255,255,255,.35);
          font-size: 14px;
        }

        @media (max-width: 900px) {
          .analytics-grid-four {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .dashboard-bottom-grid {
            grid-template-columns: 1fr;
          }

          .analytics-intro {
            align-items: flex-start;
            flex-direction: column;
          }

          .analytics-date {
            width: 100%;
            box-sizing: border-box;
          }
        }

        @media (max-width: 650px) {
          .analytics-grid-four,
          .analytics-grid-three {
            grid-template-columns: 1fr;
          }

          .analytics-section-head {
            align-items: flex-start;
            flex-direction: column;
          }

          .progress-top,
          .progress-bottom {
            align-items: flex-start;
            flex-direction: column;
          }

          .recent-item {
            align-items: flex-start;
            flex-direction: column;
          }

          .recent-side {
            text-align: left;
          }
        }
      `}</style>
    </main>
  );
}