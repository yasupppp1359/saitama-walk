// ========================================
// properties.js - 物件システム（バランス調整版）
// ========================================

const PROP_TYPES = {
  farm:    { name:"農地",   icon:"🌾", rate:0.12, harvest:0.30, sellable:true },
  factory: { name:"工場",   icon:"🏭", rate:0.18, sellable:true },
  tourism: { name:"観光地", icon:"🎡", rate:0.25, sellable:true },
  ranch:   { name:"牧場",   icon:"🐄", rate:0.06, sellable:false },
  water:   { name:"水道局", icon:"🚰", rate:0.06, sellable:false },
};

const PROP_PRICE = {
  farm:    { min:500,   max:3000 },
  factory: { min:2000,  max:10000 },
  tourism: { min:5000,  max:30000 },
  ranch:   { min:5000,  max:5000 },
  water:   { min:5000,  max:5000 },
};

const REGION_MIX = {
  north:  [["farm",0.60],["factory",0.30],["tourism",0.10]],
  east:   [["farm",0.40],["factory",0.40],["tourism",0.20]],
  center: [["farm",0.20],["factory",0.60],["tourism",0.20]],
  west:   [["farm",0.30],["factory",0.30],["tourism",0.40]],
};

const SPECIAL_PROPS = {
  konosu:   "ranch",
  chichibu: "ranch",
  kasukabe: "water",
};

const SELL_RATE = 0.7;

function pickWeighted(mix) {
  const r = Math.random();
  let cum = 0;
  for (const [type, w] of mix) {
    cum += w;
    if (r < cum) return type;
  }
  return mix[0][0];
}

const ALL_PROPS = [];

function generateProperties(stationIdToCellId) {
  let id = 0;
  for (const st of STATIONS) {
    if (st.kind !== "goal" && st.kind !== "prop") continue;
    const count = 5 + Math.floor(Math.random() * 4);
    const mix = REGION_MIX[st.region] || REGION_MIX.center;
    const special = SPECIAL_PROPS[st.id];
    const cellId = stationIdToCellId[st.id];

    for (let i = 0; i < count; i++) {
      let type;
      if (special && i === 0) type = special;
      else type = pickWeighted(mix);

      const p = PROP_PRICE[type];
      const price = (p.min + Math.floor(Math.random() * (p.max - p.min + 1))) * 10000;

      ALL_PROPS.push({
        id: id++,
        stationId: st.id,
        stationCellId: cellId,
        type: type,
        name: st.name + "の" + PROP_TYPES[type].name,
        price: price,
        owner: null,
      });
    }
  }
}

function getPropsAtStation(cellId) {
  return ALL_PROPS.filter(p => p.stationCellId === cellId);
}

function ownsAllStation(playerId, cellId) {
  const props = getPropsAtStation(cellId);
  if (props.length === 0) return false;
  return props.every(p => p.owner === playerId);
}

function buyProperty(propId) {
  const prop = ALL_PROPS.find(p => p.id === propId);
  if (!prop || prop.owner !== null) return false;
  if (player.money < prop.price) return false;
  player.money -= prop.price;
  prop.owner = player.id;
  return true;
}

function canSellProperty(prop) {
  return PROP_TYPES[prop.type].sellable;
}

function sellProperty(propId) {
  const prop = ALL_PROPS.find(p => p.id === propId);
  if (!prop) return false;
  if (prop.owner !== player.id) return false;
  if (!canSellProperty(prop)) return false;

  const sellPrice = Math.floor(prop.price * SELL_RATE);
  player.money += sellPrice;
  prop.owner = null;
  return sellPrice;
}

function getSellPrice(prop) {
  return Math.floor(prop.price * SELL_RATE);
}

function getPlayerProperties(p) {
  return ALL_PROPS.filter(x => x.owner === p.id);
}

function payPropertyIncome() {
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

  if (total > 0) {
    player.money += total;
    log("💰 ボーナス日！ " + player.name + " 物件収入 +" + ky(total));
  } else {
    log("💰 " + player.name + " ボーナス日（物件収入なし）");
  }
  return total;
}

// ===== インフレ倍率（10日ごと1.1倍、月ごと1.25倍） =====
function getInflationMultiplier() {
  const period = Math.floor((day - 1) / 10);
  const monthBonus = Math.pow(1.25, month - 1);
  return Math.pow(1.1, period) * monthBonus;
}