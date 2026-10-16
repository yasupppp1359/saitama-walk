// ========================================
// events.js - ランダムイベント
// ========================================

const EVENTS = [
  // ===== 良いイベント =====
  { name:"🎁 福引大会", run: (p) => {
      if (p.cards.length >= 10) {
        log("🎁 福引大会！ でも " + p.name + " の手札が一杯…");
        return;
      }
      const ids = Object.keys(CARDS);
      const cid = ids[Math.floor(Math.random() * ids.length)];
      p.cards.push(cid);
      log("🎁 " + p.name + " 福引大会で " + CARDS[cid].name + " を獲得！");
  }},

  { name:"🚴 サイクリング日和", run: (p) => {
      const gain = (Math.floor(Math.random() * 5) + 3) * 1000000;
      p.money += gain;
      log("🚴 " + p.name + " サイクリングで爽快 +" + ky(gain));
  }},

  { name:"🍡 団子屋発見", run: (p) => {
      const gain = (Math.floor(Math.random() * 3) + 1) * 1000000;
      p.money += gain;
      log("🍡 " + p.name + " 美味しい団子 +" + ky(gain));
  }},

  { name:"💰 宝くじ当選", run: (p) => {
      const gain = (Math.floor(Math.random() * 10) + 5) * 1000000;
      p.money += gain;
      log("💰 " + p.name + " 宝くじ当選！ +" + ky(gain));
  }},

  { name:"📺 テレビ取材", run: (p) => {
      const owned = ALL_PROPS.filter(x => x.owner === p.id);
      if (owned.length === 0) {
        log("📺 " + p.name + " テレビ取材（物件なし）");
        return;
      }
      const target = owned[Math.floor(Math.random() * owned.length)];
      target.price = Math.floor(target.price * 2);
      log("📺 " + p.name + " の " + target.name + " が2倍に！");
  }},

  { name:"👑 知事表彰", run: (p) => {
      const owned = ALL_PROPS.filter(x => x.owner === p.id);
      const bonus = owned.length * 500000;
      if (bonus === 0) {
        log("👑 知事表彰（物件なし）");
        return;
      }
      p.money += bonus;
      log("👑 " + p.name + " 知事表彰 " + owned.length + "件 +" + ky(bonus));
  }},

  { name:"🌸 桜まつり", run: (p) => {
      const tourism = ALL_PROPS.filter(x => x.owner === p.id && x.type === "tourism");
      if (tourism.length === 0) {
        log("🌸 桜まつり（観光地なし）");
        return;
      }
      const gain = tourism.reduce((s, x) => s + Math.floor(x.price * 0.2), 0);
      p.money += gain;
      log("🌸 " + p.name + " 桜まつり収入 +" + ky(gain));
  }},

  { name:"🏭 工場見学ツアー", run: (p) => {
      const factories = ALL_PROPS.filter(x => x.owner === p.id && x.type === "factory");
      if (factories.length === 0) {
        log("🏭 工場見学（工場なし）");
        return;
      }
      const gain = factories.reduce((s, x) => s + Math.floor(x.price * 0.1), 0);
      p.money += gain;
      log("🏭 " + p.name + " 工場見学 +" + ky(gain));
  }},

  // ===== 悪いイベント =====
  { name:"🚧 道路工事", run: (p) => {
      let cur = p.pos;
      for (let i = 0; i < 3; i++) {
        const parents = PARENTS[cur];
        if (parents.length === 0) break;
        cur = parents[Math.floor(Math.random() * parents.length)];
      }
      p.pos = cur;
      log("🚧 " + p.name + " 道路工事で3マス戻される");
      drawAllPlayers();
      applyCamera();
  }},

  { name:"🍜 ラーメン屋", run: (p) => {
      const loss = Math.floor(Math.abs(p.money) * 0.05);
      if (loss === 0) return;
      p.money -= loss;
      log("🍜 " + p.name + " ラーメン食べ過ぎ −" + ky(loss));
  }},

  { name:"🌧 台風接近", run: (p) => {
      const farms = ALL_PROPS.filter(x => x.owner === p.id && x.type === "farm");
      if (farms.length === 0) {
        log("🌧 台風（農地なし）");
        return;
      }
      const loss = farms.reduce((s, x) => s + Math.floor(x.price * 0.1), 0);
      p.money -= loss;
      log("🌧 " + p.name + " 台風で農地被害 −" + ky(loss));
  }},

  { name:"🐗 猪出没", run: (p) => {
      const loss = (Math.floor(Math.random() * 5) + 2) * 1000000;
      p.money -= loss;
      log("🐗 " + p.name + " 猪に遭遇 −" + ky(loss));
  }},

  { name:"🛌 風邪ひき", run: (p) => {
      if (p.buffs.sekubi > 0) return;
      p.buffs.sekubi = 1;
      log("🛌 " + p.name + " 風邪で1ターン休み");
  }},

  { name:"🚕 タクシー", run: (p) => {
      const stations = MAP.filter(c => c.type === CELL.STATION && c.id !== p.pos);
      if (stations.length === 0) return;
      const target = stations[Math.floor(Math.random() * stations.length)];
      p.pos = target.id;
      log("🚕 " + p.name + " タクシーで " + target.name + " へ");
      drawAllPlayers();
      applyCamera();
  }},

  { name:"🐄 牛逃走", run: (p) => {
      const ranches = ALL_PROPS.filter(x => x.owner === p.id && x.type === "ranch");
      if (ranches.length === 0) {
        log("🐄 牛逃走（牧場なし）");
        return;
      }
      const loss = ranches.reduce((s, x) => s + Math.floor(x.price * 0.1), 0);
      p.money -= loss;
      log("🐄 " + p.name + " 牛が逃げた −" + ky(loss));
  }},

  { name:"🚨 交通事故", run: (p) => {
      const loss = (Math.floor(Math.random() * 8) + 3) * 1000000;
      p.money -= loss;
      log("🚨 " + p.name + " 交通事故 −" + ky(loss));
  }},

  { name:"⛽ ガス欠", run: (p) => {
      const loss = (Math.floor(Math.random() * 3) + 1) * 1000000;
      p.money -= loss;
      log("⛽ " + p.name + " ガス欠 −" + ky(loss));
  }},

  // ===== 特殊イベント =====
  { name:"🎂 誕生日", run: (p) => {
      let total = 0;
      for (const other of players) {
        if (other === p) continue;
        const gift = Math.min(Math.max(other.money, 0), 1000000);
        if (gift > 0) {
          other.money -= gift;
          total += gift;
        }
      }
      p.money += total;
      if (total === 0) {
        log("🎂 " + p.name + " の誕生日（誰もお金なし）");
      } else {
        log("🎂 " + p.name + " の誕生日！ みんなから +" + ky(total));
      }
  }},

  { name:"📦 落とし物", run: (p) => {
      if (Math.random() < 0.5) {
        const gain = (Math.floor(Math.random() * 5) + 1) * 1000000;
        p.money += gain;
        log("📦 " + p.name + " 落とし物で +" + ky(gain));
      } else {
        if (p.cards.length < 10) {
          const ids = Object.keys(CARDS);
          const cid = ids[Math.floor(Math.random() * ids.length)];
          p.cards.push(cid);
          log("📦 " + p.name + " 落とし物で " + CARDS[cid].name + " を拾った！");
        } else {
          log("📦 落とし物（手札一杯）");
        }
      }
  }},

  { name:"🏪 商店街抽選", run: (p) => {
      const r = Math.random();
      if (r < 0.3) {
        const gain = 5000000;
        p.money += gain;
        log("🏪 " + p.name + " 商店街抽選 1等 +" + ky(gain));
      } else if (r < 0.6) {
        const gain = 1000000;
        p.money += gain;
        log("🏪 " + p.name + " 商店街抽選 2等 +" + ky(gain));
      } else {
        log("🏪 " + p.name + " 商店街抽選 はずれ");
      }
  }},

  { name:"🎓 埼玉検定", run: (p) => {
      const r = Math.random();
      if (r < 0.5) {
        const gain = 3000000;
        p.money += gain;
        log("🎓 " + p.name + " 埼玉検定合格！ +" + ky(gain));
      } else {
        log("🎓 " + p.name + " 埼玉検定不合格…");
      }
  }},
];

// ===== イベント発動 =====
function triggerRandomEvent() {
  const ev = EVENTS[Math.floor(Math.random() * EVENTS.length)];
  log("✨ イベント発生！ " + ev.name);
  ev.run(player);
  updateHUD();
}