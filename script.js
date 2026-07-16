const LIBRARY_ROOT = "./";
const DATA_URL = `${LIBRARY_ROOT}data/cards.json`;
const IMAGE_ROOT = `${LIBRARY_ROOT}assets/cards/`;
const CARD_PARTS = Array.from({ length: 7 }, (_, index) => `data/cards-${index + 1}.json`);
const STORAGE_KEY = "cf-deck-builder-state-v1";
const LEGACY_STORAGE_KEY = "card-fantasy-index-state-v1";
const MAX_TEAM_SIZE = 4;
const BORDER_ORDER = ["Shiny", "Diamond", "Radiant"];
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
  collectionVariants: {},
  team: [],
  teamVariants: [],
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
  removeTeamButton: document.querySelector("#removeTeamButton"),
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

function canonicalBorderNames(names = state.selectedBorders) {
  const selected = new Set(Array.from(names || []));
  return BORDER_ORDER.filter((name) => selected.has(name));
}

function variantKey(names = state.selectedBorders) {
  const ordered = canonicalBorderNames(names);
  return ordered.length ? ordered.join("+") : "Base";
}

function bordersFromVariantKey(key) {
  if (!key || key === "Base") return [];
  return canonicalBorderNames(String(key).split("+"));
}

function variantLabel(names = state.selectedBorders) {
  const ordered = canonicalBorderNames(names);
  return ordered.length ? ordered.join(" + ") : "Base";
}

function variantCode(names = state.selectedBorders) {
  const codes = { Shiny: "S", Diamond: "D", Radiant: "R" };
  const ordered = canonicalBorderNames(names);
  return ordered.length ? ordered.map((name) => codes[name]).join("") : "Base";
}

function ownedCount(id) {
  return Math.max(0, Number(state.collection[id] || 0));
}

function variantOwnedCount(id, names = state.selectedBorders) {
  const variants = state.collectionVariants[id];
  if (!variants || typeof variants !== "object") return 0;
  return Math.max(0, Number(variants[variantKey(names)] || 0));
}

function exactTeamCount(id, names = state.selectedBorders) {
  const key = variantKey(names);
  return state.teamVariants.filter((entry) => entry.id === id && variantKey(entry.borders) === key).length;
}

function sanitizeTeamVariants(entries = state.teamVariants) {
  const used = {};
  return entries.filter((entry) => {
    const key = `${entry.id}::${variantKey(entry.borders)}`;
    const nextCount = (used[key] || 0) + 1;
    if (nextCount > variantOwnedCount(entry.id, entry.borders)) return false;
    used[key] = nextCount;
    return true;
  }).slice(0, MAX_TEAM_SIZE);
}

function shouldHighlightTile(id) {
  if (!state.selectedBorders.size) return false;
  const isOpenCard = !els.cardModal.hidden && state.selectedId === id;
  return isOpenCard || variantOwnedCount(id) > 0;
}

function rebuildCollectionTotals() {
  const totals = {};
  for (const [id, variants] of Object.entries(state.collectionVariants)) {
    const total = Object.values(variants || {}).reduce((sum, count) => sum + Math.max(0, Math.floor(Number(count) || 0)), 0);
    if (total > 0) totals[id] = total;
  }
  state.collection = totals;
}

function syncLegacyTeam() {
  state.team = state.teamVariants.map((entry) => entry.id);
}

function saveState() {
  syncLegacyTeam();
  localStorage.setItem(STORAGE_KEY, JSON.stringify({
    collection: state.collection,
    collectionVariants: state.collectionVariants,
    team: state.team,
    teamVariants: state.teamVariants,
    selectedBorders: selectedBorderNames(),
    cardSize: Number(els.sizeRange.value || 190)
  }));
}

function loadSavedState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || localStorage.getItem(LEGACY_STORAGE_KEY) || "{}");
    if (saved.collectionVariants && typeof saved.collectionVariants === "object") {
      state.collectionVariants = saved.collectionVariants;
      rebuildCollectionTotals();
    } else if (saved.collection && typeof saved.collection === "object") {
      state.collection = saved.collection;
      state.collectionVariants = {};
      for (const [id, count] of Object.entries(saved.collection)) {
        const cleanCount = Math.max(0, Math.floor(Number(count) || 0));
        if (cleanCount > 0) state.collectionVariants[id] = { Base: cleanCount };
      }
    }

    if (Array.isArray(saved.teamVariants)) {
      state.teamVariants = saved.teamVariants.slice(0, MAX_TEAM_SIZE).map((entry) => ({
        id: String(entry?.id || ""),
        borders: canonicalBorderNames(entry?.borders || [])
      }));
    } else if (Array.isArray(saved.team)) {
      state.teamVariants = saved.team.slice(0, MAX_TEAM_SIZE).map((id) => ({ id: String(id), borders: [] }));
    }
    syncLegacyTeam();

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
  const owned = variantOwnedCount(card.id);
  const accent = accentForCard(card);
  const showVariantBorder = shouldHighlightTile(card.id);
  return `
    <button class="card-tile ${showVariantBorder ? "has-modifiers" : ""}" type="button" data-card-id="${escapeHTML(card.id)}" style="--accent:${accent};${showVariantBorder ? borderVisualStyle() : ""}">
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
    const entry = state.teamVariants[index];
    const card = entry ? teamCard(entry.id) : null;
    if (!card) {
      slots.push(`<div class="team-slot is-empty">Empty slot</div>`);
      continue;
    }
    const borders = canonicalBorderNames(entry.borders);
    const stats = statsForCard(card, new Set(borders));
    totalHP += stats.hp;
    totalATK += stats.atk;
    slots.push(`
      <div class="team-slot ${borders.length ? "has-modifiers" : ""}" data-team-id="${escapeHTML(card.id)}" style="${borderVisualStyle(borders)}">
        <img src="${imageURL(card)}" alt="" onerror="this.style.visibility='hidden'">
        <span><strong>${escapeHTML(card.name)}</strong><small>${escapeHTML(variantCode(borders))} · ${formatNumber(stats.hp)} HP · ${formatNumber(stats.atk)} ATK</small></span>
        <button class="team-remove" type="button" data-team-remove-index="${index}" aria-label="Remove ${escapeHTML(variantCode(borders))} ${escapeHTML(card.name)}">×</button>
      </div>
    `);
  }

  els.teamList.innerHTML = slots.join("");
  els.teamCount.textContent = `${state.teamVariants.length}/${MAX_TEAM_SIZE}`;
  els.teamHP.textContent = formatNumber(totalHP);
  els.teamATK.textContent = formatNumber(totalATK);
}

function selectedCard() {
  return state.cards.find((card) => card.id === state.selectedId) || null;
}

function renderModal() {
  const card = selectedCard();
  if (!card) return;
  const selectedNames = selectedBorderNames();
  const stats = statsForCard(card, new Set(selectedNames));
  const owned = ownedCount(card.id);
  const ownedVariant = variantOwnedCount(card.id, selectedNames);
  const teamCopies = exactTeamCount(card.id, selectedNames);

  els.modalSource.textContent = sourceName(card);
  els.modalName.textContent = card.name;
  els.modalAbility.textContent = card.abilityDescription || "No ability description available.";
  els.modalHP.textContent = formatNumber(stats.hp);
  els.modalATK.textContent = formatNumber(stats.atk);
  els.modalOdds.textContent = formatOdds(stats.odds);
  els.modalOwned.textContent = `${formatNumber(ownedVariant)} ${variantLabel(selectedNames)} · ${formatNumber(owned)} total`;
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

  els.removeCopyButton.disabled = ownedVariant <= 0;
  els.removeTeamButton.disabled = teamCopies <= 0;
  els.removeTeamButton.textContent = teamCopies > 0
    ? `− ${variantCode(selectedNames)} team copy (${teamCopies})`
    : "− Team copy";
  els.teamButton.textContent = `+ ${variantCode(selectedNames)} team copy`;
  els.teamButton.classList.toggle("is-active", teamCopies > 0);
  els.teamButton.disabled = ownedVariant <= teamCopies || state.teamVariants.length >= MAX_TEAM_SIZE;

  applyBorderHighlight(els.modalDialog);
  applyBorderHighlight(els.modalImageWrap);
}

function openModal(id) {
  state.selectedId = id;
  els.cardModal.hidden = false;
  document.body.style.overflow = "hidden";
  renderModal();
  updateTile(id);
}

function closeModal() {
  const previousId = state.selectedId;
  els.cardModal.hidden = true;
  state.selectedId = null;
  document.body.style.overflow = "";
  if (previousId) updateTile(previousId);
}

function updateTile(id) {
  const tile = els.cardGrid.querySelector(`[data-card-id="${CSS.escape(id)}"]`);
  if (!tile) return;
  const badge = tile.querySelector("[data-owned-badge]");
  const owned = variantOwnedCount(id);
  badge.textContent = owned;
  badge.hidden = owned <= 0;
  applyBorderHighlight(tile, shouldHighlightTile(id) ? state.selectedBorders : []);
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
    const badge = tile.querySelector("[data-owned-badge]");
    const ownedVariant = variantOwnedCount(card.id);
    if (badge) {
      badge.textContent = ownedVariant;
      badge.hidden = ownedVariant <= 0;
    }
    applyBorderHighlight(tile, shouldHighlightTile(card.id) ? state.selectedBorders : []);
  });
}

function changeOwned(id, amount) {
  const key = variantKey();
  const current = variantOwnedCount(id);
  const next = Math.max(0, current + amount);
  if (!state.collectionVariants[id]) state.collectionVariants[id] = {};
  if (next > 0) state.collectionVariants[id][key] = next;
  else delete state.collectionVariants[id][key];
  if (!Object.keys(state.collectionVariants[id]).length) delete state.collectionVariants[id];

  rebuildCollectionTotals();
  let remainingCopies = next;
  state.teamVariants = state.teamVariants.filter((entry) => {
    if (entry.id !== id || variantKey(entry.borders) !== key) return true;
    if (remainingCopies <= 0) return false;
    remainingCopies -= 1;
    return true;
  });
  saveState();
  updateCollectionSummary();
  updateTile(id);
  renderTeam();
  renderModal();
  if (state.ownedOnly && ownedCount(id) === 0) renderGrid();
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

function addTeamVariant(id) {
  const borders = selectedBorderNames();
  const ownedCopies = variantOwnedCount(id, borders);
  const teamCopies = exactTeamCount(id, borders);

  if (ownedCopies <= teamCopies) {
    showToast(`Add another ${variantCode(borders)} copy first`);
    return;
  }
  if (state.teamVariants.length >= MAX_TEAM_SIZE) {
    showToast("Your team is full");
    return;
  }

  state.teamVariants.push({ id, borders: canonicalBorderNames(borders) });
  saveState();
  renderTeam();
  renderModal();
  showToast(`Added ${variantCode(borders)} card to team`);
}

function removeTeamVariant(id) {
  const key = variantKey(selectedBorderNames());
  let index = -1;
  for (let position = state.teamVariants.length - 1; position >= 0; position -= 1) {
    const entry = state.teamVariants[position];
    if (entry.id === id && variantKey(entry.borders) === key) {
      index = position;
      break;
    }
  }

  if (index < 0) {
    showToast("That card variant is not in the team");
    return;
  }

  state.teamVariants.splice(index, 1);
  saveState();
  renderTeam();
  renderModal();
  showToast("Removed one team copy");
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

function borderCombinationDifference(left, right) {
  const leftSet = new Set(canonicalBorderNames(left));
  const rightSet = new Set(canonicalBorderNames(right));
  let difference = 0;
  for (const name of BORDER_ORDER) {
    if (leftSet.has(name) !== rightSet.has(name)) difference += 1;
  }
  return difference;
}

function matchCardByImage(embedding, references, recognition, detectedBorders) {
  const hasOdds = Number(recognition?.odds) > 0;
  const combinations = allBorderCombinations();
  const ranking = references.map((reference) => {
    const similarity = embeddingSimilarity(embedding, reference.embedding);
    let oddsError = Infinity;
    let borderDifference = 0;
    let combination = { names: [], multiplier: 1 };

    if (hasOdds) {
      const candidates = combinations.map((candidate) => {
        const expectedOdds = Math.max(1, Number(reference.card.odds || 1) * candidate.multiplier);
        const error = Math.abs(Math.log(expectedOdds / Math.max(1, recognition.odds)));
        const difference = detectedBorders.length
          ? borderCombinationDifference(candidate.names, detectedBorders)
          : 0;
        return {
          combination: candidate,
          error,
          difference,
          score: error + difference * 0.08
        };
      }).sort((left, right) => left.score - right.score);
      const bestOdds = candidates[0];
      oddsError = bestOdds.error;
      borderDifference = bestOdds.difference;
      combination = bestOdds.combination;
    }

    const oddsStrength = hasOdds ? Math.exp(-oddsError * 12) : 0;
    const combinedScore = similarity + oddsStrength * 1.35 - borderDifference * 0.16;
    return {
      card: reference.card,
      similarity,
      oddsError,
      borderDifference,
      combination,
      combinedScore
    };
  }).sort((left, right) => right.combinedScore - left.combinedScore);

  const best = ranking[0];
  const second = ranking[1] || { combinedScore: best.combinedScore - 0.08 };
  const separation = Math.max(0, best.combinedScore - second.combinedScore);
  const exactOdds = hasOdds && best.oddsError < 0.018;
  const matchingBorder = !detectedBorders.length || best.borderDifference === 0;
  let confidence;

  if (exactOdds) {
    confidence = 72 + Math.min(15, separation * 120) + (matchingBorder ? 8 : 0);
  } else if (hasOdds) {
    confidence = 35 + Math.min(25, separation * 100) + Math.max(0, 20 - best.oddsError * 30);
  } else {
    const visualGap = Math.max(0, best.similarity - (ranking[1]?.similarity || best.similarity - 0.04));
    confidence = 18 + Math.min(50, visualGap * 220);
  }

  return {
    card: best.card,
    confidence: Math.round(Math.max(10, Math.min(96, confidence))),
    method: exactOdds
      ? "Artwork + exact odds + border"
      : hasOdds
        ? "Artwork + closest odds"
        : "Artwork only — verify match",
    combination: best.combination.names,
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
  const sx = cell.x + cell.width * 0.31;
  const sy = cell.y + cell.height * 0.76;
  const sw = cell.width * 0.67;
  const sh = cell.height * 0.21;
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
      if (Math.max(data[offset], data[offset + 1], data[offset + 2]) > 36) visible += 1;
    }
    active[index] = visible / Math.ceil(crossLength / 2) > 0.08;
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
          image.width * 0.14,
          image.height * 0.08,
          image.width * 0.80,
          image.height * 0.48
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

const quantityGlyphCache = new Map();

function glyphTemplate(character, fontFamily) {
  const cacheKey = character + "::" + fontFamily;
  if (quantityGlyphCache.has(cacheKey)) return quantityGlyphCache.get(cacheKey);
  const canvas = document.createElement("canvas");
  canvas.width = 32;
  canvas.height = 32;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  context.fillStyle = "#fff";
  context.font = "700 14px " + fontFamily;
  context.textBaseline = "top";
  context.fillText(character, 2, 1);
  const { data, width, height } = context.getImageData(0, 0, canvas.width, canvas.height);
  const points = [];
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (data[(y * width + x) * 4 + 3] > 70) points.push({ x, y });
    }
  }
  const template = normalizedMask(points, 16, 20);
  quantityGlyphCache.set(cacheKey, template);
  return template;
}

function quantityComponents(image, cell) {
  const sx = cell.x + cell.width * 0.12;
  const sy = cell.y + cell.height * 0.09;
  const sw = cell.width * 0.22;
  const sh = cell.height * 0.13;
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(sw));
  canvas.height = Math.max(1, Math.round(sh));
  const context = canvas.getContext("2d", { willReadFrequently: true });
  context.drawImage(image, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
  const { data, width, height } = context.getImageData(0, 0, canvas.width, canvas.height);
  const active = new Uint8Array(width * height);

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const offset = (y * width + x) * 4;
      const red = data[offset];
      const green = data[offset + 1];
      const blue = data[offset + 2];
      const maximum = Math.max(red, green, blue);
      const minimum = Math.min(red, green, blue);
      if (maximum > 115 && maximum - minimum < 72) active[y * width + x] = 1;
    }
  }

  const visited = new Uint8Array(active.length);
  const components = [];
  for (let start = 0; start < active.length; start += 1) {
    if (!active[start] || visited[start]) continue;
    const queue = [start];
    const points = [];
    visited[start] = 1;
    while (queue.length) {
      const current = queue.pop();
      const x = current % width;
      const y = Math.floor(current / width);
      points.push({ x, y });
      const neighbors = [current - 1, current + 1, current - width, current + width];
      for (const neighbor of neighbors) {
        if (neighbor < 0 || neighbor >= active.length || visited[neighbor] || !active[neighbor]) continue;
        const neighborX = neighbor % width;
        if (Math.abs(neighborX - x) > 1) continue;
        visited[neighbor] = 1;
        queue.push(neighbor);
      }
    }

    const xs = points.map((point) => point.x);
    const ys = points.map((point) => point.y);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    const componentWidth = maxX - minX + 1;
    const componentHeight = maxY - minY + 1;
    if (points.length >= 4 && componentWidth <= 13 && componentHeight >= 4 && componentHeight <= 14) {
      components.push({ points, minX, maxX, minY, maxY, width: componentWidth, height: componentHeight });
    }
  }
  return components.sort((left, right) => left.minX - right.minX);
}

function maskDistance(left, right) {
  let mismatch = 0;
  const length = Math.min(left.length, right.length);
  for (let index = 0; index < length; index += 1) {
    if (left[index] !== right[index]) mismatch += 1;
  }
  return mismatch / Math.max(1, length);
}

function recognizeQuantityGlyph(component) {
  const input = normalizedMask(component.points, 16, 20);
  const fonts = ["Arial", "Helvetica", "Verdana", "sans-serif"];
  let best = { digit: "", distance: Infinity };
  for (let digit = 0; digit <= 9; digit += 1) {
    for (const font of fonts) {
      const distance = maskDistance(input, glyphTemplate(String(digit), font));
      if (distance < best.distance) best = { digit: String(digit), distance };
    }
  }
  return best;
}

function detectQuantity(image, cell) {
  const components = quantityComponents(image, cell);
  if (components.length < 2) return 1;

  for (let start = 0; start < components.length - 1; start += 1) {
    const first = components[start];
    const line = [first];
    for (let index = start + 1; index < components.length; index += 1) {
      const candidate = components[index];
      const previous = line[line.length - 1];
      const baselineDifference = Math.abs(candidate.maxY - first.maxY);
      const gap = candidate.minX - previous.maxX;
      if (baselineDifference <= 3 && gap >= 0 && gap <= 7) line.push(candidate);
      else if (gap > 7) break;
    }
    if (line.length < 2 || first.height < 5) continue;

    const digits = line.slice(1, 3).map(recognizeQuantityGlyph);
    if (!digits.length || digits.some((result) => result.distance > 0.48)) continue;
    const quantity = Number(digits.map((result) => result.digit).join(""));
    if (Number.isInteger(quantity) && quantity >= 2 && quantity <= 99) return quantity;
  }
  return 1;
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
  els.scanSummary.textContent = `${state.scanResults.length} card slots detected. Odds and borders improve the match; check tiny quantity badges before importing.`;
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
    let ocrWorker = null;
    try {
      ocrWorker = await getOCRWorker();
    } catch (error) {
      console.warn("Odds OCR unavailable; continuing with artwork matching", error);
    }
    if (!references.length) throw new Error("Local reference card images could not be loaded.");
    const results = [];
    for (let index = 0; index < cells.length; index += 1) {
      const cell = cells[index];
      els.scanProgressText.textContent = `Reading card ${index + 1}/${cells.length}…`;
      const canvas = createFeatureCanvas(
        image,
        cell.x + cell.width * 0.14,
        cell.y + cell.height * 0.08,
        cell.width * 0.80,
        cell.height * 0.48
      );
      const embedding = await imageEmbedding(model, canvas);
      const detectedBorders = detectScreenshotBorders(image, cell);
      let recognition = { odds: 0, text: "", confidence: 0 };
      if (ocrWorker) {
        recognition = await recognizeDisplayedOdds(ocrWorker, image, cell, false);
        if (!recognition.odds) recognition = await recognizeDisplayedOdds(ocrWorker, image, cell, true);
      }
      const match = matchCardByImage(embedding, references, recognition, detectedBorders);
      const resolvedBorders = detectedBorders.length ? detectedBorders : match.combination;
      results.push({
        cardId: match.card.id,
        confidence: match.confidence,
        quantity: detectQuantity(image, cell),
        preview: cropPreview(image, cell),
        method: match.method,
        displayedOdds: recognition.odds,
        detectedBorders: resolvedBorders,
        matchedCombination: match.combination,
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
  const importedVariants = {};
  for (const result of state.scanResults) {
    const id = result.cardId;
    const key = variantKey(result.detectedBorders || []);
    if (!importedVariants[id]) importedVariants[id] = {};
    importedVariants[id][key] = (importedVariants[id][key] || 0) + Math.max(1, Number(result.quantity) || 1);
  }

  if (mode === "replace") state.collectionVariants = {};
  for (const [id, variants] of Object.entries(importedVariants)) {
    if (!state.collectionVariants[id]) state.collectionVariants[id] = {};
    for (const [key, quantity] of Object.entries(variants)) {
      state.collectionVariants[id][key] = mode === "replace"
        ? quantity
        : Math.max(0, Number(state.collectionVariants[id][key] || 0)) + quantity;
    }
  }

  rebuildCollectionTotals();
  state.teamVariants = sanitizeTeamVariants(state.teamVariants);
  saveState();
  updateCollectionSummary();
  renderTeam();
  renderGrid();
  closeScanModal();
  showToast(`${Object.keys(importedVariants).length} cards imported from screenshot`);
}

function exportCollection() {
  syncLegacyTeam();
  const data = {
    version: 2,
    exportedAt: new Date().toISOString(),
    collection: state.collection,
    collectionVariants: state.collectionVariants,
    team: state.team,
    teamVariants: state.teamVariants
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
    const cardIds = new Set(state.cards.map((card) => card.id));
    const cleanVariants = {};

    if (parsed.collectionVariants && typeof parsed.collectionVariants === "object") {
      for (const [id, variants] of Object.entries(parsed.collectionVariants)) {
        if (!cardIds.has(id) || !variants || typeof variants !== "object") continue;
        for (const [key, count] of Object.entries(variants)) {
          const cleanCount = Math.max(0, Math.floor(Number(count) || 0));
          if (!cleanCount) continue;
          const cleanKey = variantKey(bordersFromVariantKey(key));
          if (!cleanVariants[id]) cleanVariants[id] = {};
          cleanVariants[id][cleanKey] = (cleanVariants[id][cleanKey] || 0) + cleanCount;
        }
      }
    } else {
      const importedCollection = parsed.collection && typeof parsed.collection === "object" ? parsed.collection : parsed;
      for (const id of cardIds) {
        const count = Math.max(0, Math.floor(Number(importedCollection[id] || 0)));
        if (count > 0) cleanVariants[id] = { Base: count };
      }
    }

    state.collectionVariants = cleanVariants;
    rebuildCollectionTotals();

    const importedTeamVariants = Array.isArray(parsed.teamVariants)
      ? parsed.teamVariants
      : Array.isArray(parsed.team)
        ? parsed.team.map((id) => ({ id, borders: [] }))
        : [];

    state.teamVariants = sanitizeTeamVariants(importedTeamVariants
      .map((entry) => ({ id: String(entry?.id || ""), borders: canonicalBorderNames(entry?.borders || []) }))
      .filter((entry) => cardIds.has(entry.id)));

    saveState();
    updateCollectionSummary();
    renderTeam();
    renderGrid();
    showToast("Collection imported with card variants");
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
    if (card) addTeamVariant(card.id);
  });
  els.removeTeamButton.addEventListener("click", () => {
    const card = selectedCard();
    if (card) removeTeamVariant(card.id);
  });

  els.teamList.addEventListener("click", (event) => {
    const button = event.target.closest("[data-team-remove-index]");
    if (!button) return;
    const index = Number(button.dataset.teamRemoveIndex);
    if (Number.isInteger(index)) state.teamVariants.splice(index, 1);
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
    state.collectionVariants = {};
    state.team = [];
    state.teamVariants = [];
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
    state.teamVariants = sanitizeTeamVariants(state.teamVariants.filter((entry) => state.cards.some((card) => card.id === entry.id)));
    syncLegacyTeam();
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
