"use client";

import { useMemo, useState } from "react";

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

type Scores = Record<(typeof criteria)[number][0], string>;

export default function EvaluationForm({ filmId, expectedDriveUrl }: { filmId: string; expectedDriveUrl: string }) {
  const [filmUrl, setFilmUrl] = useState(expectedDriveUrl);
  const [scores, setScores] = useState<Scores>(() => Object.fromEntries(criteria.map(([key]) => [key, ""])) as Scores);
  const [remarks, setRemarks] = useState("");
  const [urlState, setUrlState] = useState<"idle" | "checking" | "valid" | "invalid">("idle");
  const [urlMessage, setUrlMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const total = useMemo(() => criteria.reduce((sum, [key, , max]) => {
    const value = Number(scores[key]);
    return sum + (Number.isFinite(value) ? Math.min(Math.max(value, 0), max) : 0);
  }, 0), [scores]);

  async function validateUrl() {
    setUrlState("checking");
    setUrlMessage("");
    try {
      const response = await fetch("/api/evaluations/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filmId, filmUrl }),
      });
      const result = await response.json();
      if (!response.ok) {
        setUrlState("invalid");
        setUrlMessage(result.error ?? "This film URL could not be validated.");
        return false;
      }
      setUrlState("valid");
      setUrlMessage("Film URL verified. You can submit this evaluation once you finish scoring.");
      return true;
    } catch {
      setUrlState("invalid");
      setUrlMessage("Could not validate the Film URL. Please try again.");
      return false;
    }
  }

  async function submitEvaluation(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSubmitting(true);

    const urlValid = await validateUrl();
    if (!urlValid) {
      setSubmitting(false);
      return;
    }

    for (const [key, label, max] of criteria) {
      const value = Number(scores[key]);
      if (!Number.isInteger(value) || value < 0 || value > max) {
        setError(`${label} must be a whole number from 0 to ${max}.`);
        setSubmitting(false);
        return;
      }
    }

    try {
      const response = await fetch("/api/evaluations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filmId, filmUrl, scores, remarks }),
      });
      const result = await response.json();
      if (!response.ok) {
        setError(result.error ?? "The evaluation could not be submitted.");
        setUrlState("invalid");
        setUrlMessage(result.error ?? "The Film URL could not be accepted.");
        setSubmitting(false);
        return;
      }
      window.location.href = "/dashboard";
    } catch {
      setError("Something went wrong while submitting. Please try again.");
      setSubmitting(false);
    }
  }

  return (
    <form className="evaluation-form" onSubmit={submitEvaluation}>
      <div className="section-kicker">01 / FILM URL VALIDATION</div>
      <div className="url-field-wrap">
        <label className="field-label" htmlFor="film-url">Film URL</label>
        <div className="url-row">
          <input id="film-url" value={filmUrl} onChange={(e) => { setFilmUrl(e.target.value); setUrlState("idle"); setUrlMessage(""); }} placeholder="Paste the Google Drive film link" required />
          <button type="button" className="secondary-button" onClick={validateUrl} disabled={urlState === "checking"}>
            {urlState === "checking" ? "Checking…" : "Validate"}
          </button>
        </div>
        {urlMessage && <p className={`url-message ${urlState}`}>{urlMessage}</p>}
      </div>

      <div className="evaluation-heading">
        <div>
          <div className="section-kicker">02 / EVALUATION CRITERIA</div>
          <h2>Judge the story.<br /><em>Score the craft.</em></h2>
        </div>
        <div className="total-card"><span>TOTAL</span><strong>{total}</strong><small>/ 100</small></div>
      </div>

      <div className="criteria-table">
        <div className="criteria-header"><span>#</span><span>Criteria</span><span>Maximum</span><span>Score</span></div>
        {criteria.map(([key, label, max], index) => (
          <div className="criteria-row" key={key}>
            <span className="criteria-number">{String(index + 1).padStart(2, "0")}</span>
            <span className="criteria-name">{label}</span>
            <span className="criteria-max">{max}</span>
            <input className="score-input" type="number" min={0} max={max} step={1} value={scores[key]} onChange={(e) => setScores((current) => ({ ...current, [key]: e.target.value }))} required />
          </div>
        ))}
      </div>

      <div className="remarks-block">
        <div className="section-kicker">03 / REMARKS</div>
        <textarea value={remarks} onChange={(e) => setRemarks(e.target.value)} placeholder="Add your observations, comments or recommendations…" rows={7} />
      </div>

      {error && <div className="form-error submit-error">{error}</div>}

      <div className="submit-area">
        <p>Once submitted, this evaluation is final and the film will be locked for your account.</p>
        <button className="button button-primary button-large" disabled={submitting}>
          {submitting ? "Submitting…" : "Submit Evaluation"} <span>↗</span>
        </button>
      </div>
    </form>
  );
}
