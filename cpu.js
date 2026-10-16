// ========================================
// cpu.js - CPU AI
// ========================================

const CPU_NAMES = {
  1: "庶民",
  2: "ベテラン",
  3: "生粋の埼玉県民",
};
const CPU_ICONS = {
  1: "🧑‍🌾",
  2: "🧑‍💼",
  3: "🧑‍🚀",
};

// ===== カード使用判断 =====
function cpuChooseCard() {
  const p = player;
  if (p.cards.length === 0) return -1;
  const level = p.cpuLevel;

  // カード一覧を{idx, card}に変換
  const usable = [];
  for (let i = 0; i < p.cards.length; i++) {
    const c = CARDS[p.cards[i]];
    if (c) usable.push({ idx: i, card: c });
  }
  if (usable.length === 0) return -1;

  // ゴールまでの距離
  const dist = shortestDistance(p.pos, GOAL_ID);

  if (level === 1) {
    // 庶民: 移動系・ワープ系を時々使う
    const moveCards = usable.filter(u =>
      u.card.cat === "move" || u.card.cat === "warp");
    if (moveCards.length > 0 && Math.random() < 0.30) {
      return moveCards[Math.floor(Math.random() * moveCards.length)].idx;
    }
    return -1;
  }

  if (level === 2) {
    // ベテラン: 移動系・ワープ系は積極的、お邪魔系も時々
    // ゴールが近い時は移動系を優先
    const moveCards = usable.filter(u =>
      u.card.cat === "move" || u.card.cat === "warp");
    if (moveCards.length > 0 && (dist > 10 || Math.random() < 0.7)) {
      return moveCards[Math.floor(Math.random() * moveCards.length)].idx;
    }
    const jamaCards = usable.filter(u => u.card.cat === "jama");
    if (jamaCards.length > 0 && Math.random() < 0.25) {
      return jamaCards[Math.floor(Math.random() * jamaCards.length)].idx;
    }
    return -1;
  }

  if (level === 3) {
    // 生粋: 全カードを評価
    // ゴールに近い時はダッシュ系を優先
    if (dist <= 20) {
      // 大きい数字の移動カードを優先
      const bigMove = usable.filter(u =>
        u.card.cat === "move" &&
        (u.card.name.includes("ダッシュ") || u.card.name.includes("スペーシア") ||
         u.card.name === "しらこばと"));
      if (bigMove.length > 0) {
        return bigMove[0].idx;
      }
      const anyMove = usable.filter(u => u.card.cat === "move");
      if (anyMove.length > 0 && Math.random() < 0.8) {
        return anyMove[0].idx;
      }
    } else {
      // 遠い時は移動系をバランス良く
      const moveCards = usable.filter(u =>
        ["move","warp"].includes(u.card.cat));
      if (moveCards.length > 0 && Math.random() < 0.7) {
        return moveCards[Math.floor(Math.random() * moveCards.length)].idx;
      }
      // 便利系・お金系も使う
      const others = usable.filter(u =>
        ["util","money","jama"].includes(u.card.cat));
      if (others.length > 0 && Math.random() < 0.4) {
        return others[Math.floor(Math.random() * others.length)].idx;
      }
    }
    return -1;
  }
  return -1;
}

// ===== 移動先の選択 =====
function cpuChooseTarget(reachable) {
  const p = player;
  const level = p.cpuLevel;

  const candidates = [];
  for (const [id, info] of reachable) {
    if (id === p.pos) continue;
    candidates.push({ id, dist: info.dist });
  }
  if (candidates.length === 0) return p.pos;

  // ゴールへの距離でスコアリング
  for (const c of candidates) {
    c.goalDist = shortestDistance(c.id, GOAL_ID);
  }

  if (level === 1) {
    // 庶民: 50%でランダム、50%でゴールに近い方
    if (Math.random() < 0.5) {
      return candidates[Math.floor(Math.random() * candidates.length)].id;
    }
  } else if (level === 2) {
    // ベテラン: 80%でゴールに近い方
    if (Math.random() < 0.2) {
      return candidates[Math.floor(Math.random() * candidates.length)].id;
    }
  }
  // レベル3 or 上の判定を抜けたら最適
  candidates.sort((a, b) => a.goalDist - b.goalDist);
  return candidates[0].id;
}

// ===== CPU ターン進行 =====
function cpuTakeTurn() {
  if (!player.isCPU || !turnInProgress) return;

  // 1. カード使用を試す（30%の確率で使う場合あり）
  const cardIdx = cpuChooseCard();
  if (cardIdx >= 0) {
    log("🤖 " + player.name + " がカードを使います");
    useCardByIndex(cardIdx);
    // カード使用後の処理はuseCardByIndex内で進む
    // rollが出た場合、次のCPU処理はshowMoveTargets後に分岐
    return;
  }

  // 2. サイコロを振る
  setTimeout(() => {
    if (!turnInProgress) return;
    cpuRollDice();
  }, 400);
}

function cpuRollDice() {
  if (!player.isCPU || !turnInProgress) return;
  if (!canRoll) return;

  // rollDiceと同じ処理
  canUseCard = false;
  canRoll = false;
  const count = thisTurn.diceCount;
  let total = 0;
  const rolls = [];
  for (let i = 0; i < count; i++) {
    const r = Math.floor(Math.random() * 6) + 1;
    rolls.push(r); total += r;
  }
  log("🎲 " + player.name + ": " +
      (count > 1 ? rolls.join("+") + "=" : "") + total + " マス");
  remainingSteps = total;
  isMoving = true;
  turnPath = [player.pos];
  updateHUD();
  showMoveTargets();
}