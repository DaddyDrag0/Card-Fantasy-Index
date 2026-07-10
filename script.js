const LIBRARY_ROOT = "./";
const DATA_URL = `${LIBRARY_ROOT}data/cards.json`;
const IMAGE_ROOT = `${LIBRARY_ROOT}assets/cards/`;
const CARD_PARTS = Array.from({ length: 7 }, (_, index) => `data/cards-${index + 1}.json`);
const STORAGE_KEY = "cf-deck-builder-state-v1";
const LEGACY_STORAGE_KEY = "card-fantasy-index-state-v1";
const MAX_TEAM_SIZE = 4;
const SUPPORT_CARD_IDS = new Set([
  "peasant", "druid", "pixie", "paladin-guardian", "spirit-caller", "life-tree",
  "sand-wraith", "soul-warden", "arcane-construct", "storm-dragon", "death-tree",
  "bone-drake", "celestial-ruler", "shroom-paladin", "blue-shroomage",
  "shroom-commander", "green-shroomage", "bear", "flower-lord", "flower-guardian",
  "snow-beast", "cthulhu", "grave-guardian", "orc-warrior", "orc-shaman",
  "ice-golem", "ice-dragon", "the-overseer", "orc-king", "snow-mage"
]);
const REGULAR_CARD_IDS = new Set([
  "wolf", "hellhound", "cerberus", "swamp-hydra", "shroom-spiderlings",
  "skeleton-king", "abyssal-nightmare", "neptune"
]);
const AOE_CARD_IDS = new Set([
  "archer", "bone-mage", "mummy", "deacon", "kraken", "diver",
  "rift-destroyer", "star-titan", "behemoth", "rift-seraph",
  "shroom-warrior", "red-shroomage", "shroom-archer", "shroom-king",
  "snow-husk", "moonlit-lizard", "aeternus-the-abyssal-king",
  "bandit-archer", "ember-mage", "fire-spirit", "heavenly-warrior",
  "god-of-thunder"
]);

const state = {
  cards: [],
  meta: { variants: [] },
  query: "",
  source: "all",
  role: "all",
  sort: "odds-asc",
  selectedBorders: new Set(),
  ownedOnly: false,
  selectedId: null,
  collection: {},
  team: [],
  scanResults: []
};

const els = {
  cardGrid: document.querySelector("#cardGrid"),
  loadingState: document.querySelector("#loadingState"),
  emptyState: document.querySelector("#emptyState"),
  resultCount: document.querySelector("#resultCount"),
  searchInput: document.querySelector("#searchInput"),
  sizeRange: document.querySelector("#sizeRange"),
  sortSelect: document.querySelector("#sortSelect"),
  borderControls: document.querySelector("#borderControls"),
  ownedOnly: document.querySelector("#ownedOnly"),
  sourceFilters: document.querySelector("#sourceFilters"),
  roleFilters: document.querySelector("#roleFilters"),
  ownedSummary: document.querySelector("#ownedSummary"),
  ownedProgress: document.querySelector("#ownedProgress"),
  teamList: document.querySelector("#teamList"),
  teamCount: document.querySelector("#teamCount"),
  teamHP: document.querySelector("#teamHP"),
  teamATK: document.querySelector("#teamATK"),
  importButton: document.querySelector("#importButton"),
  importInput: document.querySelector("#importInput"),
  exportButton: document.querySelector("#exportButton"),
  clearCollectionButton: document.querySelector("#clearCollectionButton"),
  cardModal: document.querySelector("#cardModal"),
  modalDialog: document.querySelector(".card-modal"),
  modalImageWrap: document.querySelector(".modal-image-wrap"),
  modalClose: document.querySelector("#modalClose"),
  modalImage: document.querySelector("#modalImage"),
  modalImageFallback: document.querySelector("#modalImageFallback"),
  modalSource: document.querySelector("#modalSource"),
  modalName: document.querySelector("#modalName"),
  modalAbility: document.querySelector("#modalAbility"),
  modalTags: document.querySelector("#modalTags"),
  modalHP: document.querySelector("#modalHP"),
  modalATK: document.querySelector("#modalATK"),
  modalOdds: document.querySelector("#modalOdds"),
  modalOwned: document.querySelector("#modalOwned"),
  modalBorderControls: document.querySelector("#modalBorderControls"),
  removeCopyButton: document.querySelector("#removeCopyButton"),
  addCopyButton: document.querySelector("#addCopyButton"),
  teamButton: document.querySelector("#teamButton"),
  scanModal: document.querySelector("#scanModal"),
  scanClose: document.querySelector("#scanClose"),
  scanCancel: document.querySelector("#scanCancel"),
  scanAdd: document.querySelector("#scanAdd"),
  scanReplace: document.querySelector("#scanReplace"),
  scanSummary: document.querySelector("#scanSummary"),
  scanProgress: document.querySelector("#scanProgress"),
  scanProgressText: document.querySelector("#scanProgressText"),
  scanResults: document.querySelector("#scanResults"),
  toast: document.querySelector("#toast")
};

function escapeHTML(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function normalize(value) {
  return String(value || "").toLowerCase().trim();
}

function titleCase(value) {
  return String(value || "")
    .replaceAll("_", " ")
    .replaceAll("-", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatNumber(value) {
  return Math.max(0, Math.floor(Number(value) || 0)).toLocaleString();
}

function formatOdds(value) {
  return `1/${formatNumber(value)}`;
}

function imageURL(card) {
  return `${IMAGE_ROOT}${encodeURIComponent(card.id)}.png`;
}

function sourceName(card) {
  return card.weather || "Base";
}


function cardRole(card) {
  if (SUPPORT_CARD_IDS.has(card.id)) return "support";
  if (REGULAR_CARD_IDS.has(card.id)) return "regular";
  if (AOE_CARD_IDS.has(card.id)) return "aoe";
  const description = normalize(`${card.abilityType || ""} ${card.abilityDescription || ""}`);
  const supportsAllies = /(all allies|allied team|grant allies|gives every ally|boosts entire team|next ally|fallen ally|active ally card|remaining allies|all poison-related allies|allies take|every ally deals|boosts all allies|two allies|current active ally|revives? .*ally|brings back .*ally)/.test(description);
  if (supportsAllies) return "support";
  const hitsMultiple = /(all enemies|two random enem|2 enemy|hit two enem|strikes two|attack twice|attacks twice|counterattack twice|attacks 3 times|strike all|pierce.*all|pierce.*next|splash.*next|next enemy card|spread to all enemy|simultaneously strike all)/.test(description);
  if (hitsMultiple) return "aoe";
  return "regular";
}

function accentForCard(card) {
  const source = sourceName(card).toLowerCase();
  const text = `${card.name} ${card.ability} ${card.abilityType}`.toLowerCase();
  if (source.includes("blizzard") || text.includes("ice") || text.includes("frost")) return "#55bff0";
  if (source.includes("blood") || text.includes("blood") || text.includes("vampire")) return "#df5a68";
  if (source.includes("heat") || text.includes("fire") || text.includes("ember") || text.includes("phoenix")) return "#f08b45";
  if (source.includes("orc")) return "#79a65d";
  if (source.includes("bandit")) return "#c18e4e";
  if (source.includes("slime") || text.includes("shroom")) return "#5ed27f";
  if (source.includes("valhalla") || text.includes("heaven") || text.includes("odin")) return "#dbc161";
  if (text.includes("void") || text.includes("rift") || text.includes("abyss")) return "#9b61ef";
  if (text.includes("moon") || text.includes("lunar") || text.includes("star")) return "#7589ff";
  return "#8d4dff";
}

function getBorderDefs() {
  return state.meta.variants || [];
}

function orderBorderNames(names = state.selectedBorders) {
  const selected = new Set(names);
  return getBorderDefs().map((border) => border.name).filter((name) => selected.has(name));
}

function selectedBorderNames() {
  return orderBorderNames(state.selectedBorders);
}

function borderMultiplierFromNames(names = state.selectedBorders) {
  const selected = new Set(names);
  return getBorderDefs().reduce((multiplier, border) => {
    return selected.has(border.name) ? multiplier * Number(border.chance || 1) : multiplier;
  }, 1);
}

function borderColorList(names = state.selectedBorders) {
  const selected = new Set(orderBorderNames(names));
  return getBorderDefs()
    .filter((border) => selected.has(border.name))
    .map((border) => border.color || "#8d4dff");
}

function modifierColorValue(names = state.selectedBorders) {
  const colors = borderColorList(names);
  if (!colors.length) return "";
  if (colors.length === 1) return [colors[0], colors[0], colors[0]].join(", ");
  return [...colors, colors[0]].join(", ");
}

function borderVisualStyle(names = state.selectedBorders) {
  const colors = borderColorList(names);
  if (!colors.length) return "";
  return `--modifier-colors:${modifierColorValue(names)};--border-primary:${colors[0]};--border-glow:${colors[colors.length - 1]};`;
}

function applyBorderHighlight(element, names = state.selectedBorders) {
  if (!element) return;
  const colors = borderColorList(names);
  element.classList.toggle("has-modifiers", colors.length > 0);
  if (colors.length) {
    element.style.setProperty("--modifier-colors", modifierColorValue(names));
    element.style.setProperty("--border-primary", colors[0]);
    element.style.setProperty("--border-glow", colors[colors.length - 1]);
  } else {
    element.style.removeProperty("--modifier-colors");
    element.style.removeProperty("--border-primary");
    element.style.removeProperty("--border-glow");
  }
}

function statsForCard(card, borders = state.selectedBorders) {
  const borderChance = borderMultiplierFromNames(borders);
  const odds = Math.max(1, Number(card.odds || 1) * borderChance);
  const rawHP = Math.floor(Math.pow(2, Math.log10(odds)) * 20);
  const rawATK = Math.floor(rawHP / 3);
  const weatherMult = Number(card.statMult || 1) || 1;
  return {
    hp: Math.floor(rawHP * weatherMult),
    atk: Math.floor(rawATK * weatherMult),
    odds
  };
}

function ownedCount(id) {
  return Math.max(0, Number(state.collection[id] || 0));
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({
    collection: state.collection,
    team: state.team,
    selectedBorders: selectedBorderNames(),
    cardSize: Number(els.sizeRange.value || 190)
  }));
}

function loadSavedState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || localStorage.getItem(LEGACY_STORAGE_KEY) || "{}");
    if (saved.collection && typeof saved.collection === "object") state.collection = saved.collection;
    if (Array.isArray(saved.team)) state.team = saved.team.slice(0, MAX_TEAM_SIZE);
    if (Array.isArray(saved.selectedBorders)) {
      state.selectedBorders = new Set(saved.selectedBorders);
    } else if (typeof saved.border === "string" && saved.border !== "Base") {
      state.selectedBorders = new Set(saved.border.split(" + "));
    }
    if (Number(saved.cardSize)) {
      els.sizeRange.value = String(saved.cardSize);
      document.documentElement.style.setProperty("--card-size", `${saved.cardSize}px`);
    }
  } catch (error) {
    console.warn("Could not load saved collection", error);
  }
}

function getVisibleCards() {
  const query = normalize(state.query);
  const filtered = state.cards.filter((card) => {
    const matchesQuery = !query || normalize([
      card.name,
      card.ability,
      card.abilityType,
      card.abilityDescription,
      card.source,
      card.weather
    ].join(" ")).includes(query);
    const matchesSource = state.source === "all" || sourceName(card) === state.source;
    const matchesRole = state.role === "all" || cardRole(card) === state.role;
    const matchesOwned = !state.ownedOnly || ownedCount(card.id) > 0;
    return matchesQuery && matchesSource && matchesRole && matchesOwned;
  });

  return [...filtered].sort((a, b) => {
    if (state.sort === "odds-desc") return Number(b.odds) - Number(a.odds);
    if (state.sort === "name-asc") return a.name.localeCompare(b.name);
    if (state.sort === "hp-desc") return statsForCard(b).hp - statsForCard(a).hp;
    if (state.sort === "atk-desc") return statsForCard(b).atk - statsForCard(a).atk;
    return Number(a.odds) - Number(b.odds);
  });
}

function cardHTML(card) {
  const stats = statsForCard(card);
  const owned = ownedCount(card.id);
  const accent = accentForCard(card);
  return `
    <button class="card-tile ${state.selectedBorders.size ? "has-modifiers" : ""}" type="button" data-card-id="${escapeHTML(card.id)}" style="--accent:${accent};${borderVisualStyle()}">
      <span class="card-image-frame">
        <span class="card-fallback">${escapeHTML(card.name)}</span>
        <img src="${imageURL(card)}" alt="${escapeHTML(card.name)}" loading="lazy" decoding="async" onload="this.previousElementSibling.hidden=true" onerror="this.hidden=true">
      </span>
      ${owned > 0 ? `<span class="card-owned-badge" data-owned-badge>${owned}</span>` : `<span class="card-owned-badge" data-owned-badge hidden>0</span>`}
      <h3>${escapeHTML(card.name)}</h3>
      <p class="card-subline"><span>${escapeHTML(sourceName(card))}</span><span>${escapeHTML(titleCase(cardRole(card)))}</span></p>
      <p class="card-statline"><span>HP <b data-card-hp>${formatNumber(stats.hp)}</b></span><span>ATK <b data-card-atk>${formatNumber(stats.atk)}</b></span></p>
    </button>
  `;
}

let pendingGridFrame = 0;
function scheduleGridRender() {
  cancelAnimationFrame(pendingGridFrame);
  pendingGridFrame = requestAnimationFrame(() => {
    pendingGridFrame = 0;
    renderGrid();
  });
}

function renderGrid() {
  const cards = getVisibleCards();
  els.resultCount.textContent = formatNumber(cards.length);
  els.cardGrid.innerHTML = cards.map(cardHTML).join("");
  els.emptyState.hidden = cards.length > 0;
}

function renderPills(container, values, active, dataName) {
  container.innerHTML = values.map((value) => {
    const label = value === "all" ? "All" : value;
    return `<button class="filter-pill ${active === value ? "is-active" : ""}" type="button" data-${dataName}="${escapeHTML(value)}">${escapeHTML(label)}</button>`;
  }).join("");
}

function renderFilters() {
  const sources = ["all", ...new Set(state.cards.map(sourceName))];
  renderPills(els.sourceFilters, sources, state.source, "source");
  renderPills(els.roleFilters, ["all", "regular", "aoe", "support"], state.role, "role");
}

function renderBorderControls() {
  els.borderControls.innerHTML = getBorderDefs().map((border) => {
    const active = state.selectedBorders.has(border.name);
    return `<button class="modifier-button ${active ? "is-active" : ""}" type="button" data-border="${escapeHTML(border.name)}" style="--chip-color:${escapeHTML(border.color || "#8d4dff")}"><span>${escapeHTML(border.name)}</span><small>${escapeHTML(border.chanceLabel || "")}</small></button>`;
  }).join("");
}

function updateCollectionSummary() {
  const uniqueOwned = state.cards.filter((card) => ownedCount(card.id) > 0).length;
  const total = state.cards.length;
  els.ownedSummary.textContent = `${uniqueOwned} / ${total}`;
  els.ownedProgress.style.width = `${total ? (uniqueOwned / total) * 100 : 0}%`;
}

function teamCard(id) {
  return state.cards.find((card) => card.id === id) || null;
}

function renderTeam() {
  const slots = [];
  let totalHP = 0;
  let totalATK = 0;

  for (let index = 0; index < MAX_TEAM_SIZE; index += 1) {
    const id = state.team[index];
    const card = teamCard(id);
    if (!card) {
      slots.push(`<div class="team-slot is-empty">Empty slot</div>`);
      continue;
    }
    const stats = statsForCard(card);
    totalHP += stats.hp;
    totalATK += stats.atk;
    slots.push(`
      <div class="team-slot ${state.selectedBorders.size ? "has-modifiers" : ""}" data-team-id="${escapeHTML(card.id)}" style="${borderVisualStyle()}">
        <img src="${imageURL(card)}" alt="" onerror="this.style.visibility='hidden'">
        <span><strong>${escapeHTML(card.name)}</strong><small>${formatNumber(stats.hp)} HP · ${formatNumber(stats.atk)} ATK</small></span>
        <button class="team-remove" type="button" data-team-remove="${escapeHTML(card.id)}" aria-label="Remove ${escapeHTML(card.name)}">×</button>
      </div>
    `);
  }

  els.teamList.innerHTML = slots.join("");
  els.teamCount.textContent = `${state.team.length}/${MAX_TEAM_SIZE}`;
  els.teamHP.textContent = formatNumber(totalHP);
  els.teamATK.textContent = formatNumber(totalATK);
}

function selectedCard() {
  return state.cards.find((card) => card.id === state.selectedId) || null;
}

function renderModal() {
  const card = selectedCard();
  if (!card) return;
  const stats = statsForCard(card);
  const owned = ownedCount(card.id);
  const inTeam = state.team.includes(card.id);
  const selectedNames = selectedBorderNames();

  els.modalSource.textContent = sourceName(card);
  els.modalName.textContent = card.name;
  els.modalAbility.textContent = card.abilityDescription || "No ability description available.";
  els.modalHP.textContent = formatNumber(stats.hp);
  els.modalATK.textContent = formatNumber(stats.atk);
  els.modalOdds.textContent = formatOdds(stats.odds);
  els.modalOwned.textContent = formatNumber(owned);
  els.modalTags.innerHTML = [
    titleCase(card.ability || card.abilityType || "No ability"),
    card.source || sourceName(card),
    selectedNames.length ? selectedNames.join(" + ") : "Base",
    titleCase(cardRole(card))
  ].map((tag) => `<span class="modal-tag">${escapeHTML(tag)}</span>`).join("");

  els.modalImage.hidden = false;
  els.modalImageFallback.hidden = true;
  els.modalImage.src = imageURL(card);
  els.modalImage.alt = card.name;
  els.modalImage.onerror = () => {
    els.modalImage.hidden = true;
    els.modalImageFallback.hidden = false;
  };

  els.modalBorderControls.innerHTML = getBorderDefs().map((border) => {
    const active = state.selectedBorders.has(border.name);
    return `<button class="modifier-button ${active ? "is-active" : ""}" type="button" data-modal-border="${escapeHTML(border.name)}" style="--chip-color:${escapeHTML(border.color || "#8d4dff")}"><span>${escapeHTML(border.name)}</span><small>${escapeHTML(border.chanceLabel || "")}</small></button>`;
  }).join("");

  els.removeCopyButton.disabled = owned <= 0;
  els.teamButton.textContent = inTeam ? "Remove from team" : "Add to team";
  els.teamButton.classList.toggle("is-active", inTeam);
  els.teamButton.disabled = !inTeam && (owned <= 0 || state.team.length >= MAX_TEAM_SIZE);

  applyBorderHighlight(els.modalDialog);
  applyBorderHighlight(els.modalImageWrap);
}

function openModal(id) {
  state.selectedId = id;
  renderModal();
  els.cardModal.hidden = false;
  document.body.style.overflow = "hidden";
}

function closeModal() {
  els.cardModal.hidden = true;
  document.body.style.overflow = "";
}

function updateTile(id) {
  const tile = els.cardGrid.querySelector(`[data-card-id="${CSS.escape(id)}"]`);
  if (!tile) return;
  const badge = tile.querySelector("[data-owned-badge]");
  const owned = ownedCount(id);
  badge.textContent = owned;
  badge.hidden = owned <= 0;
}

function updateVisibleStats() {
  els.cardGrid.querySelectorAll("[data-card-id]").forEach((tile) => {
    const card = state.cards.find((item) => item.id === tile.dataset.cardId);
    if (!card) return;
    const stats = statsForCard(card);
    const hp = tile.querySelector("[data-card-hp]");
    const atk = tile.querySelector("[data-card-atk]");
    if (hp) hp.textContent = formatNumber(stats.hp);
    if (atk) atk.textContent = formatNumber(stats.atk);
    applyBorderHighlight(tile);
  });
}

function changeOwned(id, amount) {
  const current = ownedCount(id);
  const next = Math.max(0, current + amount);
  if (next > 0) state.collection[id] = next;
  else delete state.collection[id];

  if (next === 0) state.team = state.team.filter((teamId) => teamId !== id);
  saveState();
  updateCollectionSummary();
  updateTile(id);
  renderTeam();
  renderModal();
  if (state.ownedOnly && next === 0) renderGrid();
}

function toggleBorder(borderName) {
  if (state.selectedBorders.has(borderName)) state.selectedBorders.delete(borderName);
  else state.selectedBorders.add(borderName);
  saveState();
  renderBorderControls();
  updateVisibleStats();
  renderTeam();
  if (!els.cardModal.hidden) renderModal();
}

function toggleTeam(id) {
  const index = state.team.indexOf(id);
  if (index >= 0) {
    state.team.splice(index, 1);
    showToast("Removed from team");
  } else {
    if (ownedCount(id) <= 0) {
      showToast("Add a copy to your collection first");
      return;
    }
    if (state.team.length >= MAX_TEAM_SIZE) {
      showToast("Your team is full");
      return;
    }
    state.team.push(id);
    showToast("Added to team");
  }
  saveState();
  renderTeam();
  renderModal();
}

let toastTimer;
function showToast(message) {
  clearTimeout(toastTimer);
  els.toast.textContent = message;
  els.toast.classList.add("is-visible");
  toastTimer = setTimeout(() => els.toast.classList.remove("is-visible"), 1800);
}


let referenceSignaturePromise = null;
let imageModelPromise = null;
let ocrWorkerPromise = null;



async function getImageModel() {
  if (imageModelPromise) return imageModelPromise;
  if (!window.tf || !window.mobilenet) {
    throw new Error("The image-comparison model could not be loaded. Check the connection and try again.");
  }
  imageModelPromise = (async () => {
    els.scanProgressText.textContent = "Loading image-comparison model…";
    await window.tf.ready();
    return window.mobilenet.load({ version: 2, alpha: 1.0 });
  })();
  return imageModelPromise;
}

function createFeatureCanvas(image, sx, sy, sw, sh) {
  const canvas = document.createElement("canvas");
  canvas.width = 224;
  canvas.height = 224;
  const context = canvas.getContext("2d");
  context.fillStyle = "#000";
  context.fillRect(0, 0, 224, 224);
  context.drawImage(image, sx, sy, sw, sh, 0, 0, 224, 224);
  return canvas;
}

async function imageEmbedding(model, canvas) {
  const tensor = model.infer(canvas, true);
  try {
    const values = Array.from(await tensor.data());
    const magnitude = Math.sqrt(values.reduce((total, value) => total + value * value, 0)) || 1;
    return values.map((value) => value / magnitude);
  } finally {
    tensor.dispose();
  }
}

function embeddingSimilarity(left, right) {
  let total = 0;
  const length = Math.min(left.length, right.length);
  for (let index = 0; index < length; index += 1) total += left[index] * right[index];
  return total;
}

function matchCardByImage(embedding, references) {
  const ranking = references
    .map((reference) => ({
      card: reference.card,
      similarity: embeddingSimilarity(embedding, reference.embedding)
    }))
    .sort((left, right) => right.similarity - left.similarity);
  const best = ranking[0];
  const second = ranking[1] || { similarity: best.similarity - 0.08 };
  const absoluteScore = Math.max(0, Math.min(1, (best.similarity - 0.42) / 0.48));
  const separationScore = Math.max(0, Math.min(1, (best.similarity - second.similarity) / 0.08));
  const confidence = Math.round(Math.max(10, Math.min(90, 10 + absoluteScore * 50 + separationScore * 30)));
  return {
    card: best.card,
    confidence,
    method: "Neural image resemblance",
    alternatives: ranking.slice(1, 4).map((candidate) => candidate.card.name)
  };
}

async function getOCRWorker() {
  if (ocrWorkerPromise) return ocrWorkerPromise;
  if (!window.Tesseract) throw new Error("The local OCR helper could not be loaded. Check the connection and try again.");
  ocrWorkerPromise = (async () => {
    const worker = await window.Tesseract.createWorker("eng", 1, {
      logger: (message) => {
        if (message.status && typeof message.progress === "number") {
          els.scanProgressText.textContent = `Reading card odds… ${Math.round(message.progress * 100)}%`;
        }
      }
    });
    await worker.setParameters({
      tessedit_pageseg_mode: window.Tesseract.PSM.SINGLE_LINE,
      tessedit_char_whitelist: "0123456789,/",
      preserve_interword_spaces: "1"
    });
    return worker;
  })();
  return ocrWorkerPromise;
}

function createOddsCanvas(image, cell, binary = false) {
  const sx = cell.x + cell.width * 0.11;
  const sy = cell.y + cell.height * 0.72;
  const sw = cell.width * 0.86;
  const sh = cell.height * 0.25;
  const scale = 4;
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(sw * scale));
  canvas.height = Math.max(1, Math.round(sh * scale));
  const context = canvas.getContext("2d", { willReadFrequently: true });
  context.imageSmoothingEnabled = true;
  context.drawImage(image, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
  if (binary) {
    const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
    const pixels = imageData.data;
    for (let index = 0; index < pixels.length; index += 4) {
      const red = pixels[index];
      const green = pixels[index + 1];
      const blue = pixels[index + 2];
      const luminance = red * 0.299 + green * 0.587 + blue * 0.114;
      const saturationRange = Math.max(red, green, blue) - Math.min(red, green, blue);
      const value = luminance > 105 && saturationRange < 95 ? 255 : 0;
      pixels[index] = value;
      pixels[index + 1] = value;
      pixels[index + 2] = value;
      pixels[index + 3] = 255;
    }
    context.putImageData(imageData, 0, 0);
  }
  return canvas;
}

function parseOddsText(text) {
  const groups = String(text || "").match(/\d[\d,]*/g) || [];
  const values = groups
    .map((group) => group.replaceAll(",", ""))
    .filter((group) => group.length > 1)
    .map((group) => Number(group))
    .filter((value) => Number.isFinite(value) && value > 0);
  if (!values.length) return 0;
  return values.sort((left, right) => String(right).length - String(left).length)[0];
}

async function recognizeDisplayedOdds(worker, image, cell, binary = false) {
  const canvas = createOddsCanvas(image, cell, binary);
  const result = await worker.recognize(canvas);
  return {
    odds: parseOddsText(result.data.text),
    text: String(result.data.text || "").trim(),
    confidence: Number(result.data.confidence || 0)
  };
}

function rgbHue(red, green, blue) {
  const r = red / 255;
  const g = green / 255;
  const b = blue / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const difference = max - min;
  if (!difference) return { hue: 0, saturation: 0, value: max };
  let hue;
  if (max === r) hue = 60 * (((g - b) / difference) % 6);
  else if (max === g) hue = 60 * ((b - r) / difference + 2);
  else hue = 60 * ((r - g) / difference + 4);
  if (hue < 0) hue += 360;
  return { hue, saturation: difference / max, value: max };
}

function detectScreenshotBorders(image, cell) {
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(cell.width));
  canvas.height = Math.max(1, Math.round(cell.height));
  const context = canvas.getContext("2d", { willReadFrequently: true });
  context.drawImage(image, cell.x, cell.y, cell.width, cell.height, 0, 0, canvas.width, canvas.height);
  const { data, width, height } = context.getImageData(0, 0, canvas.width, canvas.height);
  const thickness = Math.max(4, Math.round(Math.min(width, height) * 0.04));
  const counts = { Shiny: 0, Diamond: 0, Radiant: 0 };
  let perimeterPixels = 0;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (x > thickness && x < width - thickness && y > thickness && y < height - thickness) continue;
      const offset = (y * width + x) * 4;
      const color = rgbHue(data[offset], data[offset + 1], data[offset + 2]);
      if (color.saturation > 0.45 && color.value > 0.42) {
        if (color.hue >= 38 && color.hue <= 75) counts.Shiny += 1;
        if (color.hue >= 175 && color.hue <= 225) counts.Diamond += 1;
        if (color.hue >= 250 && color.hue <= 340) counts.Radiant += 1;
      }
      perimeterPixels += 1;
    }
  }
  const ratios = Object.fromEntries(Object.entries(counts).map(([name, count]) => [name, count / Math.max(1, perimeterPixels)]));
  const strongest = Math.max(...Object.values(ratios));
  if (strongest < 0.05) return [];
  return getBorderDefs()
    .map((border) => border.name)
    .filter((name) => ratios[name] >= 0.035 && ratios[name] >= strongest * 0.22);
}

function screenshotBorderMultiplier(borderNames) {
  const selected = new Set(borderNames);
  return getBorderDefs().reduce((multiplier, border) => {
    return selected.has(border.name) ? multiplier * Number(border.chance || 1) : multiplier;
  }, 1);
}

function allBorderCombinations() {
  return getBorderDefs().reduce((combinations, border) => {
    const additions = combinations.map((combination) => ({
      names: [...combination.names, border.name],
      multiplier: combination.multiplier * Number(border.chance || 1)
    }));
    return [...combinations, ...additions];
  }, [{ names: [], multiplier: 1 }]);
}

function matchCardUsingOdds(signature, references, recognition) {
  const visualRanking = references
    .map((reference) => ({
      card: reference.card,
      artDistance: signatureDistance(signature, reference.signature)
    }))
    .sort((left, right) => left.artDistance - right.artDistance);

  const bestVisual = visualRanking[0];
  const secondVisual = visualRanking[1] || { artDistance: bestVisual.artDistance * 1.5 };
  const closeVisuals = visualRanking
    .filter((candidate) => candidate.artDistance <= bestVisual.artDistance * 1.08 + 0.0004)
    .slice(0, 8);

  let selected = bestVisual;
  let method = "Artwork";
  let selectedOddsError = Infinity;

  if (recognition.odds && closeVisuals.length > 1) {
    const combinations = allBorderCombinations();
    const tied = closeVisuals.map((candidate) => {
      const closestOdds = combinations
        .map((combination) => ({
          combination,
          error: Math.abs(Math.log(
            Math.max(1, Number(candidate.card.odds || 1) * combination.multiplier)
            / Math.max(1, recognition.odds)
          ))
        }))
        .sort((left, right) => left.error - right.error)[0];
      return { ...candidate, oddsError: closestOdds.error };
    }).sort((left, right) => left.oddsError - right.oddsError);
    selected = tied[0];
    selectedOddsError = selected.oddsError;
    method = "Artwork + odds tie-break";
  } else if (recognition.odds) {
    selectedOddsError = allBorderCombinations()
      .map((combination) => Math.abs(Math.log(
        Math.max(1, Number(selected.card.odds || 1) * combination.multiplier)
        / Math.max(1, recognition.odds)
      )))
      .sort((left, right) => left - right)[0];
  }

  const visualSeparation = Math.max(
    0,
    (secondVisual.artDistance - bestVisual.artDistance) / Math.max(secondVisual.artDistance, 0.0001)
  );
  const confidence = Math.round(Math.max(15, Math.min(95, 20 + visualSeparation * 180)));

  return {
    card: selected.card,
    confidence,
    relativeError: selectedOddsError,
    combination: [],
    alternatives: visualRanking.slice(1, 4).map((candidate) => candidate.card.name),
    method
  };
}

function loadImageSource(source) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.decoding = "async";
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Image could not be loaded"));
    image.src = source;
  });
}

async function loadImageFile(file) {
  const url = URL.createObjectURL(file);
  try {
    return await loadImageSource(url);
  } finally {
    URL.revokeObjectURL(url);
  }
}

function findContentBands(image, axis) {
  const canvas = document.createElement("canvas");
  canvas.width = image.naturalWidth || image.width;
  canvas.height = image.naturalHeight || image.height;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  context.drawImage(image, 0, 0);
  const { data, width, height } = context.getImageData(0, 0, canvas.width, canvas.height);
  const length = axis === "x" ? width : height;
  const crossLength = axis === "x" ? height : width;
  const active = new Array(length).fill(false);

  for (let index = 0; index < length; index += 1) {
    let visible = 0;
    for (let cross = 0; cross < crossLength; cross += 2) {
      const x = axis === "x" ? index : cross;
      const y = axis === "x" ? cross : index;
      const offset = (y * width + x) * 4;
      if (Math.max(data[offset], data[offset + 1], data[offset + 2]) > 24) visible += 1;
    }
    active[index] = visible / Math.ceil(crossLength / 2) > 0.035;
  }

  const bands = [];
  let start = null;
  for (let index = 0; index <= active.length; index += 1) {
    if (active[index] && start === null) start = index;
    if ((!active[index] || index === active.length) && start !== null) {
      if (index - start > Math.max(45, length * 0.035)) bands.push({ start, end: index - 1 });
      start = null;
    }
  }
  return bands;
}

function detectInventoryCells(image) {
  const columns = findContentBands(image, "x");
  const rows = findContentBands(image, "y");
  if (!columns.length || !rows.length || columns.length * rows.length > 100) {
    throw new Error("Could not identify a clean card grid. Crop the screenshot to the inventory cards and try again.");
  }
  return rows.flatMap((row) => columns.map((column) => ({
    x: column.start,
    y: row.start,
    width: column.end - column.start + 1,
    height: row.end - row.start + 1
  })));
}

function imageSignature(image, sx, sy, sw, sh) {
  const width = 30;
  const height = 22;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  context.drawImage(image, sx, sy, sw, sh, 0, 0, width, height);
  const pixels = context.getImageData(0, 0, width, height).data;
  const signature = [];
  let average = 0;
  for (let index = 0; index < pixels.length; index += 4) {
    average += (pixels[index] + pixels[index + 1] + pixels[index + 2]) / 3;
  }
  average = average / (pixels.length / 4) || 1;
  for (let index = 0; index < pixels.length; index += 4) {
    const red = pixels[index] / 255;
    const green = pixels[index + 1] / 255;
    const blue = pixels[index + 2] / 255;
    const total = red + green + blue + 0.08;
    const luminance = ((pixels[index] + pixels[index + 1] + pixels[index + 2]) / 3) / average;
    signature.push(red / total, green / total, blue / total, Math.min(2, luminance) * 0.38);
  }
  return signature;
}

function signatureDistance(left, right) {
  let total = 0;
  const length = Math.min(left.length, right.length);
  for (let index = 0; index < length; index += 1) {
    const difference = left[index] - right[index];
    total += difference * difference;
  }
  return total / Math.max(1, length);
}

async function getReferenceSignatures() {
  if (referenceSignaturePromise) return referenceSignaturePromise;
  referenceSignaturePromise = (async () => {
    const model = await getImageModel();
    const references = [];
    for (let index = 0; index < state.cards.length; index += 1) {
      const card = state.cards[index];
      try {
        const image = await loadImageSource(imageURL(card));
        const canvas = createFeatureCanvas(
          image,
          image.width * 0.06,
          image.height * 0.1,
          image.width * 0.88,
          image.height * 0.34
        );
        references.push({ card, embedding: await imageEmbedding(model, canvas) });
      } catch (error) {
        console.warn(`Could not prepare image reference for ${card.name}`, error);
      }
      els.scanProgressText.textContent = `Comparing local card artwork… ${index + 1}/${state.cards.length}`;
      if (index % 4 === 0) await new Promise((resolve) => requestAnimationFrame(resolve));
    }
    return references;
  })();
  return referenceSignaturePromise;
}

function normalizedMask(points, outputWidth = 48, outputHeight = 30) {
  if (!points.length) return new Uint8Array(outputWidth * outputHeight);
  const minX = Math.min(...points.map((point) => point.x));
  const maxX = Math.max(...points.map((point) => point.x));
  const minY = Math.min(...points.map((point) => point.y));
  const maxY = Math.max(...points.map((point) => point.y));
  const mask = new Uint8Array(outputWidth * outputHeight);
  const sourceWidth = Math.max(1, maxX - minX);
  const sourceHeight = Math.max(1, maxY - minY);
  for (const point of points) {
    const x = Math.min(outputWidth - 1, Math.round(((point.x - minX) / sourceWidth) * (outputWidth - 1)));
    const y = Math.min(outputHeight - 1, Math.round(((point.y - minY) / sourceHeight) * (outputHeight - 1)));
    mask[y * outputWidth + x] = 1;
  }
  return mask;
}

function quantityTemplate(text, fontFamily) {
  const canvas = document.createElement("canvas");
  canvas.width = 90;
  canvas.height = 48;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  context.fillStyle = "#fff";
  context.font = `bold 38px ${fontFamily}`;
  context.textBaseline = "top";
  context.fillText(text, 1, 0);
  const { data, width, height } = context.getImageData(0, 0, canvas.width, canvas.height);
  const points = [];
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (data[(y * width + x) * 4 + 3] > 80) points.push({ x, y });
    }
  }
  return normalizedMask(points);
}

function maskDistance(left, right) {
  let mismatch = 0;
  for (let index = 0; index < left.length; index += 1) {
    if (left[index] !== right[index]) mismatch += 1;
  }
  return mismatch / left.length;
}

function detectQuantity(image, cell) {
  const sx = cell.x + cell.width * 0.68;
  const sy = cell.y + cell.height * 0.04;
  const sw = cell.width * 0.28;
  const sh = cell.height * 0.21;
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(sw));
  canvas.height = Math.max(1, Math.round(sh));
  const context = canvas.getContext("2d", { willReadFrequently: true });
  context.drawImage(image, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
  const { data, width, height } = context.getImageData(0, 0, canvas.width, canvas.height);
  const points = [];
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const offset = (y * width + x) * 4;
      const red = data[offset];
      const green = data[offset + 1];
      const blue = data[offset + 2];
      if (red > 180 && green > 150 && blue < 110 && red > blue * 1.5) points.push({ x, y });
    }
  }
  if (points.length < Math.max(55, width * height * 0.045)) return 1;
  const input = normalizedMask(points);
  const fonts = ["Georgia", '"Times New Roman"', "serif"];
  const score = (quantity) => Math.min(...fonts.map((font) => maskDistance(input, quantityTemplate(`X${quantity}`, font))));
  return score(4) + 0.01 < score(2) ? 4 : 2;
}

function cropPreview(image, cell) {
  const canvas = document.createElement("canvas");
  canvas.width = 100;
  canvas.height = 100;
  const context = canvas.getContext("2d");
  context.drawImage(image, cell.x, cell.y, cell.width, cell.height, 0, 0, 100, 100);
  return canvas.toDataURL("image/jpeg", 0.78);
}

function bestCardMatches(signature, references) {
  const ranked = references
    .map((reference) => ({ card: reference.card, distance: signatureDistance(signature, reference.signature) }))
    .sort((left, right) => left.distance - right.distance);
  const best = ranked[0];
  const second = ranked[1] || { distance: best.distance * 1.5 };
  const separation = Math.max(0, (second.distance - best.distance) / Math.max(second.distance, 0.0001));
  return {
    card: best.card,
    confidence: Math.round(Math.min(99, Math.max(1, separation * 180)))
  };
}

function renderScanReview() {
  const options = state.cards
    .map((card) => `<option value="${escapeHTML(card.id)}">${escapeHTML(card.name)}</option>`)
    .join("");
  els.scanSummary.textContent = `${state.scanResults.length} card slots detected. Review low-confidence matches before importing.`;
  els.scanResults.innerHTML = state.scanResults.map((result, index) => {
    const selectedOptions = options.replace(`value="${escapeHTML(result.cardId)}"`, `value="${escapeHTML(result.cardId)}" selected`);
    const confidenceClass = result.confidence >= 35 ? "is-good" : "needs-review";
    return `
      <div class="scan-result" data-scan-result="${index}">
        <img src="${result.preview}" alt="Detected inventory card ${index + 1}">
        <div class="scan-result-fields">
          <label>Matched card<select data-scan-card="${index}">${selectedOptions}</select></label>
          <span class="scan-confidence ${confidenceClass}">${result.confidence}% match confidence</span>\n          <span class="scan-method">${escapeHTML(result.method)}${result.displayedOdds ? ` · Read 1/${formatNumber(result.displayedOdds)}` : ""}${result.detectedBorders.length ? ` · ${escapeHTML(result.detectedBorders.join(" + "))}` : ""}</span>
        </div>
        <label class="scan-quantity">Copies<input data-scan-quantity="${index}" type="number" min="1" max="99" value="${result.quantity}"></label>
      </div>
    `;
  }).join("");
  els.scanProgress.hidden = true;
  els.scanAdd.disabled = false;
  els.scanReplace.disabled = false;
}

async function scanInventoryImage(file) {
  if (!state.cards.length) {
    showToast("Wait for the card library to finish loading");
    return;
  }
  els.scanModal.hidden = false;
  document.body.style.overflow = "hidden";
  els.scanProgress.hidden = false;
  els.scanProgressText.textContent = "Finding cards in the screenshot…";
  els.scanResults.innerHTML = "";
  els.scanSummary.textContent = "Comparing each inventory image against all 135 local card images.";
  els.scanAdd.disabled = true;
  els.scanReplace.disabled = true;
  try {
    const image = await loadImageFile(file);
    const cells = detectInventoryCells(image);
    const references = await getReferenceSignatures();
    const model = await getImageModel();
    if (!references.length) throw new Error("Local reference card images could not be loaded.");
    const results = [];
    for (let index = 0; index < cells.length; index += 1) {
      const cell = cells[index];
      els.scanProgressText.textContent = `Comparing card ${index + 1}/${cells.length}…`;
      const canvas = createFeatureCanvas(
        image,
        cell.x + cell.width * 0.06,
        cell.y + cell.height * 0.1,
        cell.width * 0.88,
        cell.height * 0.34
      );
      const embedding = await imageEmbedding(model, canvas);
      const match = matchCardByImage(embedding, references);
      const detectedBorders = detectScreenshotBorders(image, cell);
      results.push({
        cardId: match.card.id,
        confidence: match.confidence,
        quantity: detectQuantity(image, cell),
        preview: cropPreview(image, cell),
        method: match.method,
        displayedOdds: 0,
        detectedBorders,
        matchedCombination: [],
        alternatives: match.alternatives
      });
      await new Promise((resolve) => requestAnimationFrame(resolve));
    }
    state.scanResults = results;
    renderScanReview();
  } catch (error) {
    console.error("Inventory screenshot scan failed", error);
    els.scanProgress.hidden = true;
    els.scanSummary.textContent = error.message || "The screenshot could not be read.";
    els.scanResults.innerHTML = '<div class="scan-error">Crop the image to the card grid, then try again.</div>';
  }
}

function closeScanModal() {
  els.scanModal.hidden = true;
  document.body.style.overflow = els.cardModal.hidden ? "" : "hidden";
}

function applyScanResults(mode) {
  const imported = {};
  for (const result of state.scanResults) {
    imported[result.cardId] = (imported[result.cardId] || 0) + Math.max(1, Number(result.quantity) || 1);
  }
  if (mode === "replace") state.collection = imported;
  else {
    for (const [id, quantity] of Object.entries(imported)) {
      state.collection[id] = ownedCount(id) + quantity;
    }
  }
  state.team = state.team.filter((id) => ownedCount(id) > 0);
  saveState();
  updateCollectionSummary();
  renderTeam();
  renderGrid();
  closeScanModal();
  showToast(`${Object.keys(imported).length} cards imported from screenshot`);
}

function exportCollection() {
  const data = {
    version: 1,
    exportedAt: new Date().toISOString(),
    collection: state.collection,
    team: state.team
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "card-fantasy-collection.json";
  link.click();
  URL.revokeObjectURL(url);
}

async function importCollection(file) {
  try {
    const parsed = JSON.parse(await file.text());
    const importedCollection = parsed.collection && typeof parsed.collection === "object" ? parsed.collection : parsed;
    const cleanCollection = {};
    for (const card of state.cards) {
      const count = Math.max(0, Number(importedCollection[card.id] || 0));
      if (count > 0) cleanCollection[card.id] = Math.floor(count);
    }
    state.collection = cleanCollection;
    state.team = Array.isArray(parsed.team)
      ? parsed.team.filter((id) => cleanCollection[id] > 0 && state.cards.some((card) => card.id === id)).slice(0, MAX_TEAM_SIZE)
      : [];
    saveState();
    updateCollectionSummary();
    renderTeam();
    renderGrid();
    showToast("Collection imported");
  } catch (error) {
    console.error(error);
    showToast("That collection file could not be imported");
  }
}

function bindEvents() {
  els.searchInput.addEventListener("input", (event) => {
    state.query = event.target.value;
    scheduleGridRender();
  });

  els.sizeRange.addEventListener("input", (event) => {
    document.documentElement.style.setProperty("--card-size", `${event.target.value}px`);
    saveState();
  });

  els.sortSelect.addEventListener("change", (event) => {
    state.sort = event.target.value;
    renderGrid();
  });

  els.borderControls.addEventListener("click", (event) => {
    const button = event.target.closest("[data-border]");
    if (!button) return;
    toggleBorder(button.dataset.border);
  });

  els.ownedOnly.addEventListener("change", (event) => {
    state.ownedOnly = event.target.checked;
    renderGrid();
  });

  els.sourceFilters.addEventListener("click", (event) => {
    const button = event.target.closest("[data-source]");
    if (!button) return;
    state.source = button.dataset.source;
    renderFilters();
    renderGrid();
  });

  els.roleFilters.addEventListener("click", (event) => {
    const button = event.target.closest("[data-role]");
    if (!button) return;
    state.role = button.dataset.role;
    renderFilters();
    renderGrid();
  });

  els.cardGrid.addEventListener("click", (event) => {
    const tile = event.target.closest("[data-card-id]");
    if (tile) openModal(tile.dataset.cardId);
  });

  els.modalClose.addEventListener("click", closeModal);
  els.cardModal.addEventListener("click", (event) => {
    if (event.target === els.cardModal) closeModal();
  });

  els.modalBorderControls.addEventListener("click", (event) => {
    const button = event.target.closest("[data-modal-border]");
    if (!button) return;
    toggleBorder(button.dataset.modalBorder);
  });

  els.addCopyButton.addEventListener("click", () => {
    const card = selectedCard();
    if (card) changeOwned(card.id, 1);
  });

  els.removeCopyButton.addEventListener("click", () => {
    const card = selectedCard();
    if (card) changeOwned(card.id, -1);
  });

  els.teamButton.addEventListener("click", () => {
    const card = selectedCard();
    if (card) toggleTeam(card.id);
  });

  els.teamList.addEventListener("click", (event) => {
    const button = event.target.closest("[data-team-remove]");
    if (!button) return;
    state.team = state.team.filter((id) => id !== button.dataset.teamRemove);
    saveState();
    renderTeam();
    if (!els.cardModal.hidden) renderModal();
  });

  els.importButton.addEventListener("click", () => els.importInput.click());
  els.importInput.addEventListener("change", () => {
    const file = els.importInput.files?.[0];
    if (file?.type.startsWith("image/")) scanInventoryImage(file);
    else if (file) importCollection(file);
    els.importInput.value = "";
  });

  els.scanClose.addEventListener("click", closeScanModal);
  els.scanCancel.addEventListener("click", closeScanModal);
  els.scanModal.addEventListener("click", (event) => {
    if (event.target === els.scanModal) closeScanModal();
  });
  els.scanResults.addEventListener("change", (event) => {
    const cardSelect = event.target.closest("[data-scan-card]");
    if (cardSelect) state.scanResults[Number(cardSelect.dataset.scanCard)].cardId = cardSelect.value;
    const quantityInput = event.target.closest("[data-scan-quantity]");
    if (quantityInput) state.scanResults[Number(quantityInput.dataset.scanQuantity)].quantity = Math.max(1, Number(quantityInput.value) || 1);
  });
  els.scanAdd.addEventListener("click", () => applyScanResults("add"));
  els.scanReplace.addEventListener("click", () => applyScanResults("replace"));
  els.exportButton.addEventListener("click", exportCollection);

  els.clearCollectionButton.addEventListener("click", () => {
    if (!confirm("Clear your entire saved collection and team?")) return;
    state.collection = {};
    state.team = [];
    saveState();
    updateCollectionSummary();
    renderTeam();
    renderGrid();
    closeModal();
    showToast("Collection cleared");
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      if (!els.scanModal.hidden) closeScanModal();
      else closeModal();
    }
  });
}

async function fetchJSON(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${url} returned ${response.status}`);
  return response.json();
}

async function loadCards() {
  const index = await fetchJSON(DATA_URL);
  const partPaths = Array.isArray(index.parts) && index.parts.length ? index.parts : CARD_PARTS;
  const parts = await Promise.all(partPaths.map((path) => fetchJSON(`${LIBRARY_ROOT}${path}`)));
  const candidates = [
    ...(Array.isArray(index.cards) ? index.cards : []),
    ...parts.flatMap((part) => Array.isArray(part.cards) ? part.cards : [])
  ];
  state.cards = [...new Map(candidates.map((card) => [card.id, card])).values()]
    .filter((card) => Number(card.odds) > 0);
  if (!state.cards.length) throw new Error("No local card records were found");
  state.meta = index.meta || { variants: [] };
}

async function init() {
  loadSavedState();
  bindEvents();
  try {
    await loadCards();
    state.team = state.team.filter((id) => state.cards.some((card) => card.id === id) && ownedCount(id) > 0).slice(0, MAX_TEAM_SIZE);
    renderBorderControls();
    renderFilters();
    updateCollectionSummary();
    renderTeam();
    renderGrid();
    els.loadingState.hidden = true;
  } catch (error) {
    console.error("Local card data failed to load", error);
    els.loadingState.innerHTML = "The local card data could not be loaded. Refresh the page and try again.";
  }
}

init();
