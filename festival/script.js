// Small progressive-enhancement layer for the festival landing page.
// The page works without JavaScript; this only adds a subtle header state.
(() => {
  const header = document.querySelector('.site-header');
  if (!header) return;

  const updateHeader = () => {
    header.classList.toggle('scrolled', window.scrollY > 20);
  };

  updateHeader();
  window.addEventListener('scroll', updateHeader, { passive: true });
})();

/* =========================================
   REFERRAL CODE
   ========================================= */

(() => {
  const referralInput = document.getElementById("referral_code");

  if (!referralInput) return;

  const REFERRAL_STORAGE_KEY = "stv_festival_referral_code";

  // Capture referral code from /r/<code>
  const pathParts = window.location.pathname
    .split("/")
    .filter(Boolean);

  const referralIndex = pathParts.indexOf("r");

  if (
    referralIndex !== -1 &&
    pathParts[referralIndex + 1]
  ) {
    const referralCode = decodeURIComponent(
      pathParts[referralIndex + 1]
    )
      .trim()
      .toUpperCase();

    if (referralCode) {
      sessionStorage.setItem(
        REFERRAL_STORAGE_KEY,
        referralCode
      );
    }
  }

  // Restore referral code when the submission section is reached
  const savedReferralCode =
    sessionStorage.getItem(REFERRAL_STORAGE_KEY);

  if (savedReferralCode) {
    referralInput.value = savedReferralCode;
  }

  // If the user manually enters a code, preserve it
  referralInput.addEventListener("input", () => {
    const value = referralInput.value.trim().toUpperCase();

    referralInput.value = value;

    if (value) {
      sessionStorage.setItem(
        REFERRAL_STORAGE_KEY,
        value
      );
    } else {
      sessionStorage.removeItem(
        REFERRAL_STORAGE_KEY
      );
    }
  });
})();


/* =========================================
   FILM FESTIVAL SUBMISSION
   ========================================= */

(() => {
  const submissionForm = document.getElementById("filmSubmissionForm");

  if (!submissionForm) return;

  const submitButton = submissionForm.querySelector(
    "button[type='submit']"
  );

  let statusText = document.getElementById("submissionStatus");

  if (!statusText) {
    statusText = document.createElement("p");
    statusText.id = "submissionStatus";
    statusText.className = "submission-status";
    submissionForm.appendChild(statusText);
  }

  submissionForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    statusText.textContent = "";
    statusText.className = "submission-status";

    const originalButtonText = submitButton.innerHTML;

    submitButton.disabled = true;
    submitButton.innerHTML = "Submitting…";

    const formData = new FormData(submissionForm);

    formData.set(
      "rights_confirmation",
      document.getElementById("rights_confirmation").checked
        ? "true"
        : "false"
    );

    try {
      const response = await fetch(
        "https://jury.thestartuptv.com/api/public/submissions",
        {
          method: "POST",
          body: formData,
        }
      );

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(
          result.error || "Unable to submit your film."
        );
      }

      submissionForm.reset();

      statusText.textContent =
        "✓ Your film has been submitted successfully.";

      statusText.classList.add("success");

    } catch (error) {
      console.error("Film submission error:", error);

      statusText.textContent =
        error instanceof Error
          ? error.message
          : "Something went wrong. Please try again.";

      statusText.classList.add("error");

    } finally {
      submitButton.disabled = false;
      submitButton.innerHTML = originalButtonText;
    }
  });
})();
/* =========================================
   CAST & CREW FILE DISPLAY
   ========================================= */

(() => {
  const fileInput = document.getElementById("cast_crew_file");
  const fileName = document.getElementById("castCrewFileName");

  if (!fileInput || !fileName) return;

  fileInput.addEventListener("change", () => {
    const file = fileInput.files?.[0];

    if (!file) {
      fileName.textContent = "";
      return;
    }

    const maxSize = 10 * 1024 * 1024;

    if (file.size > maxSize) {
      fileInput.value = "";
      fileName.textContent = "File is larger than 10 MB.";
      fileName.style.color = "#ff7b72";
      return;
    }

    fileName.textContent = `Selected: ${file.name}`;
    fileName.style.color = "";
  });
})(); 