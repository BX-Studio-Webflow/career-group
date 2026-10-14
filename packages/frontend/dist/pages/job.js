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
  try {
    const payload = await response.json();
    return {
      ok: response.ok && payload.ok === true,
      alreadyApplied: payload.alreadyApplied,
      resumeAttached: payload.resumeAttached,
      message: payload.message
    };
  } catch (error) {
    console.error("[Careers] Application response was not readable.", error);
    return { ok: false, message: "Your application could not be submitted. Please try again." };
  }
}

// shared/apply.ts
var MAX_RESUME_BYTES = 10 * 1024 * 1024;
var RESUME_EXTENSIONS = /* @__PURE__ */ new Set(["pdf", "doc", "docx"]);
function value(form2, target) {
  const field = form2.querySelector(`[dev-target="${target}"]`);
  return field?.value.trim() ?? "";
}
function isEmail(value2) {
  return value2.length <= 100 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value2);
}
function isHttpUrl(value2) {
  try {
    const url = new URL(value2);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}
function resumeError(file) {
  if (file.size > MAX_RESUME_BYTES) {
    return "Resume must be 10 MB or smaller.";
  }
  const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
  if (!RESUME_EXTENSIONS.has(extension)) {
    return "Resume must be a PDF, DOC, or DOCX file.";
  }
  return null;
}
var MESSAGE_TARGETS = [
  ["first name", "first-name"],
  ["last name", "last-name"],
  ["email", "email"],
  ["phone", "phone"],
  ["city", "city"],
  ["state", "state"],
  ["heard about", "referral"],
  ["linkedin", "linkedin-url"],
  ["portfolio", "porfolio"],
  ["resume", "file-upload"]
];
function fieldError(target, message) {
  return { target, message };
}
function textError(target, text, emptyMessage, limit, longMessage) {
  if (!text) {
    return fieldError(target, emptyMessage);
  }
  if (text.length > limit) {
    return fieldError(target, longMessage);
  }
  return null;
}
function urlError(target, url, longMessage, invalidMessage) {
  if (!url) {
    return null;
  }
  if (url.length > 100) {
    return fieldError(target, longMessage);
  }
  if (!isHttpUrl(url)) {
    return fieldError(target, invalidMessage);
  }
  return null;
}
function fieldErrors(form2) {
  const resume = form2.querySelector('[dev-target="file-upload"]')?.files?.[0];
  const resumeMessage = !resume || resume.size === 0 ? "Attach a resume." : resumeError(resume);
  return [
    textError("first-name", value(form2, "first-name"), "Enter a first name.", 50, "Enter a shorter first name."),
    textError("last-name", value(form2, "last-name"), "Enter a last name.", 50, "Enter a shorter last name."),
    isEmail(value(form2, "email")) ? null : fieldError("email", "Enter a valid email address."),
    textError("phone", value(form2, "phone"), "Enter a phone number.", 50, "Enter a shorter phone number."),
    textError("city", value(form2, "city"), "Enter a city.", 100, "Enter a shorter city."),
    textError("state", value(form2, "state"), "Enter a state.", 100, "Enter a shorter state."),
    value(form2, "referral") ? null : fieldError("referral", "Select how you heard about us."),
    urlError("linkedin-url", value(form2, "linkedin-url"), "Enter a shorter LinkedIn URL.", "Enter a valid LinkedIn URL."),
    urlError("porfolio", value(form2, "porfolio"), "Enter a shorter portfolio URL.", "Enter a valid portfolio URL."),
    resumeMessage ? fieldError("file-upload", resumeMessage) : null
  ].filter((error) => error !== null);
}
function targetForMessage(message) {
  const text = message.toLowerCase();
  return MESSAGE_TARGETS.find(([needle]) => text.includes(needle))?.[1] ?? null;
}
function applicationFormData(form2) {
  const errors = fieldErrors(form2);
  if (errors.length > 0) {
    return {
      ok: false,
      message: errors.map((error) => error.message).join(" "),
      targets: errors.map((error) => error.target).filter(Boolean)
    };
  }
  const firstName = value(form2, "first-name");
  const lastName = value(form2, "last-name");
  const email = value(form2, "email");
  const phone = value(form2, "phone");
  const city = value(form2, "city");
  const state = value(form2, "state");
  const referral = value(form2, "referral");
  const linkedinUrl = value(form2, "linkedin-url");
  const portfolioUrl = value(form2, "porfolio");
  const resume = form2.querySelector('[dev-target="file-upload"]')?.files?.[0];
  const body = new FormData();
  body.set("firstName", firstName);
  body.set("lastName", lastName);
  body.set("email", email);
  body.set("phone", phone);
  body.set("city", city);
  body.set("state", state);
  body.set("referral", referral);
  if (linkedinUrl) {
    body.set("linkedinUrl", linkedinUrl);
  }
  if (portfolioUrl) {
    body.set("portfolioUrl", portfolioUrl);
  }
  if (resume && resume.size > 0) {
    body.set("resume", resume);
  }
  return { ok: true, body };
}
function clearFieldErrors(form2) {
  form2.querySelectorAll(".is-error").forEach((field) => {
    field.classList.remove("is-error");
  });
}
function markFieldErrors(form2, targets) {
  clearFieldErrors(form2);
  for (const target of targets) {
    form2.querySelector(`[dev-target="${target}"]`)?.classList.add("is-error");
  }
}

// shared/recaptcha.ts
var ACTION = "apply";
var loading = null;
function siteKey() {
  const runtime = window.GOOGLE_RECAPTCHA_SITE_KEY?.trim() ?? "";
  if (runtime) {
    return runtime;
  }
  return "".trim();
}
function loadScript(key) {
  if (window.grecaptcha) {
    return Promise.resolve();
  }
  if (!loading) {
    loading = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = `https://www.google.com/recaptcha/api.js?render=${encodeURIComponent(key)}`;
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () => {
        loading = null;
        reject(new Error("recaptcha_script"));
      };
      document.head.appendChild(script);
    });
  }
  return loading;
}
async function recaptchaToken() {
  const key = siteKey();
  if (!key) {
    return "";
  }
  try {
    await loadScript(key);
    const grecaptcha = window.grecaptcha;
    if (!grecaptcha) {
      return null;
    }
    const token = await new Promise((resolve, reject) => {
      grecaptcha.ready(() => {
        grecaptcha.execute(key, { action: ACTION }).then(resolve, reject);
      });
    });
    return token.trim() || null;
  } catch (error) {
    console.error("[Careers] reCAPTCHA failed", error);
    return null;
  }
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
var FORM_ERROR_WRAPPER_SELECTOR = '[dev-target="form-error-wrapper"]';
function formErrorText(wrapper) {
  return wrapper.querySelector('[dev-target="form-error-text"]') ?? wrapper.querySelector('[dev-target="error-text"]') ?? wrapper.querySelector("p, span, div") ?? wrapper;
}
function showFormError(message) {
  const wrapper = document.querySelector(FORM_ERROR_WRAPPER_SELECTOR);
  if (!wrapper) {
    showError(message);
    return;
  }
  const text = formErrorText(wrapper);
  if (text === wrapper && wrapper.childElementCount > 0) {
    showError(message);
    return;
  }
  text.textContent = message;
  wrapper.classList.remove("hide");
  document.querySelector('[dev-target="success-state"]')?.classList.add("hide");
}
function hideFormError() {
  document.querySelector(FORM_ERROR_WRAPPER_SELECTOR)?.classList.add("hide");
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
var FORM_WRAPPER_SELECTOR = '[dev-target="form-wrapper"]';
var DESCRIPTION_SELECTOR = '[dev-target="job-description"]';
var SUCCESS_SELECTOR = '[dev-target="success-state"]';
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
function setText(target, value2) {
  const node = document.querySelector(`[dev-target="${target}"]`);
  if (node) {
    node.textContent = value2;
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
  const form2 = document.querySelector(FORM_SELECTOR);
  if (form2) {
    clearFieldErrors(form2);
  }
  hideFormError();
  const success = document.querySelector(SUCCESS_SELECTOR);
  if (!success) {
    showError(message);
    return;
  }
  success.classList.remove("hide");
  document.querySelector(FORM_WRAPPER_SELECTOR)?.classList.add("hide");
  hideError();
}
function submitControl(form2) {
  return form2.querySelector('input[type="submit"], button[type="submit"]');
}
function setSubmitting(submit, waiting, label) {
  submit.disabled = waiting;
  if (submit instanceof HTMLInputElement) {
    submit.value = label;
    return;
  }
  submit.textContent = label;
}
async function submitApplicationWithCheck(id, body) {
  const token = await recaptchaToken();
  if (token === null) {
    showFormError("The security check could not be loaded. Please try again.");
    return;
  }
  if (token) {
    body.set("recaptchaToken", token);
  }
  const result = await submitApplication(id, body);
  if (!result.ok) {
    const message = result.message || "Your application could not be submitted. Please try again.";
    const target = targetForMessage(message);
    const form2 = document.querySelector(FORM_SELECTOR);
    if (target && form2) {
      markFieldErrors(form2, [target]);
    }
    showFormError(message);
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
  document.querySelector(FORM_SELECTOR)?.reset();
}
function bindForm(form2, id) {
  form2.noValidate = true;
  hideFormError();
  clearFieldErrors(form2);
  form2.addEventListener("input", (event) => {
    if (event.target instanceof HTMLElement) {
      event.target.classList.remove("is-error");
    }
  });
  form2.addEventListener("change", (event) => {
    if (event.target instanceof HTMLElement) {
      event.target.classList.remove("is-error");
    }
  });
  form2.addEventListener(
    "submit",
    (event) => {
      event.preventDefault();
      event.stopPropagation();
      const submit = submitControl(form2);
      const label = submit instanceof HTMLInputElement ? submit.value : submit?.textContent ?? "";
      const waiting = submit?.getAttribute("data-wait") || "Please wait...";
      if (submit) {
        setSubmitting(submit, true, waiting);
      }
      const parsed = applicationFormData(form2);
      if (!parsed.ok) {
        markFieldErrors(form2, parsed.targets);
        showFormError(parsed.message);
        if (submit) {
          setSubmitting(submit, false, label);
        }
        return;
      }
      clearFieldErrors(form2);
      void submitApplicationWithCheck(id, parsed.body).catch((error) => {
        console.error("[Careers] Application failed", error);
        showFormError("Your application could not be submitted. Please try again.");
      }).finally(() => {
        if (submit) {
          setSubmitting(submit, false, label);
        }
      });
    },
    true
  );
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
      fillJob(
        job.title,
        job.location,
        job.employmentType,
        job.category,
        formatSalaryRange(job),
        job.description,
        job.division?.trim() ?? ""
      );
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
