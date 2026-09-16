import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import EvaluationForm from "./EvaluationForm";

export default async function EvaluationPage({ params }: { params: Promise<{ filmId: string }> }) {
  const { filmId } = await params;
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  if (!claimsData?.claims) redirect("/login");

  const userId = String(claimsData.claims.sub);
  const { data: assignment } = await supabase
    .from("assignments")
    .select("id, status, films(id, title, director, duration, language, drive_url, drive_file_id)")
    .eq("jury_id", userId)
    .eq("film_id", filmId)
    .single();

  if (!assignment) notFound();
  if (assignment.status === "completed") redirect("/dashboard");

  const film = Array.isArray(assignment.films) ? assignment.films[0] : assignment.films;
  if (!film) notFound();

  return (
    <main className="evaluation-shell">
      <header className="portal-header evaluation-header">
        <Link href="/dashboard" className="brand-lockup compact">
          <div className="brand-mark">STV</div>
          <div><strong>Startup TV</strong><span>JURY PORTAL</span></div>
        </Link>
        <Link href="/dashboard" className="back-link">← Back to assignments</Link>
      </header>

      <section className="evaluation-wrap">
        <div className="evaluation-film-head">
          <div>
            <div className="eyebrow"><span /> FILM UNDER REVIEW</div>
            <h1>{film.title}</h1>
            <div className="film-details-row">
              <span>Director <strong>{film.director}</strong></span>
              <span>Duration <strong>{film.duration}</strong></span>
              <span>Language <strong>{film.language}</strong></span>
            </div>
          </div>
        </div>

        <section className="watch-card">
          <div>
            <span className="watch-label">WATCH THE FILM</span>
            <h2>Take your time.</h2>
            <p>You may watch the film as needed before submitting your evaluation.</p>
          </div>
          <a className="button button-primary" href={film.drive_url} target="_blank" rel="noopener noreferrer">Open Film <span>↗</span></a>
        </section>

        <EvaluationForm filmId={film.id} expectedDriveUrl={film.drive_url} />
      </section>
    </main>
  );
}
