(function renderPublicLayout() {
  const schoolName = "J.C. Memorial School, Nagra, Ballia";
  const links = [
    { href: "/", label: "Home", key: "home" },
    { href: "/admissions", label: "Admissions", key: "admissions" },
    { href: "/fees", label: "Fees", key: "fees" },
    { href: "/announcements", label: "Announcements", key: "announcements" },
    { href: "/about", label: "About", key: "about" },
    { href: "/login", label: "Login", key: "login", cta: true },
  ];

  const currentPage = document.body.dataset.page || "";

  const headerHost = document.getElementById("public-header");
  const footerHost = document.getElementById("public-footer");

  if (headerHost) {
    headerHost.innerHTML = `
      <div class="navbar-wrap">
        <nav class="navbar container" aria-label="Primary">
          <a class="navbar-brand" href="/">
            <span class="logo-media">
              <img src="/images/school-banner.png" alt="School logo" class="school-logo">
            </span>
            <span class="brand-text">${schoolName}</span>
          </a>
          <ul class="navbar-links">
            ${links
              .map((link) => {
                const activeClass = currentPage === link.key ? "active" : "";
                const ctaClass = link.cta ? "nav-cta" : "";
                const cls = [activeClass, ctaClass].filter(Boolean).join(" ");
                return `<li><a href="${link.href}" class="${cls}">${link.label}</a></li>`;
              })
              .join("")}
          </ul>
        </nav>
      </div>
    `;
  }

  if (footerHost) {
    footerHost.classList.add("site-footer");
    footerHost.innerHTML = `
      <div class="footer-inner container">
        <p>&copy; 2026 ${schoolName}</p>
      </div>
    `;
  }
})();
