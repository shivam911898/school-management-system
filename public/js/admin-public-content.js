let editingAdmissionId = null;
let editingFeeId = null;

document.addEventListener("DOMContentLoaded", async () => {
  const user = await requireAuth();
  if (!user) return;

  if (!(await ensureRoleAccess(user, ["admin"]))) {
    return;
  }

  setupEventListeners();
  await Promise.all([loadAdmissions(), loadFees(), loadAbout()]);
});

function setupEventListeners() {
  document
    .getElementById("admissionForm")
    ?.addEventListener("submit", onAdmissionSubmit);
  document.getElementById("feeForm")?.addEventListener("submit", onFeeSubmit);
  document
    .getElementById("aboutForm")
    ?.addEventListener("submit", onAboutSubmit);
  document
    .getElementById("cancelAdmissionEdit")
    ?.addEventListener("click", resetAdmissionForm);
  document
    .getElementById("cancelFeeEdit")
    ?.addEventListener("click", resetFeeForm);
  document.getElementById("logoutButton")?.addEventListener("click", logout);
}

async function loadAdmissions() {
  const table = document.getElementById("admissionsTableBody");
  if (!table) return;
  table.innerHTML = '<tr><td colspan="5" class="muted">Loading...</td></tr>';

  try {
    const response = await api.get("/admin/admissions");
    const admissions = response.admissions || [];

    if (admissions.length === 0) {
      table.innerHTML =
        '<tr><td colspan="5" class="muted">No admissions added yet.</td></tr>';
      return;
    }

    table.innerHTML = admissions
      .map(
        (item) => `
        <tr>
          <td>${escapeHtml(item.title)}</td>
          <td>${new Date(item.startDate).toLocaleDateString()}</td>
          <td>${escapeHtml((item.requirements || []).join(", "))}</td>
          <td>${escapeHtml(item.description)}</td>
          <td>
            <button type="button" class="button-secondary" data-edit-admission="${item._id}">Edit</button>
            <button type="button" class="button-danger" data-delete-admission="${item._id}">Delete</button>
          </td>
        </tr>
      `,
      )
      .join("");

    admissions.forEach((item) => {
      document
        .querySelector(`[data-edit-admission="${item._id}"]`)
        ?.addEventListener("click", () => fillAdmissionForm(item));
      document
        .querySelector(`[data-delete-admission="${item._id}"]`)
        ?.addEventListener("click", () => deleteAdmission(item._id));
    });
  } catch (error) {
    table.innerHTML = `<tr><td colspan="5" class="muted">${escapeHtml(error.message)}</td></tr>`;
  }
}

async function onAdmissionSubmit(event) {
  event.preventDefault();
  const form = event.currentTarget;

  const payload = {
    title: form.title.value.trim(),
    description: form.description.value.trim(),
    startDate: form.startDate.value,
    requirements: form.requirements.value
      .split(/\r?\n|,/)
      .map((s) => s.trim())
      .filter(Boolean),
  };

  try {
    if (editingAdmissionId) {
      await api.put(`/admin/admissions/${editingAdmissionId}`, payload);
      ui.toast("Admission updated", "success");
    } else {
      await api.post("/admin/admissions", payload);
      ui.toast("Admission added", "success");
    }
    resetAdmissionForm();
    await loadAdmissions();
  } catch (error) {
    ui.toast(error.message, "error");
  }
}

function fillAdmissionForm(item) {
  editingAdmissionId = item._id;
  const form = document.getElementById("admissionForm");
  if (!form) return;

  form.title.value = item.title || "";
  form.description.value = item.description || "";
  form.startDate.value = item.startDate ? item.startDate.slice(0, 10) : "";
  form.requirements.value = (item.requirements || []).join("\n");
  document.getElementById("admissionFormTitle").textContent = "Edit Admission";
  document.getElementById("cancelAdmissionEdit")?.classList.remove("hidden");
}

function resetAdmissionForm() {
  editingAdmissionId = null;
  document.getElementById("admissionForm")?.reset();
  document.getElementById("admissionFormTitle").textContent = "Add Admission";
  document.getElementById("cancelAdmissionEdit")?.classList.add("hidden");
}

async function deleteAdmission(id) {
  if (!window.confirm("Delete this admission record?")) return;
  try {
    await api.delete(`/admin/admissions/${id}`);
    ui.toast("Admission deleted", "success");
    await loadAdmissions();
  } catch (error) {
    ui.toast(error.message, "error");
  }
}

async function loadFees() {
  const table = document.getElementById("feesTableBody");
  if (!table) return;
  table.innerHTML = '<tr><td colspan="4" class="muted">Loading...</td></tr>';

  try {
    const response = await api.get("/admin/fees");
    const fees = response.fees || [];

    if (fees.length === 0) {
      table.innerHTML =
        '<tr><td colspan="4" class="muted">No fee records added yet.</td></tr>';
      return;
    }

    table.innerHTML = fees
      .map(
        (item) => `
        <tr>
          <td>${escapeHtml(item.className)}</td>
          <td>₹${Number(item.amount || 0).toLocaleString()}</td>
          <td>${escapeHtml(item.details)}</td>
          <td>
            <button type="button" class="button-secondary" data-edit-fee="${item._id}">Edit</button>
            <button type="button" class="button-danger" data-delete-fee="${item._id}">Delete</button>
          </td>
        </tr>
      `,
      )
      .join("");

    fees.forEach((item) => {
      document
        .querySelector(`[data-edit-fee="${item._id}"]`)
        ?.addEventListener("click", () => fillFeeForm(item));
      document
        .querySelector(`[data-delete-fee="${item._id}"]`)
        ?.addEventListener("click", () => deleteFee(item._id));
    });
  } catch (error) {
    table.innerHTML = `<tr><td colspan="4" class="muted">${escapeHtml(error.message)}</td></tr>`;
  }
}

async function onFeeSubmit(event) {
  event.preventDefault();
  const form = event.currentTarget;

  const payload = {
    className: form.className.value.trim(),
    amount: Number(form.amount.value),
    details: form.details.value.trim(),
  };

  try {
    if (editingFeeId) {
      await api.put(`/admin/fees/${editingFeeId}`, payload);
      ui.toast("Fee updated", "success");
    } else {
      await api.post("/admin/fees", payload);
      ui.toast("Fee record added", "success");
    }
    resetFeeForm();
    await loadFees();
  } catch (error) {
    ui.toast(error.message, "error");
  }
}

function fillFeeForm(item) {
  editingFeeId = item._id;
  const form = document.getElementById("feeForm");
  if (!form) return;

  form.className.value = item.className || "";
  form.amount.value = item.amount || "";
  form.details.value = item.details || "";
  document.getElementById("feeFormTitle").textContent = "Edit Fee Record";
  document.getElementById("cancelFeeEdit")?.classList.remove("hidden");
}

function resetFeeForm() {
  editingFeeId = null;
  document.getElementById("feeForm")?.reset();
  document.getElementById("feeFormTitle").textContent = "Add Fee Record";
  document.getElementById("cancelFeeEdit")?.classList.add("hidden");
}

async function deleteFee(id) {
  if (!window.confirm("Delete this fee record?")) return;
  try {
    await api.delete(`/admin/fees/${id}`);
    ui.toast("Fee deleted", "success");
    await loadFees();
  } catch (error) {
    ui.toast(error.message, "error");
  }
}

async function loadAbout() {
  try {
    const response = await api.get("/admin/about");
    const about = response.about || {};

    document.getElementById("aboutDescription").value = about.description || "";
    document.getElementById("aboutVision").value = about.vision || "";
    document.getElementById("aboutMission").value = about.mission || "";
    document.getElementById("aboutSchoolName").value =
      about.schoolName || "J.C. Memorial School, Nagra, Ballia";
    document.getElementById("aboutHeroImage").value =
      about.heroImage || "/images/school-banner.png";
  } catch (error) {
    ui.toast(error.message, "error");
  }
}

async function onAboutSubmit(event) {
  event.preventDefault();
  const form = event.currentTarget;

  const payload = {
    description: form.description.value.trim(),
    vision: form.vision.value.trim(),
    mission: form.mission.value.trim(),
    schoolName: form.schoolName.value.trim(),
    heroImage: form.heroImage.value.trim(),
  };

  try {
    await api.put("/admin/about", payload);
    ui.toast("About section updated", "success");
  } catch (error) {
    ui.toast(error.message, "error");
  }
}

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
