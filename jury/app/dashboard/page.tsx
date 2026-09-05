import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import SignOutButton from "./SignOutButton";

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  if (!claimsData?.claims) redirect("/login");

  const userId = String(claimsData.claims.sub);
  const { data: jury } = await supabase.from("juries").select("name, email, role").eq("id", userId).single();

  const { data: assignments } = await supabase
    .from("assignments")
    .select("id, status, films(id, title, director, duration, language, drive_url, video_url)")
    .eq("jury_id", userId)
    .order("created_at", { ascending: true });

  const isAdmin = jury?.role === "admin";
  const isManagement = jury?.role === "management";

  return (
    <main className="portal-shell">
      <header className="portal-header">
        <Link href="/dashboard" className="brand-lockup compact">
          <div className="brand-mark">STV</div>
          <div><strong>Startup TV</strong><span>JURY PORTAL</span></div>
        </Link>
        <div className="header-user">
          {isAdmin && (
            <div className="admin-links">
              <Link href="/admin/submissions">Submissions</Link>
              <Link href="/admin/films">Films</Link>
              <Link href="/admin/juries">Jury</Link>
              <Link href="/admin/assignments">Assignments</Link>
              <Link href="/admin/results">Results</Link>
            </div>
          )}

          {isManagement && (
            <div className="admin-links">
              <Link href="/admin/submissions">Submissions</Link>
              <Link href="/admin/results">Results</Link>
            </div>
          )}
          <div><strong>{jury?.name ?? "Jury Member"}</strong><span>{jury?.email ?? ""}</span></div>
          <SignOutButton />
        </div>
      </header>

      <section className="dashboard-intro">
        <div>
          <div className="eyebrow">
            <span />{" "}
            {isAdmin
              ? "ADMIN OVERVIEW"
              : isManagement
                ? "MANAGEMENT OVERVIEW"
                : "YOUR ASSIGNMENTS"}
          </div>
          <h1>
            {isAdmin ? (
              <>Run the<br /><em>jury room.</em></>
            ) : isManagement ? (
              <>Festival<br /><em>overview.</em></>
            ) : (
              <>Films waiting<br /><em>for your eye.</em></>
            )}
          </h1>
          <p>
            {isAdmin
              ? "Manage participant submissions, films, jury members and assignments from the administration tools above."
              : isManagement
                ? "Review participant submissions and monitor jury evaluation results from the management tools above."
                : "Watch each assigned film and submit one evaluation. Once an evaluation is submitted, that film is locked for your account."}
          </p>
        </div>
        <div className="completion-card">
          <span>ASSIGNMENTS</span>
          <strong>{assignments?.length ?? 0}</strong>
          <small>{isAdmin ? "your assignments" : "films assigned"}</small>
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
            <article className={`film-card ${completed ? "completed" : ""}`} key={assignment.id}>
              <div className="film-card-top">
                <span className="film-status">{completed ? "✓ EVALUATED" : "● PENDING"}</span>
                <span>STV FILM FESTIVAL</span>
              </div>
              <h2>{film.title}</h2>
              <div className="film-meta">
                <span>Director <strong>{film.director}</strong></span>
                <span>Duration <strong>{film.duration}</strong></span>
                <span>Language <strong>{film.language}</strong></span>
              </div>
              {completed ? (
                <div className="locked-message">Evaluation submitted. This film is locked for your account.</div>
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
            <strong>{isAdmin ? "No assignments yet." : "No films assigned yet."}</strong>
            <span>{isAdmin ? "Use the submission and assignment tools to publish films to jury members." : "Your assigned films will appear here when the festival administrator publishes them."}</span>
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
