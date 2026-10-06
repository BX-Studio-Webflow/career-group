// bin/live-reload.js
new EventSource(`${"http://localhost:3000"}/esbuild`).addEventListener("change", () => location.reload());

// shared/api.ts
function readApiOrigin() {
  const runtime = window.CAREERS_API_ORIGIN?.replace(/\/$/, "") ?? "";
  if (runtime) {
    return runtime;
  }
  if ("http://localhost:8787") {
    return "http://localhost:8787".replace(/\/$/, "");
  }
  return null;
}
function apiUrl(path) {
  const origin = readApiOrigin();
  if (!origin) {
    return null;
  }
  return `${origin}${path}`;
}
async function fetchJob(id) {
  const url = apiUrl(`/api/jobs/${id}`);
  if (!url) {
    throw new Error("missing_api_origin");
  }
  const response = await fetch(url, { headers: { Accept: "application/json" } });
  if (response.status === 404) {
    return null;
  }
  if (!response.ok) {
    throw new Error("job_failed");
  }
  const body = await response.json();
  return body.job ?? null;
}
async function submitApplication(id, body) {
  const url = apiUrl(`/api/jobs/${id}/apply`);
  if (!url) {
    return { ok: false, message: "Careers API is not configured." };
  }
  const response = await fetch(url, {
    method: "POST",
    headers: { Accept: "application/json" },
    body
  });
  const payload = await response.json();
  return {
    ok: response.ok && payload.ok === true,
    alreadyApplied: payload.alreadyApplied,
    resumeAttached: payload.resumeAttached,
    message: payload.message
  };
}

// shared/errors.ts
var ERROR_WRAPPER_SELECTOR = '[dev-target="error-wrapper"]';
var ERROR_TEXT_SELECTOR = '[dev-target="error-text"]';
var ERROR_CANCEL_SELECTOR = '[dev-target="cancel"]';
function showError(message) {
  const wrapper = document.querySelector(ERROR_WRAPPER_SELECTOR);
  const text = wrapper?.querySelector(ERROR_TEXT_SELECTOR);
  if (!wrapper || !text) {
    return;
  }
  text.textContent = message;
  wrapper.classList.remove("hide");
}
function hideError() {
  document.querySelector(ERROR_WRAPPER_SELECTOR)?.classList.add("hide");
}
function bindErrorCancel() {
  document.querySelectorAll(ERROR_CANCEL_SELECTOR).forEach((cancel) => {
    cancel.addEventListener("click", hideError);
  });
}

// shared/jobs.ts
function formatSalary(salary, unit) {
  if (salary == null) {
    return "";
  }
  const amount = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0
  }).format(salary);
  return unit ? `${amount} ${unit}` : amount;
}
function formatSalaryRange(job) {
  const min = job.salaryMin ?? null;
  const max = job.salaryMax ?? job.salary;
  if (min != null && max != null && min !== max) {
    return `${formatCardSalary(min, job.salaryUnit)}\u2013${formatCardSalary(max, job.salaryUnit)}`;
  }
  return formatSalary(max ?? min, job.salaryUnit);
}
function formatCardSalary(salary, unit) {
  if (salary == null) {
    return "";
  }
  const amount = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: salary % 1 === 0 ? 0 : 2
  }).format(salary);
  const normalized = unit.toLowerCase();
  if (normalized.includes("hour")) {
    return `${amount}/hr`;
  }
  return amount;
}

// pages/job.ts
var FORM_SELECTOR = '[dev-target="apply-form"]';
var DESCRIPTION_SELECTOR = '[dev-target="job-description"]';
var SUCCESS_SELECTOR = '[dev-target="apply-success"]';
function setText(target, value) {
  const node = document.querySelector(`[dev-target="${target}"]`);
  if (node) {
    node.textContent = value;
  }
}
function fillJob(title, location2, employmentType, category, salary, description2) {
  setText("job-title", title);
  setText("job-location", location2);
  setText("job-type", employmentType);
  setText("job-category", category);
  setText("job-salary", salary);
  document.title = title;
  const descriptionNode = document.querySelector(DESCRIPTION_SELECTOR);
  if (descriptionNode) {
    descriptionNode.innerHTML = description2;
  }
}
function showSuccess(message) {
  const success = document.querySelector(SUCCESS_SELECTOR);
  if (!success) {
    showError(message);
    return;
  }
  success.textContent = message;
  success.classList.remove("hide");
  hideError();
}
function bindForm(form2, id) {
  form2.addEventListener("submit", (event) => {
    event.preventDefault();
    const submit = form2.querySelector('button[type="submit"]');
    if (submit) {
      submit.disabled = true;
    }
    void submitApplication(id, new FormData(form2)).then((result) => {
      if (!result.ok) {
        showError(result.message || "Your application could not be submitted. Please try again.");
        return;
      }
      if (result.alreadyApplied && result.resumeAttached === false) {
        showSuccess("You already applied for this job, and the resume could not be attached.");
        return;
      }
      if (result.alreadyApplied) {
        showSuccess("You already applied for this job.");
        return;
      }
      if (result.resumeAttached === false) {
        showSuccess("Your application was submitted, but the resume could not be attached.");
        return;
      }
      showSuccess("Your application was submitted.");
      form2.reset();
    }).catch((error) => {
      console.error("[Careers] Application failed", error);
      showError("Your application could not be submitted. Please try again.");
    }).finally(() => {
      if (submit) {
        submit.disabled = false;
      }
    });
  });
}
var form = document.querySelector(FORM_SELECTOR);
var description = document.querySelector(DESCRIPTION_SELECTOR);
if (form || description) {
  bindErrorCancel();
  const id = new URLSearchParams(window.location.search).get("id")?.trim() ?? "";
  if (!/^[1-9]\d{0,14}$/.test(id)) {
    showError("This job link is incomplete.");
  } else {
    void fetchJob(id).then((job) => {
      if (!job) {
        showError("This job is no longer available.");
        return;
      }
      fillJob(job.title, job.location, job.employmentType, job.category, formatSalaryRange(job), job.description);
      if (form) {
        bindForm(form, id);
      }
    }).catch((error) => {
      console.error("[Careers] Job detail failed", error);
      showError("This job could not be loaded. Please try again.");
    });
  }
}
//# sourceMappingURL=job.js.map
