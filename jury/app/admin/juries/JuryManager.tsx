"use client";

import { FormEvent, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function JuryManager() {
  const supabase = createClient();
  const [juries, setJuries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [form, setForm] = useState({ name: "", email: "" });

  async function loadJuries() {
    const { data, error: loadError } = await supabase
      .from("juries")
      .select("id, name, email, role, created_at")
      .order("created_at", { ascending: true });
    if (loadError) setError(loadError.message);
    else setJuries(data ?? []);
    setLoading(false);
  }

  useEffect(() => { loadJuries(); }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");
    setSaving(true);

    try {
      const response = await fetch("/api/admin/juries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Unable to invite jury member.");

      setForm({ name: "", email: "" });
      setMessage(result.message);
      await loadJuries();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Unable to invite jury member.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="portal-shell admin-shell">
      <header className="portal-header">
        <a href="/dashboard" className="brand-lockup compact"><div className="brand-mark">STV</div><div><strong>Startup TV</strong><span>JURY PORTAL · ADMIN</span></div></a>
        <a href="/dashboard" className="back-link">← Jury dashboard</a>
      </header>

      <section className="admin-wrap">
        <div className="admin-heading">
          <div>
            <div className="eyebrow"><span /> JURY MANAGEMENT</div>
            <h1>Build the<br /><em>jury.</em></h1>
            <p>Invite jury members to the portal. Each member gets an individual account and can only see films assigned to them.</p>
          </div>
          <div className="admin-count"><span>JURORS</span><strong>{juries.filter((item) => item.role === "jury").length}</strong><small>in system</small></div>
        </div>

        <section className="admin-panel">
          <div className="panel-title"><div><span>NEW JURY MEMBER</span><h2>Send an invitation</h2></div><span className="panel-note">Name and email required</span></div>
          <form className="admin-form" onSubmit={handleSubmit}>
            <label>Full Name<input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Jury member name" required /></label>
            <label>Email Address<input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="jury@example.com" required /></label>
            {error && <div className="form-error wide-field">{error}</div>}
            {message && <div className="form-success wide-field">{message}</div>}
            <div className="wide-field form-actions"><span>The invitation lets the juror set up their own password.</span><button className="button button-primary" disabled={saving}>{saving ? "Sending…" : "Invite Jury Member"} <span>↗</span></button></div>
          </form>
        </section>

        <section className="admin-panel">
          <div className="panel-title"><div><span>JURY PANEL</span><h2>Members in the system</h2></div></div>
          {loading ? <div className="empty-state">Loading jury members…</div> : juries.length === 0 ? <div className="empty-state"><strong>No jury members added yet.</strong><span>Invited members will appear here.</span></div> : (
            <div className="jury-admin-list">
              {juries.map((member) => (
                <article className="jury-admin-row" key={member.id}>
                  <div className="jury-avatar">{member.name?.slice(0, 1).toUpperCase()}</div>
                  <div className="jury-main"><strong>{member.name}</strong><span>{member.email}</span></div>
                  <div className={`jury-role ${member.role}`}>{member.role}</div>
                </article>
              ))}
            </div>
          )}
        </section>
      </section>

      <style jsx>{`
        .admin-wrap{width:min(1240px,90vw);margin:0 auto;padding:75px 0 100px}
        .admin-heading{display:flex;justify-content:space-between;align-items:flex-end;gap:50px;margin-bottom:45px}
        .admin-heading h1{margin:15px 0 18px;font:800 clamp(48px,6vw,76px)/.95 Poppins,sans-serif;letter-spacing:-.055em}
        .admin-heading h1 em{font-style:normal;background:var(--gradient-main);-webkit-background-clip:text;background-clip:text;color:transparent}
        .admin-heading p{max-width:610px;margin:0;color:var(--text-secondary);font-size:14px;line-height:1.8}
        .admin-count{flex:0 0 150px;padding:22px;border:1px solid var(--glass-border);background:var(--glass-bg);border-radius:18px}.admin-count span,.admin-count small{display:block;color:var(--text-secondary);font-size:8px;letter-spacing:.16em}.admin-count strong{display:block;margin:5px 0;font:800 40px Poppins,sans-serif;background:var(--gradient-main);-webkit-background-clip:text;background-clip:text;color:transparent}
        .admin-panel{margin-top:18px;padding:28px;border:1px solid var(--glass-border);background:linear-gradient(145deg,rgba(255,255,255,.055),rgba(255,255,255,.025));border-radius:20px}
        .panel-title{display:flex;align-items:flex-end;justify-content:space-between;gap:20px;margin-bottom:25px}.panel-title>div>span{color:var(--text-secondary);font-size:9px;font-weight:700;letter-spacing:.16em}.panel-title h2{margin:7px 0 0;font:700 22px Poppins,sans-serif}.panel-note{color:var(--text-secondary);font-size:10px}
        .admin-form{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:17px}.admin-form label{display:grid;gap:8px;color:#eee;font-size:11px;font-weight:700}.admin-form input{width:100%;border:1px solid var(--glass-border);outline:none;color:white;background:rgba(255,255,255,.045);border-radius:12px;padding:13px 14px}.admin-form input:focus{border-color:rgba(243,150,31,.65);background:rgba(255,255,255,.065)}.wide-field{grid-column:1/-1}.form-actions{display:flex;justify-content:space-between;align-items:center;gap:20px;padding-top:5px;color:var(--text-secondary);font-size:10px}.form-success{border:1px solid rgba(80,220,130,.3);background:rgba(80,220,130,.08);color:#a8efbd;padding:12px 13px;border-radius:10px;font-size:11px}.form-error{border:1px solid rgba(240,90,70,.35);background:rgba(240,90,70,.08);color:#ffb0a5;padding:12px 13px;border-radius:10px;font-size:11px}
        .jury-admin-list{border:1px solid rgba(255,255,255,.07);border-radius:15px;overflow:hidden}.jury-admin-row{display:grid;grid-template-columns:42px minmax(0,1fr) 90px;gap:15px;align-items:center;padding:16px 18px;border-top:1px solid rgba(255,255,255,.07)}.jury-admin-row:first-child{border-top:0}.jury-avatar{width:36px;height:36px;border-radius:50%;display:grid;place-items:center;background:var(--gradient-main);color:white;font:700 12px Poppins,sans-serif}.jury-main{display:grid;gap:4px}.jury-main strong{font:600 13px Poppins,sans-serif}.jury-main span{color:var(--text-secondary);font-size:10px}.jury-role{text-align:right;color:var(--text-secondary);font-size:9px;text-transform:uppercase;letter-spacing:.12em}.jury-role.admin{color:#f5a35d}
        @media(max-width:800px){.admin-heading{flex-direction:column;align-items:flex-start}.admin-form{grid-template-columns:1fr}.jury-admin-row{grid-template-columns:42px minmax(0,1fr)}.jury-role{text-align:left}.form-actions{align-items:flex-start;flex-direction:column}}
      `}</style>
    </main>
  );
}
