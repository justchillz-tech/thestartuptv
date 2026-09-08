import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

type ActivityType =
    | "submission"
    | "decision"
    | "film"
    | "evaluation";

type ActivityEvent = {
    id: string;
    type: ActivityType;
    timestamp: string;
    filmId: string | null;
    filmCode: string;
    title: string;
    director: string;
    juryName: string | null;
    score: number | null;
    status: string | null;
    description: string;
};

type SearchParams = {
    q?: string;
    type?: string;
    status?: string;
    jury?: string;
    from?: string;
    to?: string;
};

function formatDate(value: string) {
    return new Date(value).toLocaleString("en-IN", {
        dateStyle: "medium",
        timeStyle: "short",
    });
}

function eventLabel(type: ActivityType) {
    switch (type) {
        case "submission":
            return "SUBMISSION";
        case "decision":
            return "DECISION";
        case "film":
            return "FILM";
        case "evaluation":
            return "EVALUATION";
    }
}

function eventTitle(event: ActivityEvent) {
    switch (event.type) {
        case "submission":
            return "Submission received";
        case "decision":
            return event.status === "rejected"
                ? "Submission rejected"
                : "Submission approved";
        case "film":
            return "Film entered jury system";
        case "evaluation":
            return "Evaluation submitted";
    }
}

function eventDescription(event: ActivityEvent) {
    if (event.type === "submission") {
        return "Participant submission received";
    }

    if (event.type === "decision") {
        return event.status === "rejected"
            ? "Submission was rejected during admin review"
            : "Submission was approved for the festival";
    }

    if (event.type === "film") {
        return "Approved film added to the jury system";
    }

    return event.juryName
        ? `${event.juryName} submitted an evaluation`
        : "Jury evaluation submitted";
}

function matchesSearch(
    event: ActivityEvent,
    query: string
) {
    if (!query) return true;

    const value = [
        event.filmCode,
        event.title,
        event.director,
        event.juryName ?? "",
    ]
        .join(" ")
        .toLowerCase();

    return value.includes(query.toLowerCase());
}

function matchesDate(
    timestamp: string,
    from: string,
    to: string
) {
    const date = new Date(timestamp);

    if (from) {
        const fromDate = new Date(`${from}T00:00:00`);

        if (date < fromDate) {
            return false;
        }
    }

    if (to) {
        const toDate = new Date(`${to}T23:59:59.999`);

        if (date > toDate) {
            return false;
        }
    }

    return true;
}

export default async function ActivityPage({
    searchParams,
}: {
    searchParams: Promise<SearchParams>;
}) {
    const supabase = await createClient();

    const { data: claimsData } =
        await supabase.auth.getClaims();

    if (!claimsData?.claims) {
        redirect("/login");
    }

    const userId = String(claimsData.claims.sub);

    const { data: currentUser } = await supabase
        .from("juries")
        .select("name, email, role")
        .eq("id", userId)
        .single();

    const role = currentUser?.role;

    if (role !== "admin" && role !== "management") {
        redirect("/dashboard");
    }

    const params = await searchParams;

    const query = (params.q ?? "").trim();
    const typeFilter = params.type ?? "all";
    const statusFilter = params.status ?? "all";
    const juryFilter = params.jury ?? "all";
    const fromFilter = params.from ?? "";
    const toFilter = params.to ?? "";

    const [
        submissionsResult,
        filmsResult,
        evaluationsResult,
        juriesResult,
    ] = await Promise.all([
        supabase
            .from("film_submissions")
            .select(
                `
          id,
          title,
          director_name,
          status,
          submitted_at,
          reviewed_at,
          approved_film_id
        `
            )
            .order("submitted_at", {
                ascending: false,
            }),

        supabase
            .from("films")
            .select(
                `
          id,
          film_code,
          title,
          director,
          created_at
        `
            )
            .order("created_at", {
                ascending: false,
            }),

        supabase
            .from("evaluations")
            .select(
                `
          id,
          film_id,
          jury_id,
          total,
          submitted_at
        `
            )
            .order("submitted_at", {
                ascending: false,
            }),

        supabase
            .from("juries")
            .select("id, name, role")
            .eq("role", "jury")
            .order("name", {
                ascending: true,
            }),
    ]);

    if (
        submissionsResult.error ||
        filmsResult.error ||
        evaluationsResult.error ||
        juriesResult.error
    ) {
        console.error("Activity query failed", {
            submissionsError: submissionsResult.error,
            filmsError: filmsResult.error,
            evaluationsError: evaluationsResult.error,
            juriesError: juriesResult.error,
        });

        throw new Error(
            "Unable to load festival activity."
        );
    }

    const submissions =
        submissionsResult.data ?? [];

    const films = filmsResult.data ?? [];

    const evaluations =
        evaluationsResult.data ?? [];

    const juries = juriesResult.data ?? [];

    const filmMap = new Map(
        films.map((film) => [film.id, film])
    );

    const juryMap = new Map(
        juries.map((jury) => [jury.id, jury])
    );

    const events: ActivityEvent[] = [];

    /*
     * ---------------------------------------------------------
     * SUBMISSION EVENTS
     * ---------------------------------------------------------
     */

    for (const submission of submissions) {
        if (submission.submitted_at) {
            const film =
                submission.approved_film_id
                    ? filmMap.get(
                        submission.approved_film_id
                    )
                    : null;

            events.push({
                id: `submission-${submission.id}`,
                type: "submission",
                timestamp: submission.submitted_at,
                filmId: film?.id ?? null,
                filmCode:
                    film?.film_code ?? "PENDING",
                title:
                    film?.title ??
                    submission.title,
                director:
                    film?.director ??
                    submission.director_name ??
                    "",
                juryName: null,
                score: null,
                status: submission.status,
                description:
                    "Participant submission received",
            });
        }

        /*
         * -------------------------------------------------------
         * APPROVAL / REJECTION EVENTS
         * -------------------------------------------------------
         */

        if (submission.reviewed_at) {
            const film =
                submission.approved_film_id
                    ? filmMap.get(
                        submission.approved_film_id
                    )
                    : null;

            events.push({
                id: `decision-${submission.id}`,
                type: "decision",
                timestamp: submission.reviewed_at,
                filmId: film?.id ?? null,
                filmCode:
                    film?.film_code ?? "SUBMISSION",
                title:
                    film?.title ??
                    submission.title,
                director:
                    film?.director ??
                    submission.director_name ??
                    "",
                juryName: null,
                score: null,
                status: submission.status,
                description:
                    submission.status === "rejected"
                        ? "Submission was rejected during admin review"
                        : "Submission was approved for the festival",
            });
        }
    }

    /*
     * ---------------------------------------------------------
     * FILM CREATION EVENTS
     * ---------------------------------------------------------
     */

    for (const film of films) {
        events.push({
            id: `film-${film.id}`,
            type: "film",
            timestamp: film.created_at,
            filmId: film.id,
            filmCode: film.film_code,
            title: film.title,
            director: film.director,
            juryName: null,
            score: null,
            status: null,
            description:
                "Approved film added to the jury system",
        });
    }

    /*
     * ---------------------------------------------------------
     * EVALUATION EVENTS
     * ---------------------------------------------------------
     */

    for (const evaluation of evaluations) {
        const film =
            filmMap.get(evaluation.film_id);

        const jury =
            juryMap.get(evaluation.jury_id);

        events.push({
            id: `evaluation-${evaluation.id}`,
            type: "evaluation",
            timestamp: evaluation.submitted_at,
            filmId: evaluation.film_id,
            filmCode:
                film?.film_code ?? "FILM",
            title:
                film?.title ?? "Unknown film",
            director:
                film?.director ?? "",
            juryName:
                jury?.name ?? null,
            score:
                Number.isFinite(
                    Number(evaluation.total)
                )
                    ? Number(evaluation.total)
                    : null,
            status: "evaluated",
            description:
                jury?.name
                    ? `${jury.name} submitted an evaluation`
                    : "Jury evaluation submitted",
        });
    }

    /*
     * ---------------------------------------------------------
     * FILTER EVENTS
     * ---------------------------------------------------------
     */

    const filteredEvents = events
        .filter((event) => {
            if (
                typeFilter !== "all" &&
                event.type !== typeFilter
            ) {
                return false;
            }

            if (
                statusFilter !== "all" &&
                event.status !== statusFilter
            ) {
                return false;
            }

            
            if (
                juryFilter !== "all" &&
                event.type !== "evaluation"
            ) {
                return false;
            }

            if (
                !matchesSearch(
                    event,
                    query
                )
            ) {
                return false;
            }

            if (
                !matchesDate(
                    event.timestamp,
                    fromFilter,
                    toFilter
                )
            ) {
                return false;
            }

            return true;
        })
        .sort(
            (a, b) =>
                new Date(b.timestamp).getTime() -
                new Date(a.timestamp).getTime()
        );

    /*
     * When a jury filter is selected, we already know that only
     * evaluation events are relevant. Filter again by the exact
     * jury name so the event list is precise.
     */

    const finalEvents = filteredEvents;

    const activeFilterCount =
        [
            query,
            typeFilter !== "all"
                ? typeFilter
                : "",
            statusFilter !== "all"
                ? statusFilter
                : "",
            juryFilter !== "all"
                ? juryFilter
                : "",
            fromFilter,
            toFilter,
        ].filter(Boolean).length;

    return (
        <main className="portal-shell admin-shell">
            <header className="portal-header">
                <Link
                    href="/dashboard"
                    className="brand-lockup compact"
                >
                    <div className="brand-mark">
                        STV
                    </div>

                    <div>
                        <strong>
                            Startup TV
                        </strong>

                        <span>
                            JURY PORTAL
                        </span>
                    </div>
                </Link>

                <div className="header-user">
                    <div className="admin-links">
                        <Link href="/admin/submissions">
                            Submissions
                        </Link>

                        {role === "admin" && (
                            <>
                                <Link href="/admin/films">
                                    Films
                                </Link>

                                <Link href="/admin/juries">
                                    Jury
                                </Link>

                                <Link href="/admin/assignments">
                                    Assignments
                                </Link>
                            </>
                        )}

                        <Link href="/admin/results">
                            Results
                        </Link>

                        <Link
                            href="/admin/activity"
                            className="active"
                        >
                            Activity
                        </Link>
                    </div>

                    <div>
                        <strong>
                            {currentUser?.name ??
                                "User"}
                        </strong>

                        <span>
                            {currentUser?.email ??
                                ""}
                        </span>
                    </div>
                </div>
            </header>

            <section className="activity-intro">
                <div>
                    <div className="eyebrow">
                        <span />
                        FESTIVAL ACTIVITY
                    </div>

                    <h1>
                        Follow every
                        <br />
                        <em>move.</em>
                    </h1>

                    <p>
                        A chronological view of submissions,
                        admin decisions, films entering the jury
                        system and completed evaluations.
                    </p>
                </div>

                <div className="activity-summary">
                    <span>ACTIVITY EVENTS</span>

                    <strong>
                        {finalEvents.length}
                    </strong>

                    <small>
                        {activeFilterCount > 0
                            ? `${finalEvents.length} matching event${finalEvents.length === 1 ? "" : "s"}`
                            : "all recorded activity"}
                    </small>
                </div>
            </section>

            <section className="activity-wrap">
                <form
                    method="GET"
                    className="activity-filters"
                >
                    <div className="filter-field search-field">
                        <label htmlFor="q">
                            SEARCH
                        </label>

                        <input
                            id="q"
                            name="q"
                            type="search"
                            placeholder="Film code, title, director or jury"
                            defaultValue={query}
                        />
                    </div>

                    <div className="filter-field">
                        <label htmlFor="type">
                            EVENT
                        </label>

                        <select
                            id="type"
                            name="type"
                            defaultValue={typeFilter}
                        >
                            <option value="all">
                                All events
                            </option>

                            <option value="submission">
                                Submissions
                            </option>

                            <option value="decision">
                                Decisions
                            </option>

                            <option value="film">
                                Films
                            </option>

                            <option value="evaluation">
                                Evaluations
                            </option>
                        </select>
                    </div>

                    <div className="filter-field">
                        <label htmlFor="status">
                            STATUS
                        </label>

                        <select
                            id="status"
                            name="status"
                            defaultValue={statusFilter}
                        >
                            <option value="all">
                                All statuses
                            </option>

                            <option value="pending">
                                Pending
                            </option>

                            <option value="approved">
                                Approved
                            </option>

                            <option value="rejected">
                                Rejected
                            </option>

                            <option value="evaluated">
                                Evaluated
                            </option>
                        </select>
                    </div>

                    <div className="filter-field">
                        <label htmlFor="jury">
                            JURY
                        </label>

                        <select
                            id="jury"
                            name="jury"
                            defaultValue={juryFilter}
                        >
                            <option value="all">
                                All jury members
                            </option>

                            {juries.map((member) => (
                                <option
                                    key={member.id}
                                    value={member.name}
                                >
                                    {member.name}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className="filter-field">
                        <label htmlFor="from">
                            FROM
                        </label>

                        <input
                            id="from"
                            name="from"
                            type="date"
                            defaultValue={fromFilter}
                        />
                    </div>

                    <div className="filter-field">
                        <label htmlFor="to">
                            TO
                        </label>

                        <input
                            id="to"
                            name="to"
                            type="date"
                            defaultValue={toFilter}
                        />
                    </div>

                    <div className="filter-actions">
                        <button
                            type="submit"
                            className="button button-primary"
                        >
                            Apply filters
                            <span>↗</span>
                        </button>

                        <Link
                            href="/admin/activity"
                            className="clear-filters"
                        >
                            Clear
                        </Link>
                    </div>
                </form>

                <div className="activity-list-head">
                    <div>
                        <span>
                            CHRONOLOGICAL LOG
                        </span>

                        <h2>
                            Latest activity
                        </h2>
                    </div>

                    <span>
                        {finalEvents.length} event
                        {finalEvents.length === 1
                            ? ""
                            : "s"}
                    </span>
                </div>

                {finalEvents.length === 0 ? (
                    <div className="activity-empty">
                        <strong>
                            No activity found.
                        </strong>

                        <span>
                            Try changing the filters or
                            clearing your search.
                        </span>
                    </div>
                ) : (
                    <div className="activity-timeline"
                        style={{
                            maxHeight: "720px",
                            overflowY: "auto",
                            paddingRight: "12px",
                        }}
                    >
                        {finalEvents.slice(0, 50).map((event) => (
                            <article
                                className={`activity-event activity-${event.type}`}
                                key={event.id}
                            >
                                <div className="activity-marker">
                                    <span />
                                </div>

                                <div className="activity-content">
                                    <div className="activity-top">
                                        <div>
                                            <span className="activity-type">
                                                {eventLabel(
                                                    event.type
                                                )}
                                            </span>

                                            <time>
                                                {formatDate(
                                                    event.timestamp
                                                )}
                                            </time>
                                        </div>

                                        {event.score !==
                                            null && (
                                                <strong className="activity-score">
                                                    {event.score}
                                                    <small>
                                                        / 100
                                                    </small>
                                                </strong>
                                            )}
                                    </div>

                                    <div className="activity-main">
                                        <div>
                                            <div className="activity-film-code">
                                                {event.filmCode}
                                            </div>

                                            <h3>
                                                {eventTitle(
                                                    event
                                                )}
                                            </h3>

                                            <p>
                                                {eventDescription(
                                                    event
                                                )}
                                            </p>
                                        </div>

                                        <div className="activity-film">
                                            <strong>
                                                {event.title}
                                            </strong>

                                            {event.director && (
                                                <span>
                                                    Director ·{" "}
                                                    {
                                                        event.director
                                                    }
                                                </span>
                                            )}

                                            {event.juryName && (
                                                <span>
                                                    Jury ·{" "}
                                                    {
                                                        event.juryName
                                                    }
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </article>
                        ))}
                    </div>
                )}
            </section>

            <style>{`
        .activity-intro {
          width: min(1240px, 90vw);
          margin: 0 auto;
          display: flex;
          align-items: flex-end;
          justify-content: space-between;
          gap: 40px;
          padding: 100px 0 55px;
        }

        .activity-intro > div:first-child {
          max-width: 760px;
        }

        .activity-intro h1 {
          margin: 18px 0 20px;
        }

        .activity-intro p {
          max-width: 650px;
        }

        .activity-summary {
          min-width: 220px;
          padding: 24px;
          border: 1px solid var(--glass-border);
          border-radius: 18px;
          background: rgba(255,255,255,.025);
        }

        .activity-summary span,
        .activity-summary small {
          display: block;
          color: rgba(255,255,255,.45);
          font-size: 9px;
          letter-spacing: .14em;
        }

        .activity-summary strong {
          display: block;
          margin: 8px 0;
          font-size: 34px;
          letter-spacing: -.04em;
        }

        .activity-wrap {
          width: min(1240px, 90vw);
          margin: 0 auto 80px;
        }

        .activity-filters {
          display: grid;
          grid-template-columns:
            minmax(240px, 2fr)
            repeat(3, minmax(130px, 1fr))
            repeat(2, minmax(130px, 1fr));
          gap: 10px;
          padding: 18px;
          margin-bottom: 48px;
          border: 1px solid var(--glass-border);
          border-radius: 20px;
          background: rgba(255,255,255,.025);
        }

        .filter-field {
          min-width: 0;
        }

        .filter-field label {
          display: block;
          margin: 0 0 8px;
          color: rgba(255,255,255,.4);
          font-size: 8px;
          font-weight: 600;
          letter-spacing: .15em;
        }

        .filter-field input,
        .filter-field select {
          width: 100%;
          height: 44px;
          box-sizing: border-box;
          padding: 0 12px;
          border: 1px solid rgba(255,255,255,.1);
          border-radius: 10px;
          outline: none;
          background: rgba(0,0,0,.22);
          color: #fff;
          font: inherit;
          font-size: 11px;
        }

        .filter-field input:focus,
        .filter-field select:focus {
          border-color: rgba(255,255,255,.25);
        }

        .filter-field select option {
          background: #171717;
          color: #fff;
        }

        .filter-actions {
          grid-column: 1 / -1;
          display: flex;
          align-items: center;
          justify-content: flex-end;
          gap: 18px;
          padding-top: 4px;
        }

        .filter-actions .button {
          min-width: 150px;
        }

        .clear-filters {
          color: rgba(255,255,255,.5);
          font-size: 10px;
          text-decoration: none;
        }

        .clear-filters:hover {
          color: #fff;
        }

        .activity-list-head {
          display: flex;
          align-items: flex-end;
          justify-content: space-between;
          gap: 20px;
          margin-bottom: 20px;
        }

        .activity-list-head > div > span {
          display: block;
          margin-bottom: 6px;
          color: rgba(255,255,255,.4);
          font-size: 9px;
          font-weight: 600;
          letter-spacing: .16em;
        }

        .activity-list-head h2 {
          margin: 0;
          font-size: 26px;
          letter-spacing: -.025em;
        }

        .activity-list-head > span {
          color: rgba(255,255,255,.4);
          font-size: 10px;
        }

        .activity-timeline {
          position: relative;
        }

        .activity-timeline::before {
          content: "";
          position: absolute;
          left: 12px;
          top: 20px;
          bottom: 20px;
          width: 1px;
          background: rgba(255,255,255,.1);
        }

        .activity-event {
          position: relative;
          display: grid;
          grid-template-columns: 25px minmax(0, 1fr);
          gap: 20px;
          padding: 0 0 18px;
        }

        .activity-marker {
          position: relative;
          display: flex;
          justify-content: center;
          z-index: 1;
        }

        .activity-marker span {
          width: 9px;
          height: 9px;
          margin-top: 22px;
          border: 3px solid #111;
          border-radius: 50%;
          background: rgba(255,255,255,.7);
          box-sizing: content-box;
        }

        .activity-content {
          padding: 20px 22px;
          border: 1px solid var(--glass-border);
          border-radius: 16px;
          background: rgba(255,255,255,.025);
          transition:
            background .2s ease,
            border-color .2s ease,
            transform .2s ease;
        }

        .activity-content:hover {
          background: rgba(255,255,255,.04);
          border-color: rgba(255,255,255,.14);
          transform: translateX(2px);
        }

        .activity-top {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 20px;
          margin-bottom: 18px;
        }

        .activity-top > div {
          display: flex;
          align-items: center;
          gap: 12px;
          flex-wrap: wrap;
        }

        .activity-type {
          padding: 5px 8px;
          border: 1px solid rgba(255,255,255,.1);
          border-radius: 999px;
          color: rgba(255,255,255,.55);
          font-size: 7px;
          font-weight: 700;
          letter-spacing: .13em;
        }

        .activity-top time {
          color: rgba(255,255,255,.42);
          font-size: 10px;
        }

        .activity-score {
          font-size: 22px;
          letter-spacing: -.03em;
        }

        .activity-score small {
          margin-left: 3px;
          color: rgba(255,255,255,.35);
          font-size: 9px;
          font-weight: 500;
        }

        .activity-main {
          display: grid;
          grid-template-columns: minmax(0, 1fr) minmax(220px, .5fr);
          gap: 30px;
        }

        .activity-film-code {
          margin-bottom: 5px;
          color: rgba(255,255,255,.38);
          font-size: 8px;
          font-weight: 600;
          letter-spacing: .14em;
        }

        .activity-main h3 {
          margin: 0 0 7px;
          font-size: 18px;
          letter-spacing: -.02em;
        }

        .activity-main p {
          margin: 0;
          color: rgba(255,255,255,.48);
          font-size: 11px;
          line-height: 1.6;
        }

        .activity-film {
          display: flex;
          flex-direction: column;
          justify-content: center;
          gap: 5px;
          padding-left: 20px;
          border-left: 1px solid rgba(255,255,255,.08);
        }

        .activity-film strong {
          font-size: 12px;
        }

        .activity-film span {
          color: rgba(255,255,255,.4);
          font-size: 9px;
        }

        .activity-empty {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          min-height: 220px;
          padding: 30px;
          border: 1px solid var(--glass-border);
          border-radius: 18px;
          text-align: center;
        }

        .activity-empty strong {
          margin-bottom: 8px;
          font-size: 15px;
        }

        .activity-empty span {
          color: rgba(255,255,255,.4);
          font-size: 10px;
        }

        @media (max-width: 1000px) {
          .activity-filters {
            grid-template-columns:
              repeat(2, minmax(0, 1fr));
          }

          .search-field {
            grid-column: 1 / -1;
          }

          .filter-actions {
            grid-column: 1 / -1;
          }
        }

        @media (max-width: 700px) {
          .activity-intro {
            flex-direction: column;
            align-items: stretch;
            padding-top: 65px;
          }

          .activity-summary {
            min-width: 0;
          }

          .activity-filters {
            grid-template-columns: 1fr;
          }

          .search-field,
          .filter-actions {
            grid-column: auto;
          }

          .filter-actions {
            justify-content: flex-start;
          }

          .activity-main {
            grid-template-columns: 1fr;
          }

          .activity-film {
            padding: 14px 0 0;
            border-left: 0;
            border-top: 1px solid rgba(255,255,255,.08);
          }

          .activity-top {
            flex-direction: column;
          }
        }

        .activity-timeline {
        scrollbar-width: thin;
        scrollbar-color: rgba(255, 255, 255, 0.22) transparent;
        }

        .activity-timeline::-webkit-scrollbar {
            width: 6px;
        }

        .activity-timeline::-webkit-scrollbar-track {
            background: transparent;
        }

        .activity-timeline::-webkit-scrollbar-thumb {
            background: rgba(255, 255, 255, 0.22);
            border-radius: 999px;
        }

        .activity-timeline::-webkit-scrollbar-thumb:hover {
            background: rgba(255, 255, 255, 0.38);
        }

        .portal-header .header-user {
        display: flex;
        align-items: center;
        justify-content: flex-end;
        gap: 28px;
        }

        .portal-header .admin-links {
            display: flex;
            flex-direction: row;
            align-items: center;
            justify-content: flex-end;
            gap: 18px;
            flex-wrap: nowrap;
            width: auto;
        }

        .portal-header .admin-links a {
            white-space: nowrap;
        }
      `}</style>
        </main>
    );
}