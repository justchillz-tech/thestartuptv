"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

type Film = { id: string; film_code: string; title: string; director: string; duration: string; language: string; status: string };
type Jury = { id: string; name: string; email: string; role: string };
type Assignment = { id: string; jury_id: string; film_id: string; status: string; created_at: string; completed_at: string | null; films: Film | Film[]; juries: Jury | Jury[] };

function one<T>(value: T | T[] | null | undefined): T | null {
  return Array.isArray(value) ? value[0] ?? null : value ?? null;
}

export default function AssignmentManager() {
  const supabase = createClient();
  const [films, setFilms] = useState<Film[]>([]);
  const [juries, setJuries] = useState<Jury[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [filmId, setFilmId] = useState("");
  const [juryId, setJuryId] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function loadData() {
    setLoading(true);
    setError("");
    const [filmsResult, juriesResult, assignmentsResult] = await Promise.all([
      supabase.from("films").select("id, film_code, title, director, duration, language, status").order("created_at", { ascending: false }),
      supabase.from("juries").select("id, name, email, role").eq("role", "jury").order("created_at", { ascending: true }),
      supabase.from("assignments").select("id, jury_id, film_id, status, created_at, completed_at, films(id, film_code, title, director, duration, language, status), juries(id, name, email, role)").order("created_at", { ascending: false }),
    ]);

    const firstError = filmsResult.error ?? juriesResult.error ?? assignmentsResult.error;
    if (firstError) setError(firstError.message);
    else {
      setFilms(filmsResult.data ?? []);
      setJuries(juriesResult.data ?? []);
      setAssignments((assignmentsResult.data as Assignment[]) ?? []);
    }
    setLoading(false);
  }

  useEffect(() => { loadData(); }, []);

  const assignedKeys = useMemo(() => new Set(assignments.map((item) => `${item.film_id}:${item.jury_id}`)), [assignments]);
  const availableJuries = useMemo(() => juries.filter((jury) => filmId && !assignedKeys.has(`${filmId}:${jury.id}`)), [juries, filmId, assignedKeys]);

  async function handleAssign(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");
    if (!filmId || !juryId) {
      setError("Select both a film and a jury member.");
      return;
    }

    setSaving(true);
    const { error: insertError } = await supabase.from("assignments").insert({ film_id: filmId, jury_id: juryId });
    if (insertError) {
      setError(insertError.code === "23505" ? "That film is already assigned to this jury member." : insertError.message);
    } else {
      setMessage("Film assigned successfully.");
      setFilmId("");
      setJuryId("");
      await loadData();
    }
    setSaving(false);
  }

  async function removeAssignment(id: string) {
    setError("");
    setMessage("");
    const { error: deleteError } = await supabase.from("assignments").delete().eq("id", id);
    if (deleteError) setError(deleteError.message);
    else {
      setMessage("Assignment removed.");
      await loadData();
    }
  }

  return (
    <main className="portal-shell admin-shell">
      <header className="portal-header">
        <Link href="/dashboard" className="brand-lockup compact"><div className="brand-mark">STV</div><div><strong>Startup TV</strong><span>JURY PORTAL · ADMIN</span></div></Link>
        <div className="admin-nav"><Link href="/admin/films">Films</Link><Link href="/admin/juries">Jury</Link><Link href="/admin/assignments" className="active">Assignments</Link><Link href="/dashboard" className="back-link">Dashboard →</Link></div>
      </header>

      <section className="admin-wrap">
        <div className="admin-heading">
          <div>
            <div className="eyebrow"><span /> ASSIGNMENT MANAGEMENT</div>
            <h1>Put the stories<br /><em>in the right hands.</em></h1>
            <p>Assign submitted films to individual jury members. A juror will see a film on their dashboard only after an assignment is published here.</p>
          </div>
          <div className="stats-row">
            <div className="admin-count"><span>FILMS</span><strong>{films.length}</strong><small>in system</small></div>
            <div className="admin-count"><span>JURORS</span><strong>{juries.length}</strong><small>in system</small></div>
            <div className="admin-count"><span>ASSIGNMENTS</span><strong>{assignments.length}</strong><small>total</small></div>
          </div>
        </div>

        <section className="admin-panel">
          <div className="panel-title"><div><span>NEW ASSIGNMENT</span><h2>Give a film to a juror</h2></div><span className="panel-note">One film · one juror</span></div>
          <form className="assignment-form" onSubmit={handleAssign}>
            <label>Film<select value={filmId} onChange={(event) => { setFilmId(event.target.value); setJuryId(""); }} required><option value="">Select a film</option>{films.map((film) => <option key={film.id} value={film.id}>{film.film_code} · {film.title}</option>)}</select></label>
            <label>Jury Member<select value={juryId} onChange={(event) => setJuryId(event.target.value)} disabled={!filmId} required><option value="">{filmId ? "Select a jury member" : "Select a film first"}</option>{availableJuries.map((jury) => <option key={jury.id} value={jury.id}>{jury.name} · {jury.email}</option>)}</select></label>
            {filmId && availableJuries.length === 0 && <div className="form-note wide-field">Every jury member is already assigned this film.</div>}
            {error && <div className="form-error wide-field">{error}</div>}
            {message && <div className="form-success wide-field">{message}</div>}
            <div className="wide-field form-actions"><span>Completed evaluations stay recorded even if an assignment is removed later.</span><button className="button button-primary" disabled={saving || !filmId || !juryId}>{saving ? "Assigning…" : "Assign Film"} <span>↗</span></button></div>
          </form>
        </section>

        <section className="admin-panel">
          <div className="panel-title"><div><span>ASSIGNMENT REGISTER</span><h2>Films and their jury panel</h2></div><span className="panel-note">{assignments.length} assignment{assignments.length === 1 ? "" : "s"}</span></div>
          {loading ? <div className="empty-state">Loading assignments…</div> : assignments.length === 0 ? <div className="empty-state"><strong>No assignments yet.</strong><span>Choose a film and jury member above to publish the first assignment.</span></div> : (
            <div className="assignment-list">
              {assignments.map((assignment) => {
                const film = one(assignment.films);
                const jury = one(assignment.juries);
                return <article className="assignment-row" key={assignment.id}>
                  <div className="assignment-film"><span>{film?.film_code ?? "FILM"}</span><strong>{film?.title ?? "Unknown film"}</strong><small>{film?.director ?? ""} · {film?.duration ?? ""} · {film?.language ?? ""}</small></div>
                  <div className="assignment-jury"><div className="jury-avatar">{jury?.name?.slice(0, 1).toUpperCase() ?? "J"}</div><div><strong>{jury?.name ?? "Unknown juror"}</strong><small>{jury?.email ?? ""}</small></div></div>
                  <div className={`assignment-status ${assignment.status}`}>{assignment.status === "completed" ? "✓ COMPLETED" : "● PENDING"}</div>
                  <button className="remove-button" type="button" onClick={() => removeAssignment(assignment.id)} disabled={assignment.status === "completed"}>Remove</button>
                </article>;
              })}
            </div>
          )}
        </section>
      </section>

      <style jsx>{`
        .admin-nav{display:flex;align-items:center;gap:20px}.admin-nav a{color:var(--text-secondary);font-size:10px;font-weight:600}.admin-nav a:hover,.admin-nav a.active{color:white}.admin-nav .back-link{margin-left:5px}
        .admin-wrap{width:min(1240px,90vw);margin:0 auto;padding:75px 0 100px}.admin-heading{display:flex;justify-content:space-between;align-items:flex-end;gap:50px;margin-bottom:45px}.admin-heading h1{margin:15px 0 18px;font:800 clamp(44px,5.5vw,72px)/.95 Poppins,sans-serif;letter-spacing:-.055em}.admin-heading h1 em{font-style:normal;background:var(--gradient-main);-webkit-background-clip:text;background-clip:text;color:transparent}.admin-heading p{max-width:620px;margin:0;color:var(--text-secondary);font-size:14px;line-height:1.8}.stats-row{display:flex;gap:12px}.admin-count{min-width:120px;padding:18px;border:1px solid var(--glass-border);background:var(--glass-bg);border-radius:18px}.admin-count span,.admin-count small{display:block;color:var(--text-secondary);font-size:8px;letter-spacing:.16em}.admin-count strong{display:block;margin:5px 0;font:800 34px Poppins,sans-serif;background:var(--gradient-main);-webkit-background-clip:text;background-clip:text;color:transparent}
        .admin-panel{margin-top:18px;padding:28px;border:1px solid var(--glass-border);background:linear-gradient(145deg,rgba(255,255,255,.055),rgba(255,255,255,.025));border-radius:20px}.panel-title{display:flex;align-items:flex-end;justify-content:space-between;gap:20px;margin-bottom:25px}.panel-title>div>span{color:var(--text-secondary);font-size:9px;font-weight:700;letter-spacing:.16em}.panel-title h2{margin:7px 0 0;font:700 22px Poppins,sans-serif}.panel-note{color:var(--text-secondary);font-size:10px}
        .assignment-form{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:17px}.assignment-form label{display:grid;gap:8px;color:#eee;font-size:11px;font-weight:700}.assignment-form select{width:100%;border:1px solid var(--glass-border);outline:none;color:white;background:#10162d;border-radius:12px;padding:13px 14px}.assignment-form select:focus{border-color:rgba(243,150,31,.65)}.assignment-form select:disabled{opacity:.5}.wide-field{grid-column:1/-1}.form-note{color:var(--text-secondary);font-size:10px;padding:12px 13px;border:1px dashed rgba(255,255,255,.12);border-radius:10px}.form-actions{display:flex;justify-content:space-between;align-items:center;gap:20px;padding-top:5px;color:var(--text-secondary);font-size:10px}.form-success{border:1px solid rgba(80,220,130,.3);background:rgba(80,220,130,.08);color:#a8efbd;padding:12px 13px;border-radius:10px;font-size:11px}.form-error{border:1px solid rgba(240,90,70,.35);background:rgba(240,90,70,.08);color:#ffb0a5;padding:12px 13px;border-radius:10px;font-size:11px}
        .assignment-list{border:1px solid rgba(255,255,255,.07);border-radius:15px;overflow:hidden}.assignment-row{display:grid;grid-template-columns:minmax(0,1.5fr) minmax(220px,1fr) 105px 70px;gap:18px;align-items:center;padding:17px 18px;border-top:1px solid rgba(255,255,255,.07)}.assignment-row:first-child{border-top:0}.assignment-film,.assignment-jury{display:grid;gap:4px}.assignment-film span{color:#f0a36b;font:700 9px Poppins,sans-serif;letter-spacing:.1em}.assignment-film strong{font:600 13px Poppins,sans-serif}.assignment-film small,.assignment-jury small{color:var(--text-secondary);font-size:9px}.assignment-jury{display:flex;align-items:center;gap:11px}.assignment-jury>div:last-child{display:grid;gap:4px}.jury-avatar{width:34px;height:34px;flex:0 0 34px;border-radius:50%;display:grid;place-items:center;background:var(--gradient-main);font:700 11px Poppins,sans-serif}.assignment-jury strong{font:600 12px Poppins,sans-serif}.assignment-status{font-size:8px;letter-spacing:.1em;color:#f0a36b;text-align:right}.assignment-status.completed{color:#9de8b2}.remove-button{border:0;background:transparent;color:var(--text-secondary);font-size:9px;text-align:right}.remove-button:hover:not(:disabled){color:#ffb19c}.remove-button:disabled{opacity:.25;cursor:not-allowed}.empty-state{padding:55px;display:grid;gap:8px;text-align:center;color:var(--text-secondary)}.empty-state strong{color:white;font:600 18px Poppins,sans-serif}
        @media(max-width:900px){.admin-heading{flex-direction:column;align-items:flex-start}.stats-row{width:100%}.admin-count{flex:1}.assignment-row{grid-template-columns:1fr 1fr}.assignment-status,.remove-button{text-align:left}}@media(max-width:650px){.portal-header{height:auto;min-height:82px;padding:16px 20px;gap:15px;flex-wrap:wrap}.admin-nav{gap:12px;flex-wrap:wrap}.admin-wrap{width:92vw;padding-top:55px}.assignment-form{grid-template-columns:1fr}.stats-row{display:grid;grid-template-columns:repeat(3,1fr)}.admin-count{min-width:0;padding:14px}.admin-count strong{font-size:27px}.assignment-row{grid-template-columns:1fr}.assignment-status,.remove-button{text-align:left}.form-actions{align-items:flex-start;flex-direction:column}}
      `}</style>
    </main>
  );
}
