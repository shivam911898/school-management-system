document.addEventListener("DOMContentLoaded", async () => {
  const user = await requireAuth();
  if (!user) return;

  document.querySelectorAll("[data-admin-name]").forEach((element) => {
    element.textContent = user.name;
  });

  updateRoleBasedUI(user.role);
  document.getElementById("logoutButton")?.addEventListener("click", logout);
  document.getElementById("welcomeDate").textContent = ui.formatDate(
    new Date(),
  );

  try {
    const response = await api.get("/api/dashboard/overview");
    const data = response.data || {};

    configureDashboardForRole(user.role);
    renderRoleSummary(user.role, data.summary || {});
    renderDashboardNotices(data.notices || []);

    if (user.role === "student") {
      renderStudentProfile(
        data.studentProfile || user,
        data.subjectAttendance || [],
      );
    } else {
      renderDashboardStudents(data.recentStudents || []);
    }
  } catch (error) {
    ui.toast(error.message || "Failed to load dashboard", "error");
  }
});

function updateRoleBasedUI(role) {
  document
    .querySelectorAll(".admin-only, .teacher-only, .student-only")
    .forEach((element) => {
      element.style.display = "none";
    });

  document.querySelectorAll(`.${role}-only`).forEach((element) => {
    element.style.display = "";
  });
}

function configureDashboardForRole(role) {
  const noticesManageLink = document.getElementById("noticesManageLink");
  const studentsManageLink = document.getElementById("studentsManageLink");
  const studentsPanelTitle = document.getElementById("studentsPanelTitle");
  const studentsPanelSubtitle = document.getElementById(
    "studentsPanelSubtitle",
  );

  if (role === "student") {
    [
      "studentCountCard",
      "teacherCountCard",
      "classCountCard",
      "noticeCountCard",
      "myClassCountCard",
    ].forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.classList.add("hidden");
    });
    if (noticesManageLink) noticesManageLink.classList.add("hidden");
    if (studentsManageLink) studentsManageLink.classList.add("hidden");
    if (studentsPanelTitle)
      studentsPanelTitle.textContent = "My Profile & Subject-wise Attendance";
    if (studentsPanelSubtitle)
      studentsPanelSubtitle.textContent =
        "Your basic details and attendance by subject.";
    return;
  }

  if (role === "teacher") {
    ["teacherCountCard", "classCountCard"].forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.classList.add("hidden");
    });
    if (noticesManageLink) noticesManageLink.classList.add("hidden");
    if (studentsPanelTitle)
      studentsPanelTitle.textContent = "My Assigned Students";
    if (studentsPanelSubtitle)
      studentsPanelSubtitle.textContent =
        "Students from classes assigned to you.";
    return;
  }

  if (studentsPanelTitle) studentsPanelTitle.textContent = "Recent Students";
  if (studentsPanelSubtitle)
    studentsPanelSubtitle.textContent = "Newest student records overview.";
}

function renderRoleSummary(role, summary) {
  setText("studentCount", summary.totalStudents ?? 0);
  setText("teacherCount", summary.totalTeachers ?? 0);
  setText("noticeCount", summary.totalNotices ?? 0);

  if (role === "admin") {
    setText("classCount", summary.totalClasses ?? 0);
  }

  if (role === "teacher") {
    setText("myClassCount", summary.myClasses ?? 0);
  }

  if (role === "student") {
    setText("myAttendance", `${summary.myAttendancePercent ?? 0}%`);
  }
}

function renderDashboardNotices(notices) {
  const container = document.getElementById("latestNotices");
  if (!container) return;

  if (!notices.length) {
    container.innerHTML =
      '<div class="empty-state">No notices published yet.</div>';
    return;
  }

  container.innerHTML = notices
    .map(
      (notice) => `
        <article class="notice-card">
          <div class="chip">${ui.formatDate(notice.date)}</div>
          <h3>${escapeHtml(notice.title)}</h3>
          <p class="muted">${escapeHtml(notice.description)}</p>
        </article>
      `,
    )
    .join("");
}

function renderDashboardStudents(students) {
  const tbody = document.getElementById("latestStudentsBody");
  if (!tbody) return;

  if (!students.length) {
    tbody.innerHTML = '<tr><td colspan="4">No students available.</td></tr>';
    return;
  }

  tbody.innerHTML = students
    .map(
      (student) => `
        <tr>
          <td>${escapeHtml(student.name || "N/A")}</td>
          <td>${escapeHtml(student.className || student.class || "N/A")}</td>
          <td>${escapeHtml(student.section || "N/A")}</td>
          <td>${student.rollNumber ?? "N/A"}</td>
        </tr>
      `,
    )
    .join("");
}

function renderStudentProfile(student, subjectAttendance) {
  const tableWrap = document.getElementById("studentsTableWrap");
  const detailsContainer = document.getElementById("studentDetailsContainer");

  if (!detailsContainer) return;

  if (tableWrap) tableWrap.classList.add("hidden");
  detailsContainer.classList.remove("hidden");

  const attendanceRows = (subjectAttendance || []).length
    ? subjectAttendance
        .map(
          (item) => `
            <tr>
              <td>${escapeHtml(item.subject || "N/A")}</td>
              <td>${item.presentCount ?? 0}/${item.totalClasses ?? 0}</td>
              <td>${item.absentCount ?? 0}</td>
              <td>${item.attendancePercent ?? 0}%</td>
            </tr>
          `,
        )
        .join("")
    : '<tr><td colspan="4">No attendance records available yet.</td></tr>';

  detailsContainer.innerHTML = `
    <div class="panel" style="margin-bottom: 12px;">
      <h3>Basic Details</h3>
      <p><strong>Name:</strong> ${escapeHtml(student.name || "N/A")}</p>
      <p><strong>Student ID:</strong> ${escapeHtml(student.studentId || "N/A")}</p>
      <p><strong>Class:</strong> ${escapeHtml(student.class || "N/A")}</p>
      <p><strong>Email:</strong> ${escapeHtml(student.email || "N/A")}</p>
    </div>
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Subject</th>
            <th>Present / Total</th>
            <th>Absent</th>
            <th>Attendance %</th>
          </tr>
        </thead>
        <tbody>
          ${attendanceRows}
        </tbody>
      </table>
    </div>
  `;
}

function setText(id, value) {
  const element = document.getElementById(id);
  if (element) element.textContent = value;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
