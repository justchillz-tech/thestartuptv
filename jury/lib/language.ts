const LANGUAGE_ALIASES: Record<string, string> = {
    hindi: "Hindi",
    english: "English",
    malayalam: "Malayalam",
    tamil: "Tamil",
    telugu: "Telugu",
    kannada: "Kannada",
    bengali: "Bengali",
    marathi: "Marathi",
    punjabi: "Punjabi",
    assamese: "Assamese",
    odia: "Odia",
    urdu: "Urdu",
    nepali: "Nepali",
    konkani: "Konkani",
    sanskrit: "Sanskrit",
    manipuri: "Manipuri",
    tulu: "Tulu",
};

const SILENT_PATTERNS = [
    "silent film",
    "silent",
    "no voice",
    "no dialogue",
    "no dialogues",
    "without dialogue",
];

function cleanLanguage(value: string) {
    return value
        .normalize("NFKC")
        .replace(/[\u200B-\u200D\uFEFF]/g, "")
        .replace(/[–—]/g, "-")
        .replace(/\s+/g, " ")
        .trim();
}

export function normalizeLanguage(value: unknown): string {
    if (typeof value !== "string") {
        return "Unknown";
    }

    let language = cleanLanguage(value);

    if (!language) {
        return "Unknown";
    }

    const normalized = language.toLowerCase();

    /*
     * Explicit silent / no-dialogue entries.
     */
    if (
        SILENT_PATTERNS.some((pattern) =>
            normalized.includes(pattern)
        )
    ) {
        return "Silent";
    }

    /*
     * "No sound" is kept separate.
     */
    if (
        normalized === "no sound" ||
        normalized === "no audio"
    ) {
        return "No sound";
    }

    /*
     * Explicitly unspecified values.
     */
    if (
        normalized === "no language" ||
        normalized === "unknown" ||
        normalized === "not specified" ||
        normalized === "na" ||
        normalized === "n/a" ||
        normalized === "nil" ||
        normalized === "-"
    ) {
        return "Not specified";
    }

    /*
     * Remove subtitle descriptions.
     *
     * Examples:
     * Hindi with English subtitles
     * Kannada (with English subtitles)
     * Malayalam, English subtitles
     * Tamil + English subtitles
     */
    language = language
        .replace(
            /\s*\(\s*with\s+english\s+subtitles?\s*\)\s*/gi,
            ""
        )
        .replace(
            /\s+with\s+english\s+subtitles?\s*/gi,
            ""
        )
        .replace(
            /\s*,\s*english\s+subtitles?\s*/gi,
            ""
        )
        .replace(
            /\s*\+\s*english\s+subtitles?\s*/gi,
            ""
        )
        .trim();

    const cleaned = language.toLowerCase().trim();

    /*
     * Canonical single-language names.
     */
    if (LANGUAGE_ALIASES[cleaned]) {
        return LANGUAGE_ALIASES[cleaned];
    }

    /*
     * Remove brackets / punctuation around a single language.
     *
     * Example:
     * Tulu ( Karnataka )
     * -> Tulu
     */
    const compact = cleaned
        .replace(/[()[\]{}]/g, " ")
        .replace(/\s+/g, " ")
        .trim();

    if (LANGUAGE_ALIASES[compact]) {
        return LANGUAGE_ALIASES[compact];
    }

    /*
     * Check whether the value starts with a known
     * language followed by a location/description.
     *
     * Example:
     * Tulu ( Karnataka )
     * Tulu - Karnataka
     */
    for (const [alias, canonical] of Object.entries(
        LANGUAGE_ALIASES
    )) {
        if (
            compact.startsWith(`${alias} `) ||
            compact.startsWith(`${alias} -`)
        ) {
            return canonical;
        }
    }

    /*
     * Multiple-language entries.
     *
     * These are intentionally kept as "Multilingual"
     * rather than assigning them to one language.
     */
    if (
        cleaned.includes("/") ||
        cleaned.includes("&") ||
        cleaned.includes(" + ") ||
        cleaned.includes(" and ") ||
        cleaned.includes(" - ")
    ) {
        return "Multilingual";
    }

    /*
     * Preserve uncommon but valid language values.
     */
    return language;
}