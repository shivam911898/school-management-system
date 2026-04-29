document.addEventListener("DOMContentLoaded", async () => {
  const user = await requireAuth();
  let classesCache = [];
  if (!user) {
    return;
  }

  const canManageAttendance = hasRequiredRole(user, ["admin", "teacher"]);

  // Check permissions
  if (!canManageAttendance) {
    // Students can only view their own attendance
    document.getElementById("markAttendanceSection").classList.add("hidden");
    document.getElementById("attendanceFormSection").classList.add("hidden");
    document.getElementById("attendanceResultsSection").classList.add("hidden");
    document
      .getElementById("viewAttendanceButton")
      ?.closest("section")
      ?.classList.add("hidden");
    document.getElementById("myAttendanceSection").classList.remove("hidden");
    document
      .getElementById("myAttendanceResultsSection")
      .classList.remove("hidden");
  }

  // Update UI
  document.querySelectorAll("[data-admin-name]").forEach((element) => {
    element.textContent = user.name;
  });

  updateRoleBasedUI(user.role);
  document.getElementById("logoutButton")?.addEventListener("click", logout);

  // Set today's date as default
  document.getElementById("attendanceDate").valueAsDate = new Date();

  // Event listeners
  document
    .getElementById("markAttendanceButton")
    ?.addEventListener("click", showMarkAttendanceSection);
  document
    .getElementById("loadStudentsButton")
    ?.addEventListener("click", loadStudentsForAttendance);
  document
    .getElementById("attendanceForm")
    ?.addEventListener("submit", handleMarkAttendance);
  document
    .getElementById("viewAttendanceButton")
    ?.addEventListener("click", viewAttendance);
  document
    .getElementById("viewMyAttendanceButton")
    ?.addEventListener("click", viewMyAttendance);
  document
    .getElementById("classSelect")
    ?.addEventListener("change", loadSubjectsForClass);

  // Initialize page
  if (canManageAttendance) {
    await loadClasses();
  } else {
    await viewMyAttendance();
  }

  async function loadClasses() {
    try {
      const response = await api.get("/api/classes");
      const classes = response.data.classes || [];
      classesCache = classes;

      const classSelect = document.getElementById("classSelect");
      const viewClassSelect = document.getElementById("viewClassSelect");

      if (!classes.length) {
        classSelect.innerHTML =
          '<option value="">No classes available</option>';
        viewClassSelect.innerHTML =
          '<option value="">No classes available</option>';

        if (user.role === "teacher") {
          ui.toast(
            "No class assigned to your teacher account. Ask admin to assign a class teacher.",
            "error",
          );
        } else {
          ui.toast(
            "No classes found. Create a class first from the Classes page.",
            "error",
          );
        }
        return;
      }

      const classOptions = classes
        .map(
          (cls) =>
            `<option value="${cls.name}">${cls.name} - ${cls.grade}${cls.section}</option>`,
        )
        .join("");

      classSelect.innerHTML =
        '<option value="">Select Class</option>' + classOptions;
      viewClassSelect.innerHTML =
        '<option value="">All Classes</option>' + classOptions;
    } catch (error) {
      ui.toast(error.message, "error");
    }
  }

  async function loadSubjectsForClass() {
    const className = document.getElementById("classSelect").value;

    if (!className) {
      // Clear subject dropdown if no class selected
      const subjectSelect = document.getElementById("subjectSelect");
      subjectSelect.innerHTML = '<option value="">Select Class First</option>';
      return;
    }

    try {
      // Resolve class details from loaded class list by class name
      let classData = classesCache.find((cls) => cls.name === className);
      if (!classData) {
        const response = await api.get("/api/classes?limit=200");
        classesCache = response.data.classes || [];
        classData = classesCache.find((cls) => cls.name === className);
      }

      if (!classData) {
        throw new Error("Selected class details not found");
      }

      // Populate subject dropdown
      const subjectSelect = document.getElementById("subjectSelect");
      const subjects = classData.subjects || [];

      subjectSelect.innerHTML =
        '<option value="">Select Subject</option>' +
        subjects
          .map((subject) => `<option value="${subject}">${subject}</option>`)
          .join("");
    } catch (error) {
      ui.toast("Failed to load subjects: " + error.message, "error");
    }
  }

  async function loadStudentsForAttendance() {
    const className = document.getElementById("classSelect").value;
    const subject = document.getElementById("subjectSelect").value;
    const date = document.getElementById("attendanceDate").value;

    if (!className || !subject || !date) {
      ui.toast("Please select class, subject, and date", "error");
      return;
    }

    try {
      // Load students for the class
      const studentsResponse = await api.get(`/api/users/class/${className}`);
      const students = studentsResponse.data;

      // Check if attendance already exists for this date
      const attendanceResponse = await api.get(
        `/api/attendance/class?class=${className}&date=${date}`,
      );
      const existingAttendance = attendanceResponse.data.attendance || [];

      renderAttendanceForm(students, existingAttendance);

      // Update info display
      document.getElementById("selectedClassInfo").textContent =
        `${className} - ${subject}`;
      document.getElementById("selectedDateInfo").textContent = ui.formatDate(
        new Date(date),
      );

      document
        .getElementById("attendanceFormSection")
        .classList.remove("hidden");
    } catch (error) {
      ui.toast(error.message, "error");
    }
  }

  function renderAttendanceForm(students, existingAttendance = []) {
    const tbody = document.getElementById("attendanceTableBody");

    if (!students.length) {
      tbody.innerHTML =
        '<tr><td colspan="7" style="text-align: center;">No students found in this class.</td></tr>';
      return;
    }

    // Create a map of existing attendance for quick lookup
    const attendanceMap = {};
    existingAttendance.forEach((record) => {
      attendanceMap[record.student._id] = record;
    });

    tbody.innerHTML = students
      .map((student) => {
        const attendance = attendanceMap[student._id];
        const currentStatus = attendance ? attendance.status : "present";
        const remarks = attendance ? attendance.remarks || "" : "";

        return `
        <tr>
          <td>${student.studentId}</td>
          <td>${student.name}</td>
          <td>
            <input type="radio" name="attendance_${student._id}" value="present" 
              ${currentStatus === "present" ? "checked" : ""} />
          </td>
          <td>
            <input type="radio" name="attendance_${student._id}" value="absent" 
              ${currentStatus === "absent" ? "checked" : ""} />
          </td>
          <td>
            <input type="radio" name="attendance_${student._id}" value="late" 
              ${currentStatus === "late" ? "checked" : ""} />
          </td>
          <td>
            <input type="radio" name="attendance_${student._id}" value="excused" 
              ${currentStatus === "excused" ? "checked" : ""} />
          </td>
          <td>
            <input type="text" name="remarks_${student._id}" value="${remarks}" 
              placeholder="Add remarks..." style="width: 100%;" />
          </td>
        </tr>
      `;
      })
      .join("");
  }

  async function handleMarkAttendance(e) {
    e.preventDefault();

    const className = document.getElementById("classSelect").value;
    const subject = document.getElementById("subjectSelect").value;
    const date = document.getElementById("attendanceDate").value;

    if (!className || !subject || !date) {
      ui.toast("Missing required information", "error");
      return;
    }

    // Collect attendance data
    const attendanceRecords = [];
    const formData = new FormData(e.target);

    // Get all student IDs from the form
    const studentInputs = document.querySelectorAll('[name^="attendance_"]');
    const studentIds = new Set();

    studentInputs.forEach((input) => {
      const studentId = input.name.replace("attendance_", "");
      studentIds.add(studentId);
    });

    studentIds.forEach((studentId) => {
      const status = formData.get(`attendance_${studentId}`);
      const remarks = formData.get(`remarks_${studentId}`);

      attendanceRecords.push({
        studentId,
        status,
        remarks: remarks || "",
      });
    });

    if (!attendanceRecords.length) {
      ui.toast("No students to mark attendance for", "error");
      return;
    }

    try {
      ui.setLoading(
        e.target.querySelector('button[type="submit"]'),
        true,
        "Saving...",
      );

      await api.post("/api/attendance/mark", {
        class: className,
        subject,
        date,
        attendanceRecords,
      });

      ui.toast("Attendance marked successfully", "success");
      cancelAttendanceMarking();
    } catch (error) {
      ui.toast(error.message, "error");
    } finally {
      ui.setLoading(e.target.querySelector('button[type="submit"]'), false);
    }
  }

  function cancelAttendanceMarking() {
    document.getElementById("attendanceFormSection").classList.add("hidden");
    document.getElementById("attendanceForm").reset();
  }

  async function viewAttendance() {
    const className = document.getElementById("viewClassSelect").value;
    const date = document.getElementById("viewDateSelect").value;

    const params = new URLSearchParams();
    if (className) params.append("class", className);
    if (date) params.append("date", date);

    try {
      const response = await api.get(`/api/attendance/class?${params}`);
      const data = response.data;

      renderAttendanceResults(data);
      document
        .getElementById("attendanceResultsSection")
        .classList.remove("hidden");

      // Update info
      const info = `Found ${data.markedCount} attendance records out of ${data.totalStudents} students`;
      document.getElementById("attendanceResultsInfo").textContent = info;
    } catch (error) {
      ui.toast(error.message, "error");
    }
  }

  function renderAttendanceResults(data) {
    const tbody = document.getElementById("attendanceResultsBody");

    if (!data.attendance.length) {
      tbody.innerHTML =
        '<tr><td colspan="8" style="text-align: center;">No attendance records found.</td></tr>';
      return;
    }

    tbody.innerHTML = data.attendance
      .map(
        (record) => `
      <tr>
        <td>${record.student.studentId}</td>
        <td>${record.student.name}</td>
        <td>
          <span class="chip ${record.status}">${record.status.charAt(0).toUpperCase() + record.status.slice(1)}</span>
        </td>
        <td>${record.class}</td>
        <td>${record.subject}</td>
        <td>${ui.formatDate(new Date(record.date))}</td>
        <td>${record.markedBy.name}</td>
        <td>
          <div class="actions">
            ${user.role === "admin" ? `<button class="button-danger" onclick="deleteAttendance('${record._id}')">Delete</button>` : ""}
          </div>
        </td>
      </tr>
    `,
      )
      .join("");
  }

  async function viewMyAttendance() {
    const startDate = document.getElementById("startDate").value;
    const endDate = document.getElementById("endDate").value;

    const params = new URLSearchParams();
    if (startDate) params.append("startDate", startDate);
    if (endDate) params.append("endDate", endDate);

    try {
      const response = await api.get(
        `/api/attendance/student/${user.studentId}?${params}`,
      );
      const data = response.data;

      renderMyAttendanceResults(data);
      document
        .getElementById("myAttendanceResultsSection")
        .classList.remove("hidden");

      // Update statistics
      const stats = data.statistics;
      document.getElementById("totalClassesStat").textContent =
        stats.totalClasses;
      document.getElementById("presentStat").textContent = stats.present;
      document.getElementById("absentStat").textContent = stats.absent;
      document.getElementById("attendancePercentageStat").textContent =
        stats.attendancePercentage + "%";

      renderMySubjectWiseSummary(data.subjectWise || []);

      // Update info
      const info = `Showing attendance from ${startDate || "beginning"} to ${endDate || "today"}`;
      document.getElementById("myAttendanceInfo").textContent = info;
    } catch (error) {
      ui.toast(error.message, "error");
    }
  }

  function renderMySubjectWiseSummary(subjectWise) {
    const tbody = document.getElementById("myAttendanceSubjectBody");
    if (!tbody) return;

    if (!subjectWise.length) {
      tbody.innerHTML =
        '<tr><td colspan="7" style="text-align: center;">No subject-wise attendance available.</td></tr>';
      return;
    }

    tbody.innerHTML = subjectWise
      .map(
        (row) => `
      <tr>
        <td>${row.subject || "-"}</td>
        <td>${row.present ?? 0}</td>
        <td>${row.absent ?? 0}</td>
        <td>${row.late ?? 0}</td>
        <td>${row.excused ?? 0}</td>
        <td>${row.totalClasses ?? 0}</td>
        <td>${row.attendancePercentage ?? 0}%</td>
      </tr>
    `,
      )
      .join("");
  }

  function renderMyAttendanceResults(data) {
    const tbody = document.getElementById("myAttendanceTableBody");

    if (!data.attendance.length) {
      tbody.innerHTML =
        '<tr><td colspan="6" style="text-align: center;">No attendance records found.</td></tr>';
      return;
    }

    tbody.innerHTML = data.attendance
      .map(
        (record) => `
      <tr>
        <td>${ui.formatDate(new Date(record.date))}</td>
        <td>${record.class}</td>
        <td>${record.subject}</td>
        <td>
          <span class="chip ${record.status}">${record.status.charAt(0).toUpperCase() + record.status.slice(1)}</span>
        </td>
        <td>${record.markedBy.name}</td>
        <td>${record.remarks || "-"}</td>
      </tr>
    `,
      )
      .join("");
  }

  window.deleteAttendance = async function (attendanceId) {
    if (!confirm("Are you sure you want to delete this attendance record?")) {
      return;
    }

    try {
      await api.delete(`/api/attendance/${attendanceId}`);
      ui.toast("Attendance record deleted successfully", "success");
      await viewAttendance(); // Refresh the view
    } catch (error) {
      ui.toast(error.message, "error");
    }
  };

  function showMarkAttendanceSection() {
    document
      .getElementById("markAttendanceSection")
      .scrollIntoView({ behavior: "smooth" });
  }

  function updateRoleBasedUI(role) {
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
});
