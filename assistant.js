const LIBRARY_ROOT = "./";
const DATA_URL = LIBRARY_ROOT + "data/cards.json";
const IMAGE_ROOT = LIBRARY_ROOT + "assets/cards/";
const STORAGE_KEY = "cf-deck-builder-state-v1";
const MAX_TEAM_SIZE = 4;
const BORDER_ORDER = ["Shiny", "Diamond", "Radiant"];
const TOWER_API_URL = "https://script.google.com/macros/s/AKfycbwndb-XXP5r6-fIa-Dge9yBnvF0UZrVdyONry4b3f7H9oTQ4R0HH3baj78Br60m8KQc/exec";

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
    enemies: [{ name: "Storm Leviathan", hp: 449706, atk: 149902 }]
  },
  {
    id: "secret-summer",
    name: "Secret Summer Boss",
    enemies: [{ name: "Secret Boss", hp: 539520, atk: 179840 }]
  },
  {
    id: "world-7-secret",
    name: "World 7 Secret Boss",
    enemies: [{ name: "Abyssal Nightmare", hp: 369859, atk: 123284 }]
  }
];

const els = {
  ownedCount: document.querySelector("#assistantOwnedCount"),
  ownedProgress: document.querySelector("#assistantOwnedProgress"),
  teamCount: document.querySelector("#assistantTeamCount"),
  currentTeam: document.querySelector("#assistantCurrentTeam"),
  ownedStrip: document.querySelector("#assistantOwnedStrip"),
  target: document.querySelector("#assistantTarget"),
  goal: document.querySelector("#assistantGoal"),
  analyze: document.querySelector("#assistantAnalyze"),
  encounterName: document.querySelector("#bossPreviewName"),
  encounterSummary: document.querySelector("#bossPreviewSummary"),
  encounterTotal: document.querySelector("#bossEncounterTotal"),
  encounterStages: document.querySelector("#bossStageList"),
  recommendationStatus: document.querySelector("#recommendationStatus"),
  recommendedSlots: document.querySelector("#recommendedSlots"),
  explanation: document.querySelector("#assistantExplanation"),
  simulationSummary: document.querySelector("#simulationSummary"),
  simulationWin: document.querySelector("#simulationWinChance"),
  simulationVerdict: document.querySelector("#simulationVerdict"),
  simulationTrials: document.querySelector("#simulationTrials"),
  simulationFloorMetric: document.querySelector("#simulationFloorMetric"),
  simulationFloor: document.querySelector("#simulationFloorRange"),
  towerFloor: document.querySelector("#towerFloor"),
  towerGenerate: document.querySelector("#towerGenerate"),
  towerResult: document.querySelector("#towerResult"),
  towerEnemyGrid: document.querySelector("#towerEnemyGrid"),
  towerResultFloor: document.querySelector("#towerResultFloor"),
  towerError: document.querySelector("#towerError")
};

const state = {
  cards: [],
  meta: { variants: [] },
  collection: {},
  collectionVariants: {},
  team: [],
  teamVariants: [],
  selectedBorders: new Set(),
  towerEncounter: null,
  recommendation: [],
  simulation: null
};

function escapeHTML(value) {
  return String(value == null ? "" : value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function imageURL(card) {
  return IMAGE_ROOT + encodeURIComponent(card.id) + ".png";
}

function formatNumber(value) {
  return Math.max(0, Math.round(Number(value) || 0)).toLocaleString("en-US");
}

function normalizeName(value) {
  return String(value || "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

function canonicalBorderNames(names) {
  const selected = new Set(Array.from(names || []));
  return BORDER_ORDER.filter(function (name) { return selected.has(name); });
}

function variantKey(names) {
  const ordered = canonicalBorderNames(names);
  return ordered.length ? ordered.join("+") : "Base";
}

function bordersFromVariantKey(key) {
  return !key || key === "Base" ? [] : canonicalBorderNames(String(key).split("+"));
}

function variantLabel(names) {
  const ordered = canonicalBorderNames(names);
  return ordered.length ? ordered.join(" + ") : "Base";
}

function variantCode(names) {
  const codes = { Shiny: "S", Diamond: "D", Radiant: "R" };
  const ordered = canonicalBorderNames(names);
  return ordered.length ? ordered.map(function (name) { return codes[name]; }).join("") : "Base";
}

function ownedCount(id) {
  return Math.max(0, Number(state.collection[id] || 0));
}

function variantOwnedCount(id, borders) {
  return Math.max(0, Number(state.collectionVariants[id]?.[variantKey(borders)] || 0));
}

function sanitizeTeamVariants(entries) {
  const used = {};
  return entries.filter(function (entry) {
    const key = entry.id + "::" + variantKey(entry.borders);
    const nextCount = (used[key] || 0) + 1;
    if (nextCount > variantOwnedCount(entry.id, entry.borders)) return false;
    used[key] = nextCount;
    return true;
  }).slice(0, MAX_TEAM_SIZE);
}

function rebuildCollectionTotals() {
  const totals = {};
  Object.entries(state.collectionVariants).forEach(function (pair) {
    const id = pair[0];
    const variants = pair[1] || {};
    const total = Object.values(variants).reduce(function (sum, count) {
      return sum + Math.max(0, Math.floor(Number(count) || 0));
    }, 0);
    if (total > 0) totals[id] = total;
  });
  state.collection = totals;
}

function cardRole(card) {
  if (SUPPORT_CARD_IDS.has(card.id)) return "support";
  if (REGULAR_CARD_IDS.has(card.id)) return "regular";
  if (AOE_CARD_IDS.has(card.id)) return "aoe";

  const description = String((card.abilityType || "") + " " + (card.abilityDescription || "")).toLowerCase();
  if (/(all allies|allied team|grant allies|gives every ally|boosts entire team|next ally|fallen ally|remaining allies|revives? .*ally)/.test(description)) return "support";
  if (/(all enemies|two random enem|2 enemy|hit two enem|strikes two|attack twice|attacks twice|attacks 3 times|strike all|pierce.*all|splash.*next)/.test(description)) return "aoe";
  return "regular";
}

function modifierMultiplier(borders) {
  const selected = new Set(canonicalBorderNames(borders));
  return (state.meta.variants || []).reduce(function (multiplier, border) {
    return selected.has(border.name)
      ? multiplier * (Number(border.chance) || 1)
      : multiplier;
  }, 1);
}

function statsForCard(card, borders) {
  const odds = Math.max(1, (Number(card.odds) || 1) * modifierMultiplier(borders));
  const rawHP = Math.floor(Math.pow(2, Math.log10(odds)) * 20);
  const rawATK = Math.floor(rawHP / 3);
  const weatherMultiplier = Number(card.statMult || 1) || 1;
  return {
    hp: Math.floor(rawHP * weatherMultiplier),
    atk: Math.floor(rawATK * weatherMultiplier)
  };
}

async function fetchJSON(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(url + " returned " + response.status);
  return response.json();
}

async function loadCards() {
  const index = await fetchJSON(DATA_URL);
  const parts = await Promise.all((index.parts || []).map(function (path) {
    return fetchJSON(LIBRARY_ROOT + path);
  }));
  state.meta = index.meta || { variants: [] };
  state.cards = parts.flatMap(function (part) {
    return Array.isArray(part.cards) ? part.cards : [];
  });
}

function loadCollection() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    if (saved.collectionVariants && typeof saved.collectionVariants === "object") {
      state.collectionVariants = saved.collectionVariants;
      rebuildCollectionTotals();
    } else if (saved.collection && typeof saved.collection === "object") {
      state.collection = saved.collection;
      Object.entries(saved.collection).forEach(function (pair) {
        const count = Math.max(0, Math.floor(Number(pair[1]) || 0));
        if (count > 0) state.collectionVariants[pair[0]] = { Base: count };
      });
    }

    if (Array.isArray(saved.teamVariants)) {
      state.teamVariants = saved.teamVariants.slice(0, MAX_TEAM_SIZE).map(function (entry) {
        return { id: String(entry?.id || ""), borders: canonicalBorderNames(entry?.borders || []) };
      });
    } else if (Array.isArray(saved.team)) {
      state.teamVariants = saved.team.slice(0, MAX_TEAM_SIZE).map(function (id) {
        return { id: String(id), borders: [] };
      });
    }
    state.team = state.teamVariants.map(function (entry) { return entry.id; });
    if (Array.isArray(saved.selectedBorders)) state.selectedBorders = new Set(saved.selectedBorders);
  } catch (error) {
    console.warn("Could not read saved collection", error);
  }
}

function saveRecommendedTeam() {
  const teamVariants = state.recommendation.map(function (entry) {
    return { id: entry.card.id, borders: canonicalBorderNames(entry.borders) };
  });
  if (!teamVariants.length) return;

  let saved = {};
  try {
    saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
  } catch (error) {
    saved = {};
  }
  saved.collection = state.collection;
  saved.collectionVariants = state.collectionVariants;
  saved.teamVariants = teamVariants;
  saved.team = teamVariants.map(function (entry) { return entry.id; });
  saved.selectedBorders = Array.from(state.selectedBorders);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(saved));
  state.teamVariants = teamVariants;
  state.team = saved.team;
  renderSummary();

  const button = document.querySelector("#useRecommendedTeam");
  if (button) button.textContent = "Team applied";
}

function renderSummary() {
  const owned = state.cards.filter(function (card) { return ownedCount(card.id) > 0; });
  els.ownedCount.textContent = owned.length + " / " + state.cards.length;
  els.ownedProgress.style.width = (state.cards.length ? owned.length / state.cards.length * 100 : 0) + "%";
  els.teamCount.textContent = state.teamVariants.length + "/" + MAX_TEAM_SIZE;

  els.currentTeam.innerHTML = Array.from({ length: MAX_TEAM_SIZE }, function (_, index) {
    const entry = state.teamVariants[index];
    const card = entry ? state.cards.find(function (item) { return item.id === entry.id; }) : null;
    if (!card) return '<div class="assistant-team-slot is-empty">Empty slot</div>';
    return '<div class="assistant-team-slot"><img src="' + imageURL(card) + '" alt=""><span><strong>' +
      escapeHTML(card.name) + '</strong><small>' + escapeHTML(variantCode(entry.borders)) + ' · ' +
      variantOwnedCount(card.id, entry.borders) + ' owned</small></span></div>';
  }).join("");

  if (!owned.length) {
    els.ownedStrip.innerHTML = '<div class="owned-empty">No cards have been added to the collection yet.</div>';
    return;
  }

  els.ownedStrip.innerHTML = owned
    .slice()
    .sort(function (left, right) { return Number(right.odds) - Number(left.odds); })
    .slice(0, 24)
    .map(function (card) {
      return '<div class="owned-card"><img src="' + imageURL(card) + '" alt=""><strong>' +
        escapeHTML(card.name) + '</strong><small>x' + ownedCount(card.id) + '</small></div>';
    }).join("");
}

function findCardByName(name) {
  const target = normalizeName(name);
  return state.cards.find(function (card) { return normalizeName(card.name) === target; });
}

function renderTargetOptions() {
  const bossOptions = BOSS_ENCOUNTERS.map(function (boss) {
    return '<option value="' + boss.id + '">' + escapeHTML(boss.name) + '</option>';
  }).join("");
  els.target.innerHTML = bossOptions + '<option value="tower">Infinite Tower — generated floor</option>';
}

function currentEncounter() {
  if (els.target.value === "tower") return state.towerEncounter;
  return BOSS_ENCOUNTERS.find(function (item) { return item.id === els.target.value; }) || BOSS_ENCOUNTERS[0];
}

function renderSelectedEncounter() {
  const encounter = currentEncounter();

  if (!encounter) {
    els.encounterName.textContent = "Infinite Tower";
    els.encounterSummary.textContent = "Generate a floor below to create its four-enemy battle.";
    els.encounterTotal.textContent = "Waiting";
    els.encounterStages.innerHTML = '<div class="owned-empty">No tower floor has been generated yet.</div>';
    els.analyze.disabled = true;
    return;
  }

  els.encounterName.textContent = encounter.name;
  els.encounterSummary.textContent = encounter.enemies.length + " enemies in battle order.";
  els.encounterTotal.textContent = encounter.enemies.length + " enemies";
  els.encounterStages.innerHTML = encounter.enemies.map(function (enemy, index) {
    const card = enemy.card || findCardByName(enemy.name);
    const art = card
      ? '<img src="' + imageURL(card) + '" alt="">'
      : '<div class="boss-stage-fallback">CF</div>';

    return '<article class="boss-stage">' +
      '<span class="boss-order">' + (index + 1) + '</span>' +
      '<div class="boss-stage-art">' + art + '</div>' +
      '<div class="boss-stage-name"><small>Enemy ' + (index + 1) + '</small><strong>' + escapeHTML(enemy.name) + '</strong></div>' +
      '<div class="boss-stat"><small>HP</small><strong>' + formatNumber(enemy.hp) + '</strong></div>' +
      '<div class="boss-stat"><small>ATK</small><strong>' + formatNumber(enemy.atk) + '</strong></div>' +
      '</article>';
  }).join("");
  els.analyze.disabled = state.cards.filter(function (card) { return ownedCount(card.id) > 0; }).length === 0;
}

function pickRandomCards(count) {
  const pool = state.cards.slice();
  for (let index = pool.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(Math.random() * (index + 1));
    const temporary = pool[index];
    pool[index] = pool[swap];
    pool[swap] = temporary;
  }
  return pool.slice(0, count);
}

function renderTowerResult() {
  const encounter = state.towerEncounter;
  if (!encounter) {
    els.towerResult.hidden = true;
    return;
  }

  const first = encounter.enemies[0];
  els.towerResultFloor.textContent = "Floor " + formatNumber(encounter.floor);
  els.towerEnemyGrid.innerHTML = encounter.enemies.map(function (enemy, index) {
    const source = enemy.card.weather || "Base";
    const role = cardRole(enemy.card);
    return '<article class="tower-enemy-card">' +
      '<span class="tower-card-order">' + (index + 1) + '</span>' +
      '<span class="tower-card-image-frame">' +
        '<span class="tower-card-fallback">' + escapeHTML(enemy.name) + '</span>' +
        '<img src="' + imageURL(enemy.card) + '" alt="' + escapeHTML(enemy.name) + '" loading="lazy" onload="this.previousElementSibling.hidden=true" onerror="this.hidden=true">' +
        '<span class="tower-generated-stats">' +
          '<span>HP <b>' + formatNumber(enemy.hp) + '</b></span>' +
          '<span>ATK <b>' + formatNumber(enemy.atk) + '</b></span>' +
        '</span>' +
      '</span>' +
      '<h3>' + escapeHTML(enemy.name) + '</h3>' +
      '<p class="tower-card-subline"><span>' + escapeHTML(source) + '</span><span>' + escapeHTML(role.charAt(0).toUpperCase() + role.slice(1)) + '</span></p>' +
      '</article>';
  }).join("");
  els.towerResult.hidden = false;
}

async function generateTowerBattle() {
  const floor = Number(els.towerFloor.value);
  els.towerError.hidden = true;

  if (!Number.isInteger(floor) || floor < 1) {
    els.towerError.textContent = "Enter a whole-number floor of 1 or higher.";
    els.towerError.hidden = false;
    return;
  }

  els.towerGenerate.disabled = true;
  els.towerGenerate.textContent = "Generating four enemies…";

  try {
    const towerStats = await fetchTowerStats(floor);
    const hp = towerStats.hp;
    const atk = towerStats.atk;

    const enemies = pickRandomCards(4).map(function (card) {
      return { name: card.name, card: card, hp: hp, atk: atk };
    });

    state.towerEncounter = {
      id: "tower",
      floor: floor,
      name: "Infinite Tower — Floor " + formatNumber(floor),
      enemies: enemies
    };

    renderTowerResult();
    els.target.value = "tower";
    renderSelectedEncounter();
    els.recommendationStatus.textContent = "Ready";
  } catch (error) {
    console.error("Tower generation failed", error);
    els.towerError.textContent = "Could not reach the private tower endpoint. Confirm the latest Apps Script version is deployed for anyone.";
    els.towerError.hidden = false;
  } finally {
    els.towerGenerate.disabled = false;
    els.towerGenerate.textContent = "Generate four enemies";
  }
}

const TOWER_STATS_CACHE = new Map();
const SIMULATION_TRIALS = 90;
const SEARCH_TRIALS = 16;

function clamp(value, minimum, maximum) {
  return Math.max(minimum, Math.min(maximum, value));
}

function roll(probability) {
  return Math.random() < clamp(Number(probability) || 0, 0, 1);
}

function healUnit(unit, amount) {
  if (!unit || !unit.alive || amount <= 0) return 0;
  const before = unit.hp;
  unit.hp = Math.min(unit.maxHp, unit.hp + amount);
  return unit.hp - before;
}

function scaleMaxHp(unit, multiplier) {
  const ratio = unit.maxHp > 0 ? unit.hp / unit.maxHp : 1;
  unit.maxHp = Math.max(1, unit.maxHp * multiplier);
  unit.hp = Math.max(1, unit.maxHp * ratio);
}

function addStatus(unit, type, turns, value) {
  if (!unit || !unit.alive || unit.debuffImmune) return;
  if (type === "stun" && unit.stunImmune) return;
  if (type === "stun") unit.stun = Math.max(unit.stun, turns);
  else if (type === "selfAttack") unit.selfAttack = Math.max(unit.selfAttack, turns);
  else unit.statuses.push({ type, turns, value });
}

function abilityProfile(card) {
  const ability = String(card?.ability || card?.abilityType || "");
  const description = String(card?.abilityDescription || "").toLowerCase();
  const profile = {
    ability,
    dr: 0,
    dodge: 0,
    reflect: 0,
    lifesteal: 0,
    revivePct: 0,
    reviveAtk: 0,
    damageMult: 1,
    maxHpMult: 1,
    healTurn: 0,
    healAfterAttack: 0,
    stunChance: 0,
    counterChance: 0,
    counterMult: 0,
    firstBlock: 0
  };

  let match = description.match(/takes? (\d+(?:\.\d+)?)% less damage/);
  if (match) profile.dr = Math.max(profile.dr, Number(match[1]) / 100);
  match = description.match(/(\d+(?:\.\d+)?)% chance to dodge/);
  if (match) profile.dodge = Math.max(profile.dodge, Number(match[1]) / 100);
  match = description.match(/reflects? (\d+(?:\.\d+)?)%/);
  if (match) profile.reflect = Math.max(profile.reflect, Number(match[1]) / 100);
  match = description.match(/heals? for (\d+(?:\.\d+)?)% of damage dealt/);
  if (match) profile.lifesteal = Math.max(profile.lifesteal, Number(match[1]) / 100);
  match = description.match(/revives? once at (\d+(?:\.\d+)?)% hp/);
  if (match) profile.revivePct = Number(match[1]) / 100;
  match = description.match(/regenerates? (\d+(?:\.\d+)?)% max hp per turn/);
  if (match) profile.healTurn = Number(match[1]) / 100;

  if (ability === "colossus") { profile.maxHpMult = 2; profile.damageMult = 0.75; }
  if (ability === "damage_reduction") profile.dr = 0.20;
  if (ability === "evasion") profile.dodge = 0.15;
  if (ability === "shadow_dodge") { profile.dodge = 0.30; profile.counterMult = 0.20; }
  if (ability === "swamp_counter") { profile.dr = 0.20; profile.counterChance = 0.45; profile.counterMult = 1; }
  if (ability === "counter_bleed") { profile.counterChance = 0.40; profile.counterMult = 0.75; }
  if (ability === "vampiric") profile.lifesteal = 0.40;
  if (ability === "thorns") profile.reflect = 0.25;
  if (ability === "sea_kings_wrath") profile.reflect = 0.25;
  if (ability === "shield_burst" || ability === "burrow_strike") profile.firstBlock = 1;
  if (ability === "earth_beast_regen") { profile.dr = 0.25; profile.healTurn = 0.10; }
  if (ability === "bloom") profile.healTurn = 0.075;
  if (ability === "true_rebirth") { profile.revivePct = 0.60; profile.reviveAtk = 0.50; }
  if (ability === "skeleton_rebirth") { profile.revivePct = 0.20; profile.reviveAtk = 0.50; }
  if (ability === "bat_revive") { profile.revivePct = 1 / 1000000; profile.reviveAtk = 0.60; }
  if (ability === "ice_revive") profile.revivePct = 0.40;
  if (ability === "kings_last_decree") { profile.revivePct = 0.60; profile.reviveAtk = 0.40; }
  if (ability === "mummy_curse") profile.revivePct = 0.35;
  return profile;
}

function createBattleUnit(entry, side, index, forcedStats, boss) {
  const card = entry.card || entry;
  const borders = entry.borders || [];
  const baseStats = forcedStats || statsForCard(card, borders);
  const profile = abilityProfile(card);
  const unit = {
    card,
    borders,
    side,
    index,
    boss: Boolean(boss),
    profile,
    maxHp: Math.max(1, Number(baseStats.hp) || 1),
    hp: Math.max(1, Number(baseStats.hp) || 1),
    baseAtk: Math.max(1, Number(baseStats.atk) || 1),
    atk: Math.max(1, Number(baseStats.atk) || 1),
    alive: true,
    entered: false,
    attackCount: 0,
    turnCount: 0,
    kills: 0,
    shield: 0,
    blockHits: profile.firstBlock,
    dr: profile.dr,
    dodge: profile.dodge,
    reflect: profile.reflect,
    lifesteal: profile.lifesteal,
    damageMult: profile.damageMult,
    damageTakenMult: 1,
    extraHitChance: 0,
    extraHitMult: 1,
    stun: 0,
    selfAttack: 0,
    statuses: [],
    revived: false,
    fatalSaved: false,
    abilityDisabled: false,
    debuffImmune: false,
    stunImmune: false,
    storedDamage: 0,
    firstHitTaken: false,
    firstAttack: true,
    starStacks: 0
  };
  if (profile.maxHpMult !== 1) {
    unit.maxHp *= profile.maxHpMult;
    unit.hp = unit.maxHp;
  }
  return unit;
}

function livingUnits(team) {
  return team.filter(function (unit) { return unit.alive; });
}

function activeUnit(team) {
  return team.find(function (unit) { return unit.alive; }) || null;
}

function teamHasAbility(team, ability) {
  return team.some(function (unit) { return unit.alive && unit.profile.ability === ability; });
}

function effectiveDodge(unit, team) {
  let dodge = unit.dodge;
  if (teamHasAbility(team, "sandstorm_domain")) dodge += 0.15;
  return clamp(dodge, 0, 0.75);
}

function effectiveDr(unit, team) {
  let dr = unit.dr;
  if (teamHasAbility(team, "blizzard_aura")) dr += 0.20;
  return clamp(dr, 0, 0.80);
}

function abilitySuppressed(unit, opposingTeam) {
  const opposing = activeUnit(opposingTeam);
  return unit.abilityDisabled || (opposing && (opposing.profile.ability === "ability_lock" || opposing.profile.ability === "endless_pilgrimage"));
}

function applyDirectDamage(unit, amount) {
  if (!unit || !unit.alive || amount <= 0) return 0;
  const dealt = Math.min(unit.hp, amount);
  unit.hp -= amount;
  return dealt;
}

function reviveFallenAlly(team, percent, atkBonus) {
  const candidates = team.filter(function (unit) { return !unit.alive && !unit.revived; });
  if (!candidates.length) return null;
  const unit = candidates[Math.floor(Math.random() * candidates.length)];
  unit.alive = true;
  unit.revived = true;
  unit.hp = Math.max(1, unit.maxHp * percent);
  unit.atk *= 1 + (atkBonus || 0);
  unit.entered = false;
  unit.statuses = [];
  unit.stun = 0;
  return unit;
}

function handleDeath(unit, ownTeam, enemyTeam, battle, killer, killingBlow) {
  if (!unit || !unit.alive || unit.hp > 0) return false;
  const ability = unit.profile.ability;
  if (!abilitySuppressed(unit, enemyTeam)) {
    if (ability === "griffon_strike" && !unit.fatalSaved) {
      unit.fatalSaved = true;
      unit.hp = 1;
      unit.dodge += 0.20;
      unit.damageMult *= 1.15;
      return false;
    }
    if (ability === "cosmic_vision" && !unit.fatalSaved) {
      unit.fatalSaved = true;
      unit.hp = 1;
      return false;
    }
    if (unit.profile.revivePct > 0 && !unit.revived) {
      unit.revived = true;
      unit.hp = Math.max(1, unit.maxHp * unit.profile.revivePct);
      unit.atk *= 1 + unit.profile.reviveAtk;
      if (ability === "ice_revive") addStatus(activeUnit(enemyTeam), "stun", 1, 0);
      if (ability === "mummy_curse") {
        unit.damageMult *= 0.80;
        livingUnits(enemyTeam).forEach(function (enemy) { addStatus(enemy, "poison", 3, 0.05); });
      }
      if (ability === "kings_last_decree") unit.debuffImmune = true;
      if (ability === "bat_revive" && roll(0.35)) battle.immediateAttack = unit;
      return false;
    }
  }

  unit.alive = false;
  unit.hp = 0;
  unit.entered = true;

  if (!abilitySuppressed(unit, enemyTeam)) {
    if (ability === "death_nova") applyDirectDamage(activeUnit(enemyTeam), unit.maxHp);
    if (ability === "vengeance") applyDirectDamage(activeUnit(enemyTeam), killingBlow || 0);
    if (ability === "oblivion") livingUnits(enemyTeam).forEach(function (enemy) { applyDirectDamage(enemy, enemy.hp * 0.20); });
    if (ability === "death_burn_all") livingUnits(enemyTeam).forEach(function (enemy) {
      applyDirectDamage(enemy, enemy.maxHp * 0.20);
      addStatus(enemy, "burn", 99, 0.07);
    });
    if (ability === "inferno") livingUnits(enemyTeam).forEach(function (enemy) { addStatus(enemy, "burn", 3, 0.07); });
    if (ability === "martyr") livingUnits(ownTeam).forEach(function (ally) { ally.atk *= 1.25; });
    if (ability === "legacy") {
      const next = activeUnit(ownTeam);
      if (next) { scaleMaxHp(next, 1 + unit.maxHp * 0.20 / Math.max(1, next.maxHp)); next.atk += unit.atk * 0.20; }
    }
    if (ability === "spirit_echo") reviveFallenAlly(ownTeam, 0.40, 0);
    if (ability === "soul_warden") reviveFallenAlly(ownTeam, 0.25, 0.50);
    if (ability === "shaman_legacy") {
      const next = activeUnit(ownTeam);
      if (next) next.shield += unit.maxHp * 0.50;
    }
    if (ability === "earth_legacy" || ability === "bone_spawn") {
      unit.alive = true;
      unit.revived = true;
      unit.hp = unit.maxHp * (ability === "earth_legacy" ? 0.25 : 0.40);
      unit.maxHp = unit.hp;
      unit.atk *= ability === "earth_legacy" ? 0.25 : 0.40;
      unit.entered = true;
    }
  }
  if (killer && killer.alive) {
    killer.kills += 1;
    const killerAbility = killer.profile.ability;
    if (killerAbility === "greed") { scaleMaxHp(killer, 1 + unit.maxHp * 0.20 / Math.max(1, killer.maxHp)); killer.atk += unit.atk * 0.20; }
    if (killerAbility === "earth_legacy") healUnit(killer, killer.maxHp * 0.10);
    if (killerAbility === "star_stacks") killer.starStacks += 2;
    if (killerAbility === "abyssal_nightmare") { killer.blockHits += 1; killer.dr = clamp(killer.dr + 0.15, 0, 0.80); }
  }
  return true;
}

function dealDamage(attacker, target, amount, attackerTeam, targetTeam, battle, options) {
  const settings = options || {};
  if (!target || !target.alive || amount <= 0) return { dealt: 0, killed: false, dodged: false };
  const targetAbilityOff = abilitySuppressed(target, attackerTeam);
  if (!settings.unavoidable && roll(effectiveDodge(target, targetTeam))) {
    if (!targetAbilityOff && target.profile.ability === "evasion") { target.atk *= 1.10; scaleMaxHp(target, 1.10); }
    if (!targetAbilityOff && target.profile.ability === "shadow_dodge" && attacker?.alive) applyDirectDamage(attacker, amount * 0.20);
    if (!targetAbilityOff && target.profile.ability === "cosmic_vision" && attacker?.alive) applyDirectDamage(attacker, amount * 0.25);
    return { dealt: 0, killed: false, dodged: true };
  }
  if (!targetAbilityOff && target.blockHits > 0) {
    target.blockHits -= 1;
    return { dealt: 0, killed: false, dodged: false };
  }
  let remaining = amount * target.damageTakenMult;
  if (target.shield > 0) {
    const absorbed = Math.min(target.shield, remaining);
    target.shield -= absorbed;
    remaining -= absorbed;
  }
  if (!settings.trueDamage) remaining *= 1 - effectiveDr(target, targetTeam);
  remaining = Math.max(0, remaining);
  const before = target.hp;
  target.hp -= remaining;
  const dealt = Math.min(before, remaining);
  target.firstHitTaken = true;
  target.storedDamage += dealt * 0.30;

  if (!targetAbilityOff && attacker?.alive && target.reflect > 0 && !settings.reflected) {
    applyDirectDamage(attacker, dealt * target.reflect);
    handleDeath(attacker, attackerTeam, targetTeam, battle, target, dealt * target.reflect);
  }
  if (!targetAbilityOff && attacker?.alive && target.profile.counterChance && roll(target.profile.counterChance)) {
    const counterHits = target.profile.ability === "swamp_counter" ? 2 : 1;
    for (let hit = 0; hit < counterHits; hit += 1) applyDirectDamage(attacker, target.atk * target.profile.counterMult * (counterHits === 2 ? 0.50 : 1));
    handleDeath(attacker, attackerTeam, targetTeam, battle, target, target.atk * target.profile.counterMult);
  }
  if (!targetAbilityOff && target.profile.ability === "bulk_up") target.atk += dealt * 0.50;
  if (!targetAbilityOff && target.profile.ability === "overseer_growth") {
    target.atk += dealt * 0.15;
    target.maxHp += dealt * 0.05;
    target.hp += dealt * 0.05;
  }
  if (!targetAbilityOff && target.profile.ability === "minotaur_first_hit" && !target.minotaurTriggered) {
    target.minotaurTriggered = true;
    livingUnits(attackerTeam).forEach(function (enemy) { enemy.atk *= 0.85; });
    target.dr = clamp(target.dr + 0.20, 0, 0.80);
  }
  const killed = target.hp <= 0 && handleDeath(target, targetTeam, attackerTeam, battle, attacker, remaining);
  return { dealt, killed, dodged: false };
}

function applyBattleStart(team, enemyTeam, battle) {
  for (const unit of team) {
    const ability = unit.profile.ability;
    if (ability === "vitalize") livingUnits(team).forEach(function (ally) { scaleMaxHp(ally, 1.08); });
    if (ability === "power_boost") livingUnits(team).forEach(function (ally) { ally.atk *= 1.10; });
    if (ability === "pixie_shield") unit.shield += unit.maxHp * 0.30;
    if (ability === "guardian") team.slice(-2).forEach(function (ally) { ally.blockHits += 1; });
    if (ability === "flower_guardian") livingUnits(team).forEach(function (ally) { ally.shield += unit.maxHp * 0.20; ally.firstAttackBoost = 0.10; });
    if (ability === "tranquil_dominion") livingUnits(team).forEach(function (ally) { ally.dodge += 0.25; });
    if (ability === "storm_domain") livingUnits(team).forEach(function (ally) { ally.extraHitChance += 0.30; ally.extraHitMult = Math.max(ally.extraHitMult, 1); });
    if (ability === "sandstorm_domain") livingUnits(team).forEach(function (ally) { ally.stunImmune = true; ally.damageMult *= 0.75; });
    if (ability === "ice_golem_aura") livingUnits(team).forEach(function (ally) { ally.stunImmune = true; });
    if (ability === "divine_eye") unit.shield += unit.maxHp * 0.25;
  }
}

function applyEntry(unit, ownTeam, enemyTeam, battle) {
  if (!unit || !unit.alive || unit.entered) return;
  unit.entered = true;
  const ability = unit.profile.ability;
  const enemy = activeUnit(enemyTeam);
  if (ability === "serpent_venom" || ability === "stun_synergy") addStatus(enemy, "stun", 1, 0);
  if (ability === "titan_shield") unit.shield += unit.maxHp * 0.50;
  if (ability === "life_drain_max") scaleMaxHp(unit, 1.50);
  if (ability === "martyr") unit.damageMult *= 1;
  if (ability === "eruption") livingUnits(enemyTeam).forEach(function (target) { dealDamage(unit, target, unit.atk * 0.20, ownTeam, enemyTeam, battle, { unavoidable: true }); });
  if (ability === "behemoth_quake") {
    unit.hp = 1;
    livingUnits(enemyTeam).forEach(function (target) { dealDamage(unit, target, unit.maxHp * 0.15, ownTeam, enemyTeam, battle, { trueDamage: true, unavoidable: true }); });
  }
  if (ability === "entry_slam" && enemy) {
    dealDamage(unit, enemy, unit.atk * 0.50, ownTeam, enemyTeam, battle);
    addStatus(enemy, "burn", 3, 0.07);
  }
  if (ability === "sporeguard") livingUnits(ownTeam).forEach(function (ally) { ally.shield += unit.maxHp * 0.15; ally.dr = clamp(ally.dr + 0.20, 0, 0.80); });
  if (ability === "fungal_formation") livingUnits(ownTeam).forEach(function (ally) { ally.extraHitChance += 0.50; ally.extraHitMult = 0.50; });
  if (ability === "permafrost_aoe") livingUnits(enemyTeam).forEach(function (target) { target.atk *= 0.85; target.stunEvery = 3; });
  if (ability === "permafrost") livingUnits(enemyTeam).forEach(function (target) { target.atk *= 0.80; });
  if (ability === "war_cry") livingUnits(ownTeam).forEach(function (ally) { ally.atk *= 1.20; });
  if (ability === "bloodpact") { const sacrificed = unit.hp * 0.20; unit.hp -= sacrificed; unit.atk += sacrificed; }
  if (ability === "athenas_aegis") unit.blockHits += 1;
  if (ability === "pack_leader") unit.atk *= 1 + Math.max(0, livingUnits(ownTeam).length - 1) * 0.15;
  if (ability === "demon_surge") unit.atk *= unit.index === ownTeam.length - 1 ? 1.30 : 1;
  if (ability === "viking_rage") unit.atk *= 1 + enemyTeam.filter(function (target) { return target.atk > unit.atk; }).length * 0.15;
  if (ability === "chimera_modes") {
    const mode = Math.floor(Math.random() * 3);
    if (mode === 0) unit.atk *= 1.35;
    if (mode === 1) unit.dr = clamp(unit.dr + 0.30, 0, 0.80);
    if (mode === 2) unit.dodge += 0.25;
  }
  if (ability === "stat_flip" && enemy && !enemy.boss) {
    const hp = enemy.maxHp;
    enemy.maxHp = enemy.atk;
    enemy.hp = Math.min(enemy.maxHp, enemy.hp * enemy.maxHp / Math.max(1, hp));
    enemy.atk = hp;
  }
  if (ability === "armor_break" && enemy) enemy.damageTakenMult *= 1.30;
}

function ensureEntries(team, enemyTeam, battle) {
  const active = activeUnit(team);
  if (active && !active.entered) applyEntry(active, team, enemyTeam, battle);
  return active;
}

function tickStatuses(unit, ownTeam, enemyTeam, battle) {
  if (!unit || !unit.alive) return;
  const remaining = [];
  for (const status of unit.statuses) {
    if (status.type === "poison" || status.type === "bleed" || status.type === "burn") applyDirectDamage(unit, unit.maxHp * status.value);
    status.turns -= 1;
    if (status.turns > 0) remaining.push(status);
  }
  unit.statuses = remaining;
  handleDeath(unit, ownTeam, enemyTeam, battle, null, 0);
}

function applyBackgroundTurn(team, enemyTeam, battle) {
  battle.sideTurns[team[0]?.side || "player"] += 1;
  for (const support of team) {
    if (!support.alive) continue;
    const ability = support.profile.ability;
    if (ability === "regen") livingUnits(team).forEach(function (ally) { healUnit(ally, ally.maxHp * 0.05); });
    if (ability === "lifebloom_canopy" && support !== activeUnit(team)) livingUnits(team).forEach(function (ally) { healUnit(ally, ally.maxHp * 0.10); ally.atk *= 1.02; });
    if (ability === "fungal_volley" && support !== activeUnit(team) && battle.sideTurns[support.side] % 2 === 0) {
      const enemy = activeUnit(enemyTeam);
      if (enemy) dealDamage(support, enemy, support.atk * 0.40, team, enemyTeam, battle, { unavoidable: true });
    }
  }
}

function attackMultipliers(unit, target) {
  const ability = unit.profile.ability;
  if (ability === "chaos_bolt") return [0.50 + Math.random() * 1.50];
  if (ability === "swarm") return [1, 0.25, 0.25];
  if (ability === "abyssal_nightmare") return [1, 0.55];
  if (ability === "double_tap" && roll(0.20)) return [1, 1];
  if (ability === "frenzy" && target && target.hp < target.maxHp * 0.50) return [1, 1];
  if (ability === "glimmer" && roll(0.30)) return [2];
  if (ability === "griffon_strike" && target && !target.griffonHit) { target.griffonHit = true; return [1.50]; }
  if (ability === "double_strike" && unit.attackCount % 2 === 0) return [2];
  if (unit.extraHitChance && roll(unit.extraHitChance)) return [1, unit.extraHitMult];
  return [1];
}

function performAttack(unit, ownTeam, enemyTeam, battle) {
  if (!unit || !unit.alive) return;
  unit.turnCount += 1;
  tickStatuses(unit, ownTeam, enemyTeam, battle);
  if (!unit.alive) return;
  if (unit.profile.healTurn) healUnit(unit, unit.maxHp * unit.profile.healTurn);
  if (unit.profile.ability === "earth_beast_regen") unit.atk *= 1.03;
  if (unit.profile.ability === "bloom" && unit.turnCount % 2 === 0) unit.atk *= 1.05;
  if (unit.stunEvery && unit.turnCount % unit.stunEvery === 0) addStatus(unit, "stun", 1, 0);
  if (unit.stun > 0) { unit.stun -= 1; return; }
  if (unit.selfAttack > 0) {
    unit.selfAttack -= 1;
    dealDamage(unit, unit, unit.atk, ownTeam, ownTeam, battle, { unavoidable: true });
    return;
  }
  let target = activeUnit(enemyTeam);
  if (!target) return;
  const abilityOff = abilitySuppressed(unit, enemyTeam);
  unit.attackCount += 1;
  let totalDamage = 0;
  let multipliers = attackMultipliers(unit, target);
  if (abilityOff) multipliers = [1];
  if (!abilityOff && unit.profile.ability === "dual_strike") multipliers = [0.90];

  for (const multiplier of multipliers) {
    target = ensureEntries(enemyTeam, ownTeam, battle);
    if (!target || !unit.alive) break;
    let damage = unit.atk * unit.damageMult * multiplier;
    if (teamHasAbility(ownTeam, "communion")) {
      const cthulhu = ownTeam.find(function (ally) { return ally.alive && ally.profile.ability === "communion"; });
      if (cthulhu) damage += cthulhu.atk * 0.10;
    }
    if (unit.firstAttackBoost) { damage *= 1 + unit.firstAttackBoost; unit.firstAttackBoost = 0; }
    if (!abilityOff && unit.profile.ability === "reap") damage += target.maxHp * 0.12;
    if (!abilityOff && unit.profile.ability === "execute" && target.hp < target.maxHp * 0.40) damage *= 1.50;
    if (!abilityOff && unit.profile.ability === "wound") damage += (target.maxHp - target.hp) * 0.20;
    if (!abilityOff && unit.profile.ability === "berserker_blood") { unit.hp -= unit.maxHp * 0.05; damage += (unit.maxHp - unit.hp) * 0.25; }
    if (!abilityOff && unit.profile.ability === "life_drain_max" && !target.boss) { damage += target.maxHp * 0.15; unit.maxHp += target.maxHp * 0.15; unit.hp += target.maxHp * 0.15; }
    if (!abilityOff && unit.profile.ability === "mummy_curse" && target.statuses.some(function (status) { return status.type === "poison"; })) damage *= 1.50;
    if (!abilityOff && unit.profile.ability === "stun" && roll(0.25)) addStatus(target, "stun", 1, 0);
    if (!abilityOff && unit.profile.stunChance && roll(unit.profile.stunChance)) addStatus(target, "stun", 1, 0);
    const hit = dealDamage(unit, target, damage, ownTeam, enemyTeam, battle);
    totalDamage += hit.dealt;
  }

  if (!abilityOff) {
    const ability = unit.profile.ability;
    const enemies = livingUnits(enemyTeam);
    const secondary = enemies[1];
    if (ability === "dual_strike" && secondary) totalDamage += dealDamage(unit, secondary, unit.atk * unit.damageMult * 0.45, ownTeam, enemyTeam, battle).dealt;
    if (ability === "tentacle_slam" && unit.attackCount % 2 === 0) enemies.forEach(function (enemy) { totalDamage += dealDamage(unit, enemy, unit.atk * 0.50, ownTeam, enemyTeam, battle).dealt; });
    if (ability === "dimensional_rift" && roll(0.30)) enemies.forEach(function (enemy) { totalDamage += dealDamage(unit, enemy, unit.atk, ownTeam, enemyTeam, battle).dealt; });
    if (ability === "bleed" && secondary) totalDamage += dealDamage(unit, secondary, unit.atk * 0.30, ownTeam, enemyTeam, battle).dealt;
    if (ability === "berserkers_cleave" && unit.attackCount % 2 === 0 && secondary) totalDamage += dealDamage(unit, secondary, unit.atk * 0.60, ownTeam, enemyTeam, battle).dealt;
    if (ability === "winged_judgment" || ability === "kings_last_decree") enemies.slice(1).forEach(function (enemy) { totalDamage += dealDamage(unit, enemy, unit.atk * (ability === "winged_judgment" ? 0.10 : 0.15), ownTeam, enemyTeam, battle).dealt; });
    if (ability === "aeternus_wrath" && unit.attackCount % 2 === 0) enemies.forEach(function (enemy) { totalDamage += dealDamage(unit, enemy, unit.atk * 0.25, ownTeam, enemyTeam, battle).dealt; });
    if (ability === "thunder_strike" && unit.attackCount % 3 === 0) enemies.forEach(function (enemy) { enemy.damageTakenMult *= 1.15; totalDamage += dealDamage(unit, enemy, unit.atk * 0.50, ownTeam, enemyTeam, battle).dealt; });
    if (ability === "star_stacks") {
      unit.starStacks += 1;
      if (unit.starStacks >= 4 && !unit.starShield) { unit.starShield = true; unit.shield += unit.maxHp * 0.30; }
      if (unit.starStacks >= 6) enemies.forEach(function (enemy) { totalDamage += dealDamage(unit, enemy, unit.atk * 0.50, ownTeam, enemyTeam, battle).dealt; });
    }
    const targetAfter = activeUnit(enemyTeam);
    if (ability === "burn" && targetAfter) addStatus(targetAfter, "burn", 3, 0.07);
    if (ability === "venom" && targetAfter) addStatus(targetAfter, "poison", 99, 0.03);
    if (ability === "shaman_legacy" && targetAfter) { targetAfter.atk *= 0.95; addStatus(targetAfter, "poison", 4, 0.03); }
    if (ability === "crippling_shot" && targetAfter) targetAfter.atk *= 0.85;
    if (ability === "armor_break" && targetAfter) targetAfter.damageTakenMult = Math.max(targetAfter.damageTakenMult, 1.30);
    if (ability === "charm" && targetAfter && roll(0.15)) { const stolen = targetAfter.atk * 0.15; targetAfter.atk -= stolen; unit.atk += stolen; addStatus(targetAfter, "selfAttack", 1, 0); }
    if (ability === "siphoning_madness" && targetAfter && roll(0.35)) addStatus(targetAfter, "selfAttack", 1, 0);
    if (ability === "bone_poison") enemies.slice(0, 2).forEach(function (enemy) { addStatus(enemy, "poison", 3, 0.05); });
    if (ability === "infernal_bloom") enemies.forEach(function (enemy) { addStatus(enemy, "burn", 2, 0.08); });
    if (ability === "fungal_volley" && unit.attackCount % 2 === 0) enemies.forEach(function (enemy) { totalDamage += dealDamage(unit, enemy, unit.atk * 0.20, ownTeam, enemyTeam, battle).dealt; });
    if (ability === "glimmer_burst" && unit.attackCount % 2 === 0) { totalDamage += dealDamage(unit, activeUnit(enemyTeam), unit.atk * 0.50, ownTeam, enemyTeam, battle).dealt; healUnit(unit, unit.maxHp * 0.15); }
    if (ability === "momentum") unit.atk *= 1.15;
    if (ability === "true_power") { healUnit(unit, totalDamage * 0.20); unit.atk = Math.min(unit.baseAtk * 1.75, unit.atk * 1.25); }
    if (ability === "amplify") unit.damageMult *= 1.20;
    if (ability === "berserkers_cleave") unit.atk *= 1;
    if (ability === "bloom" && unit.attackCount % 2 === 0) unit.atk *= 1.05;
    if (ability === "tranquil_dominion" && targetAfter && roll(0.20)) targetAfter.abilityDisabled = true;
  }
  if (unit.lifesteal) healUnit(unit, totalDamage * unit.lifesteal);
  if (unit.profile.healAfterAttack) healUnit(unit, unit.maxHp * unit.profile.healAfterAttack);
  if (unit.profile.ability === "vitality") healUnit(unit, unit.maxHp * 0.05);
  if (unit.profile.ability === "glimmer" && multipliers[0] === 2) healUnit(unit, unit.maxHp * 0.15);
  unit.firstAttack = false;
  handleDeath(unit, ownTeam, enemyTeam, battle, activeUnit(enemyTeam), 0);
}

function simulateBattle(teamEntries, enemyEntries) {
  const players = teamEntries.map(function (entry, index) { return createBattleUnit(entry, "player", index); });
  const enemies = enemyEntries.map(function (entry, index) {
    const card = entry.card || findCardByName(entry.name) || { id: "enemy-" + index, name: entry.name || "Enemy", ability: "", abilityDescription: "" };
    return createBattleUnit({ card, borders: [] }, "enemy", index, { hp: entry.hp, atk: entry.atk }, entry.boss);
  });
  const battle = { turns: 0, sideTurns: { player: 0, enemy: 0 }, immediateAttack: null };
  applyBattleStart(players, enemies, battle);
  applyBattleStart(enemies, players, battle);
  ensureEntries(players, enemies, battle);
  ensureEntries(enemies, players, battle);
  const initialPlayerHp = players.reduce(function (sum, unit) { return sum + unit.maxHp; }, 0);
  const initialEnemyHp = enemies.reduce(function (sum, unit) { return sum + unit.maxHp; }, 0);

  while (livingUnits(players).length && livingUnits(enemies).length && battle.turns < 320) {
    battle.turns += 1;
    applyBackgroundTurn(players, enemies, battle);
    let player = ensureEntries(players, enemies, battle);
    if (player) performAttack(player, players, enemies, battle);
    ensureEntries(enemies, players, battle);
    if (!livingUnits(enemies).length) break;
    if (battle.immediateAttack?.alive) { const immediate = battle.immediateAttack; battle.immediateAttack = null; performAttack(immediate, immediate.side === "player" ? players : enemies, immediate.side === "player" ? enemies : players, battle); }
    applyBackgroundTurn(enemies, players, battle);
    const enemy = ensureEntries(enemies, players, battle);
    if (enemy) performAttack(enemy, enemies, players, battle);
    ensureEntries(players, enemies, battle);
  }

  const playerHp = livingUnits(players).reduce(function (sum, unit) { return sum + Math.max(0, unit.hp); }, 0);
  const enemyHp = livingUnits(enemies).reduce(function (sum, unit) { return sum + Math.max(0, unit.hp); }, 0);
  return {
    won: livingUnits(enemies).length === 0 && livingUnits(players).length > 0,
    turns: battle.turns,
    playerHpRatio: playerHp / Math.max(1, initialPlayerHp),
    enemyHpRatio: enemyHp / Math.max(1, initialEnemyHp),
    survivors: livingUnits(players).length
  };
}

function towerEnemyLineup(stats) {
  return pickRandomCards(4).map(function (card) { return { card, name: card.name, hp: stats.hp, atk: stats.atk, boss: false }; });
}

function encounterEnemyLineup(encounter) {
  return encounter.enemies.map(function (enemy) {
    return { card: enemy.card || findCardByName(enemy.name), name: enemy.name, hp: enemy.hp, atk: enemy.atk, boss: encounter.id !== "tower" };
  });
}

function runTeamTrials(team, encounter, trials, towerStats) {
  let wins = 0;
  let turns = 0;
  let hpRatio = 0;
  let enemyHpRatio = 0;
  let survivors = 0;
  for (let trial = 0; trial < trials; trial += 1) {
    const enemies = encounter.id === "tower" ? towerEnemyLineup(towerStats || encounter.enemies[0]) : encounterEnemyLineup(encounter);
    const result = simulateBattle(team, enemies);
    if (result.won) wins += 1;
    turns += result.turns;
    hpRatio += result.playerHpRatio;
    enemyHpRatio += result.enemyHpRatio;
    survivors += result.survivors;
  }
  return {
    wins,
    trials,
    chance: wins / Math.max(1, trials),
    avgTurns: turns / Math.max(1, trials),
    avgHpRatio: hpRatio / Math.max(1, trials),
    avgEnemyHpRatio: enemyHpRatio / Math.max(1, trials),
    avgSurvivors: survivors / Math.max(1, trials)
  };
}

function ownedSimulationEntries(encounter, goal) {
  const entries = [];
  state.cards.forEach(function (card) {
    const variants = state.collectionVariants[card.id] || {};
    Object.entries(variants).forEach(function (pair) {
      const count = Math.max(0, Math.floor(Number(pair[1]) || 0));
      if (!count) return;
      const borders = bordersFromVariantKey(pair[0]);
      const stats = statsForCard(card, borders);
      const role = cardRole(card);
      const description = String(card.abilityDescription || "").toLowerCase();
      let score = Math.log2(Math.max(2, stats.hp)) * 0.45 + Math.log2(Math.max(2, stats.atk)) * 0.55;
      if (goal === "survival") score += Math.log2(Math.max(2, stats.hp)) * 0.25;
      if (goal === "damage") score += Math.log2(Math.max(2, stats.atk)) * 0.25;
      if (role === "support") score += 1.6;
      if (role === "aoe" && encounter.enemies.length > 1) score += 1.4;
      if (/(revive|shield|heal|dodge|damage reduction|less damage)/.test(description)) score += goal === "survival" ? 1.5 : 0.8;
      if (/(all enemies|attack twice|attacks twice|attacks 3 times|max hp damage|poison|burn)/.test(description)) score += goal === "damage" ? 1.5 : 0.8;
      entries.push({ card, borders, count: Math.min(MAX_TEAM_SIZE, count), stats, role, score });
    });
  });
  return entries.sort(function (left, right) { return right.score - left.score; });
}

function quickTeamScore(team) {
  let score = 0;
  const roles = new Set();
  team.forEach(function (entry, index) {
    score += entry.score * (1 - index * 0.015);
    roles.add(entry.role);
    const ability = entry.card.ability;
    if (index === 0 && /entry|first|shield|dodge|reduction|regen|revive|counter/.test(String(entry.card.abilityDescription || "").toLowerCase())) score += 0.8;
    if (index >= 2 && /on death|upon death|off-field|while alive|battle start/.test(String(entry.card.abilityDescription || "").toLowerCase())) score += 0.7;
    if (ability === "demon_surge" && index === 3) score += 1;
  });
  if (roles.has("support")) score += 1.1;
  if (roles.has("aoe")) score += 0.7;
  return score;
}

function buildCandidateTeams(entries) {
  const shortlist = entries.slice(0, 14);
  let beam = [{ team: [], used: {}, score: 0 }];
  for (let slot = 0; slot < MAX_TEAM_SIZE; slot += 1) {
    const expanded = [];
    for (const node of beam) {
      for (const entry of shortlist) {
        const key = entry.card.id + "::" + variantKey(entry.borders);
        if ((node.used[key] || 0) >= entry.count) continue;
        const team = node.team.concat(entry);
        expanded.push({ team, used: { ...node.used, [key]: (node.used[key] || 0) + 1 }, score: quickTeamScore(team) });
      }
    }
    const unique = new Map();
    expanded.sort(function (left, right) { return right.score - left.score; }).forEach(function (node) {
      const key = node.team.map(function (entry) { return entry.card.id + ":" + variantKey(entry.borders); }).join("|");
      if (!unique.has(key)) unique.set(key, node);
    });
    beam = Array.from(unique.values()).slice(0, 72);
  }
  return beam.map(function (node) { return node.team; });
}

function nextFrame() {
  return new Promise(function (resolve) { requestAnimationFrame(resolve); });
}

async function optimizeTeam(entries, encounter) {
  const candidates = buildCandidateTeams(entries);
  const towerStats = encounter.id === "tower" ? { hp: encounter.enemies[0].hp, atk: encounter.enemies[0].atk } : null;
  const scored = [];
  for (let index = 0; index < candidates.length; index += 1) {
    const result = runTeamTrials(candidates[index], encounter, SEARCH_TRIALS, towerStats);
    scored.push({ team: candidates[index], result, score: result.chance * 100 + result.avgHpRatio * 8 - result.avgEnemyHpRatio * 4 });
    if (index % 6 === 0) {
      els.recommendationStatus.textContent = "Testing teams " + (index + 1) + "/" + candidates.length;
      await nextFrame();
    }
  }
  scored.sort(function (left, right) { return right.score - left.score; });
  const finalists = scored.slice(0, 6);
  for (let index = 0; index < finalists.length; index += 1) {
    finalists[index].result = runTeamTrials(finalists[index].team, encounter, SIMULATION_TRIALS, towerStats);
    finalists[index].score = finalists[index].result.chance * 100 + finalists[index].result.avgHpRatio * 8 - finalists[index].result.avgEnemyHpRatio * 4;
    await nextFrame();
  }
  finalists.sort(function (left, right) { return right.score - left.score; });
  return finalists[0];
}

async function fetchTowerStats(floor) {
  const cleanFloor = Math.max(1, Math.round(Number(floor) || 1));
  if (TOWER_STATS_CACHE.has(cleanFloor)) return TOWER_STATS_CACHE.get(cleanFloor);
  const response = await fetch(TOWER_API_URL + "?floor=" + encodeURIComponent(cleanFloor) + "&t=" + Date.now(), { cache: "no-store", redirect: "follow" });
  if (!response.ok) throw new Error("Tower API returned " + response.status);
  const data = await response.json();
  if (data.success === false) throw new Error(data.error || "Tower API rejected the floor.");
  const hp = Math.round(Number(data.hp != null ? data.hp : data.generatedValue));
  const atk = Math.round(Number(data.atk != null ? data.atk : hp / 3));
  if (!Number.isFinite(hp) || !Number.isFinite(atk)) throw new Error("Tower API returned invalid stats.");
  const stats = { floor: cleanFloor, hp, atk };
  TOWER_STATS_CACHE.set(cleanFloor, stats);
  return stats;
}

async function estimateTowerCeiling(team, seedFloor) {
  const chanceCache = new Map();
  async function chanceAt(floor) {
    const clean = Math.max(1, Math.round(floor));
    if (chanceCache.has(clean)) return chanceCache.get(clean);
    els.recommendationStatus.textContent = "Testing floor " + formatNumber(clean);
    const stats = await fetchTowerStats(clean);
    const encounter = { id: "tower", enemies: [{ hp: stats.hp, atk: stats.atk }] };
    const chance = runTeamTrials(team, encounter, 36, stats).chance;
    chanceCache.set(clean, chance);
    await nextFrame();
    return chance;
  }

  async function threshold(target) {
    let low = 1;
    let high = Math.max(2, Math.round(seedFloor));
    if (await chanceAt(low) < target) return 1;
    if (await chanceAt(high) >= target) {
      low = high;
      while (high < 100000000 && await chanceAt(high) >= target) {
        low = high;
        high *= 2;
      }
    }
    for (let iteration = 0; iteration < 7 && high - low > 2; iteration += 1) {
      const middle = Math.round((low + high) / 2);
      if (await chanceAt(middle) >= target) low = middle;
      else high = middle;
    }
    return Math.max(1, high);
  }

  const early = await threshold(0.75);
  const late = await threshold(0.25);
  return { early: Math.min(early, late), late: Math.max(early, late), samples: chanceCache.size };
}

function simulationVerdict(chance) {
  if (chance >= 0.80) return "Strongly favored";
  if (chance >= 0.60) return "Favored";
  if (chance >= 0.40) return "Close matchup";
  if (chance >= 0.20) return "Unfavored";
  return "Very unlikely";
}


function recommendationReason(entry, encounter) {
  const description = String(entry.card.abilityDescription || "").toLowerCase();
  const reasons = [];
  if (entry.role === "aoe" && encounter.enemies.length > 1) reasons.push("pressures enemies waiting behind the front card");
  if (entry.role === "support") reasons.push("improves the full lineup rather than only its own turn");
  if (/(heal|regen|revive|shield|damage reduction|less damage|dodge|evasion)/.test(description)) reasons.push("survives unfavorable damage rolls");
  if (/(max hp|poison|burn|ignite|bleed)/.test(description)) reasons.push("scales against high-HP tower enemies");
  if (/(attack twice|attacks twice|attacks 3 times|all enemies|two random|splash|pierce)/.test(description)) reasons.push("adds extra attacks or carry-over damage");
  if (/(on entry|upon entry|battle start|off-field|while alive)/.test(description)) reasons.push("contributes before or outside its active turns");
  if (!reasons.length) reasons.push("produced the best simulated HP-and-damage tradeoff in this order");
  return reasons.slice(0, 2).join(" and ");
}

function currentTeamSimulationEntries() {
  return state.teamVariants.map(function (saved) {
    const card = state.cards.find(function (item) { return item.id === saved.id; });
    if (!card) return null;
    return {
      card,
      borders: canonicalBorderNames(saved.borders),
      count: 1,
      stats: statsForCard(card, saved.borders),
      role: cardRole(card),
      score: 0
    };
  }).filter(Boolean).slice(0, MAX_TEAM_SIZE);
}

function renderRecommendationSlots() {
  els.recommendedSlots.innerHTML = Array.from({ length: MAX_TEAM_SIZE }, function (_, index) {
    const entry = state.recommendation[index];
    if (!entry) return '<div class="recommendation-slot is-empty"><span>' + (index + 1) + '</span><strong>Empty slot</strong><small>Own more card copies</small></div>';
    return '<div class="recommendation-slot">' +
      '<span>' + (index + 1) + '</span>' +
      '<img src="' + imageURL(entry.card) + '" alt="">' +
      '<div><strong>' + escapeHTML(entry.card.name) + '</strong><small>' + escapeHTML(variantCode(entry.borders)) +
      ' · ' + escapeHTML(entry.role.toUpperCase()) + ' · HP ' + formatNumber(entry.stats.hp) + ' · ATK ' + formatNumber(entry.stats.atk) + '</small></div>' +
      '</div>';
  }).join("");
}

function renderSimulationMetrics(result, encounter, floorRange) {
  els.simulationSummary.hidden = false;
  els.simulationWin.textContent = Math.round(result.chance * 100) + "%";
  els.simulationVerdict.textContent = simulationVerdict(result.chance);
  els.simulationTrials.textContent = formatNumber(result.trials) + " battles";
  if (encounter.id === "tower") {
    els.simulationFloorMetric.hidden = false;
    els.simulationFloor.textContent = floorRange
      ? formatNumber(floorRange.early) + "–" + formatNumber(floorRange.late)
      : "Calculating…";
  } else {
    els.simulationFloorMetric.hidden = true;
  }
}

function renderSimulationExplanation(best, encounter, currentResult, floorRange) {
  const reasons = state.recommendation.map(function (entry, index) {
    return '<li><strong>' + (index + 1) + '. ' + escapeHTML(variantCode(entry.borders)) + ' ' +
      escapeHTML(entry.card.name) + ':</strong> ' + escapeHTML(recommendationReason(entry, encounter)) + '.</li>';
  }).join("");
  const currentComparison = currentResult
    ? '<p class="simulation-comparison">Current saved team: <strong>' + Math.round(currentResult.chance * 100) +
      '%</strong> estimated win chance. Recommended team: <strong>' + Math.round(best.result.chance * 100) + '%</strong>.</p>'
    : "";
  const floorText = encounter.id === "tower"
    ? floorRange
      ? '<p class="floor-range-copy"><strong>Estimated tower ceiling: floors ' + formatNumber(floorRange.early) + '–' +
        formatNumber(floorRange.late) + '.</strong> The lower end represents bad enemy combinations; favorable matchups can reach the upper end.</p>'
      : '<p class="floor-range-copy"><strong>Estimating the tower ceiling…</strong> The assistant is checking additional floors through the private stats endpoint.</p>'
    : "";
  const randomText = encounter.id === "tower"
    ? "The selected-floor percentage samples random four-card enemy lineups, so it includes matchup variance."
    : "The percentage repeats the displayed enemy order with independently rolled chance effects.";

  els.explanation.innerHTML =
    '<div class="assistant-answer">' +
      '<p><strong>' + escapeHTML(simulationVerdict(best.result.chance)) + ' against ' + escapeHTML(encounter.name) + '.</strong> ' +
      'The simulator won ' + best.result.wins + ' of ' + best.result.trials + ' final verification battles and averaged ' +
      best.result.avgSurvivors.toFixed(1) + ' surviving cards in wins and losses combined.</p>' +
      currentComparison +
      floorText +
      '<ol>' + reasons + '</ol>' +
      '<button id="useRecommendedTeam" type="button">Use this team</button>' +
      '<small>' + escapeHTML(randomText) + ' Complex copy, summon, and random-mode abilities use conservative approximations.</small>' +
    '</div>';
}

async function buildRecommendations() {
  const encounter = currentEncounter();
  if (!encounter) {
    els.recommendationStatus.textContent = "Generate tower";
    return;
  }
  const goal = els.goal.value;
  const entries = ownedSimulationEntries(encounter, goal);
  const availableCopies = entries.reduce(function (sum, entry) { return sum + entry.count; }, 0);
  if (availableCopies < MAX_TEAM_SIZE) {
    els.recommendationStatus.textContent = "Need four copies";
    els.explanation.innerHTML = '<span>!</span><p>Add at least four owned card copies before running the battle simulator.</p>';
    return;
  }

  els.analyze.disabled = true;
  els.analyze.textContent = "Simulating battles…";
  els.recommendationStatus.textContent = "Building candidate teams";
  els.simulationSummary.hidden = true;
  try {
    const best = await optimizeTeam(entries, encounter);
    if (!best || !best.team.length) throw new Error("No valid four-card team could be built from the collection.");
    state.recommendation = best.team;
    state.simulation = { encounterId: encounter.id, result: best.result, floorRange: null };
    renderRecommendationSlots();
    renderSimulationMetrics(best.result, encounter, null);

    let currentResult = null;
    const currentTeam = currentTeamSimulationEntries();
    if (currentTeam.length === MAX_TEAM_SIZE) {
      const towerStats = encounter.id === "tower" ? { hp: encounter.enemies[0].hp, atk: encounter.enemies[0].atk } : null;
      currentResult = runTeamTrials(currentTeam, encounter, 54, towerStats);
    }
    renderSimulationExplanation(best, encounter, currentResult, null);
    els.recommendationStatus.textContent = "Simulation complete";

    if (encounter.id === "tower" && Number(encounter.floor) > 0) {
      try {
        const floorRange = await estimateTowerCeiling(best.team, encounter.floor);
        state.simulation.floorRange = floorRange;
        renderSimulationMetrics(best.result, encounter, floorRange);
        renderSimulationExplanation(best, encounter, currentResult, floorRange);
      } catch (error) {
        console.warn("Tower ceiling estimate failed", error);
        els.simulationFloor.textContent = "Unavailable";
      }
    }
    els.recommendationStatus.textContent = "Simulation complete";
  } catch (error) {
    console.error("Battle simulation failed", error);
    els.recommendationStatus.textContent = "Simulation failed";
    els.explanation.innerHTML = '<span>!</span><p>' + escapeHTML(error.message || "The simulator could not finish this matchup.") + '</p>';
  } finally {
    els.analyze.disabled = false;
    els.analyze.textContent = "Simulate best team";
  }
}


async function init() {
  loadCollection();
  try {
    await loadCards();
    state.teamVariants = sanitizeTeamVariants(state.teamVariants.filter(function (entry) {
      return state.cards.some(function (card) { return card.id === entry.id; });
    }));
    state.team = state.teamVariants.map(function (entry) { return entry.id; });
    renderSummary();
    renderTargetOptions();
    renderSelectedEncounter();
  } catch (error) {
    console.error("Assistant data failed to load", error);
    els.ownedStrip.innerHTML = '<div class="owned-empty">The local card data could not be loaded.</div>';
    els.analyze.disabled = true;
  }
}

els.target.addEventListener("change", function () {
  renderSelectedEncounter();
  els.recommendationStatus.textContent = "Ready";
  els.simulationSummary.hidden = true;
});
els.goal.addEventListener("change", function () {
  els.recommendationStatus.textContent = "Ready";
  els.simulationSummary.hidden = true;
});
els.analyze.addEventListener("click", buildRecommendations);
els.towerGenerate.addEventListener("click", generateTowerBattle);
els.towerFloor.addEventListener("keydown", function (event) {
  if (event.key === "Enter") generateTowerBattle();
});
els.explanation.addEventListener("click", function (event) {
  if (event.target.closest("#useRecommendedTeam")) saveRecommendedTeam();
});

init();
