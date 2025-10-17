// Contact Form Logic (works with /api/send)
const form = document.getElementById("contactForm");
if (form) {
  // Button & Loader setup
  const btn = form.querySelector("button[type='submit']");
  const btnText = document.createElement("span");
  btnText.className = "btn-text";
  btnText.textContent = "Send Message";
  btn.appendChild(btnText);

  const loader = document.createElement("span");
  loader.className = "loader ml-2 hidden";
  loader.innerHTML = `<svg class="animate-spin h-5 w-5 text-white inline-block" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
                      </svg>`;
  btn.appendChild(loader);

  // Status message
  const statusText = document.getElementById("formStatus") || document.createElement("p");
  statusText.id = "formStatus";
  statusText.className = "form-status mt-2 text-sm text-yellow-400";
  if (!document.getElementById("formStatus")) form.appendChild(statusText);

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    let valid = true;
    const inputs = form.querySelectorAll("input, textarea, select"); // all fields
    inputs.forEach(input => input.classList.remove("border-red-500"));

    // Validate fields
    inputs.forEach(input => {
      if (!input.value.trim()) {
        input.classList.add("border-red-500", "border-2");
        valid = false;
      }
    });

    if (!valid) {
      statusText.textContent = "⚠️ Please fill all required fields.";
      statusText.classList.remove("text-green-500");
      statusText.classList.add("text-red-400");
      return;
    }

    // Show loader
    loader.classList.remove("hidden");
    btnText.textContent = "Sending...";

    const formData = Object.fromEntries(new FormData(form).entries());

    try {
      const res = await fetch("/api/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData)
      });

      const result = await res.json();

      if (res.ok && result.success) {
        form.reset();
        statusText.textContent = "✅ Message sent successfully!";
        statusText.classList.remove("text-red-400");
        statusText.classList.add("text-green-500");
      } else {
        statusText.textContent = result.error || "❌ Failed to send message. Try again later.";
        statusText.classList.remove("text-green-500");
        statusText.classList.add("text-red-400");
      }
    } catch (err) {
      console.error("Form submit error:", err);
      statusText.textContent = "⚠️ Network error. Please try again.";
      statusText.classList.remove("text-green-500");
      statusText.classList.add("text-red-400");
    } finally {
      loader.classList.add("hidden");
      btnText.textContent = "Send Message";
      setTimeout(() => (statusText.textContent = ""), 5000);
    }
  });
}
