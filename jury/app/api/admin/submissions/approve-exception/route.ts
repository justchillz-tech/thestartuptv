import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  try {
    const supabase = await createClient();

    const { data: claimsData } =
      await supabase.auth.getClaims();

    if (!claimsData?.claims) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const userId = String(claimsData.claims.sub);

    const { data: jury, error: juryError } =
      await supabase
        .from("juries")
        .select("role")
        .eq("id", userId)
        .single();

    if (juryError || jury?.role !== "admin") {
      return NextResponse.json(
        { error: "Forbidden" },
        { status: 403 }
      );
    }

    const body = await request.json();

    const submissionId = String(
      body?.submission_id ?? ""
    ).trim();

    const exceptionReason = String(
      body?.approval_exception_reason ?? ""
    ).trim();

    if (!submissionId) {
      return NextResponse.json(
        {
          error: "Submission ID is required.",
        },
        { status: 400 }
      );
    }

    if (!exceptionReason) {
      return NextResponse.json(
        {
          error:
            "An exception reason is required.",
        },
        { status: 400 }
      );
    }

    if (exceptionReason.length > 1000) {
      return NextResponse.json(
        {
          error:
            "Exception reason must be 1000 characters or less.",
        },
        { status: 400 }
      );
    }

    const admin = createAdminClient();

    const {
      data: submission,
      error: submissionError,
    } = await admin
      .from("film_submissions")
      .select(`
        id,
        title,
        director_name,
        duration,
        language,
        film_url,
        drive_file_id,
        status
      `)
      .eq("id", submissionId)
      .single();

    if (submissionError) {
      console.error(
        "Exception submission lookup error:",
        submissionError
      );

      return NextResponse.json(
        {
          error: submissionError.message,
        },
        { status: 500 }
      );
    }

    if (!submission) {
      return NextResponse.json(
        {
          error: "Submission not found.",
        },
        { status: 404 }
      );
    }

    if (submission.status !== "pending") {
      return NextResponse.json(
        {
          error:
            `This submission is already ${submission.status}.`,
        },
        { status: 409 }
      );
    }

    /*
     * Exception approval still requires a usable title.
     * Other normal submission-field validation is bypassed.
     */
    if (!submission.title?.trim()) {
      return NextResponse.json(
        {
          error:
            "A title is still required to create the film.",
        },
        { status: 400 }
      );
    }

    /*
     * Prevent duplicate Drive/video records.
     */
    if (submission.drive_file_id) {
      const { data: duplicateDrive } =
        await admin
          .from("films")
          .select("id")
          .eq(
            "drive_file_id",
            submission.drive_file_id
          )
          .maybeSingle();

      if (duplicateDrive) {
        return NextResponse.json(
          {
            error:
              "This Drive file is already registered as a film.",
          },
          { status: 409 }
        );
      }
    }

    if (submission.film_url) {
      const { data: duplicateUrl } =
        await admin
          .from("films")
          .select("id")
          .eq(
            "video_url",
            submission.film_url
          )
          .maybeSingle();

      if (duplicateUrl) {
        return NextResponse.json(
          {
            error:
              "This video URL is already registered as a film.",
          },
          { status: 409 }
        );
      }
    }

    const filmCode = `STV-${Date.now()
      .toString(36)
      .toUpperCase()}`;

    const {
      data: film,
      error: filmError,
    } = await admin
      .from("films")
      .insert({
        film_code: filmCode,
        title: submission.title,
        director:
          submission.director_name || "Not provided",
        duration:
          submission.duration || "Not provided",
        language:
          submission.language || "Not provided",
        video_url:
          submission.film_url || null,
        drive_file_id:
          submission.drive_file_id || null,
        status: "active",
      })
      .select()
      .single();

    if (filmError || !film) {
      console.error(
        "Exception film creation error:",
        filmError
      );

      return NextResponse.json(
        {
          error:
            filmError?.message ??
            "Failed to create film.",
        },
        { status: 500 }
      );
    }

    const {
      data: updatedSubmission,
      error: updateError,
    } = await admin
      .from("film_submissions")
      .update({
        status: "approved",
        approved_film_id: film.id,
        approval_exception: true,
        approval_exception_reason:
          exceptionReason,
        rejection_reason: null,
        reviewed_by: userId,
        reviewed_at:
          new Date().toISOString(),
      })
      .eq("id", submissionId)
      .eq("status", "pending")
      .select(`
        id,
        status,
        approval_exception,
        approval_exception_reason,
        approved_film_id,
        reviewed_by,
        reviewed_at
      `)
      .single();

    if (updateError || !updatedSubmission) {
      console.error(
        "Exception submission update error:",
        updateError
      );

      /*
       * Roll back the film if the submission
       * could not be updated.
       */
      await admin
        .from("films")
        .delete()
        .eq("id", film.id);

      return NextResponse.json(
        {
          error:
            updateError?.message ??
            "Failed to approve submission.",
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      submission: updatedSubmission,
      film,
    });
  } catch (error) {
    console.error(
      "Approve with exception API error:",
      error
    );

    return NextResponse.json(
      {
        error:
          "Unable to approve submission with exception.",
      },
      { status: 500 }
    );
  }
}