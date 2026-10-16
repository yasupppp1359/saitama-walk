// ========================================
// start.js - ゲーム開始画面
// ========================================

const HUMAN_ICONS = ["🧑", "🧑‍🌾", "🧑‍💼", "🧑‍🚀"];
const HUMAN_ICON_LABELS = ["旅人", "農家", "実業家", "冒険家"];

const startConfig = {
  humans: 1,
  cpus: 3,
  months: 12,
  humanPlayers: [
    { name: "プレイヤー1", icon: "🧑" }
  ],
  cpuLevels: [1, 2, 3],
};

function showStartScreen() {
  buildHumanCountButtons();
  buildCpuCountButtons();
  buildMonthsButtons();
  refreshPlayerInputs();
  refreshCpuInputs();
}

function buildHumanCountButtons() {
  const g = document.getElementById("humanCountGroup");
  g.innerHTML = "";
  for (let n = 1; n <= 4; n++) {
    const b = document.createElement("button");
    b.textContent = n + "人";
    b.dataset.val = n;
    if (n === startConfig.humans) b.classList.add("selected");
    b.onclick = () => {
      startConfig.humans = n;
      const maxCpu = 4 - n;
      if (startConfig.cpus > maxCpu) startConfig.cpus = maxCpu;
      while (startConfig.humanPlayers.length < n) {
        startConfig.humanPlayers.push({
          name: "プレイヤー" + (startConfig.humanPlayers.length + 1),
          icon: HUMAN_ICONS[startConfig.humanPlayers.length % 4],
        });
      }
      while (startConfig.humanPlayers.length > n) {
        startConfig.humanPlayers.pop();
      }
      while (startConfig.cpuLevels.length < startConfig.cpus) {
        startConfig.cpuLevels.push(Math.min(3, startConfig.cpuLevels.length + 1));
      }
      while (startConfig.cpuLevels.length > startConfig.cpus) {
        startConfig.cpuLevels.pop();
      }
      refreshAll();
    };
    g.appendChild(b);
  }
}

function buildCpuCountButtons() {
  const g = document.getElementById("cpuCountGroup");
  g.innerHTML = "";
  const maxCpu = 4 - startConfig.humans;
  for (let n = 0; n <= maxCpu; n++) {
    const b = document.createElement("button");
    b.textContent = n + "人";
    b.dataset.val = n;
    if (n === startConfig.cpus) b.classList.add("selected");
    b.onclick = () => {
      startConfig.cpus = n;
      while (startConfig.cpuLevels.length < n) {
        startConfig.cpuLevels.push(Math.min(3, startConfig.cpuLevels.length + 1));
      }
      while (startConfig.cpuLevels.length > n) {
        startConfig.cpuLevels.pop();
      }
      refreshAll();
    };
    g.appendChild(b);
  }
}

function buildMonthsButtons() {
  const g = document.getElementById("monthsGroup");
  g.innerHTML = "";
  for (const n of [1, 3, 6, 9, 12]) {
    const b = document.createElement("button");
    b.textContent = n + "ヶ月";
    b.dataset.val = n;
    if (n === startConfig.months) b.classList.add("selected");
    b.onclick = () => {
      startConfig.months = n;
      refreshAll();
    };
    g.appendChild(b);
  }
}

function refreshPlayerInputs() {
  const container = document.getElementById("playerInputs");
  container.innerHTML = "";
  for (let i = 0; i < startConfig.humans; i++) {
    const row = document.createElement("div");
    row.className = "playerRow";

    const label = document.createElement("div");
    label.className = "label";
    label.textContent = "👤 プレイヤー" + (i + 1);
    row.appendChild(label);

    const nameInput = document.createElement("input");
    nameInput.className = "nameInput";
    nameInput.type = "text";
    nameInput.maxLength = 8;
    nameInput.value = startConfig.humanPlayers[i].name;
    nameInput.placeholder = "名前";
    nameInput.oninput = () => {
      startConfig.humanPlayers[i].name = nameInput.value || ("プレイヤー" + (i + 1));
    };
    row.appendChild(nameInput);

    const iconSel = document.createElement("div");
    iconSel.className = "iconSel";
    for (let k = 0; k < HUMAN_ICONS.length; k++) {
      const ib = document.createElement("button");
      ib.textContent = HUMAN_ICONS[k];
      ib.title = HUMAN_ICON_LABELS[k];
      if (startConfig.humanPlayers[i].icon === HUMAN_ICONS[k]) {
        ib.classList.add("selected");
      }
      ib.onclick = () => {
        startConfig.humanPlayers[i].icon = HUMAN_ICONS[k];
        refreshPlayerInputs();
      };
      iconSel.appendChild(ib);
    }
    row.appendChild(iconSel);
    container.appendChild(row);
  }
}

function refreshCpuInputs() {
  const container = document.getElementById("cpuInputs");
  const section = document.getElementById("cpuSection");
  container.innerHTML = "";

  if (startConfig.cpus === 0) {
    section.style.display = "none";
    return;
  }
  section.style.display = "";

  for (let i = 0; i < startConfig.cpus; i++) {
    const row = document.createElement("div");
    row.className = "playerRow";

    const label = document.createElement("div");
    label.className = "label";
    label.textContent = "🤖 CPU" + (i + 1);
    row.appendChild(label);

    const levelSel = document.createElement("div");
    levelSel.className = "levelSel";
    const levels = [
      { val: 1, name: "庶民" },
      { val: 2, name: "ベテラン" },
      { val: 3, name: "生粋の埼玉県民" },
    ];
    for (const lv of levels) {
      const b = document.createElement("button");
      b.textContent = lv.name;
      if (startConfig.cpuLevels[i] === lv.val) b.classList.add("selected");
      b.onclick = () => {
        startConfig.cpuLevels[i] = lv.val;
        refreshCpuInputs();
      };
      levelSel.appendChild(b);
    }
    row.appendChild(levelSel);
    container.appendChild(row);
  }
}

function refreshAll() {
  document.querySelectorAll("#humanCountGroup button").forEach(b => {
    b.classList.toggle("selected", Number(b.dataset.val) === startConfig.humans);
  });
  document.querySelectorAll("#monthsGroup button").forEach(b => {
    b.classList.toggle("selected", Number(b.dataset.val) === startConfig.months);
  });
  buildCpuCountButtons();
  refreshPlayerInputs();
  refreshCpuInputs();
}

// ===== ゲームスタートボタン =====
document.getElementById("startBtn").onclick = () => {
  // ★ 新規開始時にオートセーブをクリア
  localStorage.removeItem("saitama_auto");

  for (let i = 0; i < startConfig.humanPlayers.length; i++) {
    if (!startConfig.humanPlayers[i].name ||
        startConfig.humanPlayers[i].name.trim() === "") {
      startConfig.humanPlayers[i].name = "プレイヤー" + (i + 1);
    }
  }
  if (typeof window.startGame === "function") {
    window.startGame({
      humans: startConfig.humans,
      cpus: startConfig.cpus,
      months: startConfig.months,
      humanPlayers: startConfig.humanPlayers.map(p => ({ ...p })),
      cpuLevels: [...startConfig.cpuLevels],
    });
  } else {
    alert("startGame が見つかりません");
  }
};

// ===== 起動 =====
showStartScreen();
