import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import styles from "./results.module.css";

type Evaluation = {
  id: string;
  jury_id: string;
  film_id: string;
  total: number;
  story_narrative: number;
  direction: number;
  screenplay: number;
  cinematography: number;
  acting: number;
  editing: number;
  originality: number;
  sound: number;
  production_design: number;
  overall_impact: number;
  remarks: string | null;
  submitted_at: string;
  films: { id: string; film_code: string; title: string; director: string } | null;
  juries: { id: string; name: string; email: string } | null;
};

type RawEvaluation = Omit<Evaluation, "films" | "juries">;

const criteria = [
  ["story_narrative", "Story & Narrative", 15],
  ["direction", "Direction", 15],
  ["screenplay", "Screenplay", 10],
  ["cinematography", "Cinematography", 10],
  ["acting", "Acting & Performances", 10],
  ["editing", "Editing & Pacing", 10],
  ["originality", "Originality & Creativity", 10],
  ["sound", "Sound Design & Music", 5],
  ["production_design", "Production Design & Technical Execution", 5],
  ["overall_impact", "Overall Impact", 10],
] as const;

export default async function AdminResultsPage() {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  if (!claimsData?.claims) redirect("/login");

  const userId = String(claimsData.claims.sub);
  const { data: jury } = await supabase.from("juries").select("role").eq("id", userId).single();
  if (jury?.role !== "admin") redirect("/dashboard");

  // evaluations has two foreign keys to films (film_id and drive_file_id),
  // so nested PostgREST selection of films is ambiguous. Fetch related
  // records separately and join them in memory.
  const [{ data: films, error: filmsError }, { data: evaluations, error: evaluationsError }] = await Promise.all([
    supabase.from("films").select("id, film_code, title, director, status").order("created_at", { ascending: true }),
    supabase
      .from("evaluations")
      .select("id, jury_id, film_id, total, story_narrative, direction, screenplay, cinematography, acting, editing, originality, sound, production_design, overall_impact, remarks, submitted_at")
      .order("submitted_at", { ascending: true }),
  ]);

  if (filmsError || evaluationsError) {
    console.error("Results query failed", { filmsError, evaluationsError });
    throw new Error("Unable to load evaluation results.");
  }

  const rawRows = (evaluations ?? []) as RawEvaluation[];
  const juryIds = [...new Set(rawRows.map((evaluation) => evaluation.jury_id))];

  const { data: juries, error: juriesError } = juryIds.length
    ? await supabase.from("juries").select("id, name, email").in("id", juryIds)
    : { data: [], error: null };

  if (juriesError) {
    console.error("Jury query failed", juriesError);
    throw new Error("Unable to load jury details.");
  }

  const filmMap = new Map((films ?? []).map((film) => [film.id, film]));
  const juryMap = new Map((juries ?? []).map((member) => [member.id, member]));
  const rows: Evaluation[] = rawRows.map((evaluation) => ({
    ...evaluation,
    films: filmMap.get(evaluation.film_id) ?? null,
    juries: juryMap.get(evaluation.jury_id) ?? null,
  }));

  const grouped = new Map<string, Evaluation[]>();
  for (const evaluation of rows) {
    const current = grouped.get(evaluation.film_id) ?? [];
    current.push(evaluation);
    grouped.set(evaluation.film_id, current);
  }

  const rankedFilms = Array.from(grouped.entries())
    .map(([filmId, filmEvaluations]) => {
      const film = filmMap.get(filmId) ?? filmEvaluations[0]?.films;
      const scores = filmEvaluations.map((evaluation) => evaluation.total);
      const average = scores.reduce((sum, score) => sum + score, 0) / scores.length;
      return { filmId, film, evaluations: filmEvaluations, average, highest: Math.max(...scores), lowest: Math.min(...scores) };
    })
    .sort((a, b) => b.average - a.average);

  const averageScore = rows.length ? rows.reduce((sum, evaluation) => sum + evaluation.total, 0) / rows.length : 0;
  const completedFilms = rankedFilms.length;
  const pendingFilms = Math.max((films?.length ?? 0) - completedFilms, 0);

  return (
    <main className="portal-shell">
      <header className="portal-header">
        <Link href="/dashboard" className="brand-lockup compact">
          <div className="brand-mark">STV</div>
          <div><strong>Startup TV</strong><span>JURY PORTAL · ADMIN</span></div>
        </Link>
        <Link href="/dashboard" className="back-link">← Jury dashboard</Link>
      </header>

      <section className={styles.resultsIntro}>
        <div>
          <div className="eyebrow"><span /> RESULTS &amp; SCORING</div>
          <h1>See the<br /><em>whole picture.</em></h1>
          <p>Review submitted jury scores, compare films and track how many evaluations are still outstanding.</p>
        </div>
        <div className={styles.resultsStats}>
          <div><span>FILMS</span><strong>{films?.length ?? 0}</strong><small>{pendingFilms} awaiting scores</small></div>
          <div><span>EVALUATIONS</span><strong>{rows.length}</strong><small>{completedFilms} films reviewed</small></div>
          <div><span>AVERAGE</span><strong>{averageScore.toFixed(1)}</strong><small>out of 100</small></div>
        </div>
      </section>

      <section className={styles.resultsList}>
        <div className={styles.resultsSectionHead}>
          <div><div className="section-kicker">SUBMITTED SCORES</div><h2>Film rankings</h2></div>
          <span>{rankedFilms.length} reviewed</span>
        </div>

        {rankedFilms.length === 0 ? (
          <div className="empty-state"><strong>No evaluations submitted yet.</strong><span>Scores will appear here as jury members complete their assigned films.</span></div>
        ) : (
          <div className={styles.rankingList}>
            {rankedFilms.map((item, index) => (
              <details className={styles.rankingCard} key={item.filmId}>
                <summary>
                  <span className={styles.rankNumber}>{String(index + 1).padStart(2, "0")}</span>
                  <span className={styles.rankFilm}><strong>{item.film?.title ?? "Untitled film"}</strong><small>{item.film?.film_code ?? ""} · {item.film?.director ?? ""}</small></span>
                  <span className={styles.rankCount}>{item.evaluations.length} {item.evaluations.length === 1 ? "evaluation" : "evaluations"}</span>
                  <span className={styles.rankAverage}><strong>{item.average.toFixed(1)}</strong><small>/ 100 avg.</small></span>
                  <span className={styles.rankChevron}>+</span>
                </summary>

                <div className={styles.resultDetail}>
                  <div className={styles.scoreSummary}>
                    <div><span>AVERAGE</span><strong>{item.average.toFixed(1)}</strong></div>
                    <div><span>HIGH</span><strong>{item.highest}</strong></div>
                    <div><span>LOW</span><strong>{item.lowest}</strong></div>
                  </div>

                  <div className={styles.juryEvaluationList}>
                    {item.evaluations.map((evaluation) => (
                      <article className={styles.juryEvaluation} key={evaluation.id}>
                        <div className={styles.juryEvaluationHead}>
                          <div><strong>{evaluation.juries?.name ?? "Jury member"}</strong><span>{evaluation.juries?.email ?? ""}</span></div>
                          <strong className={styles.juryTotal}>{evaluation.total}/100</strong>
                        </div>

                        <div className={styles.criterionScores}>
                          {criteria.map(([key, label, max]) => (
                            <div key={key}><span>{label}</span><strong>{evaluation[key]}/{max}</strong></div>
                          ))}
                        </div>

                        {evaluation.remarks && <div className={styles.resultRemarks}><span>REMARKS</span><p>{evaluation.remarks}</p></div>}
                        <div className={styles.submittedAt}>Submitted {new Date(evaluation.submitted_at).toLocaleString()}</div>
                      </article>
                    ))}
                  </div>
                </div>
              </details>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
