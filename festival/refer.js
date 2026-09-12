(() => {
    const form = document.getElementById("referrerForm");

    if (!form) return;

    const submitButton = document.getElementById(
        "referrerSubmitButton"
    );

    const statusText = document.getElementById(
        "referrerStatus"
    );

    const successSection = document.getElementById(
        "referrerSuccess"
    );

    const referralCodeElement = document.getElementById(
        "referralCode"
    );

    const referralUrlInput = document.getElementById(
        "referralUrl"
    );

    const copyButton = document.getElementById(
        "copyReferralButton"
    );

    const showQrButton = document.getElementById(
        "showQrButton"
    );

    const shareReferralButton = document.getElementById(
        "shareReferralButton"
    );

    const qrContainer = document.getElementById(
        "qrContainer"
    );

    const qrCode = document.getElementById(
        "qrCode"
    );

    const openReferralButton = document.getElementById(
        "openReferralButton"
    );


    /*
     * Header scroll state
     */

    const header = document.querySelector(
        ".site-header"
    );

    if (header) {
        const updateHeader = () => {
            header.classList.toggle(
                "scrolled",
                window.scrollY > 20
            );
        };

        updateHeader();

        window.addEventListener(
            "scroll",
            updateHeader,
            { passive: true }
        );
    }


    /*
     * Show status message
     */

    function showStatus(message, type) {
        statusText.textContent = message;
        statusText.className =
            `submission-status ${type || ""}`;
    }


    /*
     * Submit registration
     */

    form.addEventListener("submit", async (event) => {
        event.preventDefault();

        showStatus("", "");

        const originalButtonText =
            submitButton.innerHTML;

        submitButton.disabled = true;
        submitButton.innerHTML =
            "Creating your link…";


        const formData = new FormData(form);


        try {

            const response = await fetch(
                "https://jury.thestartuptv.com/api/public/referrers",
                {
                    method: "POST",
                    body: formData
                }
            );


            const result = await response.json();


            if (!response.ok || !result.success) {
                throw new Error(
                    result.error ||
                    "Unable to create your referral link."
                );
            }


            /*
             * Display successful registration
             */

            const referrer =
                result.referrer;

            const referralCode =
                referrer.referral_code;

            const referralUrl =
                result.referral_url;


            referralCodeElement.textContent =
                referralCode;

            referralUrlInput.value =
                referralUrl;

            openReferralButton.href =
                referralUrl;


            /*
             * Generate QR code.
             *
             * We generate it from the referral URL
             * instead of storing an image in Supabase.
             */

            qrCode.src =
                "https://api.qrserver.com/v1/create-qr-code/" +
                `?size=320x320&data=${encodeURIComponent(referralUrl)}`;


            form.hidden = true;

            successSection.hidden = false;

            window.scrollTo({
                top: 0,
                behavior: "smooth"
            });


        } catch (error) {

            console.error(
                "Referrer registration error:",
                error
            );

            showStatus(
                error instanceof Error
                    ? error.message
                    : "Something went wrong. Please try again.",
                "error"
            );

        } finally {

            submitButton.disabled = false;
            submitButton.innerHTML =
                originalButtonText;

        }

    });


    /*
     * Copy referral link
     */

    copyButton.addEventListener(
        "click",
        async () => {

            const referralUrl =
                referralUrlInput.value;

            if (!referralUrl) return;


            try {

                await navigator.clipboard.writeText(
                    referralUrl
                );

                const originalText =
                    copyButton.textContent;

                copyButton.textContent =
                    "Copied ✓";

                setTimeout(() => {
                    copyButton.textContent =
                        originalText;
                }, 1800);


            } catch (error) {

                /*
                 * Fallback for browsers where
                 * clipboard API is unavailable.
                 */

                referralUrlInput.select();
                referralUrlInput.setSelectionRange(
                    0,
                    referralUrlInput.value.length
                );

                document.execCommand("copy");

                copyButton.textContent =
                    "Copied ✓";

                setTimeout(() => {
                    copyButton.textContent =
                        "Copy";
                }, 1800);

            }

        }
    );


    /*
     * Show / hide QR
     */

    showQrButton.addEventListener(
        "click",
        () => {

            const isHidden =
                qrContainer.hidden;

            qrContainer.hidden =
                !isHidden;

            showQrButton.innerHTML =
                isHidden
                    ? "Hide QR <span>▣</span>"
                    : "Show QR <span>▣</span>";

        }
    );
    /*
 * Share referral link
 */

    shareReferralButton.addEventListener(
        "click",
        async () => {

            const referralUrl =
                referralUrlInput.value;

            if (!referralUrl) return;

            const shareData = {
                title: "Startup TV Film Festival",
                text:
                    "Submit your film to the Startup TV Film Festival.",
                url: referralUrl
            };

            try {

                if (navigator.share) {

                    await navigator.share(shareData);

                } else {

                    /*
                     * Fallback for browsers that do not
                     * support the native share sheet.
                     */

                    await navigator.clipboard.writeText(
                        referralUrl
                    );

                    const originalText =
                        shareReferralButton.innerHTML;

                    shareReferralButton.innerHTML =
                        "Link Copied ✓";

                    setTimeout(() => {

                        shareReferralButton.innerHTML =
                            originalText;

                    }, 1800);

                }

            } catch (error) {

                /*
                 * AbortError simply means the user
                 * closed the share sheet.
                 */

                if (error.name !== "AbortError") {

                    console.error(
                        "Referral sharing error:",
                        error
                    );

                }

            }

        }
    );
})();