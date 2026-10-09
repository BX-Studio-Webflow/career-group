// bin/live-reload.js
new EventSource(`${"http://localhost:3000"}/esbuild`).addEventListener("change", () => location.reload());

// shared/accordion.ts
function devTarget(name) {
  return `[dev-target="${name}"]`;
}
function whenWebflowReady(run) {
  const webflow = window.Webflow;
  if (webflow && !Array.isArray(webflow) && typeof webflow.push === "function") {
    webflow.push(run);
    return;
  }
  run();
}
var AccordionGroup = class {
  constructor(wrapper, attributes) {
    this.wrapper = wrapper;
    this.attributes = attributes;
    this.items = [];
    this.currentIndex = 0;
    this.intervalId = null;
    this.duration = attributes.duration ?? 0;
    this.activeClass = attributes.activeClass ?? "is-active";
  }
  init() {
    const itemElements = [...this.wrapper.querySelectorAll(devTarget(this.attributes.item))];
    for (const item of itemElements) {
      const header = item.querySelector(devTarget(this.attributes.header));
      const body = item.querySelector(devTarget(this.attributes.body));
      if (!header) {
        console.error(`[accordion] An item is missing [dev-target="${this.attributes.header}"].`);
        continue;
      }
      if (!body) {
        console.error(`[accordion] An item is missing [dev-target="${this.attributes.body}"].`);
        continue;
      }
      const index = this.items.length;
      header.addEventListener("click", () => {
        this.handleHeaderClick(index);
      });
      this.items.push(item);
    }
    if (this.items.length === 0) {
      console.error(`[accordion] No valid items found for [dev-target="${this.attributes.item}"].`);
      return;
    }
    this.items[0]?.classList.add(this.activeClass);
    this.startAutoCycle();
  }
  activateItem(index) {
    const item = this.items[index];
    if (!item) {
      return;
    }
    item.classList.add(this.activeClass);
    this.currentIndex = index;
  }
  handleHeaderClick(index) {
    const item = this.items[index];
    if (!item) {
      return;
    }
    item.classList.toggle(this.activeClass);
    this.currentIndex = index;
    this.stop();
    this.startAutoCycle();
  }
  startAutoCycle() {
    if (this.duration <= 0 || this.items.length < 2) {
      return;
    }
    this.intervalId = window.setInterval(() => {
      const nextIndex = (this.currentIndex + 1) % this.items.length;
      this.activateItem(nextIndex);
    }, this.duration);
  }
  stop() {
    if (this.intervalId !== null) {
      window.clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }
};
var Accordion = class {
  constructor(attributes) {
    this.attributes = attributes;
  }
  mount(root = document) {
    whenWebflowReady(() => {
      this.mountNow(root);
    });
  }
  mountNow(root) {
    const wrappers = [...root.querySelectorAll(devTarget(this.attributes.wrapper))];
    if (wrappers.length === 0) {
      const parents = /* @__PURE__ */ new Set();
      for (const item of root.querySelectorAll(devTarget(this.attributes.item))) {
        if (item.parentElement) {
          parents.add(item.parentElement);
        }
      }
      wrappers.push(...parents);
    }
    if (wrappers.length === 0) {
      console.error(`[accordion] No elements found with [dev-target="${this.attributes.wrapper}"].`);
      return;
    }
    for (const wrapper of wrappers) {
      new AccordionGroup(wrapper, this.attributes).init();
    }
  }
};

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
async function fetchJobsNear(near) {
  const url = apiUrl(`/api/jobs?near=${encodeURIComponent(near)}`);
  if (!url) {
    throw new Error("missing_api_origin");
  }
  const response = await fetch(url, { headers: { Accept: "application/json" } });
  if (response.status === 422) {
    return null;
  }
  if (!response.ok) {
    throw new Error("jobs_failed");
  }
  const body = await response.json();
  return body.jobs ?? [];
}
async function fetchPublishedJobs() {
  const jobs = [];
  const seen = /* @__PURE__ */ new Set();
  const count = 200;
  let start2 = 0;
  while (jobs.length < 500) {
    const url = apiUrl(`/api/jobs?start=${start2}&count=${count}`);
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
    start2 += count;
    if (page.length === 0 || start2 >= (body.total ?? 0) || jobs.length >= 500) {
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

// shared/filters.ts
var DIVISION_LABELS = ["Career Group", "Syndicatebleu", "Fourth Floor", "Career Group Search", "Career Group Events", "CGC Internal"];
var JOB_FUNCTION_LABELS = [
  "Accounting",
  "Administrative",
  "C-Level Management",
  "Creative",
  "Customer Service",
  "Event Staff",
  "Family Office",
  "Fashion Design",
  "Finance",
  "Hospitality",
  "Human Resources",
  "Information Technology",
  "Legal Services",
  "Line Development",
  "Marketing",
  "Private Services",
  "Retail + Wholesale",
  "Sales",
  "Technology"
];
var SALARY_FLOORS = [4e4, 6e4, 8e4, 1e5, 12e4, 14e4, 16e4, 18e4, 2e5];
var EMPLOYMENT_VALUES = {
  "Direct Hire": ["direct hire", "permanent"],
  "Temp to Hire": ["temp to hire", "contract to hire"],
  Temp: ["temp", "temporary", "contract"]
};
var loggedOptions = /* @__PURE__ */ new Set();
function choice(label) {
  return { label, value: label };
}
var DIVISION_OPTIONS = DIVISION_LABELS.map(choice);
var EMPLOYMENT_OPTIONS = Object.keys(EMPLOYMENT_VALUES).map(choice);
var JOB_FUNCTION_OPTIONS = JOB_FUNCTION_LABELS.map(choice);
var SALARY_OPTIONS = SALARY_FLOORS.map((amount) => ({
  label: new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(amount),
  value: String(amount)
}));
function matchesEmployment(jobType, selected) {
  if (selected.length === 0) {
    return true;
  }
  const normalized = normalize(jobType);
  return selected.some((label) => {
    const values = EMPLOYMENT_VALUES[label];
    if (!values) {
      logOption(`Unknown employment type option: ${label}`);
      return false;
    }
    return values.includes(normalized);
  });
}
function matchesChoice(value, selected) {
  if (selected.length === 0) {
    return true;
  }
  const normalized = value.trim().toLowerCase();
  return selected.some((label) => label.trim().toLowerCase() === normalized);
}
function normalize(value) {
  return value.trim().toLowerCase().replace(/-/g, " ").replace(/\s+/g, " ");
}
function logOption(message) {
  if (loggedOptions.has(message)) {
    return;
  }
  loggedOptions.add(message);
  console.error(`[job.ts] ${message}`);
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
var SEARCH_SELECTOR = '[dev-target="search-input"]';
var LOCATION_SELECTOR = '[dev-target="location-search-input"]';
var CATEGORY_SELECTOR = '[dev-target="jobs-category"]';
var SALARY_MIN_SELECTOR = '[dev-target="jobs-salary-min"]';
var SALARY_MAX_SELECTOR = '[dev-target="jobs-salary-max"]';
var RESULTS_SELECTOR = '[dev-target="results"], .results';
var DIVISION_SELECTOR = '[dev-target="division-checkbox-wrapper"]';
var REMOTE_SELECTOR = '[dev-target="remote-only-checkbox-wrapper"]';
var EMPLOYMENT_SELECTOR = '[dev-target="employment-type-checkbox-wrapper"]';
var SALARY_SELECTOR = '[dev-target="salary-radio-wrapper"]';
var FUNCTION_SELECTOR = '[dev-target="job-function-checkbox-wrapper"]';
var CLEAR_SELECTOR = '[dev-target="clear"]';
var FILTER_WRAPPER_SELECTOR = '[dev-target="filter-wrapper"]';
var FILTER_TRIGGER_SELECTOR = '[dev-target="filter-trigger"]';
var FILTER_CLOSE_SELECTOR = '[dev-target="filter-close"]';
var MOBILE_FILTER_QUERY = "(max-width: 767px)";
var divisionInputs = [];
var employmentInputs = [];
var salaryInputs = [];
var functionInputs = [];
function logEarly(message) {
  console.error(`[job.ts] ${message}`);
}
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
function readSearch() {
  const marked = document.querySelector(SEARCH_SELECTOR);
  const field = marked ?? document.querySelector(QUERY_SELECTOR);
  return field?.value.trim() ?? "";
}
function readLocation() {
  return document.querySelector(LOCATION_SELECTOR)?.value.trim() ?? "";
}
function checkedValues(inputs) {
  return inputs.filter((input) => input.checked).map((input) => input.value);
}
function readSalary() {
  if (salaryInputs.length === 0) {
    return { min: readNumber(SALARY_MIN_SELECTOR), max: readNumber(SALARY_MAX_SELECTOR) };
  }
  const selected = salaryInputs.find((input) => input.checked);
  if (!selected) {
    return { min: null, max: null };
  }
  const min = Number(selected.value);
  if (!Number.isFinite(min)) {
    logEarly(`Salary option "${selected.value}" is not a number.`);
    return { min: null, max: null };
  }
  return { min, max: null };
}
function readCategories() {
  if (functionInputs.length > 0) {
    return checkedValues(functionInputs);
  }
  const category = readText(CATEGORY_SELECTOR);
  return category ? [category] : [];
}
function readFilters() {
  const salary = readSalary();
  return {
    q: readSearch(),
    divisions: checkedValues(divisionInputs),
    remoteOnly: document.querySelector(`${REMOTE_SELECTOR} input`)?.checked ?? false,
    employmentTypes: checkedValues(employmentInputs),
    categories: readCategories(),
    min: salary.min,
    max: salary.max
  };
}
function matches(job, filters, locationText) {
  if (locationText && !job.location.toLowerCase().includes(locationText.toLowerCase())) {
    return false;
  }
  if (filters.q) {
    const query = filters.q.toLowerCase();
    const haystack = `${job.title} ${job.location}`.toLowerCase();
    if (!haystack.includes(query)) {
      return false;
    }
  }
  if (!matchesChoice(job.division ?? "", filters.divisions)) {
    return false;
  }
  if (filters.remoteOnly && !job.remote) {
    return false;
  }
  if (!matchesEmployment(job.employmentType, filters.employmentTypes)) {
    return false;
  }
  if (!matchesChoice(job.category, filters.categories)) {
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
function optionId(group, label) {
  const slug = label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return `${group}-${slug}`;
}
function choiceInputs(selector, options, group) {
  if (document.querySelector(selector)) {
    return fillChoices(selector, options, group);
  }
  const inputs = [...document.querySelectorAll(`input[name="${group}"]`)];
  if (inputs.length === 0) {
    logEarly(`${group} option template is missing.`);
  }
  return inputs;
}
function fillChoices(selector, options, group) {
  const template = document.querySelector(selector);
  if (!template) {
    logEarly(`${group} option template is missing.`);
    return [];
  }
  const parent = template.parentElement;
  if (!parent) {
    logEarly(`${group} option template has no parent.`);
    return [];
  }
  if (options.length === 0) {
    logEarly(`${group} has no options.`);
    template.remove();
    return [];
  }
  const inputs = [];
  for (const option of options) {
    const node = template.cloneNode(true);
    node.removeAttribute("dev-target");
    const input = node.querySelector("input");
    const label = node.querySelector(".form_checkbox-label, .form_radio-label");
    if (!input || !label) {
      logEarly(`${group} option "${option.label}" is missing an input or label.`);
      continue;
    }
    const id = optionId(group, option.label);
    input.id = id;
    input.name = group;
    input.value = option.value;
    input.checked = false;
    label.textContent = option.label;
    label.setAttribute("for", id);
    node.querySelector(".w-checkbox-input, .w-radio-input")?.classList.remove("w--redirected-checked");
    parent.append(node);
    inputs.push(input);
  }
  template.remove();
  return inputs;
}
function syncInput(input) {
  const root = input.closest("label");
  if (!(root instanceof HTMLElement)) {
    logEarly("Filter option is missing its label.");
    return;
  }
  root.querySelector(".w-checkbox-input, .w-radio-input")?.classList.toggle("w--redirected-checked", input.checked);
}
function syncInputs(inputs) {
  for (const input of inputs) {
    syncInput(input);
  }
}
function detailHref(list, id) {
  const path = list.getAttribute("detail-path")?.trim() || "/dev/job-posting-dev";
  const url = new URL(path, window.location.origin);
  url.searchParams.set("id", String(id));
  return `${url.pathname}${url.search}`;
}
function takeCardTemplate(list) {
  const card = list.querySelector(CARD_SELECTOR);
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
function setWorksiteLabel(node, label) {
  const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT);
  let current = walker.nextNode();
  while (current) {
    if (current.textContent?.trim()) {
      current.textContent = label;
      return;
    }
    current = walker.nextNode();
  }
  node.textContent = label;
}
function fillWorksite(root, worksite) {
  const shown = worksite === "Remote" || worksite === "Hybrid";
  setShown(root.querySelector('[dev-target="remote-role"]'), shown);
  const text = root.querySelector('[dev-target="remote-text"], p.remote');
  if (text) {
    if (shown) {
      setWorksiteLabel(text, worksite);
    }
    setShown(text, shown);
  }
  const value = root.querySelector('p.hidden-filter[fs-cmsfilter-field="remote"]');
  if (value) {
    value.textContent = worksite === "Remote" ? "Yes" : worksite === "Hybrid" ? "Hybrid" : "No";
  }
}
function fillCard(card, job, href) {
  const links = card instanceof HTMLAnchorElement ? [card, ...card.querySelectorAll("a")] : [...card.querySelectorAll("a")];
  for (const link of links) {
    link.href = href;
  }
  if (links.length === 0) {
    card.addEventListener("click", () => {
      window.location.assign(href);
    });
  }
  setField(card, "title", job.title);
  setField(card, "location", job.location);
  setField(card, "type", job.employmentType);
  setField(card, "category", job.category);
  fillSalary(card, job);
  fillDivision(card, job.division?.trim() ?? "");
  fillWorksite(card, job.worksite?.trim() || (job.remote ? "Remote" : ""));
  const posted = card.querySelector('[dev-target="date-posted"], .date-field-hidden');
  if (posted && job.publishedAt != null) {
    posted.textContent = formatPostedDate(job.publishedAt);
  }
  setShown(card.querySelector(".new-job-text"), isNewJob(job.publishedAt));
  const preview = job.preview?.trim() ?? "";
  card.querySelectorAll('[dev-target="preview-text"], [fs-cmsfilter-field="preview"]').forEach((node) => {
    node.textContent = preview;
  });
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
function render(list, template, jobs, locationText = "") {
  const visible = jobs.filter((job) => matches(job, readFilters(), locationText));
  fillResults(visible.length, jobs.length);
  list.replaceChildren();
  if (visible.length === 0) {
    showError("We could not find your jobs");
    return;
  }
  hideError();
  for (const job of visible) {
    const card = template.cloneNode(true);
    fillCard(card, job, detailHref(list, job.id));
    list.append(card);
  }
}
function bindChoice(inputs, onChange) {
  for (const input of inputs) {
    input.addEventListener("change", () => {
      setTimeout(() => syncInputs(inputs), 0);
      onChange();
    });
  }
}
function bindFilters(onChange, onLocation, onClear) {
  const search = document.querySelector(SEARCH_SELECTOR) ?? document.querySelector(QUERY_SELECTOR);
  search?.addEventListener("input", onChange);
  bindChoice(divisionInputs, onChange);
  bindChoice(employmentInputs, onChange);
  bindChoice(functionInputs, onChange);
  bindChoice(salaryInputs, onChange);
  const remote = document.querySelector(`${REMOTE_SELECTOR} input`);
  remote?.addEventListener("change", () => {
    setTimeout(() => syncInput(remote), 0);
    onChange();
  });
  const location2 = document.querySelector(LOCATION_SELECTOR);
  location2?.addEventListener("input", onLocation);
  location2?.addEventListener("change", onLocation);
  document.querySelector(CLEAR_SELECTOR)?.addEventListener("click", (event) => {
    event.preventDefault();
    onClear();
  });
  for (const selector of [CATEGORY_SELECTOR, SALARY_MIN_SELECTOR, SALARY_MAX_SELECTOR]) {
    document.querySelector(selector)?.addEventListener("input", onChange);
    document.querySelector(selector)?.addEventListener("change", onChange);
  }
}
function bindMobileFilter() {
  const wrapper = document.querySelector(FILTER_WRAPPER_SELECTOR);
  if (!wrapper) {
    logEarly("Filter wrapper is missing.");
    return;
  }
  const mobile = window.matchMedia(MOBILE_FILTER_QUERY);
  const hideOnMobile = () => {
    wrapper.classList.toggle("hide", mobile.matches);
  };
  hideOnMobile();
  mobile.addEventListener("change", hideOnMobile);
  const triggers = document.querySelectorAll(FILTER_TRIGGER_SELECTOR);
  if (triggers.length === 0) {
    logEarly("Filter trigger is missing.");
  }
  for (const trigger of triggers) {
    trigger.addEventListener("click", (event) => {
      event.preventDefault();
      wrapper.classList.remove("hide");
    });
  }
  const closers = document.querySelectorAll(FILTER_CLOSE_SELECTOR);
  if (closers.length === 0) {
    logEarly("Filter close is missing.");
  }
  for (const closer of closers) {
    closer.addEventListener("click", (event) => {
      event.preventDefault();
      wrapper.classList.add("hide");
    });
  }
}
function start() {
  bindMobileFilter();
  const list = document.querySelector(LIST_SELECTOR);
  if (!list) {
    logEarly("Job list is missing.");
    return;
  }
  const template = takeCardTemplate(list);
  bindErrorCancel();
  if (!template) {
    logEarly("Job card is missing.");
    showError("Job card is missing.");
    return;
  }
  if (!readApiOrigin()) {
    logEarly("Careers API is not configured.");
    showError("Careers API is not configured.");
    return;
  }
  document.querySelector("#wf-form-Filter")?.addEventListener("submit", (event) => {
    event.preventDefault();
  });
  document.querySelector('[fs-cmsfilter-element="filters"]')?.removeAttribute("fs-cmsfilter-element");
  divisionInputs = choiceInputs(DIVISION_SELECTOR, DIVISION_OPTIONS, "division");
  employmentInputs = choiceInputs(EMPLOYMENT_SELECTOR, EMPLOYMENT_OPTIONS, "employment-type");
  salaryInputs = choiceInputs(SALARY_SELECTOR, SALARY_OPTIONS, "salary");
  functionInputs = choiceInputs(FUNCTION_SELECTOR, JOB_FUNCTION_OPTIONS, "job-function");
  new Accordion({
    wrapper: "accordion-wrapper",
    item: "accordion-item",
    header: "accordion-header",
    body: "accordion-body"
  }).mount();
  if (!document.querySelector(`${REMOTE_SELECTOR} input`)) {
    logEarly("Remote option is missing.");
  }
  if (!document.querySelector(LOCATION_SELECTOR)) {
    logEarly("Location input is missing.");
  }
  let loaded = [];
  let radius = null;
  let pending = 0;
  let locationPending = 0;
  let requestId = 0;
  const paint = () => {
    render(list, template, radius ?? loaded, radius ? "" : readLocation());
  };
  const schedule = () => {
    window.clearTimeout(pending);
    pending = window.setTimeout(paint, 150);
  };
  const applyLocation = () => {
    const place = readLocation();
    window.clearTimeout(locationPending);
    if (!place) {
      requestId += 1;
      radius = null;
      schedule();
      return;
    }
    radius = null;
    schedule();
    locationPending = window.setTimeout(() => {
      requestId += 1;
      const id = requestId;
      void fetchJobsNear(place).then((jobs) => {
        if (id !== requestId) {
          return;
        }
        if (jobs === null) {
          radius = null;
          if (!loaded.some((job) => job.location.toLowerCase().includes(place.toLowerCase()))) {
            logEarly(`Could not resolve location: ${place}`);
          }
          schedule();
          return;
        }
        radius = jobs;
        schedule();
      }).catch((error) => {
        if (id !== requestId) {
          return;
        }
        console.error("[job.ts] Location search failed", error);
        showError("Location search is unavailable right now. Please try again.");
      });
    }, 400);
  };
  const clearFilters = () => {
    const search = document.querySelector(SEARCH_SELECTOR) ?? document.querySelector(QUERY_SELECTOR);
    if (search) {
      search.value = "";
    }
    const location2 = document.querySelector(LOCATION_SELECTOR);
    if (location2) {
      location2.value = "";
    }
    for (const input of [...divisionInputs, ...employmentInputs, ...salaryInputs, ...functionInputs]) {
      input.checked = false;
    }
    const remote = document.querySelector(`${REMOTE_SELECTOR} input`);
    if (remote) {
      remote.checked = false;
    }
    syncInputs([...divisionInputs, ...employmentInputs, ...salaryInputs, ...functionInputs]);
    if (remote) {
      syncInput(remote);
    }
    const min = document.querySelector(SALARY_MIN_SELECTOR);
    const max = document.querySelector(SALARY_MAX_SELECTOR);
    if (min) {
      min.value = "";
    }
    if (max) {
      max.value = "";
    }
    const category = document.querySelector(CATEGORY_SELECTOR);
    if (category) {
      category.value = "";
    }
    requestId += 1;
    window.clearTimeout(locationPending);
    radius = null;
    paint();
  };
  bindFilters(schedule, applyLocation, clearFilters);
  list.textContent = "Loading jobs\u2026";
  void fetchPublishedJobs().then((jobs) => {
    loaded = jobs;
    fillCategories(jobs);
    paint();
  }).catch((error) => {
    console.error("[job.ts] Job list failed", error);
    list.textContent = "";
    showError("Jobs could not be loaded. Please try again.");
  });
}
start();
//# sourceMappingURL=jobs.js.map
