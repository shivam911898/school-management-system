document.addEventListener("DOMContentLoaded", async () => {
  const user = await requireAuth();
  if (!user) return;

  if (!(await ensureRoleAccess(user, ["admin", "teacher"]))) {
    return;
  }

  let classesCache = [];
  let currentPage = 1;
  const pageSize = 8;

  document.querySelectorAll("[data-user-name]").forEach((element) => {
    element.textContent = user.name;
  });

  applyRoleVisibility(user.role);
  setupGradeOptions();

  document.getElementById("logoutButton")?.addEventListener("click", logout);
  document
    .getElementById("refreshClassesButton")
    ?.addEventListener("click", loadClasses);
  document
    .getElementById("createClassForm")
    ?.addEventListener("submit", handleCreateClass);
  document.getElementById("classSearchInput")?.addEventListener("input", () => {
    currentPage = 1;
    renderClassesTable();
  });
  document.getElementById("classSortSelect")?.addEventListener("change", () => {
    currentPage = 1;
    renderClassesTable();
  });

  if (user.role === "admin") {
    await loadTeachers();
  }

  await loadClasses();
});

function applyRoleVisibility(role) {
  document
    .querySelectorAll(".admin-only, .teacher-only, .student-only")
    .forEach((element) => {
      element.style.display = "none";
    });

  document.querySelectorAll(`.${role}-only`).forEach((element) => {
    element.style.display = "";
  });

  if (role === "admin" || role === "teacher") {
    document
      .querySelectorAll(".admin-only, .teacher-only")
      .forEach((element) => {
        element.style.display = "";
      });
  }
}

function setupGradeOptions() {
  const gradeInput = document.getElementById("gradeInput");
  if (!gradeInput) return;

  const options = Array.from({ length: 12 }, (_, index) => {
    const grade = String(index + 1);
    return `<option value="${grade}">${grade}</option>`;
  }).join("");

  gradeInput.insertAdjacentHTML("beforeend", options);
}

async function loadTeachers() {
  try {
    const response = await api.get("/api/users?role=teacher&limit=200");
    const teachers = response.data?.users || [];
    const teacherInput = document.getElementById("teacherInput");

    if (!teacherInput) return;

    teacherInput.innerHTML =
      '<option value="">Select teacher</option>' +
      teachers
        .map(
          (teacher) =>
            `<option value="${teacher._id}">${escapeHtml(teacher.name)}</option>`,
        )
        .join("");
  } catch (error) {
    ui.toast(error.message || "Failed to load teachers", "error");
  }
}

async function loadClasses() {
  const tbody = document.getElementById("classesTableBody");
  if (!tbody) return;

  try {
    tbody.innerHTML = '<tr><td colspan="7">Loading classes...</td></tr>';
    const response = await api.get("/api/classes?limit=200");
    const classes = response.data?.classes || [];
    classesCache = classes;

    if (!classes.length) {
      tbody.innerHTML = '<tr><td colspan="7">No classes found.</td></tr>';
      return;
    }

    renderClassesTable();
  } catch (error) {
    tbody.innerHTML = `<tr><td colspan="7">${escapeHtml(error.message || "Failed to load classes")}</td></tr>`;
  }
}

function renderClassesTable() {
  const tbody = document.getElementById("classesTableBody");
  const pagination = document.getElementById("classesPagination");
  if (!tbody) return;

  const searchValue = (document.getElementById("classSearchInput")?.value || "")
    .trim()
    .toLowerCase();
  const sortValue =
    document.getElementById("classSortSelect")?.value || "nameAsc";
  const isAdmin =
    document.querySelector("#createClassSection")?.style.display !== "none";
  const actionCellStyle = isAdmin ? "" : 'style="display:none"';

  let classes = [...classesCache];

  if (searchValue) {
    classes = classes.filter((classItem) => {
      const className = String(classItem.name || "").toLowerCase();
      const teacherName = String(
        classItem.classTeacher?.name || "",
      ).toLowerCase();
      const grade = String(classItem.grade || "").toLowerCase();
      return (
        className.includes(searchValue) ||
        teacherName.includes(searchValue) ||
        grade.includes(searchValue)
      );
    });
  }

  classes.sort((a, b) => {
    const teacherA = String(a.classTeacher?.name || "");
    const teacherB = String(b.classTeacher?.name || "");
    const studentsA = Number(a.currentStudents || 0);
    const studentsB = Number(b.currentStudents || 0);
    const gradeA = Number(a.grade || 0);
    const gradeB = Number(b.grade || 0);

    switch (sortValue) {
      case "nameDesc":
        return String(b.name || "").localeCompare(String(a.name || ""));
      case "gradeAsc":
        return gradeA - gradeB;
      case "gradeDesc":
        return gradeB - gradeA;
      case "teacherAsc":
        return teacherA.localeCompare(teacherB);
      case "studentsDesc":
        return studentsB - studentsA;
      case "nameAsc":
      default:
        return String(a.name || "").localeCompare(String(b.name || ""));
    }
  });

  if (!classes.length) {
    tbody.innerHTML =
      '<tr><td colspan="7">No classes match your search.</td></tr>';
    if (pagination) pagination.innerHTML = "";
    return;
  }

  const totalPages = Math.max(1, Math.ceil(classes.length / pageSize));
  if (currentPage > totalPages) currentPage = totalPages;
  const startIndex = (currentPage - 1) * pageSize;
  const pageRows = classes.slice(startIndex, startIndex + pageSize);
  const from = classes.length === 0 ? 0 : startIndex + 1;
  const to = Math.min(startIndex + pageRows.length, classes.length);

  tbody.innerHTML = pageRows
    .map(
      (classItem) => `
        <tr>
          <td><strong>${escapeHtml(classItem.name)}</strong></td>
          <td><span class="chip">Grade ${escapeHtml(classItem.grade)}</span></td>
          <td><span class="chip">${escapeHtml(classItem.section)}</span></td>
          <td>${escapeHtml(classItem.classTeacher?.name || "N/A")}</td>
          <td>${escapeHtml((classItem.subjects || []).join(", ") || "N/A")}</td>
          <td><span class="chip">${classItem.currentStudents || 0}/${classItem.maxStudents || 0}</span></td>
          <td class="admin-only" ${actionCellStyle}>
            <button class="button-danger" onclick="deleteClassById('${classItem._id}')">Delete</button>
          </td>
        </tr>
      `,
    )
    .join("");

  if (pagination) {
    let controls = "";
    controls += `<button class="button-secondary" ${currentPage === 1 ? "disabled" : ""} onclick="changeClassesPage(1)">First</button>`;
    controls += `<button class="button-secondary" ${currentPage === 1 ? "disabled" : ""} onclick="changeClassesPage(${currentPage - 1})">Previous</button>`;

    const maxButtons = 5;
    const half = Math.floor(maxButtons / 2);
    let start = Math.max(1, currentPage - half);
    let end = Math.min(totalPages, start + maxButtons - 1);
    if (end - start + 1 < maxButtons) {
      start = Math.max(1, end - maxButtons + 1);
    }

    for (let page = start; page <= end; page++) {
      const activeClass = page === currentPage ? "active-page" : "";
      controls += `<button class="button-secondary ${activeClass}" onclick="changeClassesPage(${page})">${page}</button>`;
    }

    controls += `<span class="chip">Showing ${from}-${to} of ${classes.length} classes</span>`;
    controls += `<span class="chip">Page ${currentPage} of ${totalPages}</span>`;
    controls += `<button class="button-secondary" ${currentPage === totalPages ? "disabled" : ""} onclick="changeClassesPage(${currentPage + 1})">Next</button>`;
    controls += `<button class="button-secondary" ${currentPage === totalPages ? "disabled" : ""} onclick="changeClassesPage(${totalPages})">Last</button>`;
    pagination.innerHTML = controls;
  }
}

window.changeClassesPage = function changeClassesPage(page) {
  currentPage = page;
  renderClassesTable();
};

async function handleCreateClass(event) {
  event.preventDefault();

  const submitButton = event.target.querySelector('button[type="submit"]');
  ui.setLoading(submitButton, true, "Creating...");

  try {
    const payload = {
      name: document.getElementById("classNameInput").value.trim(),
      grade: document.getElementById("gradeInput").value,
      section: document
        .getElementById("sectionInput")
        .value.trim()
        .toUpperCase(),
      classTeacher: document.getElementById("teacherInput").value,
      subjects: document
        .getElementById("subjectsInput")
        .value.split(",")
        .map((subject) => subject.trim())
        .filter(Boolean),
      academicYear: document.getElementById("academicYearInput").value.trim(),
      maxStudents: Number(document.getElementById("maxStudentsInput").value),
      roomNumber: document.getElementById("roomNumberInput").value.trim(),
    };

    await api.post("/api/classes", payload);
    ui.toast("Class created successfully", "success");
    event.target.reset();
    document.getElementById("maxStudentsInput").value = 40;
    await loadClasses();
  } catch (error) {
    ui.toast(error.message || "Failed to create class", "error");
  } finally {
    ui.setLoading(submitButton, false);
  }
}

window.deleteClassById = async function deleteClassById(classId) {
  if (!window.confirm("Delete this class?")) return;

  try {
    await api.delete(`/api/classes/${classId}`);
    ui.toast("Class deleted successfully", "success");
    await loadClasses();
  } catch (error) {
    ui.toast(error.message || "Failed to delete class", "error");
  }
};

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
