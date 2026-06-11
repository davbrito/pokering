const STAT_ABBR = {
  hp: "HP",
  attack: "ATK",
  defense: "DEF",
  "special-attack": "SpA",
  "special-defense": "SpD",
  speed: "SPD",
};
const TYPES = [
  "all",
  "normal",
  "fire",
  "water",
  "grass",
  "electric",
  "ice",
  "fighting",
  "poison",
  "ground",
  "flying",
  "psychic",
  "bug",
  "rock",
  "ghost",
  "dragon",
  "dark",
  "steel",
  "fairy",
] as const;
const TYPE_TAB_COLORS = {
  all: {
    bg: "rgba(255,255,255,.1)",
    color: "#e0e0f0",
    border: "rgba(255,255,255,.25)",
  },
  fire: {
    bg: "rgba(214,90,48,.25)",
    color: "#ff8c5a",
    border: "rgba(214,90,48,.5)",
  },
  water: {
    bg: "rgba(58,130,220,.25)",
    color: "#6db4ff",
    border: "rgba(58,130,220,.5)",
  },
  grass: {
    bg: "rgba(90,170,50,.25)",
    color: "#7ed957",
    border: "rgba(90,170,50,.5)",
  },
  electric: {
    bg: "rgba(240,200,0,.2)",
    color: "#ffd52e",
    border: "rgba(240,200,0,.4)",
  },
  ice: {
    bg: "rgba(60,190,200,.25)",
    color: "#5ae0e8",
    border: "rgba(60,190,200,.5)",
  },
  fighting: {
    bg: "rgba(180,60,40,.25)",
    color: "#ff8060",
    border: "rgba(180,60,40,.5)",
  },
  poison: {
    bg: "rgba(120,60,180,.25)",
    color: "#c080ff",
    border: "rgba(120,60,180,.5)",
  },
  ground: {
    bg: "rgba(180,150,60,.25)",
    color: "#e0c060",
    border: "rgba(180,150,60,.5)",
  },
  flying: {
    bg: "rgba(100,160,220,.25)",
    color: "#90ccff",
    border: "rgba(100,160,220,.5)",
  },
  psychic: {
    bg: "rgba(200,60,120,.25)",
    color: "#ff7eb5",
    border: "rgba(200,60,120,.5)",
  },
  bug: {
    bg: "rgba(100,160,60,.25)",
    color: "#a0d060",
    border: "rgba(100,160,60,.5)",
  },
  rock: {
    bg: "rgba(150,130,80,.25)",
    color: "#c8b870",
    border: "rgba(150,130,80,.5)",
  },
  ghost: {
    bg: "rgba(60,60,120,.35)",
    color: "#9090d8",
    border: "rgba(60,60,120,.6)",
  },
  dragon: {
    bg: "rgba(80,60,180,.25)",
    color: "#9f90ff",
    border: "rgba(80,60,180,.5)",
  },
  dark: {
    bg: "rgba(60,50,50,.4)",
    color: "#c0b0b0",
    border: "rgba(120,100,100,.5)",
  },
  steel: {
    bg: "rgba(150,150,180,.25)",
    color: "#c0c0d8",
    border: "rgba(150,150,180,.5)",
  },
  fairy: {
    bg: "rgba(220,80,140,.2)",
    color: "#ff99c8",
    border: "rgba(220,80,140,.4)",
  },
  normal: {
    bg: "rgba(130,130,130,.2)",
    color: "#c0c0c0",
    border: "rgba(130,130,130,.45)",
  },
};

// TABLA DE EFECTIVIDAD COMPLETA (Pokémon Oficial)
const TYPE_CHART = {
  normal: { rock: 0.5, ghost: 0, steel: 0.5 },
  fire: {
    fire: 0.5,
    water: 0.5,
    grass: 2,
    ice: 2,
    bug: 2,
    rock: 0.5,
    dragon: 0.5,
    steel: 2,
  },
  water: {
    fire: 2,
    water: 0.5,
    grass: 0.5,
    ground: 2,
    rock: 2,
    dragon: 0.5,
  },
  grass: {
    fire: 0.5,
    water: 2,
    grass: 0.5,
    poison: 0.5,
    ground: 2,
    flying: 0.5,
    bug: 0.5,
    rock: 2,
    dragon: 0.5,
    steel: 0.5,
  },
  electric: {
    water: 2,
    grass: 0.5,
    electric: 0.5,
    ground: 0,
    flying: 2,
    dragon: 0.5,
  },
  ice: {
    fire: 0.5,
    water: 0.5,
    grass: 2,
    ice: 0.5,
    ground: 2,
    flying: 2,
    dragon: 2,
    steel: 0.5,
  },
  fighting: {
    normal: 2,
    ice: 2,
    poison: 0.5,
    flying: 0.5,
    psychic: 0.5,
    bug: 0.5,
    rock: 2,
    ghost: 0,
    dark: 2,
    steel: 2,
    fairy: 0.5,
  },
  poison: {
    grass: 2,
    poison: 0.5,
    ground: 0.5,
    rock: 0.5,
    ghost: 0.5,
    steel: 0,
    fairy: 2,
  },
  ground: {
    fire: 2,
    grass: 0.5,
    electric: 2,
    poison: 2,
    flying: 0,
    bug: 0.5,
    rock: 2,
    steel: 2,
  },
  flying: {
    grass: 2,
    electric: 0.5,
    fighting: 2,
    bug: 2,
    rock: 0.5,
    steel: 0.5,
  },
  psychic: { fighting: 2, poison: 2, psychic: 0.5, dark: 0, steel: 0.5 },
  bug: {
    fire: 0.5,
    grass: 2,
    fighting: 0.5,
    poison: 0.5,
    flying: 0.5,
    psychic: 2,
    ghost: 0.5,
    dark: 2,
    steel: 0.5,
    fairy: 0.5,
  },
  rock: {
    fire: 2,
    ice: 2,
    fighting: 0.5,
    ground: 0.5,
    flying: 2,
    bug: 2,
    steel: 0.5,
  },
  ghost: { normal: 0, psychic: 2, ghost: 2, dark: 0.5 },
  dragon: { dragon: 2, steel: 0.5, fairy: 0 },
  dark: { fighting: 0.5, psychic: 2, ghost: 2, dark: 0.5, fairy: 0.5 },
  steel: {
    fire: 0.5,
    water: 0.5,
    electric: 0.5,
    ice: 2,
    rock: 2,
    steel: 0.5,
    fairy: 2,
  },
  fairy: {
    fire: 0.5,
    fighting: 2,
    poison: 0.5,
    dragon: 2,
    dark: 2,
    steel: 0.5,
  },
};

// MOVIMIENTOS TEMÁTICOS SEGÚN EL TIPO DEL POKÉMON (Para simulación inteligente)
const TYPE_MOVES = {
  normal: { physical: "Golpe Cuerpo", special: "Triataque", power: 85 },
  fire: { physical: "Envite Ígneo", special: "Lanzallamas", power: 90 },
  water: { physical: "Cascada", special: "Hidrobomba", power: 90 },
  grass: { physical: "Latigazo", special: "Giga Drenado", power: 80 },
  electric: { physical: "Puño Trueno", special: "Rayo", power: 80 },
  ice: { physical: "Chuzos", special: "Rayo Hielo", power: 85 },
  fighting: {
    physical: "A Bocajarro",
    special: "Onda Certera",
    power: 100,
  },
  poison: { physical: "Puya Nociva", special: "Bomba Lodo", power: 80 },
  ground: { physical: "Terremoto", special: "Tierra Viva", power: 95 },
  flying: { physical: "Pájaro Osado", special: "Tornado", power: 80 },
  psychic: { physical: "Cabezazo Zen", special: "Psíquico", power: 85 },
  bug: { physical: "Tijera X", special: "Zumbido", power: 80 },
  rock: { physical: "Afilagarras", special: "Poder Pasado", power: 75 },
  ghost: { physical: "Garra Umbría", special: "Bola Sombra", power: 80 },
  dragon: {
    physical: "Garra Dragón",
    special: "Pulso Dragón",
    power: 85,
  },
  dark: { physical: "Tajo Umbrío", special: "Pulso Umbrío", power: 80 },
  steel: {
    physical: "Cabeza de Hierro",
    special: "Foco Resplandor",
    power: 80,
  },
  fairy: { physical: "Carantoña", special: "Fuerza Lunar", power: 90 },
};

type Pokemon = any; // TODO: Definir tipo real basado en la respuesta de la API

let allPokemon: Pokemon[] = [],
  byType: Record<string, Pokemon[]> = {},
  activeSlot = 0,
  activeTab = "all",
  searchQ = "";
let chosen: (Pokemon | null)[] = [null, null];
let previewCache: Record<number, Pokemon> = {};

// Variables para el motor cinemático de combate
let battleSteps: any[] = [];
let currentStepIdx = 0;
let playbackTimeout: any = null;
let playbackSpeed = 1; // Multiplicador (1x, 2x, 4x)
let isPaused = false;
let maxHealths = [100, 100];

async function init() {
  const bar = document.getElementById("tabs-bar")!;
  TYPES.forEach((t) => {
    const c = TYPE_TAB_COLORS[t] || TYPE_TAB_COLORS.normal;
    const btn = document.createElement("button");
    btn.className = "tab-btn" + (t === "all" ? " active" : "");
    btn.textContent = t === "all" ? "Todos" : t;
    btn.style.background = c.bg;
    btn.style.color = c.color;
    btn.style.borderColor = c.border;
    btn.onclick = () => switchTab(t);
    btn.dataset.type = t;
    bar.appendChild(btn);
  });

  try {
    const r = await fetch("https://pokeapi.co/api/v2/pokemon?limit=1010");
    const d = await r.json();
    allPokemon = d.results.map((p, i) => ({ name: p.name, id: i + 1 }));
    byType.all = allPokemon;
  } catch (e) {
    console.error(e);
  }
}

async function loadTypeData(type) {
  if (byType[type]) return;
  try {
    const r = await fetch(`https://pokeapi.co/api/v2/type/${type}`);
    const d = await r.json();
    byType[type] = d.pokemon
      .map((p) => {
        const parts = p.pokemon.url.split("/").filter(Boolean);
        const id = parseInt(parts[parts.length - 1]);
        return { name: p.pokemon.name, id };
      })
      .filter((p) => p.id <= 1010)
      .sort((a, b) => a.id - b.id);
  } catch (e) {
    byType[type] = [];
  }
}

function switchTab(type) {
  activeTab = type;
  document
    .querySelectorAll(".tab-btn")
    .forEach((b) => b.classList.toggle("active", b.dataset.type === type));
  renderGrid();
  if (type !== "all") loadTypeData(type).then(renderGrid);
}

function filterGrid() {
  searchQ = document.getElementById("modal-search").value.trim().toLowerCase();
  renderGrid();
}

function renderGrid() {
  const grid = document.getElementById("poke-grid");
  let list = byType[activeTab] || allPokemon;
  if (searchQ) {
    list = allPokemon.filter(
      (p) =>
        p.name.includes(searchQ) ||
        String(p.id).padStart(3, "0").includes(searchQ),
    );
  }
  if (!list.length) {
    grid.innerHTML = `<div class="no-results" style="grid-column:1/-1">No se encontraron Pokémon</div>`;
    return;
  }
  grid.innerHTML = list
    .slice(0, 200)
    .map(
      (p) => `
    <div class="poke-thumb" onclick="selectFromModal('${p.name}')" onmouseenter="showPreview(${p.id},'${p.name}')">
      <img src="https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${p.id}.png" alt="${p.name}" loading="lazy">
      <div class="pt-name">${p.name}</div>
      <div class="pt-num">#${String(p.id).padStart(3, "0")}</div>
    </div>`,
    )
    .join("");
}

async function showPreview(id, name) {
  const panel = document.getElementById("preview-panel");
  if (previewCache[id]) {
    renderPreview(previewCache[id]);
    return;
  }
  panel.innerHTML = `<div class="loading-bar"><div class="spinner"></div></div>`;
  try {
    const r = await fetch(`https://pokeapi.co/api/v2/pokemon/${id}`);
    const d = await r.json();
    previewCache[id] = d;
    renderPreview(d);
  } catch (e) {}
}

function renderPreview(d) {
  const panel = document.getElementById("preview-panel");
  const art =
    d.sprites.other?.["official-artwork"]?.front_default ||
    d.sprites.front_default;
  const types = d.types.map((t) => t.type.name);
  const stats = d.stats;
  const total = stats.reduce((a, s) => a + s.base_stat, 0);
  const typeBadges = types
    .map((t) => `<span class="tbadge t-${t}">${t}</span>`)
    .join("");
  const statRows = stats
    .map((s) => {
      const abbr =
        STAT_ABBR[s.stat.name] || s.stat.name.slice(0, 3).toUpperCase();
      const pct = Math.round(Math.min((s.base_stat / 180) * 100, 100));
      const col =
        s.base_stat >= 100
          ? "#4ade80"
          : s.base_stat >= 70
            ? "#60d8a0"
            : s.base_stat >= 45
              ? "#f5c842"
              : "#e63e3e";
      return `<div class="prev-srow">
      <span class="prev-sname">${abbr}</span>
      <div class="strack"><div class="sfill" style="width:${pct}%;background:${col}"></div></div>
      <span class="sval" style="font-size:9px;font-family:var(--font-m);color:var(--text)">${s.base_stat}</span>
    </div>`;
    })
    .join("");
  panel.innerHTML = `
    <img class="prev-art" src="${art}" alt="${d.name}">
    <div class="prev-name">${d.name}</div>
    <div class="prev-meta">#${String(d.id).padStart(3, "0")} · BST ${total}</div>
    <div class="prev-types">${typeBadges}</div>
    <div class="prev-stats">${statRows}</div>
    <button class="prev-select-btn" onclick="selectFromModal('${d.name}')">Elegir este ▶</button>
  `;
}

function openModal(slot) {
  activeSlot = slot;
  document.getElementById("overlay").classList.add("open");
  document.getElementById("modal-search").value = "";
  searchQ = "";
  document.getElementById("preview-panel").innerHTML =
    `<div class="preview-empty"><div class="pe-icon">👆</div><div>Pasa el cursor sobre un Pokémon para verlo</div></div>`;
  renderGrid();
  setTimeout(() => document.getElementById("modal-search").focus(), 100);
}

function closeModal() {
  document.getElementById("overlay").classList.remove("open");
}

function handleOverlayClick(e) {
  if (e.target === document.getElementById("overlay")) closeModal();
}

async function selectFromModal(name) {
  closeModal();
  const slot = document.getElementById("slot" + activeSlot);
  const card = document.getElementById("card" + activeSlot);
  const btn = slot.querySelector(".pick-btn");
  btn.innerHTML = `<div class="spinner"></div> Cargando...`;
  card.className = "poke-card";
  card.innerHTML = "";

  try {
    const [pr, sr_dummy] = [
      await fetch(`https://pokeapi.co/api/v2/pokemon/${name}`),
      null,
    ];
    const d = await pr.json();
    const spR = await fetch(d.species.url);
    const spD = await spR.json();
    const fl =
      spD.flavor_text_entries.find((e) => e.language.name === "es") ||
      spD.flavor_text_entries.find((e) => e.language.name === "en");
    const flavor = fl ? fl.flavor_text.replace(/[\f\n]/g, " ") : "";
    chosen[activeSlot] = { ...d, flavor };
    slot.classList.add("filled");
    btn.innerHTML = `<span class="pb-icon">✔</span> ${d.name} — cambiar`;
    renderSlotCard(activeSlot, d, flavor);
    checkReady();
  } catch (e) {
    btn.innerHTML = `<span class="pb-icon">⊕</span> Seleccionar Pokémon`;
    alert("Error al cargar el Pokémon. Intenta de nuevo.");
  }
}

function renderSlotCard(idx, d, flavor) {
  const card = document.getElementById("card" + idx);
  const art =
    d.sprites.other?.["official-artwork"]?.front_default ||
    d.sprites.front_default;
  const types = d.types.map((t) => t.type.name);
  const stats = d.stats;
  const total = stats.reduce((a, s) => a + s.base_stat, 0);
  const typeBadges = types
    .map((t) => `<span class="tbadge t-${t}">${t}</span>`)
    .join("");
  const statRows = stats
    .map((s) => {
      const abbr =
        STAT_ABBR[s.stat.name] || s.stat.name.slice(0, 3).toUpperCase();
      const pct = Math.round(Math.min((s.base_stat / 180) * 100, 100));
      const col =
        s.base_stat >= 100
          ? "#4ade80"
          : s.base_stat >= 70
            ? "#60d8a0"
            : s.base_stat >= 45
              ? "#f5c842"
              : "#e63e3e";
      return `<div class="srow"><span class="sname">${abbr}</span><div class="strack"><div class="sfill" style="width:${pct}%;background:${col}"></div></div><span class="sval">${s.base_stat}</span></div>`;
    })
    .join("");
  card.innerHTML = `
    <div class="poke-art-wrap"><div style="position:absolute;inset:0;background:radial-gradient(circle at 50% 60%,rgba(230,62,62,.18) 0%,transparent 65%);pointer-events:none"></div>
      <img class="poke-art" src="${art}" alt="${d.name}">
    </div>
    <div class="poke-name">${d.name}</div>
    <div class="poke-sub">#${String(d.id).padStart(3, "0")} · ${d.height / 10}m · ${d.weight / 10}kg · BST ${total}</div>
    <div class="types">${typeBadges}</div>
    <div class="stats">${statRows}</div>
    ${flavor ? `<p class="flavor">"${flavor}"</p>` : ""}
  `;
  card.className = "poke-card show";
}

function checkReady() {
  document.getElementById("battleBtn").disabled = !(chosen[0] && chosen[1]);
}

// Retorna multiplicador de efectividad acumulado
function getEffectiveness(attackerType, defenderTypes) {
  let eff = 1;
  defenderTypes.forEach((defType) => {
    if (
      TYPE_CHART[attackerType] &&
      TYPE_CHART[attackerType][defType] !== undefined
    ) {
      eff *= TYPE_CHART[attackerType][defType];
    }
  });
  return eff;
}

// Selección inteligente del mejor ataque ofensivo del luchador
function selectBestMove(attacker, attackerStats, defenderTypes, isDefenderP1) {
  const attackerTypes = attacker.types.map((t) => t.type.name);
  let bestMove = null;
  let maxDamagePotential = -1;

  attackerTypes.forEach((type) => {
    const moveOptions = TYPE_MOVES[type] || TYPE_MOVES.normal;
    const isPhysicalAttacker = attackerStats.atk > attackerStats.spa;
    const category = isPhysicalAttacker ? "physical" : "special";
    const moveName = moveOptions[category];
    const movePower = moveOptions.power;

    const offensiveStat = isPhysicalAttacker
      ? attackerStats.atk
      : attackerStats.spa;
    const defenderStats = isDefenderP1
      ? chosen[0]
        ? getStatsObject(chosen[0])
        : attackerStats
      : chosen[1]
        ? getStatsObject(chosen[1])
        : attackerStats;
    const defensiveStat = isPhysicalAttacker
      ? defenderStats.def
      : defenderStats.spd;

    const typeEff = getEffectiveness(type, defenderTypes);
    const expectedDmg = (offensiveStat / defensiveStat) * movePower * typeEff;

    if (expectedDmg > maxDamagePotential) {
      maxDamagePotential = expectedDmg;
      bestMove = {
        name: moveName,
        type: type,
        category: category,
        power: movePower,
        eff: typeEff,
      };
    }
  });

  return (
    bestMove || {
      name: "Combate",
      type: "normal",
      category: "physical",
      power: 50,
      eff: 1,
    }
  );
}

function getStatsObject(p) {
  const gs = (poke, n) =>
    poke.stats.find((s) => s.stat.name === n)?.base_stat || 0;
  return {
    hp: gs(p, "hp"),
    atk: gs(p, "attack"),
    def: gs(p, "defense"),
    spa: gs(p, "special-attack"),
    spd: gs(p, "special-defense"),
    spe: gs(p, "speed"),
  };
}

// INICIAR SECUENCIA VISUAL CINEMÁTICA
function initiateBattleSequence() {
  const btn = document.getElementById("battleBtn");
  btn.disabled = true;

  // Ocultar la selección de Pokémon de la PokéArena con transición suave
  document.getElementById("arenaGrid").classList.add("hidden");
  document.getElementById("battleSection").classList.add("hidden");

  // Mostrar el Estadio de Combate Visual
  const stage = document.getElementById("stageContainer");
  stage.classList.add("show");

  // Limpiar estados de animación anteriores
  document.getElementById("fighter-wrapper-0").className = "fighter-wrapper p1";
  document.getElementById("fighter-wrapper-1").className = "fighter-wrapper p2";

  // Configurar metadatos y fotos de combatientes en el estadio
  const p1 = chosen[0],
    p2 = chosen[1];
  const p1s = getStatsObject(p1),
    p2s = getStatsObject(p2);
  const t1 = Object.values(p1s).reduce((a, b) => a + b, 0);
  const t2 = Object.values(p2s).reduce((a, b) => a + b, 0);

  document.getElementById("hud-name-0").textContent = p1.name;
  document.getElementById("hud-meta-0").textContent =
    `#${String(p1.id).padStart(3, "0")} · BST ${t1}`;
  document.getElementById("hud-name-1").textContent = p2.name;
  document.getElementById("hud-meta-1").textContent =
    `#${String(p2.id).padStart(3, "0")} · BST ${t2}`;

  const art1 =
    p1.sprites.other?.["official-artwork"]?.front_default ||
    p1.sprites.front_default;
  const art2 =
    p2.sprites.other?.["official-artwork"]?.front_default ||
    p2.sprites.front_default;
  document.getElementById("fighter-img-0").src = art1;
  document.getElementById("fighter-img-1").src = art2;

  // Escalar los PS de manera realista para que la pelea sea emocionante y dure varios turnos (Lv. 50)
  maxHealths[0] = p1s.hp * 2 + 110;
  maxHealths[1] = p2s.hp * 2 + 110;

  // Resetear barras de salud
  updateHpBar(0, maxHealths[0], maxHealths[0]);
  updateHpBar(1, maxHealths[1], maxHealths[1]);

  // Generar todos los turnos e interacciones usando la lógica local de combate
  generateBattleSteps(p1, p2, p1s, p2s, t1, t2);

  // Iniciar la reproducción cinemática por pasos
  currentStepIdx = 0;
  isPaused = false;
  document.getElementById("btn-pause").textContent = "Pausa";

  // Scrollear al viewport de forma fluida
  stage.scrollIntoView({ behavior: "smooth", block: "center" });

  setTimeout(playNextBattleStep, 600);
}

// GENERAR LA SECUENCIA DE PASOS DE COMBATE
function generateBattleSteps(p1, p2, p1s, p2s, t1, t2) {
  battleSteps = [];
  const pt1 = p1.types.map((t) => t.type.name);
  const pt2 = p2.types.map((t) => t.type.name);

  let hp1 = maxHealths[0];
  let hp2 = maxHealths[1];

  battleSteps.push({
    type: "start",
    text: `¡Comienza el duelo de exhibición! <strong>${p1.name.toUpperCase()}</strong> se enfrenta a <strong>${p2.name.toUpperCase()}</strong> en la arena.`,
    hps: [hp1, hp2],
  });

  let turn = 1;
  let critsCount = 0;

  while (hp1 > 0 && hp2 > 0 && turn <= 15) {
    // Iniciativa por velocidad más fluctuación estratégica aleatoria
    const spd1 = p1s.spe * (0.85 + Math.random() * 0.3);
    const spd2 = p2s.spe * (0.85 + Math.random() * 0.3);

    const firstAttackerP1 = spd1 >= spd2;
    const order = firstAttackerP1
      ? [
          {
            atk: p1,
            atkStats: p1s,
            atkTypes: pt1,
            def: p2,
            defStats: p2s,
            defTypes: pt2,
            isAtkP1: true,
          },
        ]
      : [
          {
            atk: p2,
            atkStats: p2s,
            atkTypes: pt2,
            def: p1,
            defStats: p1s,
            defTypes: pt1,
            isAtkP1: false,
          },
        ];

    order.push(
      firstAttackerP1
        ? {
            atk: p2,
            atkStats: p2s,
            atkTypes: pt2,
            def: p1,
            defStats: p1s,
            defTypes: pt1,
            isAtkP1: false,
          }
        : {
            atk: p1,
            atkStats: p1s,
            atkTypes: pt1,
            def: p2,
            defStats: p2s,
            defTypes: pt2,
            isAtkP1: true,
          },
    );

    for (let i = 0; i < order.length; i++) {
      const act = order[i];
      if (hp1 <= 0 || hp2 <= 0) break;

      const activeBestMove = selectBestMove(
        act.atk,
        act.atkStats,
        act.defTypes,
        !act.isAtkP1,
      );
      const isPhys = activeBestMove.category === "physical";
      const offVal = isPhys ? act.atkStats.atk : act.atkStats.spa;
      const defVal = isPhys ? act.defStats.def : act.defStats.spd;

      let baseDamage =
        (((2 * 50) / 5 + 2) * activeBestMove.power * (offVal / defVal)) / 50 +
        2;
      const eff = activeBestMove.eff;

      const isCrit = Math.random() < 0.12; // Probabilidad de golpe crítico (12%)
      const critMultiplier = isCrit ? 1.5 : 1;
      if (isCrit) critsCount++;

      const randomMultiplier = 0.85 + Math.random() * 0.15;
      let finalDamage = Math.floor(
        baseDamage * eff * critMultiplier * randomMultiplier,
      );
      if (finalDamage <= 0 && eff > 0) finalDamage = 1;

      // Calcular HPs antes y después
      const preHp = [hp1, hp2];
      if (act.isAtkP1) {
        hp2 = Math.max(0, hp2 - finalDamage);
      } else {
        hp1 = Math.max(0, hp1 - finalDamage);
      }
      const postHp = [hp1, hp2];

      // Texto narrativo dramático del combate
      let msg = `¡<strong>${act.atk.name.toUpperCase()}</strong> usó <span>${activeBestMove.name.toUpperCase()}</span>! `;
      if (isCrit) msg += `<em>¡Impacto Crítico!</em> 💥 `;
      if (eff > 1.5) msg += `<span class="super-eff">¡Es súper eficaz!</span> `;
      if (eff < 0.6 && eff > 0) msg += `<span>No es muy eficaz...</span> `;
      if (eff === 0) msg += `<span>¡No le afecta en absoluto!</span> `;

      battleSteps.push({
        type: "action",
        attackerIdx: act.isAtkP1 ? 0 : 1,
        moveName: activeBestMove.name,
        moveType: activeBestMove.type,
        category: activeBestMove.category,
        damage: finalDamage,
        isCrit: isCrit,
        eff: eff,
        preHp: preHp,
        postHp: postHp,
        text: msg,
      });

      // Chequear debilitado inmediato
      if (act.isAtkP1 && hp2 <= 0) {
        battleSteps.push({
          type: "faint",
          faintedIdx: 1,
          text: `¡El oponente <strong>${p2.name.toUpperCase()}</strong> se ha desplomado agotado! 😵`,
        });
      } else if (!act.isAtkP1 && hp1 <= 0) {
        battleSteps.push({
          type: "faint",
          faintedIdx: 0,
          text: `¡El luchador <strong>${p1.name.toUpperCase()}</strong> no puede continuar el combate! 😵`,
        });
      }
    }
    turn++;
  }

  // Veredicto final
  const winnerIdx = hp1 > 0 ? 0 : 1;
  const victor = winnerIdx === 0 ? p1 : p2;
  battleSteps.push({
    type: "end",
    winnerIdx: winnerIdx,
    text: `🏆 ¡El combate ha terminado! El absoluto ganador de la contienda es <strong>${victor.name.toUpperCase()}</strong>.`,
  });
}

// REPRODUCIR PASO A PASO
function playNextBattleStep() {
  if (isPaused) return;

  if (currentStepIdx >= battleSteps.length) {
    completeBattleSimulation();
    return;
  }

  const step = battleSteps[currentStepIdx];
  const duration = getStepDuration(step);

  executeStepVisuals(step);

  currentStepIdx++;
  playbackTimeout = setTimeout(playNextBattleStep, duration);
}

// CALCULAR TIEMPO DE PAUSA SEGÚN EL EVENTO Y LA VELOCIDAD DE JUEGO
function getStepDuration(step) {
  let baseDuration = 1800; // Por defecto 1.8 segundos
  if (step.type === "start") baseDuration = 2200;
  if (step.type === "faint") baseDuration = 2000;
  if (step.type === "end") baseDuration = 2500;
  if (step.type === "action") {
    // Si es especial tiene trayecto de proyectil, aumentamos levemente
    baseDuration = step.category === "special" ? 2000 : 1800;
  }
  return baseDuration / playbackSpeed;
}

// EJECUCIÓN GRÁFICA DEL COMBATE EN TIEMPO REAL
function executeStepVisuals(step) {
  const dialog = document.getElementById("stageDialog");
  dialog.innerHTML = step.text;

  if (step.type === "start") {
    // Setear HPs completos
    updateHpBar(0, maxHealths[0], maxHealths[0]);
    updateHpBar(1, maxHealths[1], maxHealths[1]);
  }

  if (step.type === "action") {
    const atkIdx = step.attackerIdx;
    const defIdx = atkIdx === 0 ? 1 : 0;
    const attackerWrapper = document.getElementById(
      `fighter-wrapper-${atkIdx}`,
    );
    const attackerSprite = document.getElementById(`fighter-img-${atkIdx}`);
    const defenderWrapper = document.getElementById(
      `fighter-wrapper-${defIdx}`,
    );
    const defenderSprite = document.getElementById(`fighter-img-${defIdx}`);

    if (step.category === "physical") {
      // Animación de embestida física
      attackerSprite.classList.add(atkIdx === 0 ? "lunge-right" : "lunge-left");

      // Impacto a mitad de animación
      setTimeout(() => {
        applyImpactHits(defIdx, defenderSprite, step);
      }, 200 / playbackSpeed);

      // Quitar clase tras finalizar embestida
      setTimeout(() => {
        attackerSprite.classList.remove(
          atkIdx === 0 ? "lunge-right" : "lunge-left",
        );
      }, 450 / playbackSpeed);
    } else {
      // Animación especial con proyectil elemental
      triggerProjectileFX(atkIdx, defIdx, step.moveType, () => {
        applyImpactHits(defIdx, defenderSprite, step);
      });
    }
  }

  if (step.type === "faint") {
    const sprite = document.getElementById(`fighter-img-${step.faintedIdx}`);
    sprite.classList.add("faint-slide");
  }

  if (step.type === "end") {
    const winnerSprite = document.getElementById(
      `fighter-img-${step.winnerIdx}`,
    );
    // Animación celebratoria del campeón
    winnerSprite.style.transform = "scale(1.25)";
    setTimeout(() => {
      winnerSprite.style.transform = "scale(1)";
    }, 400);
  }
}

// APLICAR IMPACTOS, TEMBLORES, POPUPS Y DAÑO A LA SALUD
function applyImpactHits(targetIdx, defenderSprite, step) {
  // Sacudida de impacto al receptor
  defenderSprite.classList.add("hit-shake");

  // Si fue crítico o súper eficaz sacude toda la pantalla
  if (step.isCrit || step.eff > 1.5) {
    const viewport = document.getElementById("stageViewport");
    viewport.classList.add("screen-shake-anim");
    setTimeout(() => viewport.classList.remove("screen-shake-anim"), 350);
  }

  // Generar popup dinámico de número de daño sobre el luchador afectado
  generateDamagePopup(targetIdx, step.damage, step.isCrit, step.eff);

  // Actualizar barra de vida progresivamente
  updateHpBar(targetIdx, step.postHp[targetIdx], maxHealths[targetIdx]);

  setTimeout(() => {
    defenderSprite.classList.remove("hit-shake");
  }, 400);
}

// GENERAR PROYECTIL ELEMENTAL DINÁMICO
function triggerProjectileFX(atkIdx, defIdx, moveType, onComplete) {
  const viewport = document.getElementById("stageViewport");
  const atkImg = document.getElementById(`fighter-img-${atkIdx}`);
  const defImg = document.getElementById(`fighter-img-${defIdx}`);

  const rectAtk = atkImg.getBoundingClientRect();
  const rectDef = defImg.getBoundingClientRect();
  const rectViewport = viewport.getBoundingClientRect();

  // Calcular centro de partida y de llegada en base al viewport
  const startX = rectAtk.left + rectAtk.width / 2 - rectViewport.left;
  const startY = rectAtk.top + rectAtk.height / 2 - rectViewport.top;
  const targetX = rectDef.left + rectDef.width / 2 - rectViewport.left;
  const targetY = rectDef.top + rectDef.height / 2 - rectViewport.top;

  const proj = document.createElement("div");
  proj.className = "fx-projectile";

  // Establecer colores de partícula según el tipo del ataque elemental
  let bg = "#ffffff",
    shadow = "0 0 15px #ffffff";
  if (["fire"].includes(moveType)) {
    bg = "#ff4500";
    shadow = "0 0 20px #ff0000, 0 0 40px #ff4500";
  } else if (["water", "ice"].includes(moveType)) {
    bg = "#00bfff";
    shadow = "0 0 20px #1e90ff, 0 0 40px #00bfff";
  } else if (["electric"].includes(moveType)) {
    bg = "#ffd700";
    shadow = "0 0 20px #ffff00, 0 0 40px #ffd700";
  } else if (["grass", "bug"].includes(moveType)) {
    bg = "#32cd32";
    shadow = "0 0 20px #00ff00, 0 0 40px #32cd32";
  } else if (["ghost", "dark", "poison", "psychic"].includes(moveType)) {
    bg = "#8a2be2";
    shadow = "0 0 20px #9400d3, 0 0 40px #8a2be2";
  }

  proj.style.background = bg;
  proj.style.boxShadow = shadow;
  proj.style.left = `${startX}px`;
  proj.style.top = `${startY}px`;

  viewport.appendChild(proj);

  // Animación del proyectil
  const animTime = 380 / playbackSpeed;
  proj.style.transition = `all ${animTime}ms cubic-bezier(0.25, 1, 0.5, 1)`;

  // Reflujo de render para activar la animación CSS
  proj.offsetHeight;

  proj.style.left = `${targetX}px`;
  proj.style.top = `${targetY}px`;
  proj.style.transform = "translate(-50%, -50%) scale(1.6)";

  setTimeout(() => {
    proj.remove();
    if (onComplete) onComplete();
  }, animTime);
}

// GENERAR POPUP DE DAÑO FLOTANTE
function generateDamagePopup(targetIdx, damage, isCrit, eff) {
  const container = document.getElementById(`fighter-wrapper-${targetIdx}`);
  const popup = document.createElement("div");
  popup.className = `damage-popup ${isCrit ? "crit" : ""}`;

  let content = `-${damage}`;
  if (isCrit) {
    content += `<span class="popup-sub" style="color:var(--gold)">¡CRÍTICO!</span>`;
  } else if (eff > 1.5) {
    content += `<span class="popup-sub" style="color:var(--green)">¡SÚPER EFICAZ!</span>`;
  } else if (eff < 0.6 && eff > 0) {
    content += `<span class="popup-sub" style="color:var(--muted)">POCO EFICAZ</span>`;
  } else if (eff === 0) {
    content = `<span style="font-size: 24px">INMUNE</span>`;
  }

  popup.innerHTML = content;
  container.appendChild(popup);

  // Remover tras concluir la animación CSS
  setTimeout(() => {
    popup.remove();
  }, 900);
}

// ACTUALIZAR LA BARRA DE VIDA DE FORMA DINÁMICA
function updateHpBar(idx, current, max) {
  const fill = document.getElementById(`hp-bar-${idx}`);
  const text = document.getElementById(`hp-txt-${idx}`);

  const percentage = Math.max(0, Math.min(100, (current / max) * 100));
  fill.style.width = `${percentage}%`;
  text.textContent = `${current} / ${max} PS`;

  // Cambiar colores dinámicos según el desgaste
  if (percentage >= 50) {
    fill.style.backgroundColor = "var(--green)";
  } else if (percentage >= 20) {
    fill.style.backgroundColor = "var(--gold)";
  } else {
    fill.style.backgroundColor = "var(--accent)";
  }
}

// INTERRUPTORES DE REPRODUCCIÓN (PAUSA, VELOCIDAD, SALTAR)
function togglePlayback() {
  const btn = document.getElementById("btn-pause");
  if (isPaused) {
    isPaused = false;
    btn.textContent = "Pausa";
    playNextBattleStep();
  } else {
    isPaused = true;
    btn.textContent = "Reanudar";
    clearTimeout(playbackTimeout);
  }
}

function toggleSpeed() {
  const btn = document.getElementById("btn-speed");
  if (playbackSpeed === 1) {
    playbackSpeed = 2;
    btn.textContent = "Velocidad 2x";
  } else if (playbackSpeed === 2) {
    playbackSpeed = 4;
    btn.textContent = "Velocidad 4x";
  } else {
    playbackSpeed = 1;
    btn.textContent = "Velocidad 1x";
  }
}

function skipCinematics() {
  clearTimeout(playbackTimeout);
  isPaused = false;
  completeBattleSimulation();
}

// FINALIZAR COMBATE Y MOSTRAR RESULTADOS
function completeBattleSimulation() {
  // Desaparecer estadio visual y devolver las vistas tradicionales opcionalmente
  document.getElementById("stageContainer").classList.remove("show");
  document.getElementById("arenaGrid").classList.remove("hidden");
  document.getElementById("battleSection").classList.remove("hidden");
  document.getElementById("battleBtn").disabled = false;

  // Renderizar la comparativa y análisis final detallado
  renderFinalBattleReport();
}

function renderFinalBattleReport() {
  const rw = document.getElementById("result-wrap");
  const ri = document.getElementById("result-inner");
  rw.style.display = "block";
  rw.className = "show";

  const p1 = chosen[0],
    p2 = chosen[1];
  const p1s = getStatsObject(p1),
    p2s = getStatsObject(p2);
  const t1 = Object.values(p1s).reduce((a, b) => a + b, 0);
  const t2 = Object.values(p2s).reduce((a, b) => a + b, 0);

  // Recolectar datos cinemáticos para dar formato a la bitácora tradicional
  // Determinamos ganador en base al último paso de faint/end
  const lastStep = battleSteps[battleSteps.length - 1];
  const winnerIdx =
    lastStep.winnerIdx !== undefined
      ? lastStep.winnerIdx
      : lastStep.type === "faint"
        ? lastStep.faintedIdx === 0
          ? 1
          : 0
        : 0;

  const wp = winnerIdx === 0 ? p1 : p2;
  const lp = winnerIdx === 0 ? p2 : p1;
  const ws = winnerIdx === 0 ? p1s : p2s;
  const ls = winnerIdx === 0 ? p2s : p1s;
  const wt = winnerIdx === 0 ? t1 : t2;
  const lt = winnerIdx === 0 ? t2 : t1;
  const wpTypes = wp.types.map((t) => t.type.name);
  const lpTypes = lp.types.map((t) => t.type.name);

  // Estimar análisis táctico
  let hasElementalAdvantage = false;
  wpTypes.forEach((wt) => {
    lpTypes.forEach((lt) => {
      if (getEffectiveness(wt, [lt]) > 1) hasElementalAdvantage = true;
    });
  });

  let razon = "";
  if (hasElementalAdvantage) {
    razon = `La ventaja elemental de tipo de ${wp.name.toUpperCase()} desarmó por completo la defensa del contrincante.`;
  } else if (ws.spe > ls.spe && ws.spe - ls.spe >= 20) {
    razon = `Su superioridad de velocidad le otorgó la iniciativa de cada turno, sentenciando el combate.`;
  } else {
    razon = `La consistencia física y el poder acumulado de sus estadísticas de combate fueron arrolladores.`;
  }

  const analisis = `La arena de batalla presenció un combate de alto nivel entre ${p1.name.toUpperCase()} y ${p2.name.toUpperCase()}. ${
    hasElementalAdvantage
      ? `La ventaja elemental y de tipo estratégica del ganador le confirió el control de los daños en todo momento.`
      : `El ritmo del combate estuvo dictaminado por sutiles diferencias tácticas en las estadísticas de combate individuales.`
  } Finalmente, la contundencia coronó a ${wp.name.toUpperCase()} como el gladiador supremo de la contienda tras el simulacro cinematográfico.`;

  // Construir comparativas gráficas
  const STATK = ["hp", "atk", "def", "spa", "spd", "spe"];
  const STATL = ["HP", "ATK", "DEF", "SpA", "SpD", "VEL"];
  const cmpRows = STATK.map((k, i) => {
    const v1 = winnerIdx === 0 ? p1s[k] : p2s[k],
      v2 = winnerIdx === 0 ? p2s[k] : p1s[k];
    const mx = Math.max(v1, v2, 1);
    const c1 = v1 >= v2 ? "#4ade80" : "#e63e3e",
      c2 = v2 >= v1 ? "#4ade80" : "#e63e3e";
    const p1pct = Math.round((v1 / mx) * 100),
      p2pct = Math.round((v2 / mx) * 100);
    return `<div class="cmp-row">
      <div class="cmp-left">
        <span style="font-size:10px;font-family:var(--font-m);color:${c1}">${v1}</span>
        <div class="strack" style="width:${p1pct}%;max-width:110px;min-width:4px"><div class="sfill" style="width:100%;background:${c1}"></div></div>
      </div>
      <div class="cmp-lbl">${STATL[i]}</div>
      <div class="cmp-right">
        <div class="strack" style="width:${p2pct}%;max-width:110px;min-width:4px"><div class="sfill" style="width:100%;background:${c2}"></div></div>
        <span style="font-size:10px;font-family:var(--font-m);color:${c2}">${v2}</span>
      </div>
    </div>`;
  }).join("");

  // Filtrar solo las acciones reales para mostrarlas en la bitácora
  const logHtml = battleSteps
    .filter((step) => step.type === "action" || step.type === "faint")
    .map(
      (step, i) =>
        `<div class="log-item"><span class="log-t">T${i + 1}</span><span>${step.text}</span></div>`,
    )
    .join("");

  const wart =
    wp.sprites.other?.["official-artwork"]?.front_default ||
    wp.sprites.front_default;

  ri.innerHTML = `<div class="result-card">
    <div class="result-top">
      <img class="win-art" src="${wart}" alt="${wp.name}">
      <div>
        <div class="win-eyebrow">🏆 Ganador de la batalla</div>
        <div class="win-name">${wp.name}</div>
        <div class="win-reason">${razon}</div>
      </div>
      <div class="bst-box">
        <div class="bst-lbl">BST</div>
        <div class="bst-num">${wt}</div>
        <div class="bst-vs">vs ${lt}</div>
      </div>
    </div>
    <div class="result-body">
      <p class="analysis">${analisis}</p>
      <div class="section-lbl">Registro de batalla</div>
      <div class="log-list">${logHtml}</div>
      <div class="cmp-wrap">
        <div class="section-lbl" style="color:var(--blue);margin-bottom:.8rem">Comparativa · <span style="color:var(--muted)">${wp.name}</span> vs <span style="color:var(--muted)">${lp.name}</span></div>
        ${cmpRows}
      </div>
    </div>
  </div>`;

  rw.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") closeModal();
});
init();
