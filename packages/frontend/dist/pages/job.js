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

// shared/divisions.ts
var DIVISION_CHIP_COLORS = {
  "career group": "#b9373d",
  syndicatebleu: "#00abc7",
  "fourth floor": "#51afe2",
  "career group search": "#bab4ae",
  "career group events": "#f62dae"
};
function divisionChipColor(division) {
  return DIVISION_CHIP_COLORS[division.trim().toLowerCase()] ?? null;
}

// shared/errors.ts
var ERROR_WRAPPER_SELECTOR = '[dev-target="error-wrapper"]';
var ERROR_TEXT_SELECTOR = '[dev-target="error-text"]';
var ERROR_CANCEL_SELECTOR = '[dev-target="cancel"]';
function showError(message) {
  const wrapper = document.querySelector(ERROR_WRAPPER_SELECTOR);
  const text = wrapper?.querySelector(ERROR_TEXT_SELECTOR);
  if (!wrapper || !text) {
    console.error("[job.ts] Error wrapper is missing.");
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
function formatSalaryRange(job) {
  const min = job.salaryMin ?? null;
  const max = job.salaryMax ?? job.salary;
  if (min != null && max != null && min !== max) {
    return `${formatCardSalary(min, job.salaryUnit)}\u2013${formatCardSalary(max, job.salaryUnit)}`;
  }
  return formatCardSalary(max ?? min, job.salaryUnit);
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
var DIVISION_CARDS = {
  "career group": "division-card-career-grp",
  syndicatebleu: "division-card-syndicate",
  "fourth floor": "division-card-fourth-floor",
  "career group search": "division-card-career-grp-search",
  "career group events": "division-card-career-grp-events",
  "cgc internal": "division-card-career-grp-companies"
};
var FORM_SELECTOR = '[dev-target="apply-form"]';
var DESCRIPTION_SELECTOR = '[dev-target="job-description"]';
var SUCCESS_SELECTOR = '[dev-target="apply-success"]';
var JOB_BODY_SELECTOR = '[dev-target="job-body"]';
var HIGHLIGHT_SELECTOR = '[dev-target="job-highlights"]';
var SIDE_CARD_SELECTOR = `${HIGHLIGHT_SELECTOR}, [dev-target^="division-card-"]`;
function jobBody() {
  return document.querySelector(JOB_BODY_SELECTOR);
}
function hideJobBody() {
  jobBody()?.classList.add("hide");
}
function showJobBody() {
  jobBody()?.classList.remove("hide");
}
function hideSideCards() {
  document.querySelectorAll(SIDE_CARD_SELECTOR).forEach((card) => {
    card.classList.add("hide");
  });
}
function showHighlight() {
  document.querySelector(HIGHLIGHT_SELECTOR)?.classList.remove("hide");
}
hideJobBody();
hideSideCards();
document.title = "Job";
function setText(target, value) {
  const node = document.querySelector(`[dev-target="${target}"]`);
  if (node) {
    node.textContent = value;
  }
}
function fillJob(title, location2, employmentType, category, salary, description2, division) {
  setText("job-title", title);
  setText("job-location", location2);
  setText("job-type", employmentType);
  setText("job-category", category);
  setText("job-salary", salary);
  setText("division", division);
  fillHighlight(division);
  showDivisionCard(division);
  showHighlight();
  document.title = title;
  showJobBody();
  const descriptionNode = document.querySelector(DESCRIPTION_SELECTOR);
  if (descriptionNode) {
    descriptionNode.innerHTML = description2;
  }
}
function fillHighlight(division) {
  const card = document.querySelector(HIGHLIGHT_SELECTOR);
  if (!card) {
    return;
  }
  const color = divisionChipColor(division);
  if (color) {
    card.style.backgroundColor = color;
    return;
  }
  card.style.removeProperty("background-color");
}
function showDivisionCard(division) {
  const active = DIVISION_CARDS[division.trim().toLowerCase()] ?? "";
  const cards = document.querySelectorAll('[dev-target^="division-card-"]');
  for (const card of cards) {
    card.classList.toggle("hide", card.getAttribute("dev-target") !== active);
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
    document.title = "Job not available";
    showError("This job link is incomplete.");
  } else {
    void fetchJob(id).then((job) => {
      if (!job) {
        document.title = "Job not available";
        showError("This job is no longer available.");
        return;
      }
      fillJob(job.title, job.location, job.employmentType, job.category, formatSalaryRange(job), job.description, job.division?.trim() ?? "");
      if (form) {
        bindForm(form, id);
      }
    }).catch((error) => {
      console.error("[Careers] Job detail failed", error);
      document.title = "Job not available";
      showError("This job could not be loaded. Please try again.");
    });
  }
}
//# sourceMappingURL=job.js.map
