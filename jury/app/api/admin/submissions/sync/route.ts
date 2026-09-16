import { createHash } from "crypto";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

function parseCsv(csv: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;

  for (let i = 0; i < csv.length; i += 1) {
    const char = csv[i];
    const next = csv[i + 1];

    if (char === '"') {
      if (quoted && next === '"') {
        cell += '"';
        i += 1;
      } else {
        quoted = !quoted;
      }
    } else if (char === "," && !quoted) {
      row.push(cell);
      cell = "";
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && next === "\n") i += 1;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += char;
    }
  }

  if (cell.length > 0 || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }

  return rows.filter((item) => item.some((value) => value.trim() !== ""));
}

function clean(value: string | undefined) {
  return value?.trim() ?? "";
}

function findColumn(headers: string[], patterns: string[]) {
  const normalized = headers.map((header) => header.trim().toLowerCase());
  return patterns.reduce<number | null>((found, pattern) => {
    if (found !== null) return found;
    const index = normalized.findIndex((header) => header.includes(pattern));
    return index >= 0 ? index : null;
  }, null);
}

function getValue(row: string[], headers: string[], patterns: string[]) {
  const index = findColumn(headers, patterns);
  return index === null ? "" : clean(row[index]);
}

function parseTimestamp(value: string) {
  const match = value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2}):(\d{2})$/);
  if (!match) return null;
  const [, day, month, year, hour, minute, second] = match;
  return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}T${hour.padStart(2, "0")}:${minute}:${second}+05:30`;
}

function sourceRowId(values: string[]) {
  return createHash("sha256").update(values.join("\u001f")).digest("hex");
}

export async function POST() {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();

  if (!claimsData?.claims) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = String(claimsData.claims.sub);
  const { data: jury } = await supabase.from("juries").select("role").eq("id", userId).single();

  if (jury?.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const sheetId = process.env.GOOGLE_SHEET_ID;
  const gid = process.env.GOOGLE_SHEET_GID;
  if (!sheetId || !gid) {
    return NextResponse.json({ error: "Google Sheet configuration is missing." }, { status: 500 });
  }

  const sheetUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&gid=${encodeURIComponent(gid)}`;
  const response = await fetch(sheetUrl, { cache: "no-store" });

  if (!response.ok) {
    return NextResponse.json({ error: `Google Sheet could not be read (${response.status}).` }, { status: 502 });
  }

  const csv = await response.text();
  const rows = parseCsv(csv);
  if (rows.length < 2) {
    return NextResponse.json({ imported: 0, message: "No participant responses found." });
  }

  const headers = rows[0];
  const submissions = rows.slice(1).map((row) => {
    const timestamp = getValue(row, headers, ["timestamp"]);
    const participantEmail = getValue(row, headers, ["email address"]);
    const submittedEmail = getValue(row, headers, ["email"]);
    const name = getValue(row, headers, ["name"]);
    const contactNumber = getValue(row, headers, ["contact number"]);
    const organization = getValue(row, headers, ["organization/institution", "organization"]);
    const title = getValue(row, headers, ["title of the film", "film title"]);
    const genre = getValue(row, headers, ["genre"]);
    const duration = getValue(row, headers, ["duration"]);
    const productionYear = getValue(row, headers, ["production year"]);
    const directorName = getValue(row, headers, ["director name", "director"]);
    const producerName = getValue(row, headers, ["producer name", "producer"]);
    const language = getValue(row, headers, ["language"]);
    const synopsis = getValue(row, headers, ["synopsis"]);
    const castCrew = getValue(row, headers, ["cast & crew", "cast and crew"]);
    const filmUrl = getValue(row, headers, ["film link", "film url"]);

    const identity = [timestamp, participantEmail, submittedEmail, name, title, filmUrl];

    return {
      source_row_id: sourceRowId(identity),
      submitted_at: parseTimestamp(timestamp),
      participant_email: participantEmail || null,
      submitted_email: submittedEmail || null,
      participant_name: name,
      contact_number: contactNumber || null,
      organization: organization || null,
      title,
      genre: genre || null,
      duration: duration || null,
      production_year: productionYear || null,
      director_name: directorName || null,
      producer_name: producerName || null,
      language: language || null,
      synopsis: synopsis || null,
      cast_crew: castCrew || null,
      film_url: filmUrl || null,
    };
  }).filter((submission) => submission.participant_name && submission.title);

  if (submissions.length === 0) {
    return NextResponse.json({ imported: 0, message: "No valid participant submissions found." });
  }

  const { error } = await supabase
    .from("film_submissions")
    .upsert(submissions, { onConflict: "source_row_id" });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ imported: submissions.length, message: `${submissions.length} participant submission(s) synchronized.` });
}
