const LIBRARY_ROOT = "./";
const DATA_URL = `${LIBRARY_ROOT}data/cards.json`;
const IMAGE_ROOT = `${LIBRARY_ROOT}assets/cards/`;
const STORAGE_KEY = "cf-deck-builder-state-v1";
const MAX_TEAM_SIZE = 4;

const els = {
  ownedCount: document.querySelector("#assistantOwnedCount"),
  ownedProgress: document.querySelector("#assistantOwnedProgress"),
  teamCount: document.querySelector("#assistantTeamCount"),
  currentTeam: document.querySelector("#assistantCurrentTeam"),
  ownedStrip: document.querySelector("#assistantOwnedStrip")
};

const state = { cards: [], collection: {}, team: [] };

function escapeHTML(value) {
  return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
}

function imageURL(card) {
  return `${IMAGE_ROOT}${encodeURIComponent(card.id)}.png`;
}

function ownedCount(id) {
  return Math.max(0, Number(state.collection[id] || 0));
}

async function fetchJSON(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${url} returned ${response.status}`);
  return response.json();
}

async function loadCards() {
  const index = await fetchJSON(DATA_URL);
  const parts = await Promise.all((index.parts || []).map((path) => fetchJSON(`${LIBRARY_ROOT}${path}`)));
  state.cards = parts.flatMap((part) => Array.isArray(part.cards) ? part.cards : []);
}

function loadCollection() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    if (saved.collection && typeof saved.collection === "object") state.collection = saved.collection;
    if (Array.isArray(saved.team)) state.team = saved.team.slice(0, MAX_TEAM_SIZE);
  } catch (error) {
    console.warn("Could not read saved collection", error);
  }
}

function renderSummary() {
  const owned = state.cards.filter((card) => ownedCount(card.id) > 0);
  els.ownedCount.textContent = `${owned.length} / ${state.cards.length}`;
  els.ownedProgress.style.width = `${state.cards.length ? owned.length / state.cards.length * 100 : 0}%`;
  els.teamCount.textContent = `${state.team.length}/${MAX_TEAM_SIZE}`;

  els.currentTeam.innerHTML = Array.from({ length: MAX_TEAM_SIZE }, (_, index) => {
    const card = state.cards.find((item) => item.id === state.team[index]);
    if (!card) return '<div class="assistant-team-slot is-empty">Empty slot</div>';
    return `<div class="assistant-team-slot"><img src="${imageURL(card)}" alt=""><span><strong>${escapeHTML(card.name)}</strong><small>${ownedCount(card.id)} owned</small></span></div>`;
  }).join("");

  if (!owned.length) {
    els.ownedStrip.innerHTML = '<div class="owned-empty">No cards have been added to the collection yet.</div>';
    return;
  }
  els.ownedStrip.innerHTML = owned
    .sort((left, right) => Number(right.odds) - Number(left.odds))
    .slice(0, 24)
    .map((card) => `<div class="owned-card"><img src="${imageURL(card)}" alt=""><strong>${escapeHTML(card.name)}</strong><small>x${ownedCount(card.id)}</small></div>`)
    .join("");
}

async function init() {
  loadCollection();
  try {
    await loadCards();
    state.team = state.team.filter((id) => state.cards.some((card) => card.id === id) && ownedCount(id) > 0);
    renderSummary();
  } catch (error) {
    console.error("Assistant data failed to load", error);
    els.ownedStrip.innerHTML = '<div class="owned-empty">The local card data could not be loaded.</div>';
  }
}

init();
