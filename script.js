/**
 * PastCraft Coordinates — script.js
 *
 * Single-page application:
 *   • Homepage  (public) — fetches data from API, renders Markdown output
 *   • Console   (admin)  — full editor with manual + import-from-Markdown
 *
 * API_BASE must point to the Flask backend.
 * When serving frontend through Flask itself (same origin) use an empty string.
 */

const API_BASE = "";   // e.g. "http://localhost:5000" if running frontend separately

const LINE = "=".repeat(64);

// ── State ─────────────────────────────────────────────────────────────────────

const state = {
  isAdmin:     false,
  currentView: "home",    // "home" | "console"
  hasUnsaved:  false,
};

// ── Helpers ───────────────────────────────────────────────────────────────────

const $ = (sel, ctx = document) => ctx.querySelector(sel);
const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));

function api(path, options = {}) {
  const token = sessionStorage.getItem("pc_token");
  const headers = { "Content-Type": "application/json", ...(options.headers || {}) };
  if (token) headers["X-Session-Token"] = token;
  return fetch(API_BASE + path, { ...options, headers, credentials: "include" });
}

function buildMarkdown(data) {
  const lines = [];
  const spawn = (data.spawn || "").trim();
  if (spawn) lines.push(`# Spawn: ${spawn}`);

  (data.nations || []).forEach(nation => {
    lines.push(`## ${LINE}`);
    lines.push(`# ${nation.name}`);
    (nation.locations || []).forEach(loc => {
      lines.push(`### ${loc.name}: ${loc.coordinates}`);
    });
  });

  lines.push(`## ${LINE}`);
  return lines.join("\n");
}

function markUnsaved(val = true) {
  state.hasUnsaved = val;
  const badge = $("#unsaved-badge");
  val ? badge.classList.remove("hidden") : badge.classList.add("hidden");
}

// ── Confirm dialog ────────────────────────────────────────────────────────────

function showConfirm(message) {
  return new Promise(resolve => {
    const overlay = $("#confirm-modal");
    $("#confirm-msg").textContent = message;
    overlay.classList.remove("hidden");

    function cleanup(val) {
      overlay.classList.add("hidden");
      $("#confirm-ok").removeEventListener("click", onOk);
      $("#confirm-cancel").removeEventListener("click", onCancel);
      resolve(val);
    }

    const onOk     = () => cleanup(true);
    const onCancel = () => cleanup(false);
    $("#confirm-ok").addEventListener("click", onOk);
    $("#confirm-cancel").addEventListener("click", onCancel);
  });
}

// ── Navigation ────────────────────────────────────────────────────────────────

function updateNav() {
  const { isAdmin } = state;

  $("#nav-login").classList.toggle("hidden", isAdmin);
  $("#nav-logout").classList.remove("hidden");
  $("#nav-console").classList.remove("hidden");
  $("#nav-sep").classList.remove("hidden");

  if (!isAdmin) {
    $("#nav-logout").classList.add("hidden");
    $("#nav-console").classList.add("hidden");
    $("#nav-sep").classList.add("hidden");
  }
}

async function switchView(target) {
  if (target === state.currentView) return;

  if (state.currentView === "console" && state.hasUnsaved) {
    const ok = await showConfirm(
      "You have unsaved changes. Are you sure you want to leave? Your progress will be lost."
    );
    if (!ok) return;
    markUnsaved(false);
  }

  state.currentView = target;

  $("#page-home").classList.toggle("hidden", target !== "home");
  $("#page-console").classList.toggle("hidden", target !== "console");

  $$(".nav-btn").forEach(b => b.classList.remove("active"));
  $(target === "home" ? "#nav-home" : "#nav-console").classList.add("active");

  if (target === "home") loadHomepage();
  if (target === "console") loadConsole();
}

// ── Auth ──────────────────────────────────────────────────────────────────────

async function checkAuthStatus() {
  try {
    const r = await api("/api/auth/status");
    const d = await r.json();
    state.isAdmin = d.loggedIn;
    if (d.token) sessionStorage.setItem("pc_token", d.token);
  } catch {
    state.isAdmin = false;
  }
  updateNav();
}

function showLoginModal() {
  const modal = $("#login-modal");
  modal.classList.remove("hidden");
  $("#login-error").classList.add("hidden");
  $("#login-username").value = "";
  $("#login-password").value = "";
  setTimeout(() => $("#login-username").focus(), 50);
}

function hideLoginModal() {
  $("#login-modal").classList.add("hidden");
}

async function doLogin() {
  const username = $("#login-username").value.trim();
  const password = $("#login-password").value;
  const errEl    = $("#login-error");

  errEl.classList.add("hidden");

  if (!username || !password) {
    errEl.textContent = "Please enter both username and password.";
    errEl.classList.remove("hidden");
    return;
  }

  try {
    const r = await api("/api/auth/login", {
      method: "POST",
      body:   JSON.stringify({ username, password }),
    });
    const d = await r.json();

    if (!r.ok) {
      errEl.textContent = d.error || "Login failed.";
      errEl.classList.remove("hidden");
      return;
    }

    if (d.token) sessionStorage.setItem("pc_token", d.token);
    state.isAdmin = true;
    hideLoginModal();
    updateNav();
  } catch {
    errEl.textContent = "Could not reach the server. Is the backend running?";
    errEl.classList.remove("hidden");
  }
}

async function doLogout() {
  if (state.hasUnsaved) {
    const ok = await showConfirm(
      "You have unsaved changes. Logging out will discard them. Continue?"
    );
    if (!ok) return;
    markUnsaved(false);
  }

  try {
    await api("/api/auth/logout", { method: "POST" });
  } catch {}

  sessionStorage.removeItem("pc_token");
  state.isAdmin = false;
  updateNav();
  switchView("home");
}

// ── Homepage ──────────────────────────────────────────────────────────────────

async function loadHomepage() {
  const statusEl = $("#home-status");
  const codeEl   = $("code", $("#home-output"));
  statusEl.textContent = "Loading…";
  codeEl.textContent = "";

  try {
    const r = await api("/api/data");
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const data = await r.json();
    codeEl.textContent = buildMarkdown(data);
    statusEl.textContent = `${(data.nations || []).length} nation(s) loaded`;
  } catch (e) {
    codeEl.textContent = `Error loading data: ${e.message}`;
    statusEl.textContent = "Error";
  }
}

// ── Console: nation card / location row builders ──────────────────────────────

let nationCounter   = 0;
let locationCounter = 0;

function createLocationRow(data = {}) {
  const template = $("#location-row-template");
  const frag     = template.content.cloneNode(true);
  const row      = frag.querySelector(".location-row");
  row.dataset.locId = `loc-${++locationCounter}`;

  const nameInput   = row.querySelector(".input-location-name");
  const coordsInput = row.querySelector(".input-coords");

  nameInput.value   = data.name   || "";
  coordsInput.value = data.coords || "";

  nameInput.addEventListener("input",   () => markUnsaved());
  coordsInput.addEventListener("input", () => markUnsaved());

  row.querySelector(".btn-remove-location").addEventListener("click", () => {
    row.remove();
    markUnsaved();
  });

  return row;
}

function createNationCard(data = {}) {
  const template = $("#nation-card-template");
  const frag     = template.content.cloneNode(true);
  const card     = frag.querySelector(".nation-card");
  card.dataset.nationId = `nation-${++nationCounter}`;

  const nameInput   = card.querySelector(".input-nation-name");
  const locList     = card.querySelector(".locations-list");

  nameInput.value = data.name || "";
  nameInput.addEventListener("input", () => markUnsaved());

  card.querySelector(".btn-remove-nation").addEventListener("click", () => {
    card.remove();
    markUnsaved();
  });

  card.querySelector(".btn-add-location").addEventListener("click", () => {
    const row = createLocationRow();
    locList.appendChild(row);
    row.querySelector(".input-location-name").focus();
    markUnsaved();
  });

  const locs = Array.isArray(data.locations) ? data.locations : [];
  if (locs.length === 0) {
    locList.appendChild(createLocationRow());
  } else {
    locs.forEach(loc => locList.appendChild(createLocationRow({ name: loc.name, coords: loc.coordinates })));
  }

  return card;
}

function addNation(data) {
  const card = createNationCard(data);
  $("#nations-container").appendChild(card);
  return card;
}

// ── Console: collect editor state ─────────────────────────────────────────────

function collectEditorState() {
  const spawn   = $("#spawn-input").value.trim();
  const cards   = $$(".nation-card", $("#nations-container"));
  const nations = cards.map(card => {
    const name = card.querySelector(".input-nation-name").value.trim();
    const rows = $$(".location-row", card);
    const locations = rows
      .map(row => ({
        name:        row.querySelector(".input-location-name").value.trim(),
        coordinates: row.querySelector(".input-coords").value.trim(),
      }))
      .filter(l => l.name !== "" || l.coordinates !== "");
    return { name, locations };
  }).filter(n => n.name !== "" || n.locations.length > 0);

  return { spawn, nations };
}

// ── Console: populate editor from data object ─────────────────────────────────

function populateEditor(data) {
  $("#spawn-input").value = data.spawn || "";
  $("#nations-container").innerHTML = "";
  (data.nations || []).forEach(n => addNation(n));
}

// ── Console: load from API ────────────────────────────────────────────────────

async function loadConsole() {
  try {
    const r = await api("/api/data");
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const data = await r.json();
    populateEditor(data);
    markUnsaved(false);
  } catch (e) {
    $("#nations-container").innerHTML =
      `<p style="color:var(--danger);padding:16px;">Error loading data: ${e.message}</p>`;
  }
}

// ── Console: save to API ──────────────────────────────────────────────────────

async function saveConsole() {
  const data = collectEditorState();
  const btn  = $("#enter-btn");

  btn.disabled = true;
  btn.textContent = "Saving…";

  try {
    const r = await api("/api/data", {
      method: "POST",
      body:   JSON.stringify(data),
    });
    const d = await r.json();

    if (!r.ok) {
      alert(`Save failed: ${d.error || r.status}`);
      btn.disabled = false;
      btn.textContent = "ENTER — Save to Database";
      return;
    }

    markUnsaved(false);
    // Redirect to homepage
    await switchView("home");
  } catch (e) {
    alert(`Save failed: ${e.message}`);
  }

  btn.disabled = false;
  btn.textContent = "ENTER — Save to Database";
}

// ── Markdown parser ───────────────────────────────────────────────────────────

/**
 * parseMarkdown(text)
 *
 * Parses PastCraft Markdown output into { spawn, nations } structure.
 * Rules:
 *   • "# Spawn: …"     → spawn coordinate string
 *   • "## ===…"        → separator; ignored
 *   • "# Name"         → new nation (unless it matches spawn pattern)
 *   • "### Name: Coords" → location under current nation
 *   • "###"            → empty location line; ignored
 *
 * Returns { spawn, nations } on success.
 * Throws Error with descriptive message on failure.
 */
function parseMarkdown(text) {
  // normalise line endings
  const rawLines = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");

  const spawn   = { value: "" };
  const nations = [];
  let   currentNation = null;

  const SEPARATOR_RE = /^##\s*={10,}\s*$/;
  const SPAWN_RE     = /^#\s*Spawn\s*:\s*(.+)$/i;
  const NATION_RE    = /^#\s+(.+)$/;
  const LOCATION_RE  = /^###\s+(.+):\s*(.*)$/;
  const EMPTY_LOC_RE = /^###\s*$/;

  for (let i = 0; i < rawLines.length; i++) {
    const line    = rawLines[i];
    const lineNum = i + 1;
    const trimmed = line.trim();

    if (trimmed === "")          continue;
    if (SEPARATOR_RE.test(trimmed)) continue;

    // Spawn line  →  "# Spawn: 0 63 0"
    const spawnMatch = SPAWN_RE.exec(trimmed);
    if (spawnMatch) {
      spawn.value = spawnMatch[1].trim();
      continue;
    }

    // Nation line  →  "# United Bavariad Empire"
    const nationMatch = NATION_RE.exec(trimmed);
    if (nationMatch) {
      // strip trailing colon that some nation names carry in the sample
      const rawName = nationMatch[1].trim();
      const name    = rawName.endsWith(":") ? rawName.slice(0, -1).trim() : rawName;
      currentNation = { name, locations: [] };
      nations.push(currentNation);
      continue;
    }

    // Empty location line  →  "###"
    if (EMPTY_LOC_RE.test(trimmed)) continue;

    // Location line  →  "### Cobblestone Keep: 35 71 -138"
    const locMatch = LOCATION_RE.exec(trimmed);
    if (locMatch) {
      if (!currentNation) {
        throw new Error(
          `Import failed at line ${lineNum}: found a location before any nation.\n"${trimmed}"`
        );
      }
      currentNation.locations.push({
        name:        locMatch[1].trim(),
        coordinates: locMatch[2].trim(),
      });
      continue;
    }

    // Anything else — warn but don't fatal (tolerant parser)
    console.warn(`PastCraft parser: unrecognised line ${lineNum}: "${trimmed}"`);
  }

  if (nations.length === 0) {
    throw new Error(
      "Could not import the output. No valid nations were detected.\n" +
      "Make sure the text follows the PastCraft Markdown format:\n" +
      "  # Nation Name\n  ### Location Name: X Y Z"
    );
  }

  return { spawn: spawn.value, nations };
}

// ── Import handler ────────────────────────────────────────────────────────────

async function handleImport() {
  const text     = $("#import-textarea").value;
  const errorEl  = $("#import-error");

  errorEl.classList.add("hidden");
  errorEl.textContent = "";

  if (!text.trim()) {
    errorEl.textContent = "The import area is empty. Please paste a PastCraft output first.";
    errorEl.classList.remove("hidden");
    return;
  }

  // Warn if there are unsaved changes already in the editor
  if (state.hasUnsaved) {
    const ok = await showConfirm(
      "You have unsaved changes. Importing this output will replace your current edits. Continue?"
    );
    if (!ok) return;
  }

  let parsed;
  try {
    parsed = parseMarkdown(text);
  } catch (e) {
    errorEl.textContent = e.message;
    errorEl.classList.remove("hidden");
    return;
  }

  // Populate editor (does NOT touch the database)
  populateEditor(parsed);
  markUnsaved(true);          // import counts as unsaved changes

  // Clear the textarea to reduce confusion
  $("#import-textarea").value = "";

  // Scroll to editor
  $("#nations-container").scrollIntoView({ behavior: "smooth", block: "start" });
}

// ── Unsaved changes: browser close / reload ───────────────────────────────────

window.addEventListener("beforeunload", e => {
  if (state.hasUnsaved) {
    e.preventDefault();
    e.returnValue = "You have unsaved changes. Are you sure you want to leave?";
  }
});

// ── Wire up events ────────────────────────────────────────────────────────────

// Brand / homepage link
$("#brand-link").addEventListener("click", () => switchView("home"));
$("#brand-link").addEventListener("keydown", e => { if (e.key === "Enter") switchView("home"); });

// Navigation
$("#nav-home").addEventListener("click", () => switchView("home"));
$("#nav-console").addEventListener("click", () => {
  if (!state.isAdmin) { showLoginModal(); return; }
  switchView("console");
});

// Login / logout
$("#nav-login").addEventListener("click", showLoginModal);
$("#nav-logout").addEventListener("click", doLogout);
$("#login-cancel").addEventListener("click", hideLoginModal);
$("#login-submit").addEventListener("click", doLogin);
$("#login-modal").addEventListener("click", e => {
  if (e.target === e.currentTarget) hideLoginModal();
});
$("#login-password").addEventListener("keydown", e => {
  if (e.key === "Enter") doLogin();
});

// Console actions
$("#add-nation-btn").addEventListener("click", () => {
  const card = addNation();
  card.querySelector(".input-nation-name").focus();
  card.scrollIntoView({ behavior: "smooth", block: "center" });
  markUnsaved();
});

$("#reset-btn").addEventListener("click", async () => {
  if (state.hasUnsaved) {
    const ok = await showConfirm("Discard all current edits and reload data from the database?");
    if (!ok) return;
  }
  await loadConsole();
});

$("#enter-btn").addEventListener("click", saveConsole);
$("#import-btn").addEventListener("click", handleImport);

// ── Init ──────────────────────────────────────────────────────────────────────

(async function init() {
  await checkAuthStatus();
  loadHomepage();
})();
