const LIBRARY_ROOT = "https://raw.githubusercontent.com/DaddyDrag0/Card-Fantasy-Library/main/";
const DATA_URL = `${LIBRARY_ROOT}data/cards.json`;
const IMAGE_ROOT = `${LIBRARY_ROOT}assets/cards/`;
const STORAGE_KEY = "cf-deck-builder-state-v1";
const LEGACY_STORAGE_KEY = "card-fantasy-index-state-v1";
const MAX_TEAM_SIZE = 4;

const state = {
  cards: [],
  meta: { variants: [] },
  query: "",
  tier: "all",
  source: "all",
  sort: "odds-asc",
  border: "Base",
  ownedOnly: false,
  selectedId: null,
  collection: {},
  team: []
};

const els = {
  cardGrid: document.querySelector("#cardGrid"),
  loadingState: document.querySelector("#loadingState"),
  emptyState: document.querySelector("#emptyState"),
  resultCount: document.querySelector("#resultCount"),
  searchInput: document.querySelector("#searchInput"),
  sizeRange: document.querySelector("#sizeRange"),
  sortSelect: document.querySelector("#sortSelect"),
  borderSelect: document.querySelector("#borderSelect"),
  ownedOnly: document.querySelector("#ownedOnly"),
  tierFilters: document.querySelector("#tierFilters"),
  sourceFilters: document.querySelector("#sourceFilters"),
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
  modalClose: document.querySelector("#modalClose"),
  modalImage: document.querySelector("#modalImage"),
  modalImageFallback: document.querySelector("#modalImageFallback"),
  modalTier: document.querySelector("#modalTier"),
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

function getBorderDefinition(name = state.border) {
  if (name === "Base") return null;
  return (state.meta.variants || []).find((variant) => variant.name === name) || null;
}

function statsForCard(card, borderName = state.border) {
  const border = getBorderDefinition(borderName);
  const borderChance = border ? Number(border.chance || 1) : 1;
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
    border: state.border,
    cardSize: Number(els.sizeRange.value || 190)
  }));
}

function loadSavedState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || localStorage.getItem(LEGACY_STORAGE_KEY) || "{}");
    if (saved.collection && typeof saved.collection === "object") state.collection = saved.collection;
    if (Array.isArray(saved.team)) state.team = saved.team.slice(0, MAX_TEAM_SIZE);
    if (typeof saved.border === "string") state.border = saved.border;
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
      card.tier,
      card.source,
      card.weather
    ].join(" ")).includes(query);
    const matchesTier = state.tier === "all" || card.tier === state.tier;
    const matchesSource = state.source === "all" || sourceName(card) === state.source;
    const matchesOwned = !state.ownedOnly || ownedCount(card.id) > 0;
    return matchesQuery && matchesTier && matchesSource && matchesOwned;
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
    <button class="card-tile" type="button" data-card-id="${escapeHTML(card.id)}" style="--accent:${accent}">
      <span class="card-image-frame">
        <span class="card-fallback">${escapeHTML(card.name)}</span>
        <img src="${imageURL(card)}" alt="${escapeHTML(card.name)}" loading="lazy" decoding="async" onload="this.previousElementSibling.hidden=true" onerror="this.hidden=true">
      </span>
      ${owned > 0 ? `<span class="card-owned-badge" data-owned-badge>${owned}</span>` : `<span class="card-owned-badge" data-owned-badge hidden>0</span>`}
      <h3>${escapeHTML(card.name)}</h3>
      <p class="card-subline"><span>${escapeHTML(card.tier || "Card")}</span><span>${escapeHTML(sourceName(card))}</span></p>
      <p class="card-statline"><span>HP <b data-card-hp>${formatNumber(stats.hp)}</b></span><span>ATK <b data-card-atk>${formatNumber(stats.atk)}</b></span></p>
    </button>
  `;
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
  const tiers = ["all", ...new Set(state.cards.map((card) => card.tier).filter(Boolean))];
  const sources = ["all", ...new Set(state.cards.map(sourceName))];
  renderPills(els.tierFilters, tiers, state.tier, "tier");
  renderPills(els.sourceFilters, sources, state.source, "source");
}

function renderBorderOptions() {
  const names = ["Base", ...(state.meta.variants || []).map((variant) => variant.name)];
  if (!names.includes(state.border)) state.border = "Base";
  els.borderSelect.innerHTML = names.map((name) => `<option value="${escapeHTML(name)}" ${name === state.border ? "selected" : ""}>${escapeHTML(name)}</option>`).join("");
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
      <div class="team-slot" data-team-id="${escapeHTML(card.id)}">
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
  const border = getBorderDefinition();

  els.modalTier.textContent = `${card.tier || "Card"} · ${sourceName(card)}`;
  els.modalName.textContent = card.name;
  els.modalAbility.textContent = card.abilityDescription || "No ability description available.";
  els.modalHP.textContent = formatNumber(stats.hp);
  els.modalATK.textContent = formatNumber(stats.atk);
  els.modalOdds.textContent = formatOdds(stats.odds);
  els.modalOwned.textContent = formatNumber(owned);
  els.modalTags.innerHTML = [
    titleCase(card.ability || card.abilityType || "No ability"),
    card.source || sourceName(card),
    state.border
  ].map((tag) => `<span class="modal-tag">${escapeHTML(tag)}</span>`).join("");

  els.modalImage.hidden = false;
  els.modalImageFallback.hidden = true;
  els.modalImage.src = imageURL(card);
  els.modalImage.alt = card.name;
  els.modalImage.onerror = () => {
    els.modalImage.hidden = true;
    els.modalImageFallback.hidden = false;
  };

  const borderNames = ["Base", ...(state.meta.variants || []).map((variant) => variant.name)];
  els.modalBorderControls.innerHTML = borderNames.map((name) => {
    const definition = getBorderDefinition(name);
    const color = definition?.color || "#8d4dff";
    return `<button class="border-button ${state.border === name ? "is-active" : ""}" type="button" data-modal-border="${escapeHTML(name)}" style="--border-color:${color}">${escapeHTML(name)}</button>`;
  }).join("");

  els.removeCopyButton.disabled = owned <= 0;
  els.teamButton.textContent = inTeam ? "Remove from team" : "Add to team";
  els.teamButton.classList.toggle("is-active", inTeam);
  els.teamButton.disabled = !inTeam && (owned <= 0 || state.team.length >= MAX_TEAM_SIZE);

  if (border) {
    document.documentElement.style.setProperty("--active-border", border.color || "#8d4dff");
  }
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
    renderGrid();
  });

  els.sizeRange.addEventListener("input", (event) => {
    document.documentElement.style.setProperty("--card-size", `${event.target.value}px`);
    saveState();
  });

  els.sortSelect.addEventListener("change", (event) => {
    state.sort = event.target.value;
    renderGrid();
  });

  els.borderSelect.addEventListener("change", (event) => {
    state.border = event.target.value;
    saveState();
    updateVisibleStats();
    renderTeam();
    if (!els.cardModal.hidden) renderModal();
  });

  els.ownedOnly.addEventListener("change", (event) => {
    state.ownedOnly = event.target.checked;
    renderGrid();
  });

  els.tierFilters.addEventListener("click", (event) => {
    const button = event.target.closest("[data-tier]");
    if (!button) return;
    state.tier = button.dataset.tier;
    renderFilters();
    renderGrid();
  });

  els.sourceFilters.addEventListener("click", (event) => {
    const button = event.target.closest("[data-source]");
    if (!button) return;
    state.source = button.dataset.source;
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
    state.border = button.dataset.modalBorder;
    els.borderSelect.value = state.border;
    saveState();
    updateVisibleStats();
    renderTeam();
    renderModal();
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
    if (file) importCollection(file);
    els.importInput.value = "";
  });
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
    if (event.key === "Escape") closeModal();
  });
}

async function fetchJSON(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${url} returned ${response.status}`);
  return response.json();
}

async function loadCards() {
  const index = await fetchJSON(DATA_URL);
  const parts = await Promise.all((index.parts || []).map((path) => fetchJSON(`${LIBRARY_ROOT}${path}`)));
  state.cards = parts.flatMap((part) => Array.isArray(part.cards) ? part.cards : [])
    .filter((card) => Number(card.odds) > 0);
  state.meta = index.meta || { variants: [] };
}

async function init() {
  loadSavedState();
  bindEvents();
  try {
    await loadCards();
    state.team = state.team.filter((id) => state.cards.some((card) => card.id === id) && ownedCount(id) > 0).slice(0, MAX_TEAM_SIZE);
    renderBorderOptions();
    renderFilters();
    updateCollectionSummary();
    renderTeam();
    renderGrid();
    els.loadingState.hidden = true;
  } catch (error) {
    console.error("Card library failed to load", error);
    els.loadingState.innerHTML = "The Card-Fantasy-Library data could not be loaded. Refresh the page and try again.";
  }
}

init();
