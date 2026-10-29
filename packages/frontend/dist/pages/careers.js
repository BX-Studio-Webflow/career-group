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

// pages/careers.ts
var ROW_SELECTOR = '[dev-target="roles-row"]';
var CARD_SELECTOR = '[dev-target="roles-card"]';
function log(message) {
  console.error(`[careers.ts] ${message}`);
}
function setText(root, target, value) {
  const node = root.querySelector(`[dev-target="${target}"]`);
  if (node) {
    node.textContent = value;
  }
}
function detailHref(row, id) {
  const path = row.getAttribute("detail-path")?.trim() || "/dev/job-posting-dev";
  const url = new URL(path, window.location.origin);
  url.searchParams.set("id", String(id));
  return `${url.pathname}${url.search}`;
}
function fillCard(card, job, href) {
  const division = job.division?.trim() ?? "";
  const chip = card.querySelector('[dev-target="division-chip"]');
  if (chip) {
    chip.classList.toggle("hide", division.length === 0);
    const color = divisionChipColor(division);
    if (color) {
      chip.style.backgroundColor = color;
    } else {
      chip.style.removeProperty("background-color");
    }
  }
  setText(card, "division-text", division);
  setText(card, "title", job.title);
  setText(card, "location", job.location);
  const salary = formatSalaryRange(job);
  setText(card, "salary", salary);
  card.querySelector('[dev-target="salary"]')?.closest(".salary")?.classList.toggle("hide", salary.length === 0);
  const apply = card.querySelector('[dev-target="apply-cta"]');
  if (apply) {
    apply.href = href;
  }
}
function takeTemplate(row) {
  const card = row.querySelector(CARD_SELECTOR);
  if (!card) {
    return null;
  }
  const template = card.cloneNode(true);
  card.remove();
  return template;
}
function careersLimit() {
  const limit = window.CAREERS_LIMIT;
  if (typeof limit !== "number" || !Number.isFinite(limit) || limit < 1) {
    return null;
  }
  return Math.floor(limit);
}
function render(row, template, jobs) {
  row.replaceChildren();
  for (const job of jobs) {
    const card = template.cloneNode(true);
    fillCard(card, job, detailHref(row, job.id));
    row.append(card);
  }
}
function start() {
  const rows = [...document.querySelectorAll(ROW_SELECTOR)];
  if (rows.length === 0) {
    log("Roles row is missing.");
    return;
  }
  const ready = rows.flatMap((row) => {
    const template = takeTemplate(row);
    return template ? [{ row, template }] : [];
  });
  if (ready.length === 0) {
    log("Roles card is missing.");
    return;
  }
  if (!readApiOrigin()) {
    log("Careers API is not configured.");
    return;
  }
  void fetchPublishedJobs().then((jobs) => {
    const limit = careersLimit();
    const visible = limit === null ? jobs : jobs.slice(0, limit);
    for (const { row, template } of ready) {
      render(row, template, visible);
    }
  }).catch((error) => {
    console.error("[careers.ts] Job list failed", error);
  });
}
start();
//# sourceMappingURL=careers.js.map
