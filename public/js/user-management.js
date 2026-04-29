document.addEventListener("DOMContentLoaded", async () => {
  const user = await requireAuth();
  if (!user) {
    return;
  }

  // Check if user is admin
  if (!(await ensureRoleAccess(user, ["admin"]))) {
    return;
  }

  // Update UI
  document.querySelectorAll("[data-admin-name]").forEach((element) => {
    element.textContent = user.name;
  });

  updateRoleBasedUI(user.role);
  document.getElementById("logoutButton")?.addEventListener("click", logout);

  // Initialize page
  let currentPage = 1;
  let currentFilters = {};
  let isLoadingUsers = false;

  // Event listeners
  document
    .getElementById("createUserButton")
    ?.addEventListener("click", showCreateUserModal);
  document
    .getElementById("filterButton")
    ?.addEventListener("click", applyFilters);
  document
    .getElementById("roleFilter")
    ?.addEventListener("change", applyFilters);
  document.getElementById("searchFilter")?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") applyFilters();
  });

  // Modal event listeners
  document.querySelectorAll(".modal-close").forEach((button) => {
    button.addEventListener("click", hideAllModals);
  });

  // Form submissions
  document
    .getElementById("createUserForm")
    ?.addEventListener("submit", handleCreateUser);
  document
    .getElementById("editUserForm")
    ?.addEventListener("submit", handleEditUser);

  // Role field change handler
  document.getElementById("userRole")?.addEventListener("change", (e) => {
    const role = e.target.value;
    const teacherFields = document.getElementById("teacherFields");
    const studentFields = document.getElementById("studentFields");
    const classInput = document.getElementById("userClass");
    const dobInput = document.getElementById("userDateOfBirth");

    teacherFields.classList.add("hidden");
    studentFields.classList.add("hidden");

    // Reset role-based required state first
    if (classInput) classInput.required = false;
    if (dobInput) dobInput.required = false;

    if (role === "teacher") {
      teacherFields.classList.remove("hidden");
    } else if (role === "student") {
      studentFields.classList.remove("hidden");
      if (classInput) classInput.required = true;
      if (dobInput) dobInput.required = true;
    }
  });

  // Load initial data
  await loadUsers();
  window.loadUsers = (page) => loadUsers(page, currentFilters);

  async function ensureAdminSession() {
    const me = await api.get("/api/auth/me");
    if (!me?.user || me.user.role !== "admin") {
      throw new Error("Access denied. admin role required");
    }
    return me.user;
  }

  async function loadUsers(
    page = 1,
    filters = {},
    retryOnForbidden = true,
    bypassLock = false,
  ) {
    if (!bypassLock && isLoadingUsers) return;
    const acquiredLock = !bypassLock;
    if (acquiredLock) isLoadingUsers = true;

    try {
      await ensureAdminSession();

      const params = new URLSearchParams({
        page: page.toString(),
        limit: "10",
        ...filters,
      });

      const response = await api.get(`/api/users?${params}`);
      renderUsersTable(response.data.users);
      renderPagination(response.data.pagination);
      currentPage = page;
    } catch (error) {
      if (
        retryOnForbidden &&
        String(error.message).toLowerCase().includes("admin role required")
      ) {
        try {
          await ensureAdminSession();
          await loadUsers(page, filters, false, true);
          return;
        } catch (_retryError) {
          await redirectToRoleDashboard(user.role);
          return;
        }
      }

      ui.toast(error.message || "Failed to load users", "error");
    } finally {
      if (acquiredLock) isLoadingUsers = false;
    }
  }

  function renderUsersTable(users) {
    const tbody = document.getElementById("usersTableBody");
    if (!tbody) return;

    if (!users.length) {
      tbody.innerHTML =
        '<tr><td colspan="7" style="text-align: center; padding: 40px;">No users found.</td></tr>';
      return;
    }

    tbody.innerHTML = users
      .map(
        (user) => `
      <tr>
        <td>${escapeHtml(user.name)}</td>
        <td>${escapeHtml(user.email)}</td>
        <td>
          <span class="chip ${user.role}">${user.role.charAt(0).toUpperCase() + user.role.slice(1)}</span>
        </td>
  <td>${escapeHtml(user.teacherId || user.employeeId || user.studentId || "N/A")}</td>
        <td>
          ${
            user.role === "teacher"
              ? user.subjects?.join(", ") || "N/A"
              : user.role === "student"
                ? escapeHtml(user.class || "N/A")
                : "N/A"
          }
        </td>
        <td>
          <span class="chip ${user.isActive ? "success" : "danger"}">
            ${user.isActive ? "Active" : "Inactive"}
          </span>
        </td>
        <td>
          <div class="actions">
            <button class="button-secondary" onclick="editUser('${user._id}')">Edit</button>
            <button class="button-${user.isActive ? "danger" : "success"}" onclick="toggleUserStatus('${user._id}')">
              ${user.isActive ? "Deactivate" : "Activate"}
            </button>
            ${user.role !== "admin" ? `<button class="button-danger" onclick="deleteUser('${user._id}')">Delete</button>` : ""}
          </div>
        </td>
      </tr>
    `,
      )
      .join("");
  }

  function renderPagination(pagination) {
    const container = document.getElementById("pagination");
    if (!container) return;

    if (pagination.pages <= 1) {
      container.innerHTML = "";
      return;
    }

    let html = '<div class="pagination-controls">';

    // Previous button
    if (pagination.page > 1) {
      html += `<button class="button-secondary" onclick="loadUsers(${pagination.page - 1})">Previous</button>`;
    }

    // Page numbers
    for (let i = 1; i <= pagination.pages; i++) {
      const active = i === pagination.page ? "active" : "";
      html += `<button class="button-secondary ${active}" onclick="loadUsers(${i})">${i}</button>`;
    }

    // Next button
    if (pagination.page < pagination.pages) {
      html += `<button class="button-secondary" onclick="loadUsers(${pagination.page + 1})">Next</button>`;
    }

    html += "</div>";
    container.innerHTML = html;
  }

  async function applyFilters() {
    const roleFilter = document.getElementById("roleFilter").value;
    const searchFilter = document.getElementById("searchFilter").value.trim();

    const filters = {};
    if (roleFilter) filters.role = roleFilter;
    if (searchFilter) filters.search = searchFilter;

    currentFilters = filters;
    await loadUsers(1, filters);
  }

  function showCreateUserModal() {
    const roleSelect = document.getElementById("userRole");
    if (roleSelect) roleSelect.value = "";

    const classInput = document.getElementById("userClass");
    const dobInput = document.getElementById("userDateOfBirth");
    if (classInput) classInput.required = false;
    if (dobInput) dobInput.required = false;

    document.getElementById("createUserModal").classList.remove("hidden");
  }

  function hideAllModals() {
    document.querySelectorAll(".modal").forEach((modal) => {
      modal.classList.add("hidden");
    });
  }

  async function handleCreateUser(e) {
    e.preventDefault();
    // Defensive client-side check: only admins may submit this form
    if (!user || user.role !== "admin") {
      ui.toast("Access denied: only admin can create users", "error");
      return;
    }

    const formData = new FormData(e.target);
    const payload = {
      name: formData.get("name").trim(),
      password: formData.get("password"),
      role: formData.get("role"),
    };

    if (!payload.role) {
      ui.toast("Please select a role", "error");
      return;
    }

    // Add optional fields
    const phone = formData.get("phone");
    const address = formData.get("address");
    if (phone) payload.phone = phone.trim();
    if (address) payload.address = address.trim();

    // Add role-specific fields
    if (payload.role === "teacher") {
      const subjects = formData.get("subjects");
      if (subjects)
        payload.subjects = subjects
          .split(",")
          .map((s) => s.trim())
          .filter((s) => s);
    } else if (payload.role === "student") {
      const studentClass = formData.get("class");
      const dateOfBirth = formData.get("dateOfBirth");

      if (!studentClass || !String(studentClass).trim()) {
        ui.toast("Class is required for students", "error");
        return;
      }

      if (!dateOfBirth) {
        ui.toast("Date of birth is required for students", "error");
        return;
      }

      payload.class = studentClass.trim();
      payload.dateOfBirth = dateOfBirth;
    }

    try {
      ui.setLoading(
        e.target.querySelector('button[type="submit"]'),
        true,
        "Creating...",
      );
      // Use the admin-only users API instead of the auth register endpoint
      const response = await api.post("/api/users", payload);
      const generatedIdentity = response?.generated?.identity;
      const generatedEmail = response?.generated?.email;
      ui.toast(
        `${payload.role.charAt(0).toUpperCase() + payload.role.slice(1)} created successfully${generatedIdentity ? ` (${generatedIdentity})` : ""}${generatedEmail ? ` • ${generatedEmail}` : ""}`,
        "success",
      );
      hideAllModals();
      e.target.reset();
      document.getElementById("teacherFields").classList.add("hidden");
      document.getElementById("studentFields").classList.add("hidden");
      const classInput = document.getElementById("userClass");
      const dobInput = document.getElementById("userDateOfBirth");
      if (classInput) classInput.required = false;
      if (dobInput) dobInput.required = false;
      await loadUsers(currentPage, currentFilters);
    } catch (error) {
      ui.toast(error.message, "error");
    } finally {
      ui.setLoading(e.target.querySelector('button[type="submit"]'), false);
    }
  }

  window.editUser = async function (userId) {
    try {
      const response = await api.get(`/api/users/${userId}`);
      const user = response.data;

      // Populate edit form
      document.getElementById("editUserId").value = user._id;
      document.getElementById("editUserName").value = user.name;
      document.getElementById("editUserEmail").value = user.email;
      document.getElementById("editUserPhone").value = user.phone || "";
      document.getElementById("editUserAddress").value = user.address || "";

      document.getElementById("editUserModal").classList.remove("hidden");
    } catch (error) {
      ui.toast(error.message, "error");
    }
  };

  async function handleEditUser(e) {
    e.preventDefault();
    const formData = new FormData(e.target);
    const userId = formData.get("id");

    const payload = {
      name: formData.get("name").trim(),
      phone: formData.get("phone")?.trim() || "",
      address: formData.get("address")?.trim() || "",
    };

    try {
      ui.setLoading(
        e.target.querySelector('button[type="submit"]'),
        true,
        "Updating...",
      );
      await api.patch(`/api/users/${userId}`, payload);
      ui.toast("User updated successfully", "success");
      hideAllModals();
      await loadUsers(currentPage, currentFilters);
    } catch (error) {
      ui.toast(error.message, "error");
    } finally {
      ui.setLoading(e.target.querySelector('button[type="submit"]'), false);
    }
  }

  window.toggleUserStatus = async function (userId) {
    try {
      await api.patch(`/api/users/${userId}/toggle-status`);
      ui.toast("User status updated successfully", "success");
      await loadUsers(currentPage, currentFilters);
    } catch (error) {
      ui.toast(error.message, "error");
    }
  };

  window.deleteUser = async function (userId) {
    if (
      !confirm(
        "Are you sure you want to delete this user? This action cannot be undone.",
      )
    ) {
      return;
    }

    try {
      await api.delete(`/api/users/${userId}`);
      ui.toast("User deleted successfully", "success");
      await loadUsers(currentPage, currentFilters);
    } catch (error) {
      ui.toast(error.message, "error");
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
