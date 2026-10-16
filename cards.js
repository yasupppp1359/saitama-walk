// ========================================
// cards.js - カード定義（全カード完全実装）
// ========================================

const CARDS = {};
const mk = (name, cat, icon, desc, outcome, use) =>
  ({ name, cat, icon, desc, outcome, use });
const rand = (a, b) => a + Math.floor(Math.random() * (b - a + 1));

// ===== グローバル状態 =====
let globalSeal = 0;   // 封印残ターン
let ohimeHolder = null; // お姫様を持つプレイヤー

// --- 移動系 ---
CARDS.kakekko = mk("かけっこ","move","🏃","サイコロ2つ","roll", () => {
  thisTurn.diceCount = 2;
  log("🏃 サイコロが2つに！");
});
CARDS.renchanKakekko = mk("連チャンかけっこ","move","🏃‍♂️","20%で消滅までサイコロ2つ","roll", () => {
  thisTurn.diceCount = 2;
  player.buffs.renchanKakekko = true;
  log("🏃‍♂️ 連チャンかけっこ発動！");
});
CARDS.dash = mk("ダッシュ","move","💨","サイコロ3つ","roll", () => {
  thisTurn.diceCount = 3;
  log("💨 サイコロが3つに！");
});
CARDS.renchanDash = mk("連チャンダッシュ","move","💨","25%で消滅までサイコロ3つ","roll", () => {
  thisTurn.diceCount = 3;
  player.buffs.renchanDash = true;
  log("💨 連チャンダッシュ発動！");
});
CARDS.spacia = mk("スペーシア","move","🚄","サイコロ5つ","roll", () => {
  thisTurn.diceCount = 5;
  log("🚄 サイコロが5つに！");
});

for (let n = 1; n <= 10; n++) {
  CARDS["step" + n] = mk(`${n}マス進む`,"move","👣",`必ず${n}マス進む`,"move", () => {
    startFixedMove(n);
  });
}
CARDS.shirakobato = mk("しらこばと","move","🦢","必ず30マス進む","move", () => {
  startFixedMove(30);
});

// --- ワープ系 ---
CARDS.suttobi = mk("すっとび","warp","✨","ランダムな場所へ","end", () => {
  warpRandom(player);
});
CARDS.suttobiMakuri = mk("すっとびまくり","warp","🌀","25%で消滅までランダムワープ","end", () => {
  player.buffs.suttobiMakuri = true;
  warpRandom(player);
});
CARDS.minnaSuttobi = mk("みんなですっとび","warp","👥","全員ランダムワープ","end", () => {
  for (const p of players) {
    warpRandom(p);
  }
  drawAllPlayers();
  applyCamera();
  log("👥 みんなでワープ！");
});
CARDS.unWo = mk("運を天に任せ","warp","🎲","15%ゴール / 50%近く / 35%遠く","end", () => {
  luckWarp();
});

// --- 物件系 ---
CARDS.tsuuhan = mk("通販","prop","📦","買える最高額の物件を購入","end", () => {
  // 空き物件のうち、手持ちで買える最高額
  const available = ALL_PROPS.filter(x => x.owner === null && x.price <= player.money);
  if (available.length === 0) {
    log("📦 買える物件がありません");
    return;
  }
  available.sort((a, b) => b.price - a.price);
  const target = available[0];
  if (buyProperty(target.id)) {
    log("📦 通販で " + target.name + " を購入！ (" + ky(target.price) + ")");
    drawBoard();
    updateHUD();
  }
});

CARDS.yahho = mk("ヤッホー","prop","🏔️","止まった物件マスで半額購入","end", () => {
  const cell = CELL_BY_ID[player.pos];
  if (!cell || cell.kind !== "prop") {
    log("🏔️ 物件マスにいないため使えません");
    return;
  }
  const props = getPropsAtStation(player.pos).filter(x => x.owner === null);
  if (props.length === 0) {
    log("🏔️ 買える物件がありません");
    return;
  }
  // 最高額を半額で
  props.sort((a, b) => b.price - a.price);
  const target = props[0];
  const halfPrice = Math.floor(target.price / 2);
  if (player.money < halfPrice) {
    log("🏔️ 資金不足（半額でも " + ky(halfPrice) + " 必要）");
    return;
  }
  player.money -= halfPrice;
  target.owner = player.id;
  log("🏔️ " + target.name + " を半額 " + ky(halfPrice) + " で購入！");
  drawBoard();
  updateHUD();
});

CARDS.dCard = mk("Dカード","prop","💳","そのマスの物件20%引き","end", () => {
  const cell = CELL_BY_ID[player.pos];
  if (!cell || cell.kind !== "prop") {
    log("💳 物件マスにいないため使えません");
    return;
  }
  const props = getPropsAtStation(player.pos).filter(x => x.owner === null);
  if (props.length === 0) {
    log("💳 買える物件がありません");
    return;
  }
  let bought = 0;
  for (const p of props) {
    const dPrice = Math.floor(p.price * 0.8);
    if (player.money >= dPrice) {
      player.money -= dPrice;
      p.owner = player.id;
      bought++;
      log("💳 " + p.name + " を20%引き " + ky(dPrice) + " で購入");
    }
  }
  if (bought === 0) log("💳 資金不足");
  drawBoard();
  updateHUD();
});

CARDS.yokodori = mk("横取り","prop","🤚","他人の物件を1件横取り","end", () => {
  const candidates = [];
  for (const p of players) {
    if (p === player) continue;
    const owned = ALL_PROPS.filter(x => x.owner === p.id && canSellProperty(x));
    for (const prop of owned) candidates.push({ prop, victim: p });
  }
  if (candidates.length === 0) {
    log("🤚 横取りできる物件がありません");
    return;
  }
  const pick = candidates[Math.floor(Math.random() * candidates.length)];
  pick.prop.owner = player.id;
  log("🤚 " + player.name + " が " + pick.victim.name + " から " + pick.prop.name + " を横取り！");
  drawBoard();
  updateHUD();
});

// --- 便利系 ---
CARDS.yellow = mk("イエロー","util","🟡","青赤マスが黄色になる（30%で解除）","roll", () => {
  player.buffs.yellow = true;
  log("🟡 イエロー発動！");
});

CARDS.cardDorobo = mk("カード泥棒","util","🕵️","他人のカードを1枚奪う","end", () => {
  const others = players.filter(p => p !== player && p.cards.length > 0);
  if (others.length === 0) {
    log("🕵️ 奪える相手がいません");
    return;
  }
  const victim = others[Math.floor(Math.random() * others.length)];
  const idx = Math.floor(Math.random() * victim.cards.length);
  const stolen = victim.cards.splice(idx, 1)[0];
  if (player.cards.length < 10) {
    player.cards.push(stolen);
    log("🕵️ " + player.name + " が " + victim.name + " から " + CARDS[stolen].name + " を奪った！");
  } else {
    log("🕵️ 手札一杯で奪えず…");
  }
});

CARDS.gizo = mk("偽造","util","🖨️","保有カードを1枚コピー","end", () => {
  if (player.cards.length === 0) { log("📭 コピーできるカードがありません"); return; }
  if (player.cards.length >= 10) { log("📭 手札が一杯"); return; }
  const cid = player.cards[Math.floor(Math.random() * player.cards.length)];
  player.cards.push(cid);
  log("🖨️ " + CARDS[cid].name + " をコピー！");
});

CARDS.fukubiki = mk("福引","util","🎯","移動系カードを1〜2枚獲得","end", () => {
  const moveIds = Object.keys(CARDS).filter(k => CARDS[k].cat === "move");
  const n = rand(1, 2);
  for (let i = 0; i < n; i++) {
    const cid = moveIds[Math.floor(Math.random() * moveIds.length)];
    if (player.cards.length < 10) {
      player.cards.push(cid);
      log("🎯 " + CARDS[cid].name + " を獲得！");
    }
  }
});

CARDS.vacuum = mk("バキューム","util","🧹","うんちを全除去","roll", () => {
  poos.clear();
  log("🧹 うんちを全除去！");
  redrawYellowed();
});

CARDS.uchide = mk("打出の小槌","util","🔨","2〜5回ランダムできゅん","end", () => {
  const times = rand(2, 5);
  let total = 0;
  for (let i = 0; i < times; i++) {
    total += (Math.floor(Math.random() * 10) + 1) * 1000000;
  }
  player.money += total;
  log("🔨 " + times + "回で +" + ky(total));
});

// --- お金系 ---
CARDS.crayon = mk("クレヨン","money","🖍️","3〜7ターン毎ターンきゅん","roll", () => {
  const t = rand(3, 7);
  player.buffs.crayon = t;
  log("🖍️ クレヨンちゃん " + t + "ターン");
});

CARDS.heiwa = mk("平和が1番","money","🕊️","全員の資金を平均化","roll", () => {
  const total = players.reduce((sum, p) => sum + p.money, 0);
  const avg = Math.floor(total / players.length);
  for (const p of players) {
    const diff = avg - p.money;
    p.money = avg;
    const sign = diff >= 0 ? "+" : "";
    log("🕊️ " + p.name + " " + sign + ky(diff));
  }
  log("🕊️ 全員 " + ky(avg) + " に平均化！");
  updateHUD();
});

CARDS.ohime = mk("お姫様","money","👑","次のゴール同額を貰う","roll", () => {
  player.buffs.ohime = true;
  log("👑 " + player.name + " がお姫様に！");
});

CARDS.tokusei = mk("徳政令","money","📜","マイナス資金を0に","end", () => {
  let count = 0;
  for (const p of players) {
    if (p.money < 0) {
      p.money = 0;
      count++;
      log("📜 " + p.name + " の借金帳消し");
    }
  }
  if (count === 0) log("📜 借金はありません");
  updateHUD();
});

CARDS.happy = mk("ハッピー","money","😊","次のゴール賞金2倍","end", () => {
  player.buffs.happy = true;
  log("😊 ハッピー保持");
});

CARDS.osusowake = mk("おすそ分け","money","🤲","5ターン他人の青マス収入と同額","roll", () => {
  player.buffs.osusowake = 5;
  log("🤲 おすそ分け 5ターン");
});

CARDS.gokenin = mk("保護者","money","🛡️","借金を他人が肩代わり","end", () => {
  if (player.money >= 0) {
    log("🛡️ 借金がありません");
    return;
  }
  const others = players.filter(p => p !== player && p.money > 0);
  if (others.length === 0) {
    log("🛡️ 肩代わりできる相手がいません");
    return;
  }
  const debt = -player.money;
  others.sort((a, b) => b.money - a.money);
  const guard = others[0];
  const pay = Math.min(debt, guard.money);
  guard.money -= pay;
  player.money += pay;
  log("🛡️ " + guard.name + " が " + ky(pay) + " を肩代わり");
  if (player.money >= 0) {
    log("✅ 借金完済！");
  }
  updateHUD();
});

// --- お邪魔系 ---
CARDS.poo = mk("うんち","jama","💩","ランダムなマスにうんち","end", () => {
  placeRandomPoo();
});

CARDS.nonbiri = mk("のんびり","jama","🐌","ランダムな相手を弱体化","end", () => {
  const others = players.filter(p => p !== player);
  if (others.length === 0) { log("🐌 対象なし"); return; }
  const victim = others[Math.floor(Math.random() * others.length)];
  const turns = rand(3, 5);
  victim.buffs.nonbiri = turns;
  log("🐌 " + victim.name + " が " + turns + "ターン のんびり状態に");
});

CARDS.abarenbo = mk("暴れん坊","jama","💢","ランダムな相手のカードを1枚消す","end", () => {
  const others = players.filter(p => p !== player && p.cards.length > 0);
  if (others.length === 0) { log("💢 対象なし"); return; }
  const victim = others[Math.floor(Math.random() * others.length)];
  const idx = Math.floor(Math.random() * victim.cards.length);
  const destroyed = victim.cards.splice(idx, 1)[0];
  log("💢 " + victim.name + " の " + CARDS[destroyed].name + " を破壊！");
});

CARDS.fuuin = mk("封印","jama","🔒","全員カード使用不可（3ターン）","end", () => {
  globalSeal = 3;
  log("🔒 全員カード封印！ 3ターン");
});

CARDS.sokoJanai = mk("そこじゃないよ","jama","🚫","ゴールを変更","end", () => {
  changeGoal();
});

CARDS.sekubi = mk("セクビ","jama","😴","ランダムな相手を5ターン休み","end", () => {
  const others = players.filter(p => p !== player);
  if (others.length === 0) { log("😴 対象なし"); return; }
  const victim = others[Math.floor(Math.random() * others.length)];
  victim.buffs.sekubi = 5;
  log("😴 " + victim.name + " が5ターン休み！");
});