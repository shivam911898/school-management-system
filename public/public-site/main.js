function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

async function loadPublicAnnouncements() {
  const container = document.getElementById("public-announcements");
  if (!container) return;

  container.innerHTML = "<p>Loading announcements...</p>";

  try {
    const response = await fetch("/public/notices");
    const data = await response.json();
    const notices = data.notices || [];

    if (!notices.length) {
      container.innerHTML = "<p>No announcements at this time.</p>";
      return;
    }

    container.innerHTML = notices
      .map(
        (n) => `
      <div class="announcement-card">
        <h3>${escapeHtml(n.title)}</h3>
        <p>${escapeHtml(n.description)}</p>
        <div class="date">${new Date(n.date).toLocaleDateString()}</div>
      </div>
    `,
      )
      .join("");
  } catch (_error) {
    container.innerHTML = "<p>Unable to load announcements right now.</p>";
  }
}

document.addEventListener("DOMContentLoaded", loadPublicAnnouncements);
