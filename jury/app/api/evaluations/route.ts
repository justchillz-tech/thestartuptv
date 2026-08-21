import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { extractGoogleDriveFileId } from "@/lib/drive";

const limits = {
  story_narrative: 15,
  direction: 15,
  screenplay: 10,
  cinematography: 10,
  acting: 10,
  editing: 10,
  originality: 10,
  sound: 5,
  production_design: 5,
  overall_impact: 10,
} as const;

type ScoreKey = keyof typeof limits;

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  if (!claimsData?.claims) return NextResponse.json({ error: "You must be signed in." }, { status: 401 });

  const userId = String(claimsData.claims.sub);
  const body = await request.json().catch(() => null);
  const filmId = String(body?.filmId ?? "");
  const filmUrl = String(body?.filmUrl ?? "").trim();
  const remarks = String(body?.remarks ?? "").trim();
  const scores = body?.scores as Record<string, unknown> | undefined;
  const driveFileId = extractGoogleDriveFileId(filmUrl);

  if (!filmId || !driveFileId) return NextResponse.json({ error: "Please provide a valid Google Drive Film URL." }, { status: 400 });

  for (const [key, max] of Object.entries(limits) as [ScoreKey, number][]) {
    const value = scores?.[key];
    if (!Number.isInteger(Number(value)) || Number(value) < 0 || Number(value) > max) {
      return NextResponse.json({ error: `${key.replaceAll("_", " ")} must be a whole number from 0 to ${max}.` }, { status: 400 });
    }
  }

  const { data: assignment } = await supabase
    .from("assignments")
    .select("id, status, films(id, drive_file_id)")
    .eq("jury_id", userId)
    .eq("film_id", filmId)
    .single();

  if (!assignment) return NextResponse.json({ error: "This film is not assigned to your jury account." }, { status: 403 });
  if (assignment.status === "completed") return NextResponse.json({ error: "You have already completed this evaluation." }, { status: 409 });

  const film = Array.isArray(assignment.films) ? assignment.films[0] : assignment.films;
  if (!film || film.drive_file_id !== driveFileId) {
    return NextResponse.json({ error: "The Film URL does not match the assigned film." }, { status: 400 });
  }

  const numericScores = Object.fromEntries(Object.keys(limits).map((key) => [key, Number(scores?.[key])])) as Record<ScoreKey, number>;
  const total = Object.values(numericScores).reduce((sum, value) => sum + value, 0);

  const { error: insertError } = await supabase.from("evaluations").insert({
    jury_id: userId,
    film_id: filmId,
    drive_file_id: driveFileId,
    film_url: filmUrl,
    ...numericScores,
    total,
    remarks: remarks || null,
  });

  if (insertError) {
    if (insertError.code === "23505") {
      return NextResponse.json({ error: "You have already submitted an evaluation for this film." }, { status: 409 });
    }
    console.error(insertError);
    return NextResponse.json({ error: "The evaluation could not be saved." }, { status: 500 });
  }

  const { error: assignmentError } = await supabase
    .from("assignments")
    .update({ status: "completed", completed_at: new Date().toISOString() })
    .eq("id", assignment.id)
    .eq("jury_id", userId);

  if (assignmentError) {
    console.error(assignmentError);
    return NextResponse.json({ error: "Evaluation saved, but the assignment status could not be updated. Please contact the administrator." }, { status: 500 });
  }

  return NextResponse.json({ success: true, total });
}
