// PastCraft Coordinates — app logic
// Mirrors the fixed Python program: nations are keyed collections of
// locations, and each location keeps its name + one coordinate string
// together (no separate X/Y/Z fields).

const LINE = "=".repeat(64);

const PRESET_NATIONS = [
  {
    name: "United Bavariad Empire",
    locations: [
      { name: "Cobblestone Keep", coords: "35 71 -138" },
      { name: "Ultrixity", coords: "-172 63 -258" },
      { name: "Plainville", coords: "217 69 -309" },
      { name: "Ivory Fort", coords: "204 70 -531" },
      { name: "First Village", coords: "-503 84 -694" },
      { name: "Graveyard", coords: "-60 69 -516" },
      { name: "Wither Island", coords: "299 9 -109" },
      { name: "Prison (WIP)", coords: "-245 50 -723" },
    ],
  },
  {
    name: "Deshert",
    locations: [
      { name: "The Great Pyramid", coords: "2455 213 2232" },
    ],
  },
  {
    name: "Nipaliterra Republic",
    locations: [
      { name: "Nipaliterra City", coords: "3289 65 3064" },
      { name: "Kota Tua", coords: "3722 63 2701" },
    ],
  },
];

const nationsContainer = document.getElementById("nations-container");
const nationCardTemplate = document.getElementById("nation-card-template");
const locationRowTemplate = document.getElementById("location-row-template");
const spawnInput = document.getElementById("spawn-input");

const outputPanel = document.getElementById("output-panel");
const outputCode = document.getElementById("output-code");
const copyBtn = document.getElementById("copy-btn");

let nationIdCounter = 0;
let locationIdCounter = 0;

/* -------------------------------------------------------
   Building nation cards / location rows
   ------------------------------------------------------- */

function createLocationRow(data) {
  const fragment = locationRowTemplate.content.cloneNode(true);
  const row = fragment.querySelector(".location-row");
  row.dataset.locationId = `loc-${++locationIdCounter}`;

  const nameInput = row.querySelector(".input-location-name");
  const coordsInput = row.querySelector(".input-coords");

  if (data) {
    nameInput.value = data.name ?? "";
    coordsInput.value = data.coords ?? "";
  }

  row.querySelector(".btn-remove-location").addEventListener("click", () => {
    row.remove();
  });

  return row;
}

function createNationCard(data) {
  const fragment = nationCardTemplate.content.cloneNode(true);
  const card = fragment.querySelector(".nation-card");
  card.dataset.nationId = `nation-${++nationIdCounter}`;

  const nameInput = card.querySelector(".input-nation-name");
  const locationsList = card.querySelector(".locations-list");

  if (data && data.name) {
    nameInput.value = data.name;
  }

  card.querySelector(".btn-remove-nation").addEventListener("click", () => {
    card.remove();
  });

  card.querySelector(".btn-add-location").addEventListener("click", () => {
    const row = createLocationRow();
    locationsList.appendChild(row);
    row.querySelector(".input-location-name").focus();
  });

  if (data && Array.isArray(data.locations) && data.locations.length) {
    data.locations.forEach((loc) => {
      locationsList.appendChild(createLocationRow(loc));
    });
  } else {
    // Every nation starts with at least one empty location row.
    locationsList.appendChild(createLocationRow());
  }

  return card;
}

function addNation(data) {
  const card = createNationCard(data);
  nationsContainer.appendChild(card);
  return card;
}

function loadPresetData() {
  nationsContainer.innerHTML = "";
  PRESET_NATIONS.forEach((nation) => addNation(nation));
}

/* -------------------------------------------------------
   Output generation
   ------------------------------------------------------- */

function collectState() {
  const cards = Array.from(nationsContainer.querySelectorAll(".nation-card"));
  return cards.map((card) => {
    const name = card.querySelector(".input-nation-name").value.trim();
    const rows = Array.from(card.querySelectorAll(".location-row"));
    const locations = rows
      .map((row) => ({
        name: row.querySelector(".input-location-name").value.trim(),
        coords: row.querySelector(".input-coords").value.trim(),
      }))
      .filter((loc) => loc.name !== "" || loc.coords !== "");
    return { name, locations };
  }).filter((nation) => nation.name !== "" || nation.locations.length > 0);
}

function buildOutput(nations) {
  const lines = [];
  const spawn = spawnInput.value.trim();

  if (spawn !== "") {
    lines.push(`# Spawn: ${spawn}`);
  }

  nations.forEach((nation) => {
    lines.push(`## ${LINE}`);
    lines.push(`# ${nation.name}`);
    nation.locations.forEach((loc) => {
      lines.push(`### ${loc.name}: ${loc.coords}`);
    });
  });

  lines.push(`## ${LINE}`);
  return lines.join("\n");
}

function generateOutput() {
  const nations = collectState();
  const text = buildOutput(nations);
  outputCode.textContent = text;
  outputPanel.hidden = false;
  outputPanel.scrollIntoView({ behavior: "smooth", block: "start" });
}

/* -------------------------------------------------------
   Copy to clipboard
   ------------------------------------------------------- */

async function copyOutput() {
  const text = outputCode.textContent;
  try {
    await navigator.clipboard.writeText(text);
  } catch (err) {
    // Fallback for environments without Clipboard API access.
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand("copy");
    document.body.removeChild(textarea);
  }

  const originalLabel = copyBtn.textContent;
  copyBtn.textContent = "Copied!";
  copyBtn.classList.add("copied");
  setTimeout(() => {
    copyBtn.textContent = originalLabel;
    copyBtn.classList.remove("copied");
  }, 1600);
}

/* -------------------------------------------------------
   Wire up events
   ------------------------------------------------------- */

document.getElementById("add-nation-btn").addEventListener("click", () => {
  const card = addNation();
  card.querySelector(".input-nation-name").focus();
  card.scrollIntoView({ behavior: "smooth", block: "center" });
});

document.getElementById("generate-btn").addEventListener("click", generateOutput);

document.getElementById("reset-btn").addEventListener("click", () => {
  if (confirm("Clear everything and reload the starting nations?")) {
    outputPanel.hidden = true;
    spawnInput.value = "0 63 0";
    loadPresetData();
  }
});

copyBtn.addEventListener("click", copyOutput);

// Initial state
loadPresetData();
