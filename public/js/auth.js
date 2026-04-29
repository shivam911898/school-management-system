function getQueryParam(name) {
  const params = new URLSearchParams(window.location.search);
  return params.get(name);
}

function getRequestedRole() {
  const roleFromQuery = getQueryParam("role");
  if (
    roleFromQuery &&
    ["admin", "teacher", "student"].includes(roleFromQuery)
  ) {
    return roleFromQuery;
  }

  const path = window.location.pathname;
  const match = path.match(/^\/login\/(admin|teacher|student)$/);
  return match ? match[1] : null;
}

document.addEventListener("DOMContentLoaded", async () => {
  const loginForm = document.getElementById("loginForm");
  const registerForm = document.getElementById("registerForm");
  const userManagementForm = document.getElementById("userManagementForm");
  const registerPanel = document.getElementById("registerPanel");
  const userManagementPanel = document.getElementById("userManagementPanel");
  const setupHint = document.getElementById("setupHint");
  const roleSelect = document.getElementById("user-role");
  const teacherFields = document.getElementById("teacherFields");
  const studentFields = document.getElementById("studentFields");

  // Hide both panels by default
  registerPanel.classList.add("hidden");
  userManagementPanel?.classList.add("hidden");

  let registrationOpen = false;
  try {
    const setupStatus = await api.get("/api/auth/setup-status");
    registrationOpen = setupStatus.registrationOpen;
  } catch (error) {
    // ignore
  }

  const requestedRole = getRequestedRole();
  const heading = document.getElementById("loginHeading");
  const roleBanner = document.getElementById("loginRoleBanner");
  const roleBadge = document.getElementById("loginRoleBadge");
  const roleHint = document.getElementById("loginRoleHint");
  const roleIcon = document.getElementById("loginRoleIcon");
  if (requestedRole) {
    const pretty =
      requestedRole.charAt(0).toUpperCase() + requestedRole.slice(1);
    if (heading) heading.textContent = `${pretty} Login`;
    document.title = `${pretty} Login | School Management`;

    const roleMeta = {
      admin: {
        icon: "🛡️",
        badge: "Administrator Portal",
        hint: "Use your admin credentials to manage school operations.",
      },
      teacher: {
        icon: "🧑‍🏫",
        badge: "Teacher Portal",
        hint: "Sign in to manage class attendance and student records.",
      },
      student: {
        icon: "🎓",
        badge: "Student Portal",
        hint: "Sign in to view your dashboard, attendance, and updates.",
      },
    };

    const selectedMeta = roleMeta[requestedRole];
    if (roleBanner && selectedMeta) roleBanner.dataset.role = requestedRole;
    if (roleBadge && selectedMeta) roleBadge.textContent = selectedMeta.badge;
    if (roleHint && selectedMeta) roleHint.textContent = selectedMeta.hint;
    if (roleIcon && selectedMeta) roleIcon.textContent = selectedMeta.icon;
  } else {
    if (heading) heading.textContent = "Admin Login";
    document.title = "Admin Login | School Management";
  }

  // Show registerPanel only if registration is open and not a role-specific login
  if (registrationOpen && (!requestedRole || requestedRole === "admin")) {
    registerPanel.classList.remove("hidden");
    setupHint.textContent =
      "No admin account exists yet. Create the first admin below.";
  } else {
    setupHint.textContent =
      "Admin account already configured. Log in to continue.";
  }

  // Keep user creation off the public login page.
  // Admins should manage users from the dedicated user management page.
  userManagementPanel?.classList.add("hidden");

  // Handle role selection in user management form
  roleSelect?.addEventListener("change", (e) => {
    const role = e.target.value;

    // Hide all role-specific fields
    teacherFields.classList.add("hidden");
    studentFields.classList.add("hidden");

    // Show relevant fields based on role
    if (role === "teacher") {
      teacherFields.classList.remove("hidden");
    } else if (role === "student") {
      studentFields.classList.remove("hidden");
    }
  });

  loginForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const submitButton = loginForm.querySelector('button[type="submit"]');

    const payload = {
      email: loginForm.email.value.trim(),
      password: loginForm.password.value,
    };

    // If the login page was requested for a specific role, include it to help UX/back-end validation
    const requestedRole = getRequestedRole();
    if (requestedRole) payload.role = requestedRole;

    try {
      ui.setLoading(submitButton, true, "Signing in...");
      const response = await api.post("/api/auth/login", payload);
      await api.notifications.syncStoredToken();
      ui.toast("Login successful", "success");
      await redirectToRoleDashboard(response.user?.role);
    } catch (error) {
      if (String(error.message).toLowerCase().includes("role mismatch")) {
        ui.toast(
          `${error.message} Try /login for general login or choose the matching role link.`,
          "error",
        );
      } else {
        ui.toast(error.message, "error");
      }
    } finally {
      ui.setLoading(submitButton, false);
    }
  });

  registerForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const submitButton = registerForm.querySelector('button[type="submit"]');

    const payload = {
      name: registerForm.name.value.trim(),
      email: registerForm.email.value.trim(),
      phone: registerForm.phone.value.trim(),
      password: registerForm.password.value,
    };

    try {
      ui.setLoading(submitButton, true, "Creating admin...");
      // This form is used only for initial admin creation when no users exist
      const response = await api.post("/api/auth/register", payload);
      ui.toast("Admin account created", "success");
      await redirectToRoleDashboard(response.user?.role);
    } catch (error) {
      ui.toast(error.message, "error");
    } finally {
      ui.setLoading(submitButton, false);
    }
  });

  userManagementForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const submitButton = userManagementForm.querySelector(
      'button[type="submit"]',
    );

    const formData = new FormData(userManagementForm);
    const payload = {
      name: formData.get("name").trim(),
      email: formData.get("email").trim(),
      password: formData.get("password"),
      role: formData.get("role"),
    };

    // Add optional fields
    const phone = formData.get("phone");
    const address = formData.get("address");
    if (phone) payload.phone = phone.trim();
    if (address) payload.address = address.trim();

    // Add role-specific fields
    if (payload.role === "teacher") {
      const employeeId = formData.get("employeeId");
      const subjects = formData.get("subjects");
      if (employeeId) payload.employeeId = employeeId.trim();
      if (subjects)
        payload.subjects = subjects
          .split(",")
          .map((s) => s.trim())
          .filter((s) => s);
    } else if (payload.role === "student") {
      const studentId = formData.get("studentId");
      const studentClass = formData.get("class");
      const dateOfBirth = formData.get("dateOfBirth");
      if (studentId) payload.studentId = studentId.trim();
      if (studentClass) payload.class = studentClass.trim();
      if (dateOfBirth) payload.dateOfBirth = dateOfBirth;
    }

    try {
      // Defensive client-side check: only admins may submit this form
      const currentUser = await requireAuth();
      if (!currentUser || currentUser.role !== "admin") {
        ui.toast("Access denied: only admin can create users", "error");
        return;
      }

      ui.setLoading(submitButton, true, "Creating user...");
      await api.post("/api/users", payload);
      ui.toast(
        `${payload.role.charAt(0).toUpperCase() + payload.role.slice(1)} created successfully`,
        "success",
      );
      userManagementForm.reset();
      // Hide role-specific fields
      teacherFields.classList.add("hidden");
      studentFields.classList.add("hidden");
    } catch (error) {
      ui.toast(error.message, "error");
    } finally {
      ui.setLoading(submitButton, false);
    }
  });
});
