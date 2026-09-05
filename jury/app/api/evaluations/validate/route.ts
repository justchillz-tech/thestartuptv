import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  extractGoogleDriveFileId,
  extractYouTubeVideoId,
} from "@/lib/drive";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  if (!claimsData?.claims) return NextResponse.json({ error: "You must be signed in." }, { status: 401 });

  const userId = String(claimsData.claims.sub);
  const body = await request.json().catch(() => null);
  const filmId = String(body?.filmId ?? "");
  const filmUrl = String(body?.filmUrl ?? "").trim();
  const driveFileId = extractGoogleDriveFileId(filmUrl);
  const youtubeVideoId = extractYouTubeVideoId(filmUrl);

  if (!filmId || (!driveFileId && !youtubeVideoId)) {
    return NextResponse.json(
      {
        error: "Please provide a valid Google Drive or YouTube Film URL.",
      },
      { status: 400 }
    );
  }

  const { data: assignment } = await supabase
    .from("assignments")
    .select("id, status, films(id, drive_file_id, video_url)")
    .eq("jury_id", userId)
    .eq("film_id", filmId)
    .single();

  if (!assignment) return NextResponse.json({ error: "This film is not assigned to your jury account." }, { status: 403 });
  if (assignment.status === "completed") return NextResponse.json({ error: "You have already completed this evaluation." }, { status: 409 });

  const film = Array.isArray(assignment.films)
    ? assignment.films[0]
    : assignment.films;

  if (!film) {
    return NextResponse.json(
      { error: "Assigned film could not be found." },
      { status: 400 }
    );
  }

  let validFilmUrl = false;

  if (driveFileId) {
    validFilmUrl = film.drive_file_id === driveFileId;
  } else if (youtubeVideoId) {
    const assignedYouTubeId = extractYouTubeVideoId(
      film.video_url ?? ""
    );

    validFilmUrl = assignedYouTubeId === youtubeVideoId;
  }

  if (!validFilmUrl) {
    return NextResponse.json(
      {
        error:
          "This Film URL does not match the assigned film. Please use the original film link.",
      },
      { status: 400 }
    );
  }

  const { data: existing } = await supabase
    .from("evaluations")
    .select("id")
    .eq("jury_id", userId)
    .eq("film_id", filmId)
    .maybeSingle();

  if (existing) {
    return NextResponse.json(
      { error: "You have already submitted an evaluation for this film." },
      { status: 409 }
    );
  }

  return NextResponse.json({
    valid: true,
    driveFileId: driveFileId ?? null,
    youtubeVideoId: youtubeVideoId ?? null,
  });}