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
    .select("id, status, films(id, title, director, duration, language, drive_url)")
    .eq("jury_id", userId)
    .order("created_at", { ascending: true });

  const isAdmin = jury?.role === "admin";

  return (
    <main className="portal-shell">
      <header className="portal-header">
        <Link href="/dashboard" className="brand-lockup compact">
          <div className="brand-mark">STV</div>
          <div><strong>Startup TV</strong><span>JURY PORTAL</span></div>
        </Link>
        <div className="header-user">
          {isAdmin && <div className="admin-links"><Link href="/admin/films">Films</Link><Link href="/admin/juries">Jury</Link><Link href="/admin/assignments">Assignments</Link></div>}
          <div><strong>{jury?.name ?? "Jury Member"}</strong><span>{jury?.email ?? ""}</span></div>
          <SignOutButton />
        </div>
      </header>

      <section className="dashboard-intro">
        <div>
          <div className="eyebrow"><span /> {isAdmin ? "ADMIN OVERVIEW" : "YOUR ASSIGNMENTS"}</div>
          <h1>{isAdmin ? <>Run the<br /><em>jury room.</em></> : <>Films waiting<br /><em>for your eye.</em></>}</h1>
          <p>{isAdmin ? "Manage films, jury members and assignments from the administration tools above." : "Watch each assigned film and submit one evaluation. Once an evaluation is submitted, that film is locked for your account."}</p>
        </div>
        <div className="completion-card">
          <span>{isAdmin ? "ASSIGNMENTS" : "ASSIGNMENTS"}</span>
          <strong>{assignments?.length ?? 0}</strong>
          <small>{isAdmin ? "your assignments" : "films assigned"}</small>
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
            <strong>{isAdmin ? "No assignments yet." : "No films assigned yet."}</strong>
            <span>{isAdmin ? "Use the assignment manager to publish films to jury members." : "Your assigned films will appear here when the festival administrator publishes them."}</span>
          </div>
        )}
      </section>

      <style jsx>{`
        .admin-links{display:flex;align-items:center;gap:14px;margin-right:8px}.admin-links a{color:var(--text-secondary);font-size:9px;font-weight:700;letter-spacing:.05em}.admin-links a:hover{color:white}
        @media(max-width:800px){.admin-links{display:none}}
      `}</style>
    </main>
  );
}
