const loginPanel = document.querySelector("#login-panel");
const dashboard = document.querySelector("#dashboard");
const loginForm = document.querySelector("#login-form");
const loginMessage = document.querySelector("#login-message");
const loginButton = document.querySelector("#login-button");
const dashboardMessage = document.querySelector("#dashboard-message");
const registrationRows = document.querySelector("#registration-rows");
const searchInput = document.querySelector("#search-input");
const courseFilter = document.querySelector("#course-filter");
const semesterFilter = document.querySelector("#semester-filter");
const sortSelect = document.querySelector("#sort-select");
const editDialog = document.querySelector("#edit-dialog");
const editForm = document.querySelector("#edit-form");
const editMessage = document.querySelector("#edit-message");
const saveEditButton = document.querySelector("#save-edit-button");

let registrations = [];
let csrfToken = null;
let editingId = null;

function setMessage(element, message, state = "info") {
  element.dataset.state = state;
  element.textContent = message;
}

async function apiRequest(url, options = {}) {
  const headers = new Headers(options.headers || {});
  if (options.body) {
    headers.set("Content-Type", "application/json");
  }
  if (options.method && !["GET", "HEAD"].includes(options.method.toUpperCase())) {
    headers.set("X-CSRF-Token", csrfToken || "");
  }
  const response = await fetch(url, {
    ...options,
    headers,
    credentials: "same-origin",
  });
  const contentType = response.headers.get("content-type") || "";
  const result = contentType.includes("application/json")
    ? await response.json()
    : null;
  if (!response.ok) {
    if (response.status === 401) {
      showLogin();
    }
    throw new Error(result?.error || "The request could not be completed.");
  }
  return result;
}

function showLogin() {
  csrfToken = null;
  dashboard.hidden = true;
  loginPanel.hidden = false;
  document.querySelector("#access-key").focus();
}

function showDashboard(token) {
  csrfToken = token;
  loginPanel.hidden = true;
  dashboard.hidden = false;
}

async function checkSession() {
  try {
    const session = await apiRequest("/api/admin/session");
    if (session.authenticated) {
      showDashboard(session.csrfToken);
      await loadRegistrations();
    } else {
      showLogin();
    }
  } catch (error) {
    showLogin();
    setMessage(loginMessage, `SESSION ERROR: ${error.message}`, "error");
  }
}

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  loginButton.disabled = true;
  setMessage(loginMessage, "Verifying administrator access...", "pending");
  try {
    const formData = new FormData(loginForm);
    const result = await apiRequest("/api/admin/login", {
      method: "POST",
      body: JSON.stringify({ accessKey: formData.get("accessKey") }),
    });
    loginForm.reset();
    showDashboard(result.csrfToken);
    setMessage(dashboardMessage, "Access granted. Loading registration records...", "pending");
    await loadRegistrations();
  } catch (error) {
    setMessage(loginMessage, `ACCESS DENIED: ${error.message}`, "error");
  } finally {
    loginButton.disabled = false;
    document.querySelector("#access-key").value = "";
  }
});

async function loadRegistrations() {
  setMessage(dashboardMessage, "Loading registrations...", "pending");
  try {
    const result = await apiRequest("/api/registrations");
    registrations = result.registrations;
    updateFilters();
    updateStatistics();
    renderRegistrations();
    setMessage(dashboardMessage, `${registrations.length} registration record(s) loaded.`, "success");
  } catch (error) {
    setMessage(dashboardMessage, `DATABASE ERROR: ${error.message}`, "error");
    registrationRows.replaceChildren();
  }
}

function updateFilters() {
  const selectedCourse = courseFilter.value;
  const selectedSemester = semesterFilter.value;
  const courses = [...new Set(registrations.map((item) => item.course))].sort(
    (left, right) => left.localeCompare(right),
  );
  courseFilter.replaceChildren(new Option("All courses", ""));
  courses.forEach((course) => courseFilter.add(new Option(course, course)));
  if (courses.includes(selectedCourse)) {
    courseFilter.value = selectedCourse;
  }

  const semesters = [...new Set(registrations.map((item) => item.semester))].sort(
    (left, right) => left - right,
  );
  semesterFilter.replaceChildren(new Option("All semesters", ""));
  semesters.forEach((semester) =>
    semesterFilter.add(new Option(`Semester ${semester}`, String(semester))),
  );
  if (semesters.some((semester) => String(semester) === selectedSemester)) {
    semesterFilter.value = selectedSemester;
  }
}

function updateStatistics() {
  const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
  document.querySelector("#total-count").textContent = String(registrations.length);
  document.querySelector("#recent-count").textContent = String(
    registrations.filter((item) => new Date(item.createdAt).getTime() >= cutoff).length,
  );
  document.querySelector("#course-count").textContent = String(
    new Set(registrations.map((item) => item.course.toLowerCase())).size,
  );
}

function filteredRegistrations() {
  const query = searchInput.value.trim().toLowerCase();
  const course = courseFilter.value;
  const semester = semesterFilter.value;
  const filtered = registrations.filter((item) => {
    const matchesSearch =
      !query ||
      [
        item.referenceId,
        item.fullName,
        item.studentId,
        item.email,
        item.phone,
        item.course,
        item.eventRound,
        String(item.semester),
      ]
        .join(" ")
        .toLowerCase()
        .includes(query);
    return (
      matchesSearch &&
      (!course || item.course === course) &&
      (!semester || String(item.semester) === semester)
    );
  });

  const sortMode = sortSelect.value;
  filtered.sort((left, right) => {
    if (sortMode === "oldest") {
      return new Date(left.createdAt) - new Date(right.createdAt);
    }
    if (sortMode === "name") {
      return left.fullName.localeCompare(right.fullName);
    }
    if (sortMode === "studentId") {
      return left.studentId.localeCompare(right.studentId);
    }
    if (sortMode === "course") {
      return left.course.localeCompare(right.course);
    }
    return new Date(right.createdAt) - new Date(left.createdAt);
  });
  return filtered;
}

function formatDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleDateString();
}

function actionButton(label, className, action) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = `table-action ${className}`;
  button.textContent = label;
  button.addEventListener("click", action);
  return button;
}

function renderRegistrations() {
  const visible = filteredRegistrations();
  registrationRows.replaceChildren();
  if (visible.length === 0) {
    const row = document.createElement("tr");
    const cell = document.createElement("td");
    cell.colSpan = 8;
    cell.className = "empty-table";
    cell.textContent = registrations.length
      ? "No registrations match the current search or filters."
      : "No registrations have been submitted yet.";
    row.append(cell);
    registrationRows.append(row);
    return;
  }

  for (const item of visible) {
    const row = document.createElement("tr");
    const values = [
      item.referenceId,
      item.fullName,
      item.studentId,
      item.email,
      item.course,
      String(item.semester),
      formatDate(item.createdAt),
    ];
    for (const value of values) {
      const cell = document.createElement("td");
      cell.textContent = value;
      row.append(cell);
    }
    const actions = document.createElement("td");
    actions.className = "table-actions";
    actions.append(
      actionButton("VIEW", "view-action", () => showDetails(item)),
      actionButton("EDIT", "edit-action", () => beginEdit(item)),
      actionButton("DELETE", "delete-action", () => deleteRegistration(item)),
    );
    row.append(actions);
    registrationRows.append(row);
  }
}

function showDetails(item) {
  const details = document.querySelector("#details-content");
  details.replaceChildren();
  const fields = [
    ["Reference ID", item.referenceId],
    ["Full name", item.fullName],
    ["Student ID", item.studentId],
    ["Email", item.email],
    ["Phone", item.phone],
    ["Course", item.course],
    ["Semester", String(item.semester)],
    ["Event / round", item.eventRound || "Not specified"],
    ["Registered", new Date(item.createdAt).toLocaleString()],
    ["Updated", new Date(item.updatedAt).toLocaleString()],
  ];
  for (const [label, value] of fields) {
    const term = document.createElement("dt");
    const description = document.createElement("dd");
    term.textContent = label;
    description.textContent = value;
    details.append(term, description);
  }
  document.querySelector("#details-dialog").showModal();
}

function beginEdit(item) {
  editingId = item.id;
  editForm.elements.fullName.value = item.fullName;
  editForm.elements.studentId.value = item.studentId;
  editForm.elements.email.value = item.email;
  editForm.elements.phone.value = item.phone;
  editForm.elements.course.value = item.course;
  editForm.elements.semester.value = String(item.semester);
  editForm.elements.eventRound.value = item.eventRound || "";
  setMessage(editMessage, "Edit the record fields, then save your changes.", "info");
  editDialog.showModal();
  editForm.elements.fullName.focus();
}

editForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!editingId) {
    return;
  }

  saveEditButton.disabled = true;
  setMessage(editMessage, "Saving registration changes...", "pending");
  const formData = new FormData(editForm);
  const update = Object.fromEntries(formData.entries());
  update.semester = Number(update.semester);
  try {
    await apiRequest(`/api/registrations/${encodeURIComponent(editingId)}`, {
      method: "PUT",
      body: JSON.stringify(update),
    });
    editDialog.close();
    await loadRegistrations();
  } catch (error) {
    setMessage(editMessage, `UPDATE FAILED: ${error.message}`, "error");
  } finally {
    saveEditButton.disabled = false;
  }
});

async function deleteRegistration(item) {
  const confirmed = window.confirm(
    `Delete registration ${item.referenceId} for ${item.fullName}? This cannot be undone.`,
  );
  if (!confirmed) {
    return;
  }
  try {
    await apiRequest(`/api/registrations/${encodeURIComponent(item.id)}`, {
      method: "DELETE",
    });
    await loadRegistrations();
  } catch (error) {
    setMessage(dashboardMessage, `DELETE FAILED: ${error.message}`, "error");
  }
}

document.querySelector("#refresh-button").addEventListener("click", loadRegistrations);
document.querySelector("#logout-button").addEventListener("click", async (event) => {
  const logoutButton = event.currentTarget;
  logoutButton.disabled = true;
  try {
    await apiRequest("/api/admin/logout", { method: "POST" });
    showLogin();
    setMessage(loginMessage, "SESSION ENDED. Sign in to continue.", "info");
  } catch (error) {
    setMessage(dashboardMessage, `LOGOUT FAILED: ${error.message}`, "error");
  } finally {
    logoutButton.disabled = false;
  }
});

for (const element of [searchInput, courseFilter, semesterFilter, sortSelect]) {
  element.addEventListener("input", renderRegistrations);
  element.addEventListener("change", renderRegistrations);
}

document.querySelectorAll("[data-close-dialog]").forEach((button) => {
  button.addEventListener("click", () => {
    document.getElementById(button.dataset.closeDialog).close();
  });
});

checkSession();
