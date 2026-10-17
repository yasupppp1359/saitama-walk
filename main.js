// ========================================
// main.js - ゲームロジック（前半）
// ========================================

window.onerror = (msg, url, line) => {
  const p = document.createElement("div");
  p.className = "warn";
  p.textContent = "⚠ " + msg + " (line " + line + ")";
  document.getElementById("log").appendChild(p);
};

function ky(n) {
  const abs = Math.abs(n);
  const sign = n < 0 ? "-" : "";
  if (abs >= 100000000) {
    const oku = abs / 100000000;
    const str = oku >= 10 ? oku.toFixed(1) : oku.toFixed(2);
    return sign + str.replace(/\.?0+$/, "") + "億きゅん";
  }
  if (abs >= 10000) {
    const man = Math.floor(abs / 10000);
    return sign + man.toLocaleString() + "万きゅん";
  }
  return sign + abs.toLocaleString() + "きゅん";
}

function getPlayerTotalAssets(p) {
  let propValue = 0;
  for (const prop of ALL_PROPS) {
    if (prop.owner === p.id) propValue += prop.price;
  }
  return p.money + propValue;
}

const CELL_BY_ID_PRE = {};

const LABEL_POS = {
  fukaya: "right",
  nagatoro: "right",
  okabe: "right",
  hanno: "right",
  konosu: "right",
  iruma: "right",
  kazo: "right",
  koshigaya: "right",
  urawa: "right",
  tobu_zoo: "right",
  ageo: "right",
  kurihashi: "topleft",
  soka: "top",
  nishikawaguchi: "top",
  warabi: "left",
  moroyama: "left",
  minamisakurai: "left",
};

function buildMap() {
  const cells = [];
  const cellMap = new Map();
  let nextId = 0;
  const stationIdMap = {};
  const add = (c) => { cells.push(c); cellMap.set(c.id, c); return c; };

  for (const st of STATIONS) {
    add({ id:nextId, type:CELL.STATION, name:st.name,
          stationKey: st.id,
          region:st.region, kind:st.kind, x:st.x, y:st.y, next:[] });
    stationIdMap[st.id] = nextId;
    nextId++;
  }

  const stMap = Object.fromEntries(STATIONS.map(s => [s.id, s]));
  const midCells = [];
  for (const [aId, bId] of EDGES) {
    const A = stMap[aId], B = stMap[bId];
    if (!A || !B) continue;
    const dist = Math.hypot(A.x - B.x, A.y - B.y);
    const n = dist < 400 ? 3 : dist < 600 ? 4 : dist < 800 ? 5 : dist < 1000 ? 6 : 7;
    let prevId = stationIdMap[aId];
    for (let i = 1; i <= n; i++) {
      const t = i / (n + 1);
      const x = A.x + (B.x - A.x) * t;
      const y = A.y + (B.y - A.y) * t;
      const r = Math.random();
      let type;
      if (r < 0.06) type = CELL.EVENT;
      else if (r < 0.52) type = CELL.PLUS;
      else if (r < 0.86) type = CELL.MINUS;
      else type = CELL.CARD;
      const newId = nextId++;
      add({ id:newId, type, x, y, next:[] });
      midCells.push(newId);
      cellMap.get(prevId).next.push(newId);
      prevId = newId;
    }
    cellMap.get(prevId).next.push(stationIdMap[bId]);
  }

  const shuffled = [...midCells].sort(() => Math.random() - 0.5);
  for (let i = 0; i < 4 && i < shuffled.length; i++) {
    CELL_BY_ID_PRE[shuffled[i]] = CELL.HELI;
  }
  for (let i = 4; i < 7 && i < shuffled.length; i++) {
    CELL_BY_ID_PRE[shuffled[i]] = CELL.NICE;
  }
  for (let i = 7; i < 10 && i < shuffled.length; i++) {
    CELL_BY_ID_PRE[shuffled[i]] = CELL.SHOP;
  }

  return { cells, stationIdMap };
}

function buildMapWrapper() {
  const result = buildMap();
  for (const c of result.cells) {
    if (CELL_BY_ID_PRE[c.id]) c.type = CELL_BY_ID_PRE[c.id];
  }
  return result;
}

const built = buildMapWrapper();
const MAP = built.cells;
const stationIdMap = built.stationIdMap;

const CELL_BY_ID = {};
for (const c of MAP) CELL_BY_ID[c.id] = c;

const PARENTS = {};
for (const c of MAP) PARENTS[c.id] = [];
for (const c of MAP) for (const n of c.next) PARENTS[n].push(c.id);

generateProperties(stationIdMap);

const START_POS = stationIdMap["omiya"];
const START_MONEY = 15000000;

function newBuffs() {
  return {
    renchanKakekko: false, renchanDash: false,
    suttobiMakuri: false, yellow: false,
    crayon: 0, ohime: false, osusowake: 0, happy: false,
    nonbiri: 0, sekubi: 0,
  };
}

let players = [];
let player = null;

let GOAL_ID = stationIdMap["fukaya"];
CELL_BY_ID[GOAL_ID].isGoal = true;

let day = 1;
let month = 1;
let maxMonth = 12;
let remainingSteps = 0;
let isMoving = false;
let isFullMap = false;
let thisTurn = { diceCount: 1 };
let canRoll = true;
let canUseCard = true;
let turnInProgress = false;
let turnPath = [];
let currentPlayerIndex = 0;
let pendingSettlement = false;
let pendingSettlementCallback = null;
let pendingNextTurn = false;
let hasRolledThisTurn = false;
let isShowingGoalPopup = false;
let isShowingEffectPopup = false;
const poos = new Set();

let collectingEffects = false;
let collectedEffects = [];

let userZoom = 0.6;
let panOffsetX = 0;
let panOffsetY = 0;
let isPanning = false;
let panStartX = 0;
let panStartY = 0;
let panStartOffsetX = 0;
let panStartOffsetY = 0;
let panHintTimer = null;
let hasShownPanHint = false;

const boardOuter = document.getElementById("board");
const boardEl = document.getElementById("boardInner");
const svgEl = document.getElementById("lines");
const logEl = document.getElementById("log");
const controlsEl = document.getElementById("controls");
const mapToggleBtn = document.getElementById("mapToggleBtn");
const handPanel = document.getElementById("handPanel");
const handList = document.getElementById("handList");
const handCount = document.getElementById("handCount");
const propDialog = document.getElementById("propDialog");
const propList = document.getElementById("propList");
const propStationName = document.getElementById("propStationName");
const rollBtn = document.getElementById("rollBtn");
const cardBtn = document.getElementById("cardBtn");
const debugBtn = document.getElementById("debugBtn");
const debtDialog = document.getElementById("debtDialog");
const settleDialog = document.getElementById("settleDialog");
const rankDialog = document.getElementById("rankDialog");
const endDialog = document.getElementById("endDialog");
const goalDialog = document.getElementById("goalDialog");
const goalReachBtn = document.getElementById("goalReachBtn");
const goalBannerName = document.getElementById("goalBannerName");
const panHint = document.getElementById("panHint");

function log(msg) {
  const p = document.createElement("div");
  p.textContent = msg;
  logEl.appendChild(p);
  while (logEl.children.length > 15) {
    logEl.removeChild(logEl.firstChild);
  }
  logEl.scrollTop = logEl.scrollHeight;
  if (collectingEffects) {
    collectedEffects.push(msg);
  }
}

function showEffectPopup(callback) {
  if (collectedEffects.length === 0) {
    if (callback) callback();
    return;
  }

  let dialog = document.getElementById("effectDialog");
  if (!dialog) {
    dialog = document.createElement("div");
    dialog.id = "effectDialog";
    dialog.innerHTML = `
      <div class="effect-panel">
        <div class="effect-list" id="effectList"></div>
        <button class="effect-ok-btn" id="effectOkBtn">OK</button>
      </div>
    `;
    dialog.style.cssText = "position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);z-index:450;pointer-events:none;display:none;justify-content:center;align-items:center;";
    const panel = dialog.querySelector(".effect-panel");
    panel.style.cssText = "background:rgba(255,255,255,.98);border-radius:18px;padding:20px 24px;min-width:240px;max-width:90vw;text-align:center;box-shadow:0 12px 40px rgba(0,0,0,.35);border:3px solid #5a6a7a;pointer-events:auto;";
    const listEl = dialog.querySelector(".effect-list");
    listEl.style.cssText = "display:flex;flex-direction:column;gap:8px;margin-bottom:16px;";
    const okEl = dialog.querySelector(".effect-ok-btn");
    okEl.style.cssText = "padding:12px 32px;background:linear-gradient(135deg,#5cb85c,#3c903c);color:#fff;font-size:16px;font-weight:bold;border-radius:10px;border:none;cursor:pointer;min-height:48px;min-width:120px;";
    document.body.appendChild(dialog);
  }

  dialog.classList.remove("hidden");
  dialog.style.display = "flex";

  const listEl = document.getElementById("effectList");
  const okEl = document.getElementById("effectOkBtn");

  listEl.innerHTML = "";
  for (const msg of collectedEffects) {
    const item = document.createElement("div");
    item.style.cssText = "font-size:16px;font-weight:bold;color:#333;padding:6px 10px;background:#f0f4ff;border-radius:10px;";
    item.textContent = msg;
    listEl.appendChild(item);
  }

  isShowingEffectPopup = true;

  let closed = false;
  const close = () => {
    if (closed) return;
    closed = true;
    dialog.style.display = "none";
    dialog.classList.add("hidden");
    isShowingEffectPopup = false;
    if (callback) callback();
  };

  if (player && player.isCPU) {
    okEl.style.display = "none";
    setTimeout(close, 800);
  } else {
    okEl.style.display = "";
    okEl.onclick = close;
  }
}

function autoSave() {
  if (!players || players.length === 0) return;
  try {
    const data = {
      version: 2,
      players: players.map(p => ({
        id: p.id, name: p.name, icon: p.icon,
        money: p.money, pos: p.pos,
        cards: [...p.cards], buffs: { ...p.buffs },
        isCPU: p.isCPU, cpuLevel: p.cpuLevel
      })),
      currentPlayerIndex,
      day, month, GOAL_ID, maxMonth,
      poos: [...poos],
      props: ALL_PROPS.map(p => ({ id:p.id, owner:p.owner, price:p.price })),
      globalSeal: (typeof globalSeal !== "undefined" ? globalSeal : 0),
    };
    localStorage.setItem("saitama_auto", JSON.stringify(data));
  } catch (e) {
    console.warn("Autosave failed:", e);
  }
}

function loadAutoSave() {
  const raw = localStorage.getItem("saitama_auto");
  if (!raw) return false;
  try {
    const data = JSON.parse(raw);
    if (!data.version || data.version < 2) {
      localStorage.removeItem("saitama_auto");
      return false;
    }
    if (!data.players || data.players.length === 0) return false;
    players = data.players;
    currentPlayerIndex = data.currentPlayerIndex || 0;
    player = players[currentPlayerIndex];
    day = data.day || 1;
    month = data.month || 1;
    maxMonth = data.maxMonth || 12;
    if (data.poos) { poos.clear(); data.poos.forEach(id => poos.add(id)); }
    if (data.props) {
      for (const saved of data.props) {
        const p = ALL_PROPS.find(x => x.id === saved.id);
        if (p) {
          p.owner = saved.owner;
          if (saved.price) p.price = saved.price;
        }
      }
    }
    if (typeof globalSeal !== "undefined") globalSeal = data.globalSeal || 0;
    for (const c of MAP) c.isGoal = false;
    GOAL_ID = data.GOAL_ID;
    if (!CELL_BY_ID[GOAL_ID]) {
      GOAL_ID = stationIdMap["fukaya"];
    }
    CELL_BY_ID[GOAL_ID].isGoal = true;
    return true;
  } catch (e) {
    console.warn("Auto-load failed:", e);
    return false;
  }
}

function updateGoalBanner() {
  if (!goalBannerName) return;
  let goalCell = CELL_BY_ID[GOAL_ID];
  if (!goalCell || !goalCell.name) {
    const anyGoal = MAP.find(c => c.kind === "goal");
    if (anyGoal) {
      GOAL_ID = anyGoal.id;
      anyGoal.isGoal = true;
      goalCell = anyGoal;
    }
  }
  goalBannerName.textContent = (goalCell && goalCell.name) ? goalCell.name : "?";
}

function drawBoard() {
  boardEl.querySelectorAll(".cell, .player").forEach(e => e.remove());
  svgEl.innerHTML = "";
  for (const c of MAP) {
    for (const n of c.next) {
      const nc = CELL_BY_ID[n];
      const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
      line.setAttribute("x1", c.x); line.setAttribute("y1", c.y);
      line.setAttribute("x2", nc.x); line.setAttribute("y2", nc.y);
      line.setAttribute("stroke", "#cfd8e0");
      line.setAttribute("stroke-width", "4");
      line.setAttribute("stroke-linecap", "round");
      svgEl.appendChild(line);
    }
  }
  for (const c of MAP) {
    const el = document.createElement("div");
    el.className = "cell " + c.type;
    if (c.region) el.classList.add("region-" + c.region);
    if (c.id === GOAL_ID) el.classList.add("goal-station");
    if (c.kind === "prop") el.classList.add("prop-station");
    if (c.kind === "goal" || c.kind === "prop") {
      const props = getPropsAtStation(c.id);
      if (props.length > 0) {
        const owner = props[0].owner;
        if (owner !== null && props.every(p => p.owner === owner)) {
          el.classList.add("monopoly-" + owner);
        }
      }
    }
    el.style.left = c.x + "px";
    el.style.top = c.y + "px";
    el.dataset.cellId = c.id;
    if (c.id === GOAL_ID) el.textContent = "🚩";
    else if (c.kind === "prop") el.textContent = "🏘";
    else if (c.type === CELL.STATION) el.textContent = "🏠";
    else if (c.type === CELL.EVENT) el.textContent = "✨";
    else if (c.type === CELL.HELI) el.textContent = "🚁";
    else if (c.type === CELL.NICE) el.textContent = "⭐";
    else if (c.type === CELL.SHOP) el.textContent = "🎴";
    boardEl.appendChild(el);
    if (c.name) {
      const label = document.createElement("div");
      label.className = "station-label";
      if (c.stationKey && LABEL_POS[c.stationKey]) {
        label.classList.add("label-" + LABEL_POS[c.stationKey]);
      }
      label.textContent = c.name;
      el.appendChild(label);
    }
  }
  drawAllPlayers();
  updateGoalBanner();
  applyCamera();
  redrawYellowed();
}

function redrawYellowed() {
  document.querySelectorAll(".cell").forEach(el => el.classList.remove("yellowed"));
  if (player && player.buffs.yellow) {
    for (const c of MAP) {
      if (c.type === CELL.PLUS || c.type === CELL.MINUS) {
        const el = document.querySelector('[data-cell-id="' + c.id + '"]');
        if (el) el.classList.add("yellowed");
      }
    }
  }
  if (poos.size > 0) {
    for (const id of poos) {
      const el = document.querySelector('[data-cell-id="' + id + '"]');
      if (el) el.textContent = "💩";
    }
  }
}

function drawAllPlayers() {
  document.querySelectorAll(".player").forEach(e => e.remove());
  for (const p of players) {
    const el = document.createElement("div");
    el.className = "player p" + p.id;
    if (p === player) el.classList.add("active");
    el.textContent = p.icon;
    el.dataset.playerId = p.id;
    const cell = CELL_BY_ID[p.pos];
    if (!cell) continue;
    el.style.left = cell.x + "px";
    el.style.top  = cell.y + "px";
    el.style.zIndex = 50 + p.id;
    boardEl.appendChild(el);
  }
  updateHUD();
}

function drawPlayer() { drawAllPlayers(); }

function applyCamera() {
  if (!player) return;
  const cell = CELL_BY_ID[player.pos];
  if (!cell) return;
  if (isFullMap) {
    const scale = Math.min(boardOuter.clientWidth / BOARD_W, boardOuter.clientHeight / BOARD_H);
    const sw = BOARD_W * scale, sh = BOARD_H * scale;
    const ox = (boardOuter.clientWidth - sw) / 2;
    const oy = (boardOuter.clientHeight - sh) / 2;
    boardEl.style.transform = `translate(${ox}px, ${oy}px) scale(${scale})`;
  } else {
    const zoom = userZoom;
    const cx = boardOuter.clientWidth / 2;
    const cy = boardOuter.clientHeight / 2;
    const ox = cx - cell.x * zoom + panOffsetX;
    const oy = cy - cell.y * zoom + panOffsetY;
    boardEl.style.transform = `translate(${ox}px, ${oy}px) scale(${zoom})`;
  }
}

function setupPan() {
  const target = boardOuter;
  let pinchStartDist = 0;
  let pinchStartZoom = 1;

  target.addEventListener("mousedown", (e) => {
    if (isFullMap) return;
    if (e.target.closest(".cell") && e.target.classList.contains("highlight")) return;
    startPan(e.clientX, e.clientY);
  });
  window.addEventListener("mousemove", (e) => {
    if (!isPanning) return;
    movePan(e.clientX, e.clientY);
  });
  window.addEventListener("mouseup", () => {
    if (!isPanning) return;
    endPan();
  });

  target.addEventListener("wheel", (e) => {
    if (isFullMap) return;
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    userZoom = Math.max(0.2, Math.min(3.0, userZoom * delta));
    applyCamera();
  }, { passive: false });

  target.addEventListener("touchstart", (e) => {
    if (isFullMap) return;
    if (e.touches.length === 2) {
      const t1 = e.touches[0];
      const t2 = e.touches[1];
      pinchStartDist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
      pinchStartZoom = userZoom;
      isPanning = false;
      return;
    }
    if (e.touches.length !== 1) return;
    const t = e.touches[0];
    if (e.target.closest(".cell") && e.target.classList.contains("highlight")) return;
    startPan(t.clientX, t.clientY);
  }, { passive: true });

  target.addEventListener("touchmove", (e) => {
    if (e.touches.length === 2) {
      const t1 = e.touches[0];
      const t2 = e.touches[1];
      const dist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
      if (pinchStartDist > 0) {
        userZoom = Math.max(0.2, Math.min(3.0, pinchStartZoom * (dist / pinchStartDist)));
        applyCamera();
      }
      return;
    }
    if (!isPanning) return;
    if (e.touches.length !== 1) return;
    const t = e.touches[0];
    movePan(t.clientX, t.clientY);
  }, { passive: true });

  target.addEventListener("touchend", (e) => {
    if (e.touches && e.touches.length === 0) {
      pinchStartDist = 0;
    }
    if (!isPanning) return;
    endPan();
  });

  target.addEventListener("touchcancel", () => {
    if (!isPanning) return;
    endPan();
  });
}

function startPan(x, y) {
  isPanning = true;
  panStartX = x;
  panStartY = y;
  panStartOffsetX = panOffsetX;
  panStartOffsetY = panOffsetY;
  boardEl.style.transition = "none";
  if (!hasShownPanHint) {
    showPanHint();
  }
}

function movePan(x, y) {
  if (!isPanning) return;
  const dx = x - panStartX;
  const dy = y - panStartY;
  panOffsetX = Math.max(-400, Math.min(400, panStartOffsetX + dx));
  panOffsetY = Math.max(-400, Math.min(400, panStartOffsetY + dy));
  applyCamera();
}

function endPan() {
  isPanning = false;
  boardEl.style.transition = "transform .4s ease-out";
  panOffsetX = 0;
  panOffsetY = 0;
  setTimeout(() => {
    applyCamera();
  }, 20);
  setTimeout(() => {
    boardEl.style.transition = "transform .35s ease-out";
  }, 450);
}

function showPanHint() {
  hasShownPanHint = true;
  if (!panHint) return;
  panHint.classList.add("show");
  if (panHintTimer) clearTimeout(panHintTimer);
  panHintTimer = setTimeout(() => {
    panHint.classList.remove("show");
  }, 2500);
}

window.addEventListener("resize", applyCamera);

function toggleFullMap() {
  isFullMap = !isFullMap;
  panOffsetX = 0;
  panOffsetY = 0;
  mapToggleBtn.textContent = isFullMap ? "🔍 拡大表示" : "🗺 全体マップ";
  boardEl.style.transition = "transform .35s ease-out";
  applyCamera();
  setTimeout(() => { boardEl.style.transition = "transform .35s ease-out"; }, 360);
}

function updateHUD() {
  if (!player) return;
  document.getElementById("day").textContent = day + "日目";
  document.getElementById("month").textContent = month + "ヶ月目";
  document.getElementById("curIcon").textContent = player.icon;
  document.getElementById("curName").textContent = player.name;

  const moneyEl = document.getElementById("money");
  moneyEl.textContent = ky(player.money);
  if (player.money < 0) {
    moneyEl.classList.add("debt");
  } else {
    moneyEl.classList.remove("debt");
  }

  let remainText = "";
  if (isMoving) {
    remainText = "残り " + remainingSteps + " マス";
  } else {
    const dist = shortestDistance(player.pos, GOAL_ID);
    remainText = "ゴールまで " + (dist === Infinity ? "--" : dist) + " マス";
  }

  const states = [];
  if (typeof globalSeal !== "undefined" && globalSeal > 0) states.push("🔒封印" + globalSeal);
  if (player.buffs.nonbiri > 0) states.push("🐌のんびり" + player.buffs.nonbiri);
  if (player.buffs.sekubi > 0) states.push("😴休み" + player.buffs.sekubi);
  if (states.length > 0) {
    remainText += " [" + states.join(" ") + "]";
  }
  document.getElementById("remain").textContent = remainText;

  const isHuman = !player.isCPU;
  rollBtn.disabled = !isHuman || !canRoll || isMoving;
  cardBtn.disabled = !isHuman || !canUseCard || isMoving;

  if (isHuman && isMoving && remainingSteps > 0) {
    goalReachBtn.classList.add("show");
  } else {
    goalReachBtn.classList.remove("show");
  }
}

function shortestDistance(from, goal) {
  const q = [[from, 0]];
  const seen = new Set([from]);
  while (q.length) {
    const [id, d] = q.shift();
    if (id === goal) return d;
    const cell = CELL_BY_ID[id];
    if (cell && cell.next) {
      for (const n of cell.next) {
        if (poos.has(n) || seen.has(n)) continue;
        seen.add(n); q.push([n, d + 1]);
      }
    }
    if (PARENTS[id]) {
      for (const p of PARENTS[id]) {
        if (poos.has(p) || seen.has(p)) continue;
        seen.add(p); q.push([p, d + 1]);
      }
    }
  }
  return Infinity;
}

function rollDice() {
  if (hasRolledThisTurn) return;
  if (!player || player.isCPU) return;
  if (isMoving || !canRoll) return;
  playSound("dice");
  canUseCard = false;
  canRoll = false;
  turnInProgress = true;
  hasRolledThisTurn = true;

  let count = thisTurn.diceCount;
  if (player.buffs.nonbiri > 0) {
    count = 1;
    log("🐌 のんびり中：サイコロ1個のみ");
  }

  let total = 0;
  const rolls = [];
  for (let i = 0; i < count; i++) {
    const r = Math.floor(Math.random() * 6) + 1;
    rolls.push(r); total += r;
  }
  log("🎲 " + (count > 1 ? rolls.join("+") + "=" : "") + total + " マス");
  remainingSteps = total;
  isMoving = true;
  turnPath = [player.pos];
  updateHUD();
  showMoveTargets();
}

function findReachable(fromId, maxSteps) {
  const reachable = new Map();
  reachable.set(fromId, { dist:0, parent:null });
  const q = [fromId];
  while (q.length) {
    const cur = q.shift();
    const info = reachable.get(cur);
    if (info.dist >= maxSteps) continue;
    for (const nxt of CELL_BY_ID[cur].next) {
      if (poos.has(nxt)) continue;
      if (!reachable.has(nxt)) {
        reachable.set(nxt, { dist:info.dist+1, parent:cur });
        q.push(nxt);
      }
    }
    for (const p of PARENTS[cur]) {
      if (poos.has(p)) continue;
      if (!reachable.has(p)) {
        reachable.set(p, { dist:info.dist+1, parent:cur });
        q.push(p);
      }
    }
  }
  return reachable;
}

function showMoveTargets() {
  clearHighlights();
  const reachable = findReachable(player.pos, remainingSteps);

  if (player.isCPU) {
    setTimeout(() => {
      try {
        const candidates = [];
        let maxDist = 0;
        for (const [id, info] of reachable) {
          if (id === player.pos) continue;
          if (info.dist > maxDist) maxDist = info.dist;
          candidates.push({ id, dist: info.dist });
        }
        if (candidates.length === 0) { endMove(); return; }

        const farOnes = candidates.filter(c => c.dist === maxDist);
        for (const c of farOnes) {
          c.goalDist = shortestDistance(c.id, GOAL_ID);
        }

        const level = player.cpuLevel;
        let target;
        if ((level === 1 && Math.random() < 0.5) ||
            (level === 2 && Math.random() < 0.2)) {
          target = farOnes[Math.floor(Math.random() * farOnes.length)].id;
        } else {
          farOnes.sort((a, b) => a.goalDist - b.goalDist);
          target = farOnes[0].id;
        }
        autoWalkTo(target, reachable);
      } catch (e) {
        log("⚠ CPU移動エラー: " + e.message);
        endMove();
      }
    }, 300);
    return;
  }

  let hasOther = false;
  for (const [id, info] of reachable) {
    if (id === player.pos) continue;
    const el = document.querySelector('[data-cell-id="' + id + '"]');
    if (!el) continue;
    hasOther = true;
    el.classList.add("highlight");
    el.dataset.dist = info.dist;
    el.onclick = (e) => {
      e.stopPropagation();
      autoWalkTo(id, reachable);
    };
  }
  if (!hasOther) {
    log("🚧 動けるマスがありません。ターン終了");
    endMove();
  }
}

function continueAfterMove() {
  if (isShowingGoalPopup) return;
  if (isShowingEffectPopup) return;
  if (remainingSteps <= 0) {
    endMove();
    return;
  }
  updateHUD();
  showMoveTargets();
}

function autoWalkTo(targetId, reachable) {
  clearHighlights();
  const path = [];
  let cur = targetId;
  while (cur !== player.pos) {
    path.unshift(cur);
    cur = reachable.get(cur).parent;
  }
  if (path.length === 0) return;

  let lastWasBacktrack = false;
  for (const cellId of path) {
    const prevInPath = turnPath.length >= 2 ? turnPath[turnPath.length - 2] : null;
    const isBacktrack = (cellId === prevInPath);
    player.pos = cellId;
    if (isBacktrack) {
      turnPath.pop();
      remainingSteps++;
    } else {
      turnPath.push(cellId);
      remainingSteps--;
    }
    lastWasBacktrack = isBacktrack;
    playSound("move");
    drawAllPlayers();
    applyCamera();
  }

  if (remainingSteps <= 0) {
    if (!lastWasBacktrack && path.length > 0) {
      const popupShown = applyCellEffect(player.pos);
      if (popupShown) return;
    }
    endMove();
    return;
  }

  updateHUD();
  showMoveTargets();
}

function clearHighlights() {
  document.querySelectorAll(".highlight").forEach(el => {
    el.classList.remove("highlight");
    el.onclick = null;
    delete el.dataset.dist;
  });
}
