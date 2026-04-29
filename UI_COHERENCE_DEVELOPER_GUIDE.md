# UI Coherence - Developer Quick Reference

## For Creating New Pages

### 1. Base HTML Structure

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Page Title | School Management</title>
    <link rel="stylesheet" href="/css/styles.css" />
  </head>
  <body>
    <!-- Your page here -->
    <div id="toastWrap" class="toast-wrap"></div>
    <script src="/js/api.js"></script>
    <script>
      // Your page scripts here
    </script>
  </body>
</html>
```

### 2. Dashboard Layout Template

```html
<div class="dashboard">
  <aside class="sidebar">
    <div class="brand">
      <span class="brand-mark">SM</span>
      <span>School Management</span>
    </div>

    <nav class="sidebar-nav">
      <a class="sidebar-link active" href="/page">Current Page</a>
      <a class="sidebar-link" href="/other">Other Pages</a>
    </nav>

    <div class="sidebar-footer">
      <div class="muted">Signed in as</div>
      <strong data-admin-name>Admin</strong>
    </div>
  </aside>

  <main class="content">
    <div class="content-header">
      <div>
        <p class="muted">Subtitle</p>
        <h1 class="page-title">Page Title</h1>
      </div>
      <div class="actions">
        <button class="button" type="button">Action</button>
        <button class="button-danger" type="button">Logout</button>
      </div>
    </div>

    <!-- Page content goes here -->
  </main>
</div>
```

---

## CSS Classes Cheat Sheet

### Layout

```css
.dashboard              /* Main grid layout (sidebar + content) */
.sidebar                /* Navigation sidebar */
.content                /* Main content area */
.content-header         /* Header section with title and actions */
```

### Cards & Sections

```css
.panel                  /* Generic card/container */
.stat-card              /* Statistics card */
.table-card             /* Table container */
.hero-card              /* Large hero section */
.auth-card              /* Authentication form container */
.notice-card            /* Notice/announcement card */
.empty-state            /* Empty state message */
```

### Grids

```css
.stats-grid             /* 3-column grid for stats */
.grid-two               /* 2-column grid */
.form-grid              /* Form fields grid */
.form-grid.two-col      /* 2-column form grid */
```

### Typography

```css
.page-title             /* Main page title (2rem) */
.muted                  /* Muted text color */
.hero-title             /* Large hero title */
.hero-copy              /* Hero description text */
```

### Buttons

```css
.button                 /* Primary button (teal) */
.button-secondary       /* Secondary button (light teal) */
.button-danger          /* Danger button (light red) */
```

### Components

```css
.chip                   /* Badge/tag component */
.table-wrap             /* Table wrapper with scroll */
.form-grid              /* Form fields container */
.field                  /* Individual form field */
.actions                /* Flex container for actions */
```

### Navigation

```css
.sidebar-link           /* Navigation link */
.sidebar-link.active    /* Active navigation link */
.nav-link               /* Top navigation link (home page) */
.nav-link.active        /* Active top navigation link */
```

### Utilities

```css
.hidden                 /* display: none !important */
.muted                  /* Muted text color */
.toast-wrap             /* Notification container */
.loading                /* Loading state (opacity + pointer-events) */
.chart-container        /* Chart wrapper (300px height) */
```

---

## Color Scheme

### CSS Variables

```css
:root {
  --bg: #f4f7fb; /* Page background */
  --surface: #ffffff; /* Card background */
  --border: #d9e2ec; /* Border color */
  --text: #102a43; /* Text color */
  --muted: #627d98; /* Muted text */
  --primary: #0f766e; /* Teal */
  --primary-dark: #115e59; /* Dark teal */
  --accent: #f59e0b; /* Orange/amber */
  --danger: #dc2626; /* Red */
  --success: #15803d; /* Green */
}
```

### Common Color Usage

```javascript
// Success/Green
background: '#ecfeff' or '#d1fae5'
color: '#0f766e' or '#065f46'

// Warning/Yellow
background: '#fefce8' or '#fed7aa'
color: '#ca8a04' or '#92400e'

// Danger/Red
background: '#fee2e2' or '#fecaca'
color: '#991b1b' or '#dc2626'
```

---

## Form Patterns

### Basic Form

```html
<form class="form-grid">
  <div class="field">
    <label for="name">Field Label</label>
    <input id="name" type="text" required />
  </div>
  <button class="button" type="submit">Submit</button>
</form>
```

### Two-Column Form

```html
<form class="form-grid two-col">
  <div class="field">
    <label for="field1">Field 1</label>
    <input id="field1" type="text" required />
  </div>
  <div class="field">
    <label for="field2">Field 2</label>
    <input id="field2" type="text" required />
  </div>
</form>
```

### With Select/Textarea

```html
<div class="field">
  <label for="select">Select</label>
  <select id="select" required>
    <option value="">Choose...</option>
    <option value="1">Option 1</option>
  </select>
</div>

<div class="field">
  <label for="textarea">Description</label>
  <textarea id="textarea" required></textarea>
</div>
```

---

## JavaScript Patterns

### API Calls

```javascript
// GET request
const data = await api.get("/api/endpoint");

// POST request
const result = await api.post("/api/endpoint", { key: "value" });

// All requests automatically include auth cookies
```

### Notifications

```javascript
// Success toast
ui.toast("Operation successful", "success");

// Error toast
ui.toast("Something went wrong", "error");

// Info toast
ui.toast("Here is some information", "info");
```

### Event Listeners

```javascript
document.getElementById("buttonId")?.addEventListener("click", () => {
  // Handle click
});

// Safe optional chaining
document.getElementById("mayNotExist")?.addEventListener("click", handler);
```

### DOM Manipulation

```javascript
// Show/hide elements
element.classList.add("hidden");
element.classList.remove("hidden");
element.classList.toggle("hidden");

// Check if hidden
if (element.classList.contains("hidden")) {
}

// Update text
element.textContent = "New text";
element.innerHTML = "<strong>HTML</strong>";
```

---

## Responsive Breakpoints

```css
/* Desktop (1200px+) - 3 columns */
@media (min-width: 1200px) {
}

/* Tablet (768px - 1199px) - 2 columns */
@media (max-width: 980px) {
}

/* Mobile (< 768px) - 1 column */
@media (max-width: 720px) {
}
```

---

## Common Patterns

### Loading State

```html
<div id="content">Loading...</div>
<button id="refreshBtn" class="button-secondary">Refresh</button>

<script>
  async function loadData() {
    try {
      const data = await api.get("/api/data");
      document.getElementById("content").innerHTML = renderData(data);
    } catch (error) {
      ui.toast(error.message, "error");
    }
  }
</script>
```

### Empty State

```html
<div class="empty-state">
  <p>No data available</p>
</div>
```

### Table Template

```html
<section class="table-card">
  <div class="content-header">
    <h2>Title</h2>
  </div>
  <div class="table-wrap">
    <table>
      <thead>
        <tr>
          <th>Column 1</th>
          <th>Column 2</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody id="tableBody"></tbody>
    </table>
  </div>
</section>
```

### Stats Cards

```html
<section class="stats-grid">
  <article class="stat-card">
    <div class="muted">Label</div>
    <div class="stat-value" id="statValue">0</div>
  </article>
</section>
```

---

## Do's and Don'ts

### ✅ DO:

- Use CSS variables for colors
- Use flexbox/grid for layouts
- Use semantic HTML
- Use `api.js` for HTTP requests
- Use `ui.toast()` for notifications
- Use class selectors (not IDs) for styling
- Keep inline styles minimal
- Test on mobile

### ❌ DON'T:

- Add inline `<style>` blocks
- Use custom colors directly
- Mix layout methods (flexbox + float)
- Use `fetch()` directly (use `api.js`)
- Create custom notification systems
- Over-use IDs in selectors
- Use deprecated HTML elements
- Forget mobile responsiveness

---

## Support

For questions about the UI system:

1. Check `styles.css` for available classes
2. Review existing pages for patterns
3. Refer to this guide
4. Check `UI_COHERENCE_IMPROVEMENTS.md` for details
