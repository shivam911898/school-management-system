let currentNoticeId = null;
let activeUser = null;

document.addEventListener("DOMContentLoaded", async () => {
  const user = await requireAuth();
  if (!user) return;

  if (!(await ensureRoleAccess(user, ["admin"]))) {
    return;
  }

  activeUser = user;
  const isAdmin = user.role === "admin";

  document.querySelectorAll("[data-admin-name]").forEach((element) => {
    element.textContent = user.name;
  });

  if (!isAdmin) {
    document.getElementById("noticeForm")?.classList.add("hidden");
    const title = document.getElementById("noticeFormTitle");
    if (title) title.textContent = "Notice Feed";
  }

  document.getElementById("logoutButton")?.addEventListener("click", logout);
  document
    .getElementById("noticeForm")
    ?.addEventListener("submit", submitNoticeForm);
  document
    .getElementById("cancelNoticeEditButton")
    ?.addEventListener("click", resetNoticeForm);
  document
    .getElementById("notice-type")
    ?.addEventListener("change", updatePriorityPreview);
  document
    .getElementById("audienceFilter")
    ?.addEventListener("change", loadNotices);
  document
    .getElementById("activeOnlyFilter")
    ?.addEventListener("change", loadNotices);

  updatePriorityPreview();
  await loadNotices();
});

async function loadNotices() {
  const container = document.getElementById("noticesList");
  if (!container) return;

  container.innerHTML = '<div class="empty-state">Loading notices...</div>';

  try {
    const audience = document.getElementById("audienceFilter")?.value || "";
    const activeOnly =
      document.getElementById("activeOnlyFilter")?.value || "true";
    updateFilterSummary(audience, activeOnly);

    const params = new URLSearchParams();
    params.set("activeOnly", activeOnly);
    if (audience) params.set("targetAudience", audience);

    const { notices } = await api.get(`/api/notices?${params.toString()}`);
    const isAdmin = activeUser?.role === "admin";

    if (!notices.length) {
      container.innerHTML =
        '<div class="empty-state">No notices available.</div>';
      return;
    }

    container.innerHTML = notices
      .map(
        (notice) => `
          <article class="notice-card">
            <div class="actions" style="justify-content: space-between; align-items: flex-start;">
              <div>
                <div class="chip">${ui.formatDate(notice.date)}</div>
                <h3>${escapeHtml(notice.title)}</h3>
                <div class="actions" style="margin-top: 6px;">
                  ${notice.priority === "high" ? '<span class="chip notice-priority-high">High Priority</span>' : ""}
                  <span class="chip">${escapeHtml(notice.type || "normal")}</span>
                  <span class="chip">${escapeHtml(notice.targetAudience || "all")}</span>
                  <span class="chip">${notice.isPublic ? "Public" : "Private"}</span>
                  ${notice.expiresAt ? `<span class="chip">Expires ${ui.formatDate(notice.expiresAt)}</span>` : ""}
                </div>
              </div>
              ${
                isAdmin
                  ? `<div class="actions">
                      <button class="button-secondary" type="button" data-toggle-public-notice="${notice._id}" data-is-public="${notice.isPublic ? "true" : "false"}">${notice.isPublic ? "Make Private" : "Make Public"}</button>
                      <button class="button-secondary" type="button" data-edit-notice="${notice._id}">Edit</button>
                      <button class="button-danger" type="button" data-delete-notice="${notice._id}">Delete</button>
                    </div>`
                  : ""
              }
            </div>
            <p class="muted">${escapeHtml(notice.description)}</p>
          </article>
        `,
      )
      .join("");

    if (isAdmin) {
      notices.forEach((notice) => {
        document
          .querySelector(`[data-toggle-public-notice="${notice._id}"]`)
          ?.addEventListener("click", () =>
            toggleNoticePublicState(notice._id, !(notice.isPublic === true)),
          );
        document
          .querySelector(`[data-edit-notice="${notice._id}"]`)
          ?.addEventListener("click", () => fillNoticeForm(notice));
        document
          .querySelector(`[data-delete-notice="${notice._id}"]`)
          ?.addEventListener("click", () => deleteNotice(notice._id));
      });
    }
  } catch (error) {
    container.innerHTML = `<div class="empty-state">${escapeHtml(error.message)}</div>`;
    ui.toast(error.message, "error");
  }
}

async function submitNoticeForm(event) {
  event.preventDefault();
  if (activeUser?.role !== "admin") {
    ui.toast("Access denied: only admin can publish notices", "error");
    return;
  }

  const form = event.currentTarget;
  const submitButton = form.querySelector('button[type="submit"]');

  const payload = {
    title: form.title.value.trim(),
    description: form.description.value.trim(),
    date: form.date.value,
    type: form.type.value || "normal",
    targetAudience: form.targetAudience.value || "all",
    expiresAt: form.expiresAt.value || null,
    isPublic: form.isPublic?.checked === true,
  };

  try {
    ui.setLoading(
      submitButton,
      true,
      currentNoticeId ? "Updating..." : "Publishing...",
    );

    if (currentNoticeId) {
      await api.put(`/api/notices/${currentNoticeId}`, payload);
      ui.toast("Notice updated successfully", "success");
    } else {
      await api.post("/api/notices", payload);
      ui.toast("Notice published successfully", "success");
    }

    resetNoticeForm();
    await loadNotices();
  } catch (error) {
    ui.toast(error.message, "error");
  } finally {
    ui.setLoading(submitButton, false);
  }
}

function fillNoticeForm(notice) {
  if (activeUser?.role !== "admin") return;

  currentNoticeId = notice._id;
  const form = document.getElementById("noticeForm");
  form.title.value = notice.title;
  form.description.value = notice.description;
  form.date.value = notice.date.slice(0, 10);
  form.type.value = notice.type || "normal";
  form.targetAudience.value = notice.targetAudience || "all";
  form.expiresAt.value = notice.expiresAt ? notice.expiresAt.slice(0, 10) : "";
  form.isPublic.checked = notice.isPublic === true;
  document.getElementById("noticeFormTitle").textContent = "Edit Notice";
  document.getElementById("cancelNoticeEditButton").classList.remove("hidden");
  updatePriorityPreview();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function resetNoticeForm() {
  currentNoticeId = null;
  const form = document.getElementById("noticeForm");
  if (!form) return;
  form.reset();
  if (form.isPublic) {
    form.isPublic.checked = false;
  }
  document.getElementById("noticeFormTitle").textContent = "Publish Notice";
  document.getElementById("cancelNoticeEditButton").classList.add("hidden");
  updatePriorityPreview();
}

async function toggleNoticePublicState(noticeId, isPublic) {
  if (activeUser?.role !== "admin") {
    ui.toast("Access denied: only admin can update visibility", "error");
    return;
  }

  try {
    await api.put(`/admin/notices/${noticeId}/public`, { isPublic });
    ui.toast(`Notice marked as ${isPublic ? "public" : "private"}`, "success");
    await loadNotices();
  } catch (error) {
    ui.toast(error.message, "error");
  }
}

async function deleteNotice(noticeId) {
  if (activeUser?.role !== "admin") {
    ui.toast("Access denied: only admin can delete notices", "error");
    return;
  }

  const confirmed = window.confirm("Delete this notice permanently?");
  if (!confirmed) return;

  try {
    await api.delete(`/api/notices/${noticeId}`);
    ui.toast("Notice deleted successfully", "success");
    await loadNotices();
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

function updateFilterSummary(audience, activeOnly) {
  const summary = document.getElementById("noticeFilterSummary");
  if (!summary) return;

  const audienceLabel = audience
    ? audience.charAt(0).toUpperCase() + audience.slice(1)
    : "All";
  const activeLabel = activeOnly === "true" ? "Active only" : "All notices";
  summary.textContent = `Showing: ${activeLabel} | Audience: ${audienceLabel}`;
}

function updatePriorityPreview() {
  const typeField = document.getElementById("notice-type");
  const previewChip = document.getElementById("priorityPreviewChip");
  if (!typeField || !previewChip) return;

  const isUrgent = typeField.value === "urgent";
  previewChip.textContent = isUrgent ? "Priority: High" : "Priority: Normal";
  previewChip.classList.toggle("notice-priority-high", isUrgent);
}
