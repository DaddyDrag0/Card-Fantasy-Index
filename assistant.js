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
  recommendation: []
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
    const response = await fetch(TOWER_API_URL + "?floor=" + encodeURIComponent(floor) + "&t=" + Date.now(), {
      method: "GET",
      cache: "no-store",
      redirect: "follow"
    });
    if (!response.ok) throw new Error("Tower API returned " + response.status);

    const data = await response.json();
    if (data.success === false) throw new Error(data.error || "Tower API rejected the floor.");

    const hp = Math.round(Number(data.hp != null ? data.hp : data.generatedValue));
    const atk = Math.round(Number(data.atk != null ? data.atk : hp / 3));
    if (!Number.isFinite(hp) || !Number.isFinite(atk)) throw new Error("Tower API returned invalid stats.");

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

function recommendationReason(entry, encounter) {
  const description = String(entry.card.abilityDescription || "").toLowerCase();
  const reasons = [];

  if (entry.role === "aoe" && encounter.enemies.length > 1) reasons.push("hits multiple enemies");
  if (entry.role === "support") reasons.push("strengthens or protects the team");
  if (/(heal|regen|revive|shield|damage reduction|less damage|dodge|evasion)/.test(description)) reasons.push("adds survival");
  if (/(max hp damage|poison|burn|ignite)/.test(description)) reasons.push("scales well into high-HP enemies");
  if (/(attack twice|attacks twice|dual|all enemies|two random)/.test(description)) reasons.push("adds extra pressure");
  if (!reasons.length) reasons.push(entry.stats.atk >= entry.stats.hp / 3 ? "provides strong damage" : "provides balanced stats");

  return reasons.slice(0, 2).join(" and ");
}

function buildRecommendations() {
  const encounter = currentEncounter();
  const owned = state.cards.filter(function (card) { return ownedCount(card.id) > 0; });

  if (!encounter) {
    els.recommendationStatus.textContent = "Generate tower";
    return;
  }
  if (!owned.length) {
    els.recommendationStatus.textContent = "No owned cards";
    els.explanation.innerHTML = '<span>!</span><p>Add cards to your collection before requesting a team.</p>';
    return;
  }

  const goal = els.goal.value;
  const entries = [];
  owned.forEach(function (card) {
    const variants = state.collectionVariants[card.id] || {};
    Object.entries(variants).forEach(function (pair) {
      const borders = bordersFromVariantKey(pair[0]);
      const count = Math.max(0, Math.floor(Number(pair[1]) || 0));
      if (!count) return;
      entries.push({
        card: card,
        borders: borders,
        count: count,
        stats: statsForCard(card, borders),
        role: cardRole(card),
        score: 0
      });
    });
  });
  const maxHP = Math.max.apply(null, entries.map(function (entry) { return entry.stats.hp; }));
  const maxATK = Math.max.apply(null, entries.map(function (entry) { return entry.stats.atk; }));
  const enemyCount = encounter.enemies.length;
  const enemyMaxHP = Math.max.apply(null, encounter.enemies.map(function (enemy) { return enemy.hp; }));
  const enemyMaxATK = Math.max.apply(null, encounter.enemies.map(function (enemy) { return enemy.atk; }));

  entries.forEach(function (entry) {
    const hpScore = entry.stats.hp / Math.max(1, maxHP);
    const atkScore = entry.stats.atk / Math.max(1, maxATK);
    const description = String((entry.card.abilityType || "") + " " + (entry.card.abilityDescription || "")).toLowerCase();

    let hpWeight = 0.42;
    let atkWeight = 0.58;
    if (goal === "survival") { hpWeight = 0.72; atkWeight = 0.28; }
    if (goal === "damage") { hpWeight = 0.22; atkWeight = 0.78; }
    if (goal === "counter") { hpWeight = 0.5; atkWeight = 0.5; }

    let score = hpScore * hpWeight + atkScore * atkWeight;
    if (entry.role === "aoe" && enemyCount > 1) score += goal === "damage" ? 0.28 : 0.20;
    if (entry.role === "support") score += goal === "survival" ? 0.28 : 0.17;
    if (/(heal|regen|revive|shield|damage reduction|less damage|dodge|evasion|absorb)/.test(description)) score += goal === "survival" ? 0.22 : 0.10;
    if (/(max hp damage|poison|burn|ignite)/.test(description) && enemyMaxHP > maxATK * 5) score += 0.16;
    if (/(all enemies|two random enem|strikes two|attack twice|attacks twice|attacks 3 times)/.test(description) && enemyCount > 1) score += 0.13;
    if (/(boost.*atk|increases.*atk|attack.*boost)/.test(description)) score += goal === "damage" ? 0.13 : 0.07;
    if (enemyMaxATK > maxHP && /(shield|dodge|evasion|less damage|damage reduction|revive)/.test(description)) score += 0.12;

    entry.score = score;
  });

  entries.sort(function (left, right) { return right.score - left.score; });

  const selected = [];
  function selectedVariantCount(entry) {
    const key = variantKey(entry.borders);
    return selected.filter(function (item) {
      return item.card.id === entry.card.id && variantKey(item.borders) === key;
    }).length;
  }
  function addEntry(entry) {
    if (!entry || selected.length >= MAX_TEAM_SIZE) return false;
    if (selectedVariantCount(entry) >= entry.count) return false;
    selected.push(entry);
    return true;
  }

  if (enemyCount > 1) addEntry(entries.find(function (entry) { return entry.role === "aoe"; }));
  if (goal !== "damage" || enemyMaxATK > 0) addEntry(entries.find(function (entry) { return entry.role === "support"; }));

  let addedCopy = true;
  while (selected.length < MAX_TEAM_SIZE && addedCopy) {
    addedCopy = false;
    for (const entry of entries) {
      if (addEntry(entry)) addedCopy = true;
      if (selected.length >= MAX_TEAM_SIZE) break;
    }
  }

  state.recommendation = selected.slice(0, MAX_TEAM_SIZE);
  els.recommendationStatus.textContent = state.recommendation.length === MAX_TEAM_SIZE ? "Recommended" : state.recommendation.length + "/4 available";

  els.recommendedSlots.innerHTML = Array.from({ length: MAX_TEAM_SIZE }, function (_, index) {
    const entry = state.recommendation[index];
    if (!entry) return '<div class="recommendation-slot is-empty"><span>' + (index + 1) + '</span><strong>Empty slot</strong><small>Own more cards</small></div>';

    return '<div class="recommendation-slot">' +
      '<span>' + (index + 1) + '</span>' +
      '<img src="' + imageURL(entry.card) + '" alt="">' +
      '<div><strong>' + escapeHTML(entry.card.name) + '</strong><small>' + escapeHTML(variantCode(entry.borders)) +
      ' · ' + escapeHTML(entry.role.toUpperCase()) + ' · HP ' + formatNumber(entry.stats.hp) + ' · ATK ' + formatNumber(entry.stats.atk) + '</small></div>' +
      '</div>';
  }).join("");

  const reasons = state.recommendation.map(function (entry, index) {
    return '<li><strong>' + (index + 1) + '. ' + escapeHTML(variantCode(entry.borders)) + ' ' +
      escapeHTML(entry.card.name) + ':</strong> ' + escapeHTML(recommendationReason(entry, encounter)) + '.</li>';
  }).join("");
  const alternatives = entries
    .filter(function (entry) {
      const pickedCount = state.recommendation.filter(function (picked) {
        return picked.card.id === entry.card.id && variantKey(picked.borders) === variantKey(entry.borders);
      }).length;
      return pickedCount < entry.count;
    })
    .slice(0, 3)
    .map(function (entry) { return variantCode(entry.borders) + " " + entry.card.name; });

  els.explanation.innerHTML =
    '<div class="assistant-answer">' +
      '<p><strong>Recommended for ' + escapeHTML(encounter.name) + '.</strong> This team prioritizes ' +
      escapeHTML(goal) + ' performance against ' + encounter.enemies.length + ' enemies.</p>' +
      '<ol>' + reasons + '</ol>' +
      (alternatives.length ? '<p class="assistant-alternatives"><span>Alternatives:</span> ' + escapeHTML(alternatives.join(", ")) + '</p>' : '') +
      '<button id="useRecommendedTeam" type="button">Use this team</button>' +
      '<small>Recommendations use card stats, roles, and written abilities. Random ability outcomes can still change a battle.</small>' +
    '</div>';
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
});
els.goal.addEventListener("change", function () {
  els.recommendationStatus.textContent = "Ready";
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
