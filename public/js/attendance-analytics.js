document.addEventListener("DOMContentLoaded", async () => {
  const user = await requireAuth();
  if (!user) {
    return;
  }

  if (!(await ensureRoleAccess(user, ["admin", "teacher"]))) {
    return;
  }

  // Update UI
  document.querySelectorAll("[data-admin-name]").forEach((element) => {
    element.textContent = user.name;
  });

  updateRoleBasedUI(user.role);
  document.getElementById("logoutButton")?.addEventListener("click", logout);

  // Initialize charts
  let classAttendanceChart,
    monthlyTrendsChart,
    statusDistributionChart,
    topClassesChart;
  let latestAttendanceRows = [];

  // Event listeners
  document
    .getElementById("refreshButton")
    ?.addEventListener("click", loadAllData);
  document
    .getElementById("exportButton")
    ?.addEventListener("click", exportReport);
  document
    .getElementById("applyFiltersButton")
    ?.addEventListener("click", applyFilters);
  document
    .getElementById("classFilter")
    ?.addEventListener("change", syncSectionFilterWithClass);

  // Set default date range (last 30 days)
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - 30);

  document.getElementById("startDate").value = startDate
    .toISOString()
    .split("T")[0];
  document.getElementById("endDate").value = endDate
    .toISOString()
    .split("T")[0];
  await loadClassFilterOptions();

  // Load initial data
  await loadAllData();

  async function loadAllData() {
    showLoading(true);
    try {
      const params = buildFilterParams();
      const trendParams = buildTrendParams();
      const [summaryResponse] = await Promise.all([
        loadSummaryStats(params),
        loadClassAttendanceChart(params),
        loadMonthlyTrends(trendParams),
        loadStatusDistribution(params),
        loadTopClasses(params),
        loadLowAttendanceStudents(params),
      ]);
      updateNoDataMessage(summaryResponse);
    } catch (error) {
      ui.toast(error.message, "error");
      updateNoDataMessage(null);
    } finally {
      showLoading(false);
    }
  }

  async function loadSummaryStats(params) {
    try {
      const response = await api.get(
        `/api/attendance-enhanced/analytics/summary?${params}`,
      );
      const data = response.data;

      document.getElementById("totalStudentsStat").textContent =
        data.totalStudents || 0;
      document.getElementById("averageAttendanceStat").textContent =
        (data.overallAttendancePercentage || 0).toFixed(1) + "%";
      document.getElementById("totalRecordsStat").textContent =
        data.totalAttendanceRecords || 0;

      // Update low attendance count
      const lowAttendanceParams = new URLSearchParams(params);
      lowAttendanceParams.set("threshold", getThreshold());
      const lowAttendanceResponse = await api.get(
        `/api/attendance-enhanced/analytics/low-attendance?${lowAttendanceParams}`,
      );
      document.getElementById("lowAttendanceCountStat").textContent =
        lowAttendanceResponse.count || 0;

      // Show warning if there are low attendance students
      if (lowAttendanceResponse.count > 0) {
        document
          .getElementById("lowAttendanceAlert")
          .classList.remove("hidden");
        document.getElementById("lowAttendanceAlertText").textContent =
          `${lowAttendanceResponse.count} students are below ${getThreshold()}% attendance.`;
      } else {
        document.getElementById("lowAttendanceAlert").classList.add("hidden");
      }
      return data;
    } catch (error) {
      console.error("Error loading summary stats:", error);
      return null;
    }
  }

  async function loadClassAttendanceChart(params) {
    try {
      const response = await api.get(
        `/api/attendance-enhanced/analytics/class?${params}`,
      );
      const data = response.data;

      const ctx = document
        .getElementById("classAttendanceChart")
        .getContext("2d");

      if (classAttendanceChart) {
        classAttendanceChart.destroy();
      }

      classAttendanceChart = new Chart(ctx, {
        type: "bar",
        data: {
          labels: data.map((item) => `${item.class}-${item.section}`),
          datasets: [
            {
              label: "Attendance %",
              data: data.map((item) => item.averageAttendance),
              backgroundColor: data.map((item) =>
                item.averageAttendance >= 90
                  ? "rgba(75, 192, 192, 0.8)"
                  : item.averageAttendance >= 75
                    ? "rgba(255, 193, 7, 0.8)"
                    : "rgba(255, 99, 132, 0.8)",
              ),
              borderColor: data.map((item) =>
                item.averageAttendance >= 90
                  ? "rgba(75, 192, 192, 1)"
                  : item.averageAttendance >= 75
                    ? "rgba(255, 193, 7, 1)"
                    : "rgba(255, 99, 132, 1)",
              ),
              borderWidth: 1,
            },
          ],
        },
        options: {
          responsive: true,
          scales: {
            y: {
              beginAtZero: true,
              max: 100,
              ticks: {
                callback: function (value) {
                  return value + "%";
                },
              },
            },
          },
          plugins: {
            legend: {
              display: false,
            },
          },
        },
      });
    } catch (error) {
      console.error("Error loading class attendance chart:", error);
    }
  }

  async function loadMonthlyTrends(params) {
    try {
      const response = await api.get(
        `/api/attendance-enhanced/analytics/trends?${params}`,
      );
      const data = response.data;

      const ctx = document
        .getElementById("monthlyTrendsChart")
        .getContext("2d");

      if (monthlyTrendsChart) {
        monthlyTrendsChart.destroy();
      }

      // Group data by month
      const monthlyData = {};
      data.forEach((item) => {
        const monthKey = `${item.year}-${item.month.toString().padStart(2, "0")}`;
        if (!monthlyData[monthKey]) {
          monthlyData[monthKey] = { total: 0, present: 0 };
        }
        monthlyData[monthKey].total += item.totalStudents;
        monthlyData[monthKey].present += item.presentCount;
      });

      const labels = Object.keys(monthlyData).sort();
      if (!labels.length) {
        if (monthlyTrendsChart) monthlyTrendsChart.destroy();
        return;
      }
      const attendancePercentages = labels.map((month) =>
        ((monthlyData[month].present / monthlyData[month].total) * 100).toFixed(
          1,
        ),
      );

      monthlyTrendsChart = new Chart(ctx, {
        type: "line",
        data: {
          labels: labels.map((monthKey) => {
            const [yearPart, monthPart] = monthKey.split("-");
            return new Date(yearPart, Number(monthPart) - 1).toLocaleDateString(
              "en",
              { month: "short", year: "numeric" },
            );
          }),
          datasets: [
            {
              label: "Attendance %",
              data: attendancePercentages,
              borderColor: "rgba(75, 192, 192, 1)",
              backgroundColor: "rgba(75, 192, 192, 0.1)",
              tension: 0.4,
              fill: true,
            },
          ],
        },
        options: {
          responsive: true,
          scales: {
            y: {
              beginAtZero: true,
              max: 100,
              ticks: {
                callback: function (value) {
                  return value + "%";
                },
              },
            },
          },
        },
      });
    } catch (error) {
      console.error("Error loading monthly trends:", error);
    }
  }

  async function loadStatusDistribution(params) {
    try {
      const response = await api.get(
        `/api/attendance-enhanced/analytics/summary?${params}`,
      );
      const data = response.data;

      const ctx = document
        .getElementById("statusDistributionChart")
        .getContext("2d");

      if (statusDistributionChart) {
        statusDistributionChart.destroy();
      }

      statusDistributionChart = new Chart(ctx, {
        type: "doughnut",
        data: {
          labels: ["Present", "Absent", "Late", "Excused"],
          datasets: [
            {
              data: [
                data.presentCount || 0,
                data.absentCount || 0,
                data.lateCount || 0,
                data.excusedCount || 0,
              ],
              backgroundColor: [
                "rgba(75, 192, 192, 0.8)",
                "rgba(255, 99, 132, 0.8)",
                "rgba(255, 193, 7, 0.8)",
                "rgba(153, 102, 255, 0.8)",
              ],
              borderWidth: 2,
            },
          ],
        },
        options: {
          responsive: true,
          plugins: {
            legend: {
              position: "bottom",
            },
          },
        },
      });
    } catch (error) {
      console.error("Error loading status distribution:", error);
    }
  }

  async function loadTopClasses(params) {
    try {
      const response = await api.get(
        `/api/attendance-enhanced/analytics/top-classes?${params}`,
      );
      const data = response.data;

      const ctx = document.getElementById("topClassesChart").getContext("2d");

      if (topClassesChart) {
        topClassesChart.destroy();
      }

      topClassesChart = new Chart(ctx, {
        type: "bar",
        data: {
          labels: data.map((item) => `${item.class}-${item.section}`),
          datasets: [
            {
              label: "Attendance %",
              data: data.map((item) => item.attendancePercentage),
              backgroundColor: "rgba(54, 162, 235, 0.8)",
              borderColor: "rgba(54, 162, 235, 1)",
              borderWidth: 1,
            },
          ],
        },
        options: {
          indexAxis: "y",
          responsive: true,
          scales: {
            x: {
              beginAtZero: true,
              max: 100,
              ticks: {
                callback: function (value) {
                  return value + "%";
                },
              },
            },
          },
        },
      });
    } catch (error) {
      console.error("Error loading top classes:", error);
    }
  }

  async function loadLowAttendanceStudents(params) {
    try {
      const lowAttendanceParams = new URLSearchParams(params);
      lowAttendanceParams.set("threshold", getThreshold());
      const response = await api.get(
        `/api/attendance-enhanced/analytics/low-attendance?${lowAttendanceParams}`,
      );
      const students = response.data;
      latestAttendanceRows = students;

      const tbody = document.getElementById("lowAttendanceTableBody");

      if (!students.length) {
        tbody.innerHTML = `
          <tr>
            <td colspan="7" style="text-align: center; padding: 40px;">
              No students with low attendance found for the selected criteria.
            </td>
          </tr>
        `;
        return;
      }

      tbody.innerHTML = students
        .map(
          (student) => `
        <tr class="${student.attendancePercentage < 50 ? "danger-row" : "warning-row"}">
          <td>${student.studentId}</td>
          <td>${escapeHtml(student.name)}</td>
          <td>${student.class}</td>
          <td>${student.section}</td>
          <td>
            <span class="chip ${student.attendancePercentage < 50 ? "danger" : "warning"}">
              ${student.attendancePercentage.toFixed(1)}%
            </span>
          </td>
          <td>
            <span class="chip ${student.attendancePercentage < getThreshold() ? "danger" : "warning"}">
              ${student.attendancePercentage < getThreshold() ? "At Risk" : "Warning"}
            </span>
          </td>
          <td>
            <div class="actions">
              <button class="button-secondary" onclick="viewStudentDetails('${student.studentId}')">
                View Details
              </button>
            </div>
          </td>
        </tr>
      `,
        )
        .join("");
    } catch (error) {
      console.error("Error loading low attendance students:", error);
    }
  }

  async function applyFilters() {
    const button = document.getElementById("applyFiltersButton");
    ui.setLoading(button, true, "Applying...");
    try {
      await loadAllData();
    } finally {
      ui.setLoading(button, false);
    }
  }

  async function exportReport() {
    try {
      showLoading(true);
      const params = buildFilterParams();
      const response = await api.get(`/api/attendance-enhanced?${params}`);
      const rows = response.data.attendance || [];
      if (!rows.length) {
        ui.toast("No attendance data to export for current filters", "error");
        return;
      }

      if (!window.jspdf || !window.jspdf.jsPDF) {
        ui.toast(
          "PDF library unavailable. Please refresh and try again.",
          "error",
        );
        return;
      }

      const { jsPDF } = window.jspdf;
      const doc = new jsPDF({ orientation: "landscape" });
      doc.setFontSize(14);
      doc.text("Attendance Analytics Report", 14, 14);
      doc.setFontSize(10);
      doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 20);
      doc.text(`Filters: ${params.toString() || "none"}`, 14, 26);

      doc.autoTable({
        startY: 32,
        head: [
          [
            "Student ID",
            "Name",
            "Class",
            "Section",
            "Subject",
            "Date",
            "Status",
            "Marked By",
          ],
        ],
        body: rows.map((record) => [
          record.student?.studentId || "",
          record.student?.name || "",
          record.class || "",
          record.section || "",
          record.subject || "",
          new Date(record.date).toLocaleDateString(),
          record.status || "",
          record.markedBy?.name || "",
        ]),
        styles: { fontSize: 8 },
      });

      doc.save(
        `attendance-report-${new Date().toISOString().split("T")[0]}.pdf`,
      );
      ui.toast("PDF exported successfully", "success");
    } catch (error) {
      ui.toast(error.message, "error");
    } finally {
      showLoading(false);
    }
  }

  function generateCSV(data) {
    const headers = [
      "Student ID",
      "Name",
      "Class",
      "Section",
      "Subject",
      "Date",
      "Status",
      "Marked By",
      "Remarks",
    ];
    const rows = data.map((record) => [
      record.student.studentId || "",
      record.student.name || "",
      record.class || "",
      record.section || "",
      record.subject || "",
      new Date(record.date).toLocaleDateString(),
      record.status || "",
      record.markedBy?.name || "",
      record.remarks || "",
    ]);

    return [headers, ...rows]
      .map((row) => row.map((cell) => `"${cell}"`).join(","))
      .join("\n");
  }

  window.viewStudentDetails = async function (studentId) {
    try {
      const response = await api.get(
        `/api/attendance-enhanced/analytics/student/${studentId}`,
      );
      const data = response.data;

      alert(
        `Student Details:\n\nName: ${data.name}\nStudent ID: ${data.studentId}\nClass: ${data.class}\nSection: ${data.section}\nTotal Classes: ${data.totalClasses}\nPresent: ${data.presentCount}\nAttendance: ${data.attendancePercentage}%\nStatus: ${data.status}`,
      );
    } catch (error) {
      ui.toast(error.message, "error");
    }
  };

  function showLoading(show) {
    const overlay = document.getElementById("loadingOverlay");
    if (show) {
      overlay.classList.remove("hidden");
    } else {
      overlay.classList.add("hidden");
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

  // Auto-refresh every 5 minutes
  setInterval(
    async () => {
      await loadAllData();
    },
    5 * 60 * 1000,
  );

  function getThreshold() {
    const value = Number(
      document.getElementById("thresholdFilter")?.value || 75,
    );
    return Number.isFinite(value) && value > 0 && value <= 100 ? value : 75;
  }

  function buildFilterParams() {
    const params = new URLSearchParams();
    const classFilter = document.getElementById("classFilter")?.value;
    const sectionFilter = document.getElementById("sectionFilter")?.value;
    const startDate = document.getElementById("startDate")?.value;
    const endDate = document.getElementById("endDate")?.value;

    if (classFilter) params.append("class", classFilter);
    if (sectionFilter) params.append("section", sectionFilter);
    if (startDate) params.append("startDate", startDate);
    if (endDate) params.append("endDate", endDate);
    return params;
  }

  function buildTrendParams() {
    const params = new URLSearchParams();
    const classFilter = document.getElementById("classFilter")?.value;
    const sectionFilter = document.getElementById("sectionFilter")?.value;
    if (classFilter) params.append("class", classFilter);
    if (sectionFilter) params.append("section", sectionFilter);
    return params;
  }

  async function loadClassFilterOptions() {
    const classFilter = document.getElementById("classFilter");
    const sectionFilter = document.getElementById("sectionFilter");
    const debugInfo = document.getElementById("filterDebugInfo");
    if (!classFilter) return;

    const classSet = new Set();
    const sectionSet = new Set();
    let analyticsCount = 0;
    let classApiCount = 0;
    let attendanceCount = 0;
    const sourceErrors = [];

    try {
      const analyticsResponse = await api.get(
        "/api/attendance-enhanced/analytics/class",
      );
      const analyticsClasses = analyticsResponse.data || [];
      analyticsCount = analyticsClasses.length;
      analyticsClasses.forEach((item) => {
        if (item.class) classSet.add(item.class);
        if (item.section) sectionSet.add(item.section);
      });
    } catch (error) {
      console.warn("Analytics class source failed:", error.message);
      sourceErrors.push(`analytics: ${error.message}`);
    }

    try {
      const classResponse = await api.get("/api/classes?limit=200");
      const masterClasses = classResponse.data?.classes || [];
      classApiCount = masterClasses.length;
      masterClasses.forEach((item) => {
        if (item.name) classSet.add(item.name);
        if (item.section) sectionSet.add(item.section);
      });
    } catch (error) {
      console.warn("Master class source failed:", error.message);
      sourceErrors.push(`classes: ${error.message}`);
    }

    try {
      // Third fallback: derive classes from attendance records directly.
      const attendanceResponse = await api.get(
        "/api/attendance-enhanced?limit=500",
      );
      const attendanceRows = attendanceResponse.data?.attendance || [];
      attendanceCount = attendanceRows.length;
      attendanceRows.forEach((row) => {
        if (row.class) classSet.add(row.class);
        if (row.section) sectionSet.add(row.section);
      });
    } catch (error) {
      console.warn("Attendance source failed:", error.message);
      sourceErrors.push(`attendance: ${error.message}`);
    }

    const classes = Array.from(classSet).sort();
    const sections = Array.from(sectionSet).sort();
    const fallbackClasses = ["7A", "7B", "8A", "8B", "9A", "9B", "10A", "10B"];
    const finalClasses = classes.length ? classes : fallbackClasses;
    const finalSections = sections.length ? sections : ["A", "B"];

    classFilter.innerHTML =
      '<option value="">All Classes</option>' +
      finalClasses
        .map((cls) => `<option value="${cls}">${cls}</option>`)
        .join("");
    classFilter.disabled = false;

    if (sectionFilter) {
      sectionFilter.innerHTML =
        '<option value="">All Sections</option>' +
        finalSections
          .map((section) => `<option value="${section}">${section}</option>`)
          .join("");
    }

    syncSectionFilterWithClass();

    if (!classes.length) {
      ui.toast(
        "Using fallback class list. Please re-login if classes are still missing.",
        "info",
      );
    }

    if (debugInfo) {
      const errorSummary = sourceErrors.length
        ? ` | errors: ${sourceErrors.join(" ; ")}`
        : "";
      debugInfo.textContent = `Filter sources -> analytics:${analyticsCount}, classes:${classApiCount}, attendance:${attendanceCount}, final class options:${finalClasses.length}${errorSummary}`;
    }
  }

  function syncSectionFilterWithClass() {
    const classFilter = document.getElementById("classFilter");
    const sectionFilter = document.getElementById("sectionFilter");
    if (!classFilter || !sectionFilter) return;

    const selectedClass = classFilter.value;
    if (!selectedClass) {
      // No class selected: keep generic sections available.
      const currentSections = Array.from(sectionFilter.options)
        .map((opt) => opt.value)
        .filter(Boolean);
      if (!currentSections.length) {
        sectionFilter.innerHTML =
          '<option value="">All Sections</option><option value="A">A</option><option value="B">B</option><option value="C">C</option>';
      }
      return;
    }

    const inferredSection = selectedClass.slice(-1).toUpperCase();
    const previousSection = sectionFilter.value;
    sectionFilter.innerHTML = '<option value="">All Sections</option>';
    if (/^[A-Z]$/.test(inferredSection)) {
      sectionFilter.innerHTML += `<option value="${inferredSection}">${inferredSection}</option>`;
      if (previousSection && previousSection !== inferredSection) {
        sectionFilter.value = "";
        ui.toast(
          `Section reset to avoid invalid combo for class ${selectedClass}.`,
          "info",
        );
      } else if (previousSection === inferredSection) {
        sectionFilter.value = inferredSection;
      }
    }
  }

  function updateNoDataMessage(summaryData) {
    const alertSection = document.getElementById("noDataAlert");
    const alertText = document.getElementById("noDataAlertText");
    if (!alertSection || !alertText) return;

    if (summaryData && Number(summaryData.totalAttendanceRecords || 0) > 0) {
      alertSection.classList.add("hidden");
      alertText.textContent = "";
      return;
    }

    const classFilter =
      document.getElementById("classFilter")?.value || "all classes";
    const sectionFilter =
      document.getElementById("sectionFilter")?.value || "all sections";
    const startDate =
      document.getElementById("startDate")?.value || "any start date";
    const endDate = document.getElementById("endDate")?.value || "any end date";

    alertText.textContent = `No attendance records found for class "${classFilter}", section "${sectionFilter}", between ${startDate} and ${endDate}. Try widening date range, clearing class/section filters, or reducing threshold.`;
    alertSection.classList.remove("hidden");
  }
});
