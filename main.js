// ========================================
// main.js - ゲームロジック（完全版）
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
    const n = dist < 300 ? 3 : dist < 450 ? 4 : dist < 600 ? 5 : dist < 750 ? 6 : 7;
    let prevId = stationIdMap[aId];
    for (let i = 1; i <= n; i++) {
      const t = i / (n + 1);
      const x = A.x + (B.x - A.x) * t;
      const y = A.y + (B.y - A.y) * t;
      const r = Math.random();
      let type;
      if (r < 0.04) type = CELL.EVENT;
      else if (r < 0.50) type = CELL.PLUS;
      else if (r < 0.85) type = CELL.MINUS;
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
const poos = new Set();

let userZoom = 0.9;
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
      console.log("古いセーブデータのため無効化");
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
    userZoom = Math.max(0.3, Math.min(3.0, userZoom * delta));
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
        userZoom = Math.max(0.3, Math.min(3.0, pinchStartZoom * (dist / pinchStartDist)));
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

  if (!lastWasBacktrack && path.length > 0) {
    applyCellEffect(player.pos);
  }

  if (isShowingGoalPopup) return;

  if (remainingSteps <= 0) {
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

function applyCellEffect(cellId) {
  const c = CELL_BY_ID[cellId];
  if (!c) return;

  if (c.type === CELL.EVENT) {
    playSound("event");
    triggerRandomEvent();
    updateHUD();
    return;
  }

  if (c.type === CELL.HELI) {
    playSound("warp");
    const helis = MAP.filter(x => x.type === CELL.HELI && x.id !== cellId);
    if (helis.length > 0) {
      const target = helis[Math.floor(Math.random() * helis.length)];
      player.pos = target.id;
      drawAllPlayers();
      applyCamera();
      log("🚁 " + player.name + " がヘリポートで移動！");
    } else {
      log("🚁 ヘリポート（他に行き先なし）");
    }
    updateHUD();
    return;
  }

  if (c.type === CELL.NICE) {
    playSound("card");
    const nicePool = ["kakekko","dash","spacia","shirakobato","step10","step8","step6","renchanDash","unWo"];
    if (player.cards.length < 10) {
      const cid = nicePool[Math.floor(Math.random() * nicePool.length)];
      player.cards.push(cid);
      log("⭐ " + player.name + " がナイスカード " + CARDS[cid].name + " を入手！");
    } else {
      log("⭐ 手札一杯でナイスカード入手できず");
    }
    updateHUD();
    return;
  }

  if (c.type === CELL.SHOP) {
    playSound("coin");
    const price = 5000000;
    if (player.money >= price && player.cards.length < 10) {
      player.money -= price;
      const ids = Object.keys(CARDS);
      const cid = ids[Math.floor(Math.random() * ids.length)];
      player.cards.push(cid);
      log("🎴 " + player.name + " がカード売り場で " + CARDS[cid].name + " を購入 (-" + ky(price) + ")");
    } else if (player.money < price) {
      log("🎴 カード売り場（資金不足: " + ky(price) + " 必要）");
    } else {
      log("🎴 カード売り場（手札一杯）");
    }
    updateHUD();
    return;
  }

  const isYellowed = player.buffs.yellow && (c.type === CELL.PLUS || c.type === CELL.MINUS);

  if (isYellowed || c.type === CELL.CARD) {
    giveRandomCard();
  } else if (c.type === CELL.PLUS) {
    playSound("coin");
    const mult = getInflationMultiplier();
    const base = (Math.floor(Math.random() * 8) + 1) * 1000000;
    const a = Math.floor(base * mult);
    player.money += a;
    log("🟦 " + player.name + " +" + ky(a));

    for (const p of players) {
      if (p === player) continue;
      if (p.buffs.osusowake > 0) {
        p.money += a;
        log("🤲 " + p.name + " おすそ分け +" + ky(a));
      }
    }
  } else if (c.type === CELL.MINUS) {
    playSound("buzzer");
    const mult = getInflationMultiplier();
    const base = (Math.floor(Math.random() * 8) + 1) * 500000;
    const a = Math.floor(base * mult);
    player.money -= a;
    log("🟥 " + player.name + " −" + ky(a));
  } else if (c.id === GOAL_ID) {
    playSound("goal");
    const arrivedPlayerName = player.name;
    const arrivedGoalName = c.name;
    const arrivedCellId = cellId;
    log("🚩 " + arrivedPlayerName + " が " + arrivedGoalName + " に到着！");
    const basePrize = 50000000 * month;
    let prize = basePrize;
    let happyBonus = false;
    if (player.buffs.happy) {
      prize *= 2;
      player.buffs.happy = false;
      happyBonus = true;
      log("😊 ハッピー発動！ 賞金2倍");
    }
    player.money += prize;
    log("🏆 " + arrivedPlayerName + " 賞金 +" + ky(prize));

    for (const p of players) {
      if (p === player) continue;
      if (p.buffs.ohime) {
        p.buffs.ohime = false;
        p.money += prize;
        log("👑 " + p.name + " お姫様 +" + ky(prize));
      }
    }

    const goals = MAP.filter(x => x.kind === "goal" && x.id !== GOAL_ID);
    let nextGoalName = "";
    if (goals.length > 0) {
      CELL_BY_ID[GOAL_ID].isGoal = false;
      const newGoal = goals[Math.floor(Math.random() * goals.length)];
      newGoal.isGoal = true;
      GOAL_ID = newGoal.id;
      nextGoalName = newGoal.name;
      log("🎯 次のゴール：" + nextGoalName);
      updateGoalBanner();
      drawBoard();
    }

    isShowingGoalPopup = true;
    showGoalArrivalPopup(arrivedPlayerName, arrivedGoalName, prize, happyBonus, nextGoalName, arrivedCellId);
  } else if (c.kind === "goal" || c.kind === "prop") {
    if (player.isCPU) {
      cpuBuyProperty(cellId);
    } else {
      const props = getPropsAtStation(cellId);
      if (props.length > 0) {
        openPropDialog(cellId);
      } else {
        log("🏘 " + (c.name || "この駅") + " には物件がありません");
      }
    }
  }
  updateHUD();
}

function showGoalArrivalPopup(arrivedPlayer, goalName, prize, happyBonus, nextGoal, goalCellId) {
  let dialog = document.getElementById("goalArrivalDialog");

  if (!dialog) {
    dialog = document.createElement("div");
    dialog.id = "goalArrivalDialog";
    dialog.innerHTML = `
      <div class="goalArrivalPanel">
        <h2>🎉 目的地に到着！ 🎉</h2>
        <p class="arrivalMsg"><span class="arrivalName" id="arrivalName">-</span> が</p>
        <p class="arrivalMsg"><span class="arrivalName" id="arrivalGoal">-</span> に到着！</p>
        <p class="arrivalPrize" id="arrivalPrize">-</p>
        <p class="arrivalNext" id="arrivalNext">-</p>
        <button class="arrivalOkBtn" id="goalArrivalOkBtn">OK</button>
      </div>
    `;
    dialog.style.cssText = "position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:400;display:flex;justify-content:center;align-items:center;padding:16px;";
    const panel = dialog.querySelector(".goalArrivalPanel");
    panel.style.cssText = "background:linear-gradient(135deg,#fff0ff,#ffe0f5);border-radius:20px;padding:24px;width:min(420px,100%);text-align:center;box-shadow:0 12px 40px rgba(200,0,150,.5);border:3px solid #f080f0;";
    document.body.appendChild(dialog);
  }

  const nameEl = document.getElementById("arrivalName");
  const goalEl = document.getElementById("arrivalGoal");
  const prizeEl = document.getElementById("arrivalPrize");
  const nextEl = document.getElementById("arrivalNext");

  if (nameEl) nameEl.textContent = arrivedPlayer;
  if (goalEl) goalEl.textContent = goalName;
  if (prizeEl) prizeEl.textContent = "🏆 賞金 +" + ky(prize) + (happyBonus ? "（ハッピー2倍！）" : "");
  if (nextEl) nextEl.innerHTML = nextGoal
    ? '🎯 次の目的地：<strong>' + nextGoal + '</strong>'
    : '🎮 ゲーム終了！';

  dialog.classList.remove("hidden");

  const okBtn = document.getElementById("goalArrivalOkBtn");
  if (okBtn) {
    okBtn.onclick = () => {
      dialog.classList.add("hidden");
      try { playSound("pop"); } catch (e) {}

      isShowingGoalPopup = false;

      setTimeout(() => {
        try {
          if (goalCellId && player && !player.isCPU) {
            const props = getPropsAtStation(goalCellId);
            if (props && props.length > 0) {
              openPropDialog(goalCellId);
              return;
            }
          }
        } catch (e) {
          console.warn("Property dialog error:", e);
        }

        if (remainingSteps > 0 && turnInProgress && isMoving) {
          updateHUD();
          showMoveTargets();
          return;
        }

        if (pendingNextTurn) {
          pendingNextTurn = false;
          checkPendingDialogsOrProceed();
        } else {
          endMove();
        }
      }, 120);
    };
  }
}

function checkPendingDialogsOrProceed() {
  const propDlg = document.getElementById("propDialog");
  const arrivalDlg = document.getElementById("goalArrivalDialog");

  if ((propDlg && !propDlg.classList.contains("hidden")) ||
      (arrivalDlg && !arrivalDlg.classList.contains("hidden"))) {
    pendingNextTurn = true;
    return;
  }
  proceedToNextPlayer();
}

function cpuBuyProperty(cellId) {
  const props = getPropsAtStation(cellId);
  for (const p of props) {
    if (p.owner === null && player.money >= p.price) {
      const buyChance = player.cpuLevel === 1 ? 0.3
                      : player.cpuLevel === 2 ? 0.6 : 0.9;
      if (Math.random() < buyChance) {
        buyProperty(p.id);
        log("🏘 " + player.name + " が " + p.name + " を購入");
      }
    }
  }
}

function giveRandomCard() {
  if (player.cards.length >= 10) { log("📭 " + player.name + " 手札一杯"); return; }
  const ids = Object.keys(CARDS);
  const cid = ids[Math.floor(Math.random() * ids.length)];
  player.cards.push(cid);
  playSound("card");
  log("🎴 " + player.name + " が " + CARDS[cid].name + " を入手");
}

function openPropDialog(cellId) {
  const cell = CELL_BY_ID[cellId];
  propStationName.textContent = cell.name;
  propList.innerHTML = "";

  const props = getPropsAtStation(cellId);
  if (props.length === 0) {
    propList.innerHTML = "<div style='padding:20px;text-align:center;color:#888;'>物件がありません</div>";
  }

  for (const p of props) {
    const t = PROP_TYPES[p.type];
    const item = document.createElement("div");
    item.className = "propItem";

    const info = document.createElement("div");
    info.className = "info";
    info.innerHTML = `
      <div><span class="icon">${t.icon}</span>
        <span class="name">${p.name}</span></div>
      <div class="type">${t.name} / 収益 ${Math.round(t.rate*100)}%</div>
      <div class="price">${ky(p.price)}</div>
    `;

    const btn = document.createElement("button");
    if (p.owner === player.id) {
      btn.textContent = "所有中";
      btn.disabled = true;
    } else if (p.owner !== null) {
      btn.textContent = "他所有";
      btn.disabled = true;
    } else if (player.money < p.price) {
      btn.textContent = "資金不足";
      btn.disabled = true;
    } else {
      btn.textContent = "購入";
      btn.onclick = () => {
        if (buyProperty(p.id)) {
          playSound("coin");
          log("🏘 " + p.name + " を購入！");
          updateHUD();
          drawBoard();
          openPropDialog(cellId);
        }
      };
    }
    item.appendChild(info);
    item.appendChild(btn);
    propList.appendChild(item);
  }
  propDialog.classList.remove("hidden");
}

function closePropDialog() {
  propDialog.classList.add("hidden");
  if (pendingNextTurn) {
    pendingNextTurn = false;
    checkPendingDialogsOrProceed();
  }
}

function openPropertyList() {
  const owned = ALL_PROPS.filter(p => p.owner === player.id);
  if (owned.length === 0) {
    log("🏘 物件をまだ持っていません");
    return;
  }
  let total = 0;
  for (const p of owned) total += p.price;
  log("🏘 所有物件 " + owned.length + "件 / 総額 " + ky(total));
}

function endMove() {
  if (!turnInProgress) return;
  turnInProgress = false;
  isMoving = false;
  remainingSteps = 0;
  turnPath = [];
  panOffsetX = 0;
  panOffsetY = 0;
  clearHighlights();
  goalReachBtn.classList.remove("show");
  log("── " + player.name + " のターン終了 ──");
  autoSave();

  if (!player.isCPU && player.money < 0) {
    debtResolveCallback = () => {
      checkPendingDialogsOrProceed();
    };
    openDebtDialog();
    return;
  }

  if (player.isCPU && player.money < 0) {
    autoSellForCPU();
  }

  checkPendingDialogsOrProceed();
}

function proceedToNextPlayer() {
  currentPlayerIndex = (currentPlayerIndex + 1) % players.length;
  player = players[currentPlayerIndex];

  if (currentPlayerIndex === 0) {
    advanceDay();
  }

  if (pendingSettlement) {
    pendingSettlement = false;
    const cb = pendingSettlementCallback;
    pendingSettlementCallback = null;
    showSettlementDialog(cb);
    return;
  }

  beginTurn(player);
}

function autoSellForCPU() {
  let safeguard = 0;
  while (player.money < 0 && safeguard < 100) {
    safeguard++;
    const owned = ALL_PROPS.filter(x => x.owner === player.id && canSellProperty(x));
    if (owned.length === 0) {
      log("💸 " + player.name + " は売却できる物件がありません");
      break;
    }
    owned.sort((a, b) => a.price - b.price);
    const target = owned[0];
    const got = sellProperty(target.id);
    log("💸 " + player.name + " が " + target.name + " を売却 +" + ky(got));
  }
  if (player.money >= 0) {
    log("✅ " + player.name + " 借金返済完了");
  }
}

function beginTurn(p) {
  if (p.buffs.sekubi > 0) {
    p.buffs.sekubi--;
    log("😴 " + p.name + " は休み中（残" + p.buffs.sekubi + "）");
    setTimeout(() => {
      currentPlayerIndex = (currentPlayerIndex + 1) % players.length;
      player = players[currentPlayerIndex];
      if (currentPlayerIndex === 0) advanceDay();
      beginTurn(player);
    }, 600);
    return;
  }

  applyPlayerBuffs(p);
  hasRolledThisTurn = false;
  isShowingGoalPopup = false;

  thisTurn = { diceCount: 1 };
  if (p.buffs.renchanKakekko) thisTurn.diceCount = 2;
  if (p.buffs.renchanDash) thisTurn.diceCount = 3;

  canRoll = true;
  canUseCard = true;

  if (p.buffs.nonbiri > 0) {
    log("🐌 " + p.name + " はのんびり中（残" + p.buffs.nonbiri + "）");
    canUseCard = false;
  }
  if (typeof globalSeal !== "undefined" && globalSeal > 0) {
    canUseCard = false;
    log("🔒 封印中（残" + globalSeal + "）");
  }

  isMoving = false;
  remainingSteps = 0;
  turnPath = [];
  panOffsetX = 0;
  panOffsetY = 0;

  drawAllPlayers();
  applyCamera();
  updateHUD();

  if (p.isCPU) {
    turnInProgress = true;
    log("🎮 " + p.name + " のターン");
    setTimeout(() => {
      try {
        if (!turnInProgress) return;
        cpuTakeTurn();
      } catch (e) {
        log("⚠ CPUターンエラー: " + e.message);
        endMove();
      }
    }, 400);
  } else {
    turnInProgress = false;
    log("🎮 " + p.name + " のターン");
  }
}

function advanceDay() {
  day++;
  if (day > 30) {
    day = 1;
    month++;
    if (month > maxMonth) { endGame(); return; }
    log("📅 " + month + "ヶ月目スタート");
  }
  if (day === 10 || day === 20 || day === 30) {
    log("🎁 " + day + " 日 ボーナス日");
    pendingSettlement = true;
    pendingSettlementCallback = () => beginTurn(player);
  }
  if (typeof globalSeal !== "undefined" && globalSeal > 0) {
    globalSeal--;
    if (globalSeal === 0) log("🔓 封印解除");
  }
}

function checkGoalReach() {
  if (!isMoving || remainingSteps <= 0) return;

  const reachable = findReachable(player.pos, remainingSteps);
  const goalInfo = reachable.get(GOAL_ID);
  const canReach = goalInfo && goalInfo.dist === remainingSteps;

  if (!canReach) {
    goalDialog.classList.remove("hidden");
    document.getElementById("goalDialogTitle").textContent = "🎯 ゴール判定";
    document.getElementById("goalDialogMsg").textContent = "❌ ピッタリ止まれないのでゴールできません";
    document.getElementById("goalDialogBtns").innerHTML =
      `<button class="btnNo" id="goalCloseBtn">閉じる</button>`;
    document.getElementById("goalCloseBtn").onclick = () => {
      goalDialog.classList.add("hidden");
    };
    playSound("buzzer");
    return;
  }

  const dist = goalInfo.dist;
  goalDialog.classList.remove("hidden");
  document.getElementById("goalDialogTitle").textContent = "🎯 ゴールにピッタリ止まれる！";
  document.getElementById("goalDialogMsg").textContent =
    `${dist}マスでピッタリ止まれます。行きますか？`;
  document.getElementById("goalDialogBtns").innerHTML =
    `<button class="btnYes" id="goalYesBtn">はい</button>
     <button class="btnNo" id="goalNoBtn">いいえ</button>`;

  document.getElementById("goalYesBtn").onclick = () => {
    goalDialog.classList.add("hidden");
    playSound("goal");
    const path = [];
    let cur = GOAL_ID;
    while (cur !== player.pos) {
      path.unshift(cur);
      cur = reachable.get(cur).parent;
    }
    for (const cellId of path) {
      const c = CELL_BY_ID[player.pos];
      const isFwd = c.next.includes(cellId);
      player.pos = cellId;
      if (isFwd) {
        turnPath.push(cellId);
        remainingSteps--;
      } else {
        turnPath.pop();
        remainingSteps++;
      }
      playSound("move");
      drawAllPlayers();
      applyCamera();
    }
    applyCellEffect(player.pos);
    if (remainingSteps <= 0) {
      endMove();
    } else {
      updateHUD();
      showMoveTargets();
    }
  };

  document.getElementById("goalNoBtn").onclick = () => {
    goalDialog.classList.add("hidden");
  };
}

function showSettlementDialog(callback) {
  const gains = [];
  for (const p of players) {
    const saved = player;
    player = p;
    const income = payPropertyIncomeSilent();
    player = saved;
    gains.push({ p, gain: income });
  }

  document.getElementById("settleTitle").textContent = "💰 " + day + "日 決算 💰";
  document.getElementById("settleSubtitle").textContent =
    month + "ヶ月目 " + day + "日 物件収入";

  const incomeEl = document.getElementById("settleIncome");
  incomeEl.innerHTML = "";
  const table = document.createElement("table");
  table.className = "settleTable";
  table.innerHTML = "<tr><th>プレイヤー</th><th>物件収入</th></tr>";
  for (const g of gains) {
    const tr = document.createElement("tr");
    const cls = g.gain === 0 ? "gain zero" : "gain";
    tr.innerHTML = `<td class="name">${g.p.icon} ${g.p.name}</td>
                    <td class="${cls}">${g.gain > 0 ? "+" + ky(g.gain) : "±0"}</td>`;
    table.appendChild(tr);
  }
  incomeEl.appendChild(table);

  const rankEl = document.getElementById("settleRank");
  rankEl.innerHTML = "";
  const sorted = [...players].sort((a, b) =>
    getPlayerTotalAssets(b) - getPlayerTotalAssets(a));
  const medals = ["🥇", "🥈", "🥉", "4️⃣"];
  for (let i = 0; i < sorted.length; i++) {
    const p = sorted[i];
    const row = document.createElement("div");
    row.className = "rankRow" + (i === 0 ? " rank1" : "");
    row.innerHTML = `<span class="rankPos">${medals[i]}</span>
                     <span class="rankName">${p.icon} ${p.name}</span>
                     <span class="rankMoney">${ky(getPlayerTotalAssets(p))}</span>`;
    rankEl.appendChild(row);
  }

  playSound("coin");
  settleDialog.classList.remove("hidden");

  document.getElementById("settleOkBtn").onclick = () => {
    settleDialog.classList.add("hidden");
    playSound("pop");
    if (callback) callback();
  };
}

function payPropertyIncomeSilent() {
  let total = 0;
  const byStation = {};
  for (const p of ALL_PROPS) {
    if (p.owner !== player.id) continue;
    if (!byStation[p.stationCellId]) byStation[p.stationCellId] = [];
    byStation[p.stationCellId].push(p);
  }

  for (const cellId in byStation) {
    const props = byStation[cellId];
    const allOwned = props.every(x => x.owner === player.id);

    for (const p of props) {
      const t = PROP_TYPES[p.type];
      let rate = t.rate;
      if (p.type === "farm" && Math.random() < 0.30) rate = t.harvest;
      let income = Math.floor(p.price * rate);
      if (allOwned) income *= 2;
      total += income;
    }
  }

  if (total > 0) player.money += total;
  return total;
}

function showRankingDialog() {
  document.getElementById("rankDate").textContent =
    month + "ヶ月目 " + day + "日時点";
  const listEl = document.getElementById("rankList");
  listEl.innerHTML = "";

  const sorted = [...players].sort((a, b) =>
    getPlayerTotalAssets(b) - getPlayerTotalAssets(a));
  const medals = ["🥇", "🥈", "🥉", "4️⃣"];

  for (let i = 0; i < sorted.length; i++) {
    const p = sorted[i];
    const owned = ALL_PROPS.filter(x => x.owner === p.id);
    const propValue = owned.reduce((s, x) => s + x.price, 0);

    const row = document.createElement("div");
    row.className = "row" + (i === 0 ? " rank1" : "");
    row.innerHTML = `
      <div class="pos">${medals[i]}</div>
      <div class="name">
        ${p.icon} ${p.name}
        <div class="sub">現金 ${ky(p.money)} / 物件 ${owned.length}件 (${ky(propValue)})</div>
      </div>
      <div class="money">${ky(getPlayerTotalAssets(p))}</div>
    `;
    listEl.appendChild(row);
  }

  rankDialog.classList.remove("hidden");
}

function endGame() {
  stopBGM();
  playSound("victory");
  log("🎉 ゲーム終了！");

  localStorage.removeItem("saitama_auto");

  document.getElementById("endDate").textContent =
    maxMonth + "ヶ月間の最終結果";

  const listEl = document.getElementById("endList");
  listEl.innerHTML = "";

  const sorted = [...players].sort((a, b) =>
    getPlayerTotalAssets(b) - getPlayerTotalAssets(a));
  const medals = ["🥇", "🥈", "🥉", "4️⃣"];

  for (let i = 0; i < sorted.length; i++) {
    const p = sorted[i];
    const owned = ALL_PROPS.filter(x => x.owner === p.id);
    const propValue = owned.reduce((s, x) => s + x.price, 0);

    const row = document.createElement("div");
    row.className = "row" + (i === 0 ? " rank1" : "");
    row.innerHTML = `
      <div class="pos">${medals[i]}</div>
      <div class="name">
        ${p.icon} ${p.name}
        <div class="sub">現金 ${ky(p.money)} / 物件 ${owned.length}件 (${ky(propValue)})</div>
      </div>
      <div class="money">${ky(getPlayerTotalAssets(p))}</div>
    `;
    listEl.appendChild(row);
  }

  document.getElementById("endTitle").textContent =
    "🎉 " + sorted[0].name + " の勝利！ 🎉";
  endDialog.classList.remove("hidden");

  canRoll = false;
  canUseCard = false;
  updateHUD();
}

function applyPlayerBuffs(p) {
  if (p.buffs.nonbiri > 0) p.buffs.nonbiri--;
  if (p.buffs.osusowake > 0) p.buffs.osusowake--;

  if (p.buffs.crayon > 0) {
    const a = (Math.floor(Math.random() * 10) + 1) * 500000;
    p.money += a;
    log("🖍️ " + p.name + " クレヨン +" + ky(a));
    p.buffs.crayon--;
    if (p.buffs.crayon === 0) log("🖍️ " + p.name + " クレヨン終了");
  }

  if (p.buffs.renchanKakekko && Math.random() < 0.20) {
    p.buffs.renchanKakekko = false;
    log("🏃‍♂️ " + p.name + " 連チャンかけっこ消滅");
  }
  if (p.buffs.renchanDash && Math.random() < 0.25) {
    p.buffs.renchanDash = false;
    log("💨 " + p.name + " 連チャンダッシュ消滅");
  }
  if (p.buffs.suttobiMakuri && Math.random() < 0.25) {
    p.buffs.suttobiMakuri = false;
    log("🌀 " + p.name + " すっとびまくり消滅");
  }
  if (p.buffs.yellow && Math.random() < 0.30) {
    p.buffs.yellow = false;
    log("🟡 " + p.name + " イエロー解除");
  }

  for (const id of [...poos]) {
    if (Math.random() < 0.20) {
      poos.delete(id);
      log("💩 うんち自然消滅");
    }
  }
  redrawYellowed();
}

function startFixedMove(n) {
  playSound("move");
  canUseCard = false;
  canRoll = false;
  turnInProgress = true;
  hasRolledThisTurn = true;
  remainingSteps = n;
  isMoving = true;
  turnPath = [player.pos];
  updateHUD();
  showMoveTargets();
}

function warpRandom(targetPlayer) {
  playSound("warp");
  const p = targetPlayer || player;
  const candidates = MAP.filter(c => !poos.has(c.id) && c.id !== p.pos);
  if (candidates.length === 0) return;
  const target = candidates[Math.floor(Math.random() * candidates.length)];
  p.pos = target.id;
  drawAllPlayers();
  applyCamera();
  log("✨ " + p.name + " が " + (target.name || "マス" + target.id) + " にワープ！");
}

function luckWarp() {
  playSound("warp");
  const r = Math.random();
  const goalCell = CELL_BY_ID[GOAL_ID];
  const stations = MAP.filter(c => c.type === CELL.STATION && c.id !== player.pos);
  const sorted = stations
    .map(s => ({ s, d: Math.hypot(s.x - goalCell.x, s.y - goalCell.y) }))
    .sort((a, b) => a.d - b.d);
  let target;
  if (r < 0.15) {
    target = goalCell;
    log("🎲 大当たり！ ゴールへワープ！");
  } else if (r < 0.65) {
    target = sorted[Math.floor(Math.random() * Math.min(5, sorted.length))].s;
    log("🎲 ゴール近くの " + target.name + " へ");
  } else {
    const far = sorted.slice(-5);
    target = far[Math.floor(Math.random() * far.length)].s;
    log("🎲 遠くの " + target.name + " へ");
  }
  player.pos = target.id;
  drawAllPlayers();
  applyCamera();
}

function placeRandomPoo() {
  playSound("poo");
  const candidates = MAP.filter(c =>
    (c.type === CELL.PLUS || c.type === CELL.MINUS || c.type === CELL.CARD)
    && c.id !== player.pos && !poos.has(c.id)
  );
  if (candidates.length === 0) { log("💩 置ける場所がありません"); return; }
  const target = candidates[Math.floor(Math.random() * candidates.length)];
  poos.add(target.id);
  redrawYellowed();
  log("💩 マス" + target.id + " にうんち設置");
}

function changeGoal() {
  const goals = MAP.filter(c => c.kind === "goal" && c.id !== GOAL_ID);
  if (goals.length === 0) return;
  CELL_BY_ID[GOAL_ID].isGoal = false;
  const newGoal = goals[Math.floor(Math.random() * goals.length)];
  newGoal.isGoal = true;
  GOAL_ID = newGoal.id;
  log("🚫 ゴールが " + newGoal.name + " に変更！");
  updateGoalBanner();
  drawBoard();
}

function openHand() {
  if (!player || player.isCPU) return;
  renderHand();
  handPanel.classList.remove("hidden");
}
function closeHand() { handPanel.classList.add("hidden"); }

function renderHand() {
  handCount.textContent = player.cards.length;
  handList.innerHTML = "";
  if (player.cards.length === 0) {
    handList.innerHTML = "<div style='grid-column:1/-1;text-align:center;color:#888;'>手札がありません</div>";
    return;
  }
  for (let i = 0; i < player.cards.length; i++) {
    const cid = player.cards[i];
    const c = CARDS[cid];
    const el = document.createElement("div");
    el.className = "handCard " + c.cat;
    el.innerHTML = `<span class="cIcon">${c.icon}</span>
                    <span class="cName">${c.name}</span>
                    <span class="cCat">${c.desc}</span>`;
    el.onclick = () => useCardByIndex(i);
    handList.appendChild(el);
  }
}

function useCardByIndex(index) {
  if (!canUseCard) {
    log("❌ このターンはもうカードを使えません");
    closeHand();
    return;
  }
  if (typeof globalSeal !== "undefined" && globalSeal > 0) {
    log("🔒 封印中のため使えません");
    closeHand();
    return;
  }
  if (player.buffs.nonbiri > 0) {
    log("🐌 のんびり中のため使えません");
    closeHand();
    return;
  }

  const cid = player.cards[index];
  const c = CARDS[cid];
  player.cards.splice(index, 1);
  playSound("card");
  log("🎴 " + player.name + " が " + c.name + " を使用");
  closeHand();
  turnInProgress = true;
  c.use();

  if (c.outcome === "roll") {
    canUseCard = false;
    canRoll = true;
    updateHUD();
    if (player.isCPU) {
      setTimeout(() => {
        if (turnInProgress && canRoll) cpuRollDice();
      }, 300);
    }
  } else if (c.outcome === "move") {
    // 移動開始済み
  } else {
    canUseCard = false;
    canRoll = false;
    drawBoard();
    endMove();
    return;
  }
  updateHUD();
}

let debtDialogOpen = false;
let debtResolveCallback = null;

function openDebtDialog() {
  if (debtDialogOpen) return;
  if (player.money >= 0) return;
  debtDialogOpen = true;
  playSound("debt");

  debtDialog.classList.remove("hidden");
  renderDebtDialog();
}

function closeDebtDialog() {
  debtDialogOpen = false;
  debtDialog.classList.add("hidden");
  if (debtResolveCallback) {
    const cb = debtResolveCallback;
    debtResolveCallback = null;
    cb();
  }
}

function renderDebtDialog() {
  const listEl = document.getElementById("debtList");
  const footerEl = document.getElementById("debtFooter");
  const debtEl = document.getElementById("debtAmount");
  const msgEl = document.getElementById("debtMsg");

  const debt = -player.money;
  debtEl.textContent = ky(debt);

  const owned = ALL_PROPS.filter(x => x.owner === player.id);

  if (owned.length === 0) {
    msgEl.textContent = "物件がありません。借金が残ったままです...";
    listEl.innerHTML = "";
    footerEl.innerHTML = "<span style='color:#c00;font-weight:bold;'>借金が残ります</span><br>" +
      "<button onclick='confirmDebtEnd()' style='margin-top:8px;padding:10px 20px;background:linear-gradient(135deg,#888,#444);color:#fff;border:none;border-radius:8px;font-weight:bold;cursor:pointer;'>ターン終了</button>";
    return;
  }

  msgEl.textContent = "物件を売却して借金を返済してください";
  listEl.innerHTML = "";

  for (const p of owned) {
    const t = PROP_TYPES[p.type];
    const item = document.createElement("div");
    item.className = "debtItem";

    const info = document.createElement("div");
    info.className = "info";
    const sellPrice = getSellPrice(p);

    info.innerHTML = `
      <div class="name">${t.icon} ${p.name}</div>
      <div class="type">${t.name} ・ 価格 ${ky(p.price)}</div>
      <div class="sellPrice">売却額：${ky(sellPrice)}</div>
    `;

    const btn = document.createElement("button");
    if (!canSellProperty(p)) {
      btn.className = "locked";
      btn.disabled = true;
      btn.textContent = "🔒 売却不可";
    } else {
      btn.className = "sell";
      btn.textContent = "売却";
      btn.onclick = () => {
        const got = sellProperty(p.id);
        if (got) {
          playSound("coin");
          log("💸 " + p.name + " を売却 +" + ky(got));
          drawBoard();
          updateHUD();
          if (player.money >= 0) {
            log("✅ 借金返済完了！");
            closeDebtDialog();
          } else {
            renderDebtDialog();
          }
        }
      };
    }
    item.appendChild(info);
    item.appendChild(btn);
    listEl.appendChild(item);
  }

  if (player.money >= 0) {
    footerEl.innerHTML = "<span style='color:#0a0;font-weight:bold;'>返済完了！</span>";
  } else {
    footerEl.innerHTML = "<span style='color:#c00;font-weight:bold;'>まだ " + ky(-player.money) + " の借金があります</span><br>" +
      "<button onclick='confirmDebtEnd()' style='margin-top:8px;padding:8px 16px;background:linear-gradient(135deg,#888,#444);color:#fff;border:none;border-radius:8px;font-weight:bold;cursor:pointer;font-size:12px;'>借金を残してターン終了</button>";
  }
}

function confirmDebtEnd() {
  log("💸 借金 " + ky(-player.money) + " を残したままターン終了");
  closeDebtDialog();
}

window.confirmDebtEnd = confirmDebtEnd;

rollBtn.onclick = rollDice;
goalReachBtn.onclick = checkGoalReach;
document.getElementById("cardBtn").onclick = openHand;
document.getElementById("closeHand").onclick = closeHand;
document.getElementById("propBtn").onclick = openPropertyList;
document.getElementById("rankBtn").onclick = showRankingDialog;
document.getElementById("rankCloseBtn").onclick = () => {
  rankDialog.classList.add("hidden");
};
document.getElementById("closePropDialog").onclick = closePropDialog;
mapToggleBtn.onclick = toggleFullMap;

const muteBtn = document.getElementById("muteBtn");
if (muteBtn) {
  muteBtn.onclick = () => {
    const m = toggleMute();
    muteBtn.textContent = m ? "🔇 音OFF" : "🔊 音ON";
  };
}

document.getElementById("saveBtn").onclick = () => {
  autoSave();
  log("💾 セーブしました");
};
document.getElementById("loadBtn").onclick = () => {
  const raw = localStorage.getItem("saitama_auto");
  if (!raw) { log("セーブデータがありません"); return; }
  const data = JSON.parse(raw);
  if (data.players) {
    players = data.players;
  }
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
  if (!CELL_BY_ID[GOAL_ID]) GOAL_ID = stationIdMap["fukaya"];
  CELL_BY_ID[GOAL_ID].isGoal = true;
  document.getElementById("startScreen").classList.add("hidden");
  drawBoard();
  updateGoalBanner();
  applyCamera();
  startBGM();
  log("📂 ロードしました");
};

debugBtn.onclick = () => {
  if (!player) return;
  try {
    giveRandomCard();
    renderHand();
    handPanel.classList.remove("hidden");
  } catch (e) {
    log("⚠ " + e.message);
  }
};

document.getElementById("restartBtn").onclick = () => {
  localStorage.removeItem("saitama_auto");
  location.reload();
};

function startGame(config) {
  initAudio();
  if (audioCtx && audioCtx.state === "suspended") {
    audioCtx.resume();
  }

  localStorage.removeItem("saitama_auto");

  for (const c of MAP) c.isGoal = false;
  GOAL_ID = stationIdMap["fukaya"];
  CELL_BY_ID[GOAL_ID].isGoal = true;

  players = [];
  currentPlayerIndex = 0;

  for (let i = 0; i < config.humans; i++) {
    const hp = config.humanPlayers[i] || { name: "プレイヤー" + (i+1), icon: "🧑" };
    players.push({
      id: i,
      name: hp.name || ("プレイヤー" + (i+1)),
      icon: hp.icon || "🧑",
      money: START_MONEY,
      pos: START_POS,
      cards: [],
      buffs: newBuffs(),
      isCPU: false,
      cpuLevel: 0,
    });
  }
  for (let i = 0; i < config.cpus; i++) {
    const level = config.cpuLevels[i] || 1;
    players.push({
      id: config.humans + i,
      name: CPU_NAMES[level],
      icon: CPU_ICONS[level],
      money: START_MONEY,
      pos: START_POS,
      cards: [],
      buffs: newBuffs(),
      isCPU: true,
      cpuLevel: level,
    });
  }

  maxMonth = config.months || 12;
  player = players[0];

  day = 1;
  month = 1;
  remainingSteps = 0;
  isMoving = false;
  turnInProgress = false;
  turnPath = [];
  poos.clear();
  thisTurn = { diceCount: 1 };
  canRoll = true;
  canUseCard = true;
  isFullMap = false;
  pendingSettlement = false;
  pendingSettlementCallback = null;
  pendingNextTurn = false;
  hasRolledThisTurn = false;
  isShowingGoalPopup = false;
  panOffsetX = 0;
  panOffsetY = 0;
  userZoom = 0.9;
  if (typeof globalSeal !== "undefined") globalSeal = 0;

  document.getElementById("startScreen").classList.add("hidden");

  log("");
  log("🎮 ゲームスタート！");
  log("プレイヤー：" + players.map(p => p.name).join(" / "));
  log("プレイ期間：" + maxMonth + "ヶ月");

  drawBoard();
  updateGoalBanner();
  applyCamera();
  startBGM();
  beginTurn(players[0]);
}

window.startGame = startGame;

setupPan();

(function checkAutoLoad() {
  const raw = localStorage.getItem("saitama_auto");
  if (!raw) {
    log("🚃 埼玉散歩日和り へようこそ！");
    log("🎮 設定を選んで「ゲームスタート」を押してください");
    return;
  }
  try {
    const data = JSON.parse(raw);
    if (!data.version || data.version < 2) {
      console.log("古いセーブデータのため無効化");
      localStorage.removeItem("saitama_auto");
      log("🚃 埼玉散歩日和り へようこそ！");
      log("🎮 設定を選んで「ゲームスタート」を押してください");
      return;
    }
    if (!data.players || data.players.length === 0) {
      log("🚃 埼玉散歩日和り へようこそ！");
      return;
    }
    const dialog = document.getElementById("resumeDialog");
    const detail = document.getElementById("resumeDetail");
    dialog.classList.remove("hidden");

    const savedPlayer = data.players[data.currentPlayerIndex || 0];
    detail.textContent = (data.month || 1) + "ヶ月目 " +
      (data.day || 1) + "日 / " +
      (savedPlayer ? savedPlayer.name : "?");

    document.getElementById("resumeBtn").onclick = () => {
      dialog.classList.add("hidden");
      if (loadAutoSave()) {
        document.getElementById("startScreen").classList.add("hidden");
        drawBoard();
        updateGoalBanner();
        applyCamera();
        startBGM();
        log("📂 前回の続きから再開しました（" + month + "ヶ月目 " + day + "日）");
        setTimeout(() => {
          beginTurn(player);
        }, 150);
      }
    };

    document.getElementById("newGameBtn").onclick = () => {
      dialog.classList.add("hidden");
      localStorage.removeItem("saitama_auto");
      log("🆕 新規ゲームを開始します");
    };
  } catch (e) {
    console.warn("Auto-load check error:", e);
    log("🚃 埼玉散歩日和り へようこそ！");
  }
})();
