import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import SignOutButton from "./SignOutButton";

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  if (!claimsData?.claims) redirect("/login");

  const userId = String(claimsData.claims.sub);
  const { data: jury } = await supabase.from("juries").select("name, email").eq("id", userId).single();

  const { data: assignments } = await supabase
    .from("assignments")
    .select("id, status, films(id, title, director, duration, language, drive_url)")
    .eq("jury_id", userId)
    .order("created_at", { ascending: true });

  return (
    <main className="portal-shell">
      <header className="portal-header">
        <Link href="/dashboard" className="brand-lockup compact">
          <div className="brand-mark">STV</div>
          <div><strong>Startup TV</strong><span>JURY PORTAL</span></div>
        </Link>
        <div className="header-user">
          <div><strong>{jury?.name ?? "Jury Member"}</strong><span>{jury?.email ?? ""}</span></div>
          <SignOutButton />
        </div>
      </header>

      <section className="dashboard-intro">
        <div>
          <div className="eyebrow"><span /> YOUR ASSIGNMENTS</div>
          <h1>Films waiting<br /><em>for your eye.</em></h1>
          <p>Watch each assigned film and submit one evaluation. Once an evaluation is submitted, that film is locked for your account.</p>
        </div>
        <div className="completion-card">
          <span>ASSIGNMENTS</span>
          <strong>{assignments?.length ?? 0}</strong>
          <small>films assigned</small>
        </div>
      </section>

      <section className="film-grid">
        {(assignments ?? []).map((assignment) => {
          const film = Array.isArray(assignment.films) ? assignment.films[0] : assignment.films;
          if (!film) return null;
          const completed = assignment.status === "completed";

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
                <Link className="button button-primary full-button" href={`/evaluate/${film.id}`}>
                  Open Evaluation <span>↗</span>
                </Link>
              )}
            </article>
          );
        })}

        {(!assignments || assignments.length === 0) && (
          <div className="empty-state">
            <strong>No films assigned yet.</strong>
            <span>Your assigned films will appear here when the festival administrator publishes them.</span>
          </div>
        )}
      </section>
    </main>
  );
}
