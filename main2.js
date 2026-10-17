// ========================================
// main2.js - ゲームロジック（後半）
// ========================================

function applyCellEffect(cellId) {
  const c = CELL_BY_ID[cellId];
  if (!c) return false;

  collectingEffects = true;
  collectedEffects = [];

  if (c.type === CELL.EVENT) {
    playSound("event");
    triggerRandomEvent();
    collectingEffects = false;
    updateHUD();
    if (collectedEffects.length > 0) {
      showEffectPopup(continueAfterMove);
      return true;
    }
    return false;
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
    collectingEffects = false;
    updateHUD();
    if (collectedEffects.length > 0) {
      showEffectPopup(continueAfterMove);
      return true;
    }
    return false;
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
    collectingEffects = false;
    updateHUD();
    if (collectedEffects.length > 0) {
      showEffectPopup(continueAfterMove);
      return true;
    }
    return false;
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
      log("🎴 カード売り場（資金不足）");
    } else {
      log("🎴 カード売り場（手札一杯）");
    }
    collectingEffects = false;
    updateHUD();
    if (collectedEffects.length > 0) {
      showEffectPopup(continueAfterMove);
      return true;
    }
    return false;
  }

  const isYellowed = player.buffs.yellow && (c.type === CELL.PLUS || c.type === CELL.MINUS);

  if (isYellowed || c.type === CELL.CARD) {
    giveRandomCard();
    collectingEffects = false;
    updateHUD();
    if (collectedEffects.length > 0) {
      showEffectPopup(continueAfterMove);
      return true;
    }
    return false;
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
    collectingEffects = false;
    updateHUD();
    if (collectedEffects.length > 0) {
      showEffectPopup(continueAfterMove);
      return true;
    }
    return false;
  } else if (c.type === CELL.MINUS) {
    playSound("buzzer");
    const mult = getInflationMultiplier();
    const base = (Math.floor(Math.random() * 8) + 1) * 500000;
    const a = Math.floor(base * mult);
    player.money -= a;
    log("🟥 " + player.name + " −" + ky(a));
    collectingEffects = false;
    updateHUD();
    if (collectedEffects.length > 0) {
      showEffectPopup(continueAfterMove);
      return true;
    }
    return false;
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

    collectingEffects = false;
    updateHUD();
    isShowingGoalPopup = true;
    showGoalArrivalPopup(arrivedPlayerName, arrivedGoalName, prize, happyBonus, nextGoalName, arrivedCellId);
    return true;
  } else if (c.kind === "goal" || c.kind === "prop") {
    collectingEffects = false;
    if (player.isCPU) {
      cpuBuyProperty(cellId);
      continueAfterMove();
      return false;
    } else {
      const props = getPropsAtStation(cellId);
      if (props.length > 0) {
        openPropDialog(cellId);
        return true;
      } else {
        log("🏘 " + (c.name || "この駅") + " には物件がありません");
        continueAfterMove();
        return false;
      }
    }
  }

  collectingEffects = false;
  return false;
}

function showGoalArrivalPopup(arrivedPlayer, goalName, prize, happyBonus, nextGoal, goalCellId) {
  const dialog = document.getElementById("goalArrivalDialog");

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

        continueAfterMove();
      }, 120);
    };
  }
}

function checkPendingDialogsOrProceed() {
  const propDlg = document.getElementById("propDialog");
  const arrivalDlg = document.getElementById("goalArrivalDialog");
  const effDlg = document.getElementById("effectDialog");

  const propVisible = propDlg && !propDlg.classList.contains("hidden");
  const arrivalVisible = arrivalDlg && !arrivalDlg.classList.contains("hidden");
  const effVisible = effDlg &&
    !effDlg.classList.contains("hidden") &&
    effDlg.style.display !== "none";

  if (propVisible || arrivalVisible || effVisible) {
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
  } else {
    continueAfterMove();
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
  isShowingEffectPopup = false;

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
  const allGoals = MAP.filter(c => c.kind === "goal");
  const randomGoal = allGoals[Math.floor(Math.random() * allGoals.length)];
  GOAL_ID = randomGoal.id;
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
  isShowingEffectPopup = false;
  panOffsetX = 0;
  panOffsetY = 0;
  userZoom = 0.6;
  if (typeof globalSeal !== "undefined") globalSeal = 0;

  document.getElementById("startScreen").classList.add("hidden");

  log("");
  log("🎮 ゲームスタート！");
  log("プレイヤー：" + players.map(p => p.name).join(" / "));
  log("プレイ期間：" + maxMonth + "ヶ月");
  log("🎯 今回の目的地：" + randomGoal.name);

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
