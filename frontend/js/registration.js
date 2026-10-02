const registrationForm = document.querySelector("#registration-form");
const formMessage = document.querySelector("#form-message");
const submitButton = registrationForm.querySelector('button[type="submit"]');

async function checkRegistrationService() {
  try {
    const response = await fetch("/api/health");
    const health = await response.json();
    if (registrationForm.hasAttribute("aria-busy")) {
      return;
    }

    if (response.ok && health.database === "connected") {
      formMessage.dataset.state = "info";
      formMessage.textContent =
        "SYSTEM STATUS: DATABASE CONNECTED — TEST MODE. Use dummy data.";
    } else {
      formMessage.dataset.state = "info";
      formMessage.textContent =
        "SYSTEM STATUS: REGISTRATION API OFFLINE — TEST MODE. Submissions are not saved.";
    }
  } catch {
    if (!registrationForm.hasAttribute("aria-busy")) {
      formMessage.dataset.state = "info";
      formMessage.textContent =
        "SYSTEM STATUS: REGISTRATION API OFFLINE — TEST MODE. Submissions are not saved.";
    }
  }
}

checkRegistrationService();

registrationForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const formData = new FormData(registrationForm);
  const registration = Object.fromEntries(formData.entries());
  registration.semester = Number(registration.semester);

  submitButton.disabled = true;
  registrationForm.setAttribute("aria-busy", "true");
  formMessage.dataset.state = "pending";
  formMessage.textContent = "Submitting registration...";

  try {
    const response = await fetch("/api/registrations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(registration),
    });
    const result = await response.json();

    if (!response.ok) {
      const details = Array.isArray(result.details)
        ? ` ${result.details.join(" ")}`
        : "";
      throw new Error(`${result.error || "Registration failed."}${details}`);
    }

    const referenceId = result.registration?.referenceId;
    if (!referenceId) {
      throw new Error("The server response did not include a reference ID.");
    }

    formMessage.dataset.state = "success";
    formMessage.textContent = `REGISTRATION SUCCESSFUL_ REFERENCE ID: ${referenceId}`;
    registrationForm.reset();
  } catch (error) {
    formMessage.dataset.state = "error";
    formMessage.textContent =
      error instanceof TypeError
        ? "The registration service could not be reached. Please try again later."
        : error.message;
  } finally {
    submitButton.disabled = false;
    registrationForm.removeAttribute("aria-busy");
  }
});
