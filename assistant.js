const LIBRARY_ROOT = "./";
const DATA_URL = `${LIBRARY_ROOT}data/cards.json`;
const IMAGE_ROOT = `${LIBRARY_ROOT}assets/cards/`;
const STORAGE_KEY = "cf-deck-builder-state-v1";
const MAX_TEAM_SIZE = 4;
const TOWER_API_URL = "https://script.google.com/macros/s/AKfycbwndb-XXP5r6-fIa-Dge9yBnvF0UZrVdyONry4b3f7H9oTQ4R0HH3baj78Br60m8KQc/exec";

const BOSS_ENCOUNTERS = [
  {
    id: "fungal-crown",
    name: "Fungal Crown Boss",
    enemies: [
      { name: "Shroom Commander", hp: 46723, atk: 15574 },
      { name: "Shroom King", hp: 69414, atk: 23136 },
      { name: "The Wandering Shroom", hp: 148236, atk: 49410 }
    ]
  },
  {
    id: "neptune",
    name: "Neptune Boss",
    enemies: [
      { name: "Deep Sea Fisherman", hp: 29534, atk: 9841 },
      { name: "Diver", hp: 51031, atk: 17009 },
      { name: "Siren", hp: 68198, atk: 22730 },
      { name: "Neptune", hp: 119811, atk: 39935 }
    ]
  },
  {
    id: "storm-leviathan",
    name: "Storm Leviathan Boss",
    enemies: [
      { name: "Storm Leviathan", hp: 449706, atk: 149902 }
    ]
  },
  {
    id: "secret-summer",
    name: "Secret Summer Boss",
    enemies: [
      { name: "Secret Boss", hp: 539520, atk: 179840 }
    ]
  },
  {
    id: "world-7-secret",
    name: "World 7 Secret Boss",
    enemies: [
      { name: "Abyssal Nightmare", hp: 369859, atk: 123284 }
    ]
  }
];

const els = {
  ownedCount: document.querySelector("#assistantOwnedCount"),
  ownedProgress: document.querySelector("#assistantOwnedProgress"),
  teamCount: document.querySelector("#assistantTeamCount"),
  currentTeam: document.querySelector("#assistantCurrentTeam"),
  ownedStrip: document.querySelector("#assistantOwnedStrip"),
  target: document.querySelector("#assistantTarget"),
  bossName: document.querySelector("#bossPreviewName"),
  bossSummary: document.querySelector("#bossPreviewSummary"),
  bossTotal: document.querySelector("#bossEncounterTotal"),
  bossStages: document.querySelector("#bossStageList"),
  towerFloor: document.querySelector("#towerFloor"),
  towerGenerate: document.querySelector("#towerGenerate"),
  towerResult: document.querySelector("#towerResult"),
  towerEnemyImage: document.querySelector("#towerEnemyImage"),
  towerEnemyName: document.querySelector("#towerEnemyName"),
  towerResultFloor: document.querySelector("#towerResultFloor"),
  towerEnemyHP: document.querySelector("#towerEnemyHP"),
  towerEnemyATK: document.querySelector("#towerEnemyATK"),
  towerError: document.querySelector("#towerError")
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

function normalizeName(value) {
  return String(value || "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

function findCardByName(name) {
  const target = normalizeName(name);
  return state.cards.find((card) => normalizeName(card.name) === target);
}

function formatNumber(value) {
  return Number(value || 0).toLocaleString("en-US");
}

function renderBossOptions() {
  els.target.innerHTML = BOSS_ENCOUNTERS
    .map((boss) => `<option value="${boss.id}">${escapeHTML(boss.name)}</option>`)
    .join("");
}

function renderSelectedBoss() {
  const boss = BOSS_ENCOUNTERS.find((item) => item.id === els.target.value) || BOSS_ENCOUNTERS[0];
  els.bossName.textContent = boss.name;
  els.bossSummary.textContent = `${boss.enemies.length} enemy${boss.enemies.length === 1 ? "" : " stages"} in battle order.`;
  els.bossTotal.textContent = `${boss.enemies.length} stage${boss.enemies.length === 1 ? "" : "s"}`;
  els.bossStages.innerHTML = boss.enemies.map((enemy, index) => {
    const card = findCardByName(enemy.name);
    const art = card
      ? `<img src="${imageURL(card)}" alt="">`
      : `<div class="boss-stage-fallback">CF</div>`;
    return `<article class="boss-stage">
      <span class="boss-order">${index + 1}</span>
      <div class="boss-stage-art">${art}</div>
      <div class="boss-stage-name"><small>Stage ${index + 1}</small><strong>${escapeHTML(enemy.name)}</strong></div>
      <div class="boss-stat"><small>HP</small><strong>${formatNumber(enemy.hp)}</strong></div>
      <div class="boss-stat"><small>ATK</small><strong>${formatNumber(enemy.atk)}</strong></div>
    </article>`;
  }).join("");
}

async function generateTowerEnemy() {
  const floor = Number(els.towerFloor.value);
  els.towerError.hidden = true;

  if (!Number.isInteger(floor) || floor < 1) {
    els.towerError.textContent = "Enter a whole-number floor of 1 or higher.";
    els.towerError.hidden = false;
    return;
  }

  els.towerGenerate.disabled = true;
  els.towerGenerate.textContent = "Generating…";

  try {
    const response = await fetch(`${TOWER_API_URL}?floor=${encodeURIComponent(floor)}&t=${Date.now()}`, {
      method: "GET",
      cache: "no-store",
      redirect: "follow"
    });
    if (!response.ok) throw new Error(`Tower API returned ${response.status}`);

    const data = await response.json();
    if (data.success === false) throw new Error(data.error || "Tower API rejected the floor.");

    const rawHP = Number(data.generatedValue ?? data.hp ?? data.value);
    if (!Number.isFinite(rawHP)) throw new Error("Tower API did not return a valid HP value.");

    const hp = Math.round(rawHP);
    const atk = Math.round(rawHP / 3);
    const enemy = state.cards[Math.floor(Math.random() * state.cards.length)];

    els.towerEnemyName.textContent = enemy?.name || "Unknown Enemy";
    els.towerResultFloor.textContent = `Floor ${formatNumber(floor)}`;
    els.towerEnemyHP.textContent = formatNumber(hp);
    els.towerEnemyATK.textContent = formatNumber(atk);
    if (enemy) {
      els.towerEnemyImage.src = imageURL(enemy);
      els.towerEnemyImage.alt = enemy.name;
    }
    els.towerResult.hidden = false;
  } catch (error) {
    console.error("Tower generation failed", error);
    els.towerError.textContent = "Could not reach the private tower endpoint. Confirm the Apps Script deployment allows anyone to access it.";
    els.towerError.hidden = false;
  } finally {
    els.towerGenerate.disabled = false;
    els.towerGenerate.textContent = "Generate enemy";
  }
}

async function init() {
  loadCollection();
  try {
    await loadCards();
    state.team = state.team.filter((id) => state.cards.some((card) => card.id === id) && ownedCount(id) > 0);
    renderSummary();
    renderBossOptions();
    renderSelectedBoss();
  } catch (error) {
    console.error("Assistant data failed to load", error);
    els.ownedStrip.innerHTML = '<div class="owned-empty">The local card data could not be loaded.</div>';
  }
}

els.target.addEventListener("change", renderSelectedBoss);
els.towerGenerate.addEventListener("click", generateTowerEnemy);
els.towerFloor.addEventListener("keydown", (event) => {
  if (event.key === "Enter") generateTowerEnemy();
});

init();
