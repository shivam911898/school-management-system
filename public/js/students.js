let currentStudentId = null;
let activeUser = null;

document.addEventListener("DOMContentLoaded", async () => {
  const user = await requireAuth();
  if (!user) return;

  if (!(await ensureRoleAccess(user, ["admin", "teacher"]))) {
    return;
  }

  activeUser = user;
  const isAdmin = user.role === "admin";

  document.querySelectorAll("[data-admin-name]").forEach((element) => {
    element.textContent = user.name;
  });

  document.getElementById("logoutButton")?.addEventListener("click", logout);
  document
    .getElementById("studentForm")
    ?.addEventListener("submit", submitStudentForm);
  document
    .getElementById("cancelEditButton")
    ?.addEventListener("click", resetStudentForm);

  if (!isAdmin) {
    document.getElementById("studentForm")?.classList.add("hidden");
    const formTitle = document.getElementById("studentFormTitle");
    if (formTitle) formTitle.textContent = "Student Directory";
  }

  await loadStudents();
});

async function loadStudents() {
  const tbody = document.getElementById("studentsTableBody");
  if (!tbody) return;

  tbody.innerHTML = '<tr><td colspan="6">Loading students...</td></tr>';

  try {
    const { students } = await api.get("/api/students");

    if (!students.length) {
      tbody.innerHTML = '<tr><td colspan="6">No students added yet.</td></tr>';
      return;
    }

    const isAdmin = activeUser?.role === "admin";

    tbody.innerHTML = students
      .map(
        (student) => `
          <tr>
            <td>${escapeHtml(student.name)}</td>
            <td>${escapeHtml(student.className)}</td>
            <td>${escapeHtml(student.section)}</td>
            <td>${student.rollNumber}</td>
            <td>${escapeHtml(student.phone || "N/A")}</td>
            <td class="actions">
              ${
                isAdmin
                  ? `<button class="button-secondary" type="button" data-edit-student="${student._id}">Edit</button>
                     <button class="button-danger" type="button" data-delete-student="${student._id}">Delete</button>`
                  : '<span class="muted">View only</span>'
              }
            </td>
          </tr>
        `,
      )
      .join("");

    if (isAdmin) {
      students.forEach((student) => {
        document
          .querySelector(`[data-edit-student="${student._id}"]`)
          ?.addEventListener("click", () => fillStudentForm(student));
        document
          .querySelector(`[data-delete-student="${student._id}"]`)
          ?.addEventListener("click", () => deleteStudent(student._id));
      });
    }
  } catch (error) {
    tbody.innerHTML = `<tr><td colspan="6">${escapeHtml(error.message)}</td></tr>`;
    ui.toast(error.message, "error");
  }
}

async function submitStudentForm(event) {
  event.preventDefault();

  if (activeUser?.role !== "admin") {
    ui.toast("Access denied: only admin can modify students", "error");
    return;
  }

  const form = event.currentTarget;
  const submitButton = form.querySelector('button[type="submit"]');

  const payload = {
    name: form.name.value.trim(),
    className: form.className.value.trim(),
    section: form.section.value.trim().toUpperCase(),
    rollNumber: Number(form.rollNumber.value),
    phone: form.phone.value.trim(),
  };

  try {
    ui.setLoading(
      submitButton,
      true,
      currentStudentId ? "Updating..." : "Saving...",
    );

    if (currentStudentId) {
      const response = await api.put(`/api/students/${currentStudentId}`, payload);
      ui.toast("Student updated successfully", "success");
      if (response?.sync?.status && response.sync.status !== "updated" && response.sync.status !== "unchanged") {
        ui.toast(response.sync.message, "info");
      }
    } else {
      const response = await api.post("/api/students", payload);
      ui.toast("Student added successfully", "success");
      if (response?.sync?.status && response.sync.status !== "updated" && response.sync.status !== "unchanged") {
        ui.toast(response.sync.message, "info");
      }
    }

    resetStudentForm();
    await loadStudents();
  } catch (error) {
    ui.toast(error.message, "error");
  } finally {
    ui.setLoading(submitButton, false);
  }
}

function fillStudentForm(student) {
  if (activeUser?.role !== "admin") {
    ui.toast("Access denied: only admin can edit students", "error");
    return;
  }

  currentStudentId = student._id;
  const form = document.getElementById("studentForm");
  if (!form) return;

  form.name.value = student.name;
  form.className.value = student.className;
  form.section.value = student.section;
  form.rollNumber.value = student.rollNumber;
  form.phone.value = student.phone || "";
  document.getElementById("studentFormTitle").textContent = "Edit Student";
  document.getElementById("cancelEditButton").classList.remove("hidden");
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function resetStudentForm() {
  currentStudentId = null;
  const form = document.getElementById("studentForm");
  if (!form) return;

  form.reset();
  document.getElementById("studentFormTitle").textContent = "Add Student";
  document.getElementById("cancelEditButton").classList.add("hidden");
}

async function deleteStudent(studentId) {
  if (activeUser?.role !== "admin") {
    ui.toast("Access denied: only admin can delete students", "error");
    return;
  }

  const confirmed = window.confirm("Delete this student permanently?");
  if (!confirmed) return;

  try {
    await api.delete(`/api/students/${studentId}`);
    ui.toast("Student deleted successfully", "success");
    await loadStudents();
  } catch (error) {
    ui.toast(error.message, "error");
  }
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
