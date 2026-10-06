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
async function fetchPublishedJobs() {
  const jobs = [];
  const seen = /* @__PURE__ */ new Set();
  const count = 200;
  let start = 0;
  while (jobs.length < 500) {
    const url = apiUrl(`/api/jobs?start=${start}&count=${count}`);
    if (!url) {
      throw new Error("missing_api_origin");
    }
    const response = await fetch(url, { headers: { Accept: "application/json" } });
    if (!response.ok) {
      throw new Error("jobs_failed");
    }
    const body = await response.json();
    const page = body.jobs ?? [];
    for (const job of page) {
      if (!seen.has(job.id)) {
        seen.add(job.id);
        jobs.push(job);
      }
    }
    start += count;
    if (page.length === 0 || start >= (body.total ?? 0) || jobs.length >= 500) {
      break;
    }
  }
  return jobs;
}

// shared/divisions.ts
var DIVISION_CHIP_COLORS = {
  "career group": "#b9373d",
  syndicatebleu: "#00abc7",
  "fourth floor": "#51afe2",
  "career group search": "#bab4ae"
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
var NEW_JOB_DAYS = 4;
function isNewJob(publishedAt, now = Date.now()) {
  if (publishedAt == null) {
    return false;
  }
  const cutoff = new Date(now);
  cutoff.setHours(0, 0, 0, 0);
  cutoff.setDate(cutoff.getDate() - NEW_JOB_DAYS);
  return publishedAt >= cutoff.getTime();
}
function formatPostedDate(publishedAt) {
  const date = new Date(publishedAt);
  const year = String(date.getFullYear()).slice(-2);
  return `${date.getDate()}.${date.getMonth() + 1}.${year}`;
}
function annualSalary(job) {
  if (job.salary == null) {
    return null;
  }
  const unit = job.salaryUnit.toLowerCase();
  if (unit.includes("hour")) {
    return job.salary * 2080;
  }
  if (unit.includes("day")) {
    return job.salary * 260;
  }
  if (unit.includes("week")) {
    return job.salary * 52;
  }
  if (unit.includes("month")) {
    return job.salary * 12;
  }
  return job.salary;
}

// pages/jobs.ts
var LIST_SELECTOR = '[dev-target="jobs-list"]';
var CARD_SELECTOR = '[dev-target="job-card-item"]';
var QUERY_SELECTOR = '[dev-target="jobs-query"]';
var LOCATION_SELECTOR = '[dev-target="jobs-location"]';
var CATEGORY_SELECTOR = '[dev-target="jobs-category"]';
var SALARY_MIN_SELECTOR = '[dev-target="jobs-salary-min"]';
var SALARY_MAX_SELECTOR = '[dev-target="jobs-salary-max"]';
var RESULTS_SELECTOR = '[dev-target="results"], .results';
function readText(selector) {
  const field = document.querySelector(selector);
  return field?.value.trim() ?? "";
}
function readNumber(selector) {
  const value = readText(selector).replace(/[$,]/g, "");
  if (!value) {
    return null;
  }
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return null;
  }
  return parsed;
}
function readFilters() {
  return {
    q: readText(QUERY_SELECTOR),
    location: readText(LOCATION_SELECTOR),
    category: readText(CATEGORY_SELECTOR),
    min: readNumber(SALARY_MIN_SELECTOR),
    max: readNumber(SALARY_MAX_SELECTOR)
  };
}
function matches(job, filters) {
  if (filters.q && !job.title.toLowerCase().includes(filters.q.toLowerCase())) {
    return false;
  }
  if (filters.location && !job.location.toLowerCase().includes(filters.location.toLowerCase())) {
    return false;
  }
  if (filters.category && job.category.toLowerCase() !== filters.category.toLowerCase()) {
    return false;
  }
  if (filters.min == null && filters.max == null) {
    return true;
  }
  const annual = annualSalary(job);
  if (annual == null) {
    return false;
  }
  if (filters.min != null && annual < filters.min) {
    return false;
  }
  if (filters.max != null && annual > filters.max) {
    return false;
  }
  return true;
}
function detailHref(list2, id) {
  const path = list2.getAttribute("detail-path")?.trim() || window.location.pathname;
  const url = new URL(path, window.location.origin);
  url.searchParams.set("id", String(id));
  return `${url.pathname}${url.search}`;
}
function takeCardTemplate(list2) {
  const card = list2.querySelector(CARD_SELECTOR);
  if (!card) {
    return null;
  }
  const template = card.cloneNode(true);
  card.remove();
  return template;
}
function setShown(node, shown) {
  node?.classList.toggle("w-condition-invisible", !shown);
}
function setField(root, field, value) {
  const node = root.querySelector(`[fs-cmsfilter-field="${field}"]`);
  if (node) {
    node.textContent = value;
  }
}
function fillSalary(root, job) {
  const block = root.querySelector(".salary");
  const minAmount = job.salaryMin ?? null;
  const maxAmount = job.salaryMax ?? job.salary;
  const ranged = minAmount != null && maxAmount != null && minAmount !== maxAmount;
  const max = block?.querySelector('[fs-cmsfilter-field="salary"]') ?? null;
  const paragraphs = block ? [...block.querySelectorAll("p")] : [];
  const divider = paragraphs.find((paragraph) => paragraph.hasAttribute("salary-divider") || paragraph.textContent?.trim() === "-") ?? null;
  const min = paragraphs.find((paragraph) => paragraph !== max && paragraph !== divider && !paragraph.classList.contains("hidden-filter")) ?? null;
  if (max) {
    max.textContent = formatCardSalary(ranged ? maxAmount : maxAmount ?? minAmount, job.salaryUnit);
  }
  if (min) {
    min.textContent = ranged ? formatCardSalary(minAmount, job.salaryUnit) : "";
  }
  setShown(min, ranged);
  setShown(divider, ranged);
  setShown(block, maxAmount != null || minAmount != null);
  setShown(root.querySelector('[dev-target="salary-max-pre-div"]'), maxAmount != null || minAmount != null);
}
function fillDivision(root, division) {
  const chip = root.querySelector('[dev-target="division-chip"], .division-chip');
  if (!chip) {
    return;
  }
  const label = chip.querySelector("p");
  if (!division) {
    setShown(chip, false);
    return;
  }
  setShown(chip, true);
  if (label) {
    label.textContent = division;
  }
  const color = divisionChipColor(division);
  if (color) {
    chip.style.backgroundColor = color;
    return;
  }
  chip.style.removeProperty("background-color");
}
function fillRemote(root, remote) {
  setShown(root.querySelector('[dev-target="remote-role"]'), remote);
  setShown(root.querySelector('[dev-target="remote-text"], p.remote'), remote);
  const value = root.querySelector('p.hidden-filter[fs-cmsfilter-field="remote"]');
  if (value) {
    value.textContent = remote ? "Yes" : "No";
  }
}
function fillCard(card, job, href) {
  if (card instanceof HTMLAnchorElement) {
    card.href = href;
  }
  setField(card, "title", job.title);
  setField(card, "location", job.location);
  setField(card, "type", job.employmentType);
  setField(card, "category", job.category);
  fillSalary(card, job);
  fillDivision(card, job.division?.trim() ?? "");
  fillRemote(card, job.remote === true);
  const posted = card.querySelector('[dev-target="date-posted"], .date-field-hidden');
  if (posted && job.publishedAt != null) {
    posted.textContent = formatPostedDate(job.publishedAt);
  }
  setShown(card.querySelector(".new-job-text"), isNewJob(job.publishedAt));
  const preview = card.querySelector('[fs-cmsfilter-field="preview"]');
  if (preview) {
    preview.textContent = "";
  }
}
function fillCategories(jobs) {
  const select = document.querySelector('select[dev-target="jobs-category"]');
  if (!select || select.options.length > 1) {
    return;
  }
  const names = [...new Set(jobs.map((job) => job.category).filter(Boolean))].sort((left, right) => left.localeCompare(right));
  for (const name of names) {
    const option = document.createElement("option");
    option.value = name;
    option.textContent = name;
    select.append(option);
  }
}
function resultsRoot() {
  const marked = document.querySelector(RESULTS_SELECTOR);
  if (!marked) {
    return null;
  }
  if (marked.querySelector('[fs-cmsfilter-element="results-count"]')) {
    return marked;
  }
  const parent = marked.closest(".results");
  if (parent?.querySelector('[fs-cmsfilter-element="results-count"]')) {
    return parent;
  }
  return marked;
}
function fillResults(shown, total) {
  const root = resultsRoot();
  if (!root) {
    return;
  }
  let shownNode = root.querySelector('[fs-cmsfilter-element="results-count"]');
  let totalNode = root.querySelector('[fs-cmsfilter-element="items-count"]');
  if (!shownNode || !totalNode) {
    const showing = document.createElement("div");
    showing.textContent = "Showing";
    shownNode = document.createElement("div");
    shownNode.setAttribute("fs-cmsfilter-element", "results-count");
    const resultsLabel = document.createElement("div");
    resultsLabel.textContent = "Results";
    const of = document.createElement("div");
    of.textContent = "of";
    totalNode = document.createElement("div");
    totalNode.setAttribute("fs-cmsfilter-element", "items-count");
    root.replaceChildren(showing, shownNode, resultsLabel, of, totalNode);
  }
  shownNode.textContent = String(shown);
  totalNode.textContent = String(total);
}
function render(list2, template, jobs) {
  const visible = jobs.filter((job) => matches(job, readFilters()));
  fillResults(visible.length, jobs.length);
  list2.replaceChildren();
  if (visible.length === 0) {
    const empty = document.createElement("p");
    empty.setAttribute("dev-target", "jobs-empty");
    empty.textContent = "No jobs match your search.";
    list2.append(empty);
    return;
  }
  for (const job of visible) {
    const card = template.cloneNode(true);
    fillCard(card, job, detailHref(list2, job.id));
    list2.append(card);
  }
}
function bindFilters(onChange) {
  const selectors = [QUERY_SELECTOR, LOCATION_SELECTOR, CATEGORY_SELECTOR, SALARY_MIN_SELECTOR, SALARY_MAX_SELECTOR];
  for (const selector of selectors) {
    document.querySelector(selector)?.addEventListener("input", onChange);
    document.querySelector(selector)?.addEventListener("change", onChange);
  }
}
var list = document.querySelector(LIST_SELECTOR);
if (list) {
  const template = takeCardTemplate(list);
  bindErrorCancel();
  if (!template) {
    showError("Job card is missing.");
  } else if (!readApiOrigin()) {
    showError("Careers API is not configured.");
  } else {
    let loaded = [];
    let pending = 0;
    const schedule = () => {
      window.clearTimeout(pending);
      pending = window.setTimeout(() => render(list, template, loaded), 150);
    };
    list.textContent = "Loading jobs\u2026";
    bindFilters(schedule);
    void fetchPublishedJobs().then((jobs) => {
      loaded = jobs;
      fillCategories(jobs);
      render(list, template, jobs);
    }).catch((error) => {
      console.error("[Careers] Job list failed", error);
      list.textContent = "";
      showError("Jobs could not be loaded. Please try again.");
    });
  }
}
//# sourceMappingURL=jobs.js.map
