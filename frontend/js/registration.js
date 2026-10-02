const registrationForm = document.querySelector("#registration-form");
const formMessage = document.querySelector("#form-message");

registrationForm.addEventListener("submit", (event) => {
  event.preventDefault();
  formMessage.textContent =
    "The registration API is not connected yet. Your details have not been submitted.";
});
