const api = {
  async request(url, options = {}) {
    const config = {
      method: "GET",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
      },
      ...options,
    };

    if (!config.body) {
      delete config.headers["Content-Type"];
    }

    const response = await fetch(url, config);
    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(data.message || "Request failed");
    }

    return data;
  },

  get(url) {
    return this.request(url);
  },

  post(url, body) {
    return this.request(url, {
      method: "POST",
      body: JSON.stringify(body),
    });
  },

  put(url, body) {
    return this.request(url, {
      method: "PUT",
      body: JSON.stringify(body),
    });
  },

  patch(url, body) {
    return this.request(url, {
      method: "PATCH",
      body: JSON.stringify(body),
    });
  },

  delete(url) {
    return this.request(url, {
      method: "DELETE",
    });
  },
};

const FCM_TOKEN_STORAGE_KEY = "fcmDeviceToken";

api.notifications = {
  registerToken(token) {
    return api.post("/api/notifications/token", { token });
  },

  unregisterToken(token) {
    return api.request("/api/notifications/token", {
      method: "DELETE",
      body: JSON.stringify({ token }),
    });
  },

  sendToRoles({ roles, title, body, data = {} }) {
    return api.post("/api/notifications/send", {
      roles,
      title,
      body,
      data,
    });
  },

  getStoredToken() {
    return window.localStorage.getItem(FCM_TOKEN_STORAGE_KEY);
  },

  storeToken(token) {
    if (!token) return;
    console.log("[FCM] Token generated:", token);
    window.localStorage.setItem(FCM_TOKEN_STORAGE_KEY, token);
  },

  clearStoredToken() {
    window.localStorage.removeItem(FCM_TOKEN_STORAGE_KEY);
  },

  async syncStoredToken() {
    const token = this.getStoredToken();
    if (!token) return;

    try {
      await this.registerToken(token);
      console.log("[FCM] Token synced with backend:", token);
    } catch (_error) {
      console.log("[FCM] Token sync failed");
      // Token sync is best-effort. Ignore failures to avoid blocking UI flows.
    }
  },

  async unregisterStoredToken() {
    const token = this.getStoredToken();
    if (!token) return;

    try {
      await this.unregisterToken(token);
    } catch (_error) {
      // Best-effort cleanup during logout.
    }
  },
};

if (navigator.serviceWorker) {
  navigator.serviceWorker.addEventListener("message", (event) => {
    console.log("[FCM] Notification received:", event.data);
  });
}

const ui = {
  toast(message, type = "info") {
    const wrap = document.getElementById("toastWrap");
    if (!wrap) {
      return;
    }

    const toast = document.createElement("div");
    toast.className = `toast ${type}`;
    toast.textContent = message;
    wrap.appendChild(toast);

    window.setTimeout(() => {
      toast.remove();
    }, 3200);
  },

  setLoading(target, isLoading, loadingText = "Loading...") {
    if (!target) {
      return;
    }

    if (isLoading) {
      target.dataset.originalText = target.textContent;
      target.textContent = loadingText;
      target.disabled = true;
      target.classList.add("loading");
      return;
    }

    target.textContent = target.dataset.originalText || target.textContent;
    target.disabled = false;
    target.classList.remove("loading");
  },

  formatDate(value) {
    return new Date(value).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  },
};

async function requireAuth(redirectToLogin = true) {
  try {
    const response = await api.get("/api/auth/me");
    const dashboardRoute = await getRoleHomeRoute(response.user?.role);
    document.querySelectorAll('a[href="/dashboard"]').forEach((anchor) => {
      anchor.setAttribute("href", dashboardRoute);
    });

    applyRoleNavigation(response.user?.role);

    await api.notifications.syncStoredToken();
    return response.user;
  } catch (error) {
    if (redirectToLogin) {
      window.location.href = "/login";
    }
    return null;
  }
}

function getDashboardRouteForRole(role) {
  if (role === "admin") return "/admin/dashboard";
  if (role === "teacher") return "/teacher/dashboard";
  if (role === "student") return "/student/dashboard";
  return "/login";
}

function getAllowedPathsForRole(role) {
  const rolePaths = {
    admin: new Set([
      "/",
      "/admissions",
      "/fees",
      "/about",
      "/announcements",
      "/dashboard",
      "/admin/dashboard",
      "/admin-dashboard",
      "/admin/public-content",
      "/students",
      "/notices",
      "/attendance",
      "/attendance-management",
      "/classes",
      "/user-management",
      "/attendance-analytics",
    ]),
    teacher: new Set([
      "/dashboard",
      "/teacher/dashboard",
      "/students",
      "/attendance",
      "/attendance-management",
    ]),
    student: new Set(["/dashboard", "/student/dashboard"]),
  };

  return rolePaths[role] || new Set();
}

function applyRoleNavigation(role) {
  if (!role) return;

  const allowedPaths = getAllowedPathsForRole(role);

  document.querySelectorAll(".sidebar-nav .sidebar-link").forEach((anchor) => {
    const linkPath = new URL(anchor.href, window.location.origin).pathname;
    const isAllowed = allowedPaths.has(linkPath);
    anchor.classList.toggle("hidden", !isAllowed);
  });

  const currentPath = window.location.pathname;
  const publicPaths = new Set([
    "/",
    "/login",
    "/admissions",
    "/fees",
    "/about",
    "/announcements",
  ]);
  const isPublicPath = publicPaths.has(currentPath);
  if (!isPublicPath && !allowedPaths.has(currentPath)) {
    redirectToRoleDashboard(role);
  }
}

async function getRoleHomeRoute(role) {
  try {
    const response = await api.get("/api/auth/home");
    return response.home || getDashboardRouteForRole(response.role || role);
  } catch (_error) {
    return getDashboardRouteForRole(role);
  }
}

async function redirectToRoleDashboard(role) {
  const homeRoute = await getRoleHomeRoute(role);
  window.location.href = homeRoute;
}

function hasRequiredRole(user, allowedRoles = []) {
  if (!user || !allowedRoles.length) return false;
  return allowedRoles.includes(user.role);
}

async function ensureRoleAccess(user, allowedRoles = [], options = {}) {
  const { redirect = true } = options;
  const authorized = hasRequiredRole(user, allowedRoles);

  if (authorized) return true;
  if (redirect && user?.role) {
    await redirectToRoleDashboard(user.role);
  }
  return false;
}

async function logout() {
  await api.notifications.unregisterStoredToken();

  try {
    await fetch("/api/auth/logout", {
      method: "POST",
      credentials: "include",
      keepalive: true,
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });
  } catch (error) {
    try {
      await fetch("/api/auth/logout", {
        method: "GET",
        credentials: "include",
        keepalive: true,
      });
    } catch (_fallbackError) {
      // Ignore and continue with redirect.
    }
  } finally {
    window.location.replace("/login?loggedOut=1");
  }
}

// Global fallback: keep logout working even if page-specific scripts fail.
document.addEventListener("DOMContentLoaded", () => {
  const logoutButtons = document.querySelectorAll(
    '#logoutButton, .logout-btn, [data-action="logout"]',
  );
  logoutButtons.forEach((button) => {
    button.addEventListener("click", (event) => {
      event.preventDefault();
      logout();
    });
  });
});

// Delegated fallback for dynamically rendered or late-bound elements.
document.addEventListener("click", (event) => {
  const trigger = event.target.closest(
    '#logoutButton, .logout-btn, [data-action="logout"]',
  );
  if (!trigger) return;
  event.preventDefault();
  logout();
});
