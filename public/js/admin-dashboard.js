class AdminDashboard {
  constructor() {
    this.charts = {};
    this.data = {};
    this.filters = {
      class: "",
      section: "",
      dateRange: "30",
    };
    this.isDarkMode = false;
    this.refreshInterval = null;

    this.init();
  }

  async init() {
    try {
      await this.authenticate();
      this.setupEventListeners();
      this.initializeTheme();
      await this.loadDashboardData();
      this.startRealTimeUpdates();
    } catch (error) {
      console.error("Dashboard initialization failed:", error);
      this.showError("Failed to initialize dashboard");
    }
  }

  async authenticate() {
    try {
      const user = await requireAuth();
      if (!user) {
        return;
      }

      const hasAccess = await ensureRoleAccess(user, ["admin"]);
      if (!hasAccess) {
        return;
      }
      this.user = user;
    } catch (error) {
      console.error("Authentication failed:", error);
      const fallbackUser = await requireAuth(false);
      if (fallbackUser?.role) {
        await redirectToRoleDashboard(fallbackUser.role);
      } else {
        window.location.href = "/login";
      }
    }
  }

  setupEventListeners() {
    // Theme toggle
    document.getElementById("themeToggle")?.addEventListener("click", () => {
      this.toggleTheme();
    });

    // Filters
    document.getElementById("classFilter")?.addEventListener("change", (e) => {
      this.filters.class = e.target.value;
      this.loadDashboardData();
    });

    document
      .getElementById("sectionFilter")
      ?.addEventListener("change", (e) => {
        this.filters.section = e.target.value;
        this.loadDashboardData();
      });

    document
      .getElementById("dateRangeFilter")
      ?.addEventListener("change", (e) => {
        this.filters.dateRange = e.target.value;
        this.loadDashboardData();
      });

    // Actions
    document.getElementById("refreshBtn")?.addEventListener("click", () => {
      this.loadDashboardData();
    });

    document.getElementById("exportBtn")?.addEventListener("click", () => {
      this.exportData();
    });

    document.getElementById("viewAllClasses")?.addEventListener("click", () => {
      this.viewAllClasses();
    });

    // Chart type switch
    document.getElementById("chartType")?.addEventListener("change", (e) => {
      this.updateChartType(e.target.value);
    });

    // Navigation
    document.querySelectorAll(".nav-item").forEach((item) => {
      item.addEventListener("click", (e) => {
        e.preventDefault();
        this.handleNavigation(item.dataset.page);
      });
    });
  }

  initializeTheme() {
    const savedTheme = localStorage.getItem("theme") || "light";
    this.isDarkMode = savedTheme === "dark";
    this.applyTheme();
  }

  toggleTheme() {
    this.isDarkMode = !this.isDarkMode;
    this.applyTheme();
    localStorage.setItem("theme", this.isDarkMode ? "dark" : "light");
  }

  applyTheme() {
    const root = document.documentElement;
    const themeIcon = document.getElementById("themeIcon");

    if (this.isDarkMode) {
      root.setAttribute("data-theme", "dark");
      themeIcon.textContent = " Sun ";
    } else {
      root.removeAttribute("data-theme");
      themeIcon.textContent = " Moon ";
    }
  }

  async loadDashboardData() {
    this.showLoading(true);

    try {
      const params = new URLSearchParams();
      if (this.filters.class) params.append("class", this.filters.class);
      if (this.filters.section) params.append("section", this.filters.section);
      params.append("dateRange", this.filters.dateRange);

      const response = await api.get(`/api/dashboard/metrics?${params}`);
      this.data = response.data;

      await this.updateUI();
      this.hideLoading();
    } catch (error) {
      console.error("Failed to load dashboard data:", error);
      this.showError("Failed to load dashboard data");
      this.hideLoading();
    }
  }

  async updateUI() {
    // Update stats cards
    this.updateStatsCards();

    // Update charts
    await this.updateCharts();

    // Update tables
    this.updateClassTable();
    this.updateLowAttendanceTable();

    // Update filters
    this.updateFilters();

    // Show content with animation
    this.showDashboardContent();
  }

  updateStatsCards() {
    const { summary } = this.data;

    this.animateNumber("totalStudents", summary.totalStudents);
    this.animateNumber("totalClasses", summary.totalClasses);
    this.animateNumber("attendanceRate", summary.overallAttendance, "%");
    this.animateNumber(
      "lowAttendanceCount",
      this.data.attendance.lowAttendanceStudents.length,
    );
  }

  animateNumber(elementId, targetValue, suffix = "") {
    const element = document.getElementById(elementId);
    if (!element) return;

    const startValue = 0;
    const duration = 1000;
    const startTime = performance.now();

    const animate = (currentTime) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);

      const currentValue = Math.floor(
        startValue + (targetValue - startValue) * progress,
      );
      element.textContent = currentValue + suffix;

      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };

    requestAnimationFrame(animate);
  }

  async updateCharts() {
    await this.updateClassPerformanceChart();
    await this.updateAttendanceDistributionChart();
  }

  async updateClassPerformanceChart() {
    const ctx = document.getElementById("classPerformanceChart");
    if (!ctx) return;

    const { distributions, attendance } = this.data;
    const chartType = document.getElementById("chartType")?.value || "bar";

    if (this.charts.classPerformance) {
      this.charts.classPerformance.destroy();
    }

    const chartData = {
      labels: distributions.byClass.map((item) => item.class),
      datasets: [
        {
          label: "Total Students",
          data: distributions.byClass.map((item) => item.totalStudents),
          backgroundColor: "rgba(99, 102, 241, 0.8)",
          borderColor: "rgba(99, 102, 241, 1)",
          borderWidth: 2,
          borderRadius: 8,
        },
      ],
    };

    const config = {
      type: chartType,
      data: chartData,
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: false,
          },
          tooltip: {
            backgroundColor: "rgba(0, 0, 0, 0.8)",
            padding: 12,
            borderRadius: 8,
            titleFont: {
              size: 14,
              weight: "bold",
            },
            bodyFont: {
              size: 13,
            },
          },
        },
        scales: {
          y: {
            beginAtZero: true,
            grid: {
              color: this.isDarkMode
                ? "rgba(255, 255, 255, 0.1)"
                : "rgba(0, 0, 0, 0.1)",
            },
            ticks: {
              color: this.isDarkMode ? "#9ca3af" : "#6b7280",
            },
          },
          x: {
            grid: {
              display: false,
            },
            ticks: {
              color: this.isDarkMode ? "#9ca3af" : "#6b7280",
            },
          },
        },
      },
    };

    this.charts.classPerformance = new Chart(ctx, config);
  }

  async updateAttendanceDistributionChart() {
    const ctx = document.getElementById("attendanceDistributionChart");
    if (!ctx) return;

    const { attendance } = this.data;

    if (this.charts.attendanceDistribution) {
      this.charts.attendanceDistribution.destroy();
    }

    const chartData = {
      labels: ["Present", "Absent", "Late", "Excused"],
      datasets: [
        {
          data: [
            attendance.stats.presentCount,
            attendance.stats.absentCount,
            attendance.stats.lateCount,
            attendance.stats.excusedCount,
          ],
          backgroundColor: [
            "rgba(16, 185, 129, 0.8)",
            "rgba(239, 68, 68, 0.8)",
            "rgba(245, 158, 11, 0.8)",
            "rgba(59, 130, 246, 0.8)",
          ],
          borderColor: [
            "rgba(16, 185, 129, 1)",
            "rgba(239, 68, 68, 1)",
            "rgba(245, 158, 11, 1)",
            "rgba(59, 130, 246, 1)",
          ],
          borderWidth: 2,
          borderRadius: 8,
        },
      ],
    };

    const config = {
      type: "doughnut",
      data: chartData,
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: "bottom",
            labels: {
              padding: 15,
              color: this.isDarkMode ? "#9ca3af" : "#6b7280",
            },
          },
          tooltip: {
            backgroundColor: "rgba(0, 0, 0, 0.8)",
            padding: 12,
            borderRadius: 8,
            callbacks: {
              label: function (context) {
                const label = context.label || "";
                const value = context.parsed || 0;
                const total = context.dataset.data.reduce((a, b) => a + b, 0);
                const percentage = ((value / total) * 100).toFixed(1);
                return `${label}: ${value} (${percentage}%)`;
              },
            },
          },
        },
      },
    };

    this.charts.attendanceDistribution = new Chart(ctx, config);
  }

  updateClassTable() {
    const tbody = document.getElementById("classTableBody");
    if (!tbody) return;

    const { attendance } = this.data;

    if (!attendance.classBreakdown || attendance.classBreakdown.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="4" style="text-align: center; padding: 2rem;">
            <div class="empty-state">
              <div class="empty-icon"> Data </div>
              <div class="empty-title">No class data available</div>
              <div class="empty-description">Try adjusting your filters</div>
            </div>
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = attendance.classBreakdown
      .map((cls) => {
        const attendanceRate = cls.attendancePercentage;
        const status =
          attendanceRate >= 90
            ? "excellent"
            : attendanceRate >= 75
              ? "good"
              : "needs-attention";
        const statusClass =
          status === "excellent"
            ? "badge-success"
            : status === "good"
              ? "badge-warning"
              : "badge-danger";

        return `
        <tr>
          <td><strong>${cls.class}-${cls.section}</strong></td>
          <td>${cls.totalRecords}</td>
          <td>${attendanceRate}%</td>
          <td><span class="badge ${statusClass}">${status.replace("-", " ")}</span></td>
        </tr>
      `;
      })
      .join("");
  }

  updateLowAttendanceTable() {
    const tbody = document.getElementById("lowAttendanceTableBody");
    const badge = document.getElementById("lowAttendanceBadge");

    if (!tbody || !badge) return;

    const { attendance } = this.data;
    const students = attendance.lowAttendanceStudents || [];

    badge.textContent = students.length;

    if (students.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="4" style="text-align: center; padding: 2rem;">
            <div class="empty-state">
              <div class="empty-icon"> Check </div>
              <div class="empty-title">All students have good attendance</div>
              <div class="empty-description">Great job!</div>
            </div>
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = students
      .slice(0, 5)
      .map(
        (student) => `
      <tr>
        <td><strong>${student.studentId}</strong></td>
        <td>${student.name}</td>
        <td>
          <span class="badge badge-danger">${student.attendancePercentage}%</span>
        </td>
        <td>
          <button class="btn btn-secondary" onclick="dashboard.viewStudentDetails('${student.studentId}')">
            View
          </button>
        </td>
      </tr>
    `,
      )
      .join("");
  }

  updateFilters() {
    const classFilter = document.getElementById("classFilter");
    if (!classFilter) return;

    const { distributions } = this.data;
    const currentValue = classFilter.value;

    classFilter.innerHTML =
      '<option value="">All Classes</option>' +
      distributions.byClass
        .map(
          (cls) =>
            `<option value="${cls.class}" ${cls.class === currentValue ? "selected" : ""}>
          ${cls.class}
        </option>`,
        )
        .join("");
  }

  updateChartType(type) {
    this.updateClassPerformanceChart();
  }

  showLoading(show) {
    const loadingState = document.getElementById("loadingState");
    const dashboardContent = document.getElementById("dashboardContent");

    if (show) {
      loadingState.style.display = "flex";
      dashboardContent.style.display = "none";
    } else {
      loadingState.style.display = "none";
    }
  }

  hideLoading() {
    const loadingState = document.getElementById("loadingState");
    loadingState.style.display = "none";
  }

  showDashboardContent() {
    const dashboardContent = document.getElementById("dashboardContent");
    dashboardContent.style.display = "block";

    // Add fade-in animation
    dashboardContent.classList.add("fade-in");

    setTimeout(() => {
      dashboardContent.classList.remove("fade-in");
    }, 500);
  }

  startRealTimeUpdates() {
    // Update dashboard every 30 seconds
    this.refreshInterval = setInterval(() => {
      this.loadDashboardData();
    }, 30000);
  }

  stopRealTimeUpdates() {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
      this.refreshInterval = null;
    }
  }

  async exportData() {
    try {
      const { data } = this;
      const csvContent = this.generateCSV(data);

      const blob = new Blob([csvContent], { type: "text/csv" });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `dashboard-export-${new Date().toISOString().split("T")[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      this.showSuccess("Dashboard data exported successfully");
    } catch (error) {
      console.error("Export failed:", error);
      this.showError("Failed to export data");
    }
  }

  generateCSV(data) {
    const headers = [
      "Class",
      "Section",
      "Total Students",
      "Attendance Rate",
      "Present",
      "Absent",
      "Late",
      "Excused",
    ];
    const rows = data.attendance.classBreakdown.map((cls) => [
      cls.class,
      cls.section,
      cls.totalRecords,
      `${cls.attendancePercentage}%`,
      cls.presentCount,
      cls.absentCount,
      cls.lateCount,
      cls.excusedCount,
    ]);

    return [headers, ...rows]
      .map((row) => row.map((cell) => `"${cell}"`).join(","))
      .join("\n");
  }

  viewAllClasses() {
    // Navigate to classes page
    window.location.href = "/classes";
  }

  viewStudentDetails(studentId) {
    // Navigate to student details
    window.location.href = `/students/${studentId}`;
  }

  handleNavigation(page) {
    // Update active navigation
    document.querySelectorAll(".nav-item").forEach((item) => {
      item.classList.remove("active");
    });
    document.querySelector(`[data-page="${page}"]`)?.classList.add("active");

    // Handle navigation (could implement SPA routing here)
    console.log(`Navigate to ${page}`);
  }

  showError(message) {
    ui.toast(message, "error");
  }

  showSuccess(message) {
    ui.toast(message, "success");
  }

  destroy() {
    this.stopRealTimeUpdates();

    // Destroy charts
    Object.values(this.charts).forEach((chart) => {
      if (chart) chart.destroy();
    });
  }
}

// Initialize dashboard when DOM is ready
document.addEventListener("DOMContentLoaded", () => {
  window.dashboard = new AdminDashboard();
});

// Cleanup on page unload
window.addEventListener("beforeunload", () => {
  if (window.dashboard) {
    window.dashboard.destroy();
  }
});
