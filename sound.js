// ========================================
// sound.js - Web Audio API音響システム
// ========================================

let audioCtx = null;
let masterGain = null;
let bgmGain = null;
let sfxGain = null;
let bgmTimer = null;
let muted = false;

function initAudio() {
  if (audioCtx) return;
  try {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    masterGain = audioCtx.createGain();
    masterGain.gain.value = 0.5;
    masterGain.connect(audioCtx.destination);

    bgmGain = audioCtx.createGain();
    bgmGain.gain.value = 0.15;
    bgmGain.connect(masterGain);

    sfxGain = audioCtx.createGain();
    sfxGain.gain.value = 0.6;
    sfxGain.connect(masterGain);
  } catch (e) {
    console.warn("Audio init failed:", e);
  }
}

// ユーザー操作で初期化（ブラウザポリシー対応）
document.addEventListener("click", () => {
  initAudio();
  if (audioCtx && audioCtx.state === "suspended") {
    audioCtx.resume();
  }
}, { once: false });

// ===== 単音を鳴らす =====
function tone(freq, duration, type, dest, startTime, vol) {
  if (!audioCtx) return;
  const t0 = startTime || audioCtx.currentTime;
  const osc = audioCtx.createOscillator();
  const g = audioCtx.createGain();
  osc.type = type || "sine";
  osc.frequency.setValueAtTime(freq, t0);
  g.gain.setValueAtTime(0, t0);
  g.gain.linearRampToValueAtTime(vol || 0.3, t0 + 0.01);
  g.gain.exponentialRampToValueAtTime(0.001, t0 + duration);
  osc.connect(g);
  g.connect(dest || sfxGain);
  osc.start(t0);
  osc.stop(t0 + duration + 0.05);
}

// ===== 周波数スイープ =====
function sweep(f1, f2, duration, type, dest) {
  if (!audioCtx) return;
  const t0 = audioCtx.currentTime;
  const osc = audioCtx.createOscillator();
  const g = audioCtx.createGain();
  osc.type = type || "sine";
  osc.frequency.setValueAtTime(f1, t0);
  osc.frequency.exponentialRampToValueAtTime(f2, t0 + duration);
  g.gain.setValueAtTime(0.3, t0);
  g.gain.exponentialRampToValueAtTime(0.001, t0 + duration);
  osc.connect(g);
  g.connect(dest || sfxGain);
  osc.start(t0);
  osc.stop(t0 + duration + 0.05);
}

// ===== 効果音 =====
const SOUNDS = {
  // ボタン押下
  pop: () => {
    tone(800, 0.08, "sine", sfxGain);
  },

  // サイコロ
  dice: () => {
    if (!audioCtx) return;
    const t0 = audioCtx.currentTime;
    for (let i = 0; i < 4; i++) {
      tone(300 + Math.random() * 400, 0.05, "square", sfxGain, t0 + i * 0.06, 0.2);
    }
  },

  // お金（チャリン）
  coin: () => {
    if (!audioCtx) return;
    const t0 = audioCtx.currentTime;
    tone(1200, 0.08, "sine", sfxGain, t0, 0.3);
    tone(1800, 0.15, "sine", sfxGain, t0 + 0.05, 0.25);
  },

  // マイナス（ブブー）
  buzzer: () => {
    tone(150, 0.3, "sawtooth", sfxGain, null, 0.25);
  },

  // カード入手（カシャ）
  card: () => {
    if (!audioCtx) return;
    const t0 = audioCtx.currentTime;
    tone(600, 0.05, "triangle", sfxGain, t0, 0.25);
    tone(900, 0.08, "triangle", sfxGain, t0 + 0.05, 0.25);
  },

  // イベント発生
  event: () => {
    if (!audioCtx) return;
    const t0 = audioCtx.currentTime;
    [523, 659, 784, 1046].forEach((f, i) => {
      tone(f, 0.12, "sine", sfxGain, t0 + i * 0.08, 0.25);
    });
  },

  // ゴール（ファンファーレ）
  goal: () => {
    if (!audioCtx) return;
    const t0 = audioCtx.currentTime;
    [523, 659, 784, 1046, 1318].forEach((f, i) => {
      tone(f, 0.18, "triangle", sfxGain, t0 + i * 0.12, 0.3);
    });
    tone(1568, 0.6, "triangle", sfxGain, t0 + 0.6, 0.35);
  },

  // 勝利
  victory: () => {
    if (!audioCtx) return;
    const t0 = audioCtx.currentTime;
    [523, 659, 784, 1046, 784, 1046, 1318].forEach((f, i) => {
      tone(f, 0.22, "triangle", sfxGain, t0 + i * 0.18, 0.3);
    });
  },

  // 移動（コマ移動）
  move: () => {
    tone(500, 0.05, "sine", sfxGain, null, 0.15);
  },

  // ワープ
  warp: () => {
    sweep(200, 2000, 0.4, "sine", sfxGain);
  },

  // うんち
  poo: () => {
    if (!audioCtx) return;
    const t0 = audioCtx.currentTime;
    tone(200, 0.1, "sawtooth", sfxGain, t0, 0.3);
    tone(150, 0.2, "sawtooth", sfxGain, t0 + 0.1, 0.3);
  },

  // 借金警告
  debt: () => {
    if (!audioCtx) return;
    const t0 = audioCtx.currentTime;
    for (let i = 0; i < 3; i++) {
      tone(220, 0.15, "square", sfxGain, t0 + i * 0.2, 0.25);
    }
  },
};

// ===== 効果音を再生 =====
function playSound(name) {
  initAudio();
  if (!audioCtx || muted) return;
  if (audioCtx.state === "suspended") audioCtx.resume();
  const fn = SOUNDS[name];
  if (fn) fn();
}

// ===== BGM =====
// 簡単な和風8小節ループ
const BGM_NOTES = [
  // [周波数, 長さ（拍）]
  [523.25, 1], // ド
  [587.33, 1], // レ
  [659.25, 1], // ミ
  [523.25, 1], // ド
  [440.00, 2], // ラ
  [523.25, 2], // ド
  [659.25, 1], // ミ
  [587.33, 1], // レ
  [523.25, 2], // ド
  [440.00, 2], // ラ
  [392.00, 1], // ソ
  [440.00, 1], // ラ
  [523.25, 2], // ド
];

const BGM_BASS = [
  [130.81, 4], // ド
  [174.61, 4], // ファ
  [196.00, 4], // ソ
  [130.81, 4], // ド
];

let bgmPlaying = false;
let bgmStartTime = 0;

function startBGM() {
  initAudio();
  if (!audioCtx || bgmPlaying) return;
  bgmPlaying = true;
  bgmStartTime = audioCtx.currentTime;

  // ループをスケジュール
  scheduleBGM(0);
  // 8秒ごとに再スケジュール
  bgmTimer = setInterval(() => {
    if (!bgmPlaying) return;
    scheduleBGM(audioCtx.currentTime + 0.1);
  }, 7000);
}

function scheduleBGM(startAt) {
  if (!audioCtx || muted) return;
  const beat = 0.35; // 1拍の秒数

  let t = startAt;
  for (const [freq, len] of BGM_NOTES) {
    const dur = len * beat;
    const osc = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(freq, t);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.12, t + 0.03);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur * 0.9);
    osc.connect(g);
    g.connect(bgmGain);
    osc.start(t);
    osc.stop(t + dur);
    t += dur;
  }

  // ベース
  let tb = startAt;
  for (const [freq, len] of BGM_BASS) {
    const dur = len * beat;
    const osc = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(freq, tb);
    g.gain.setValueAtTime(0, tb);
    g.gain.linearRampToValueAtTime(0.15, tb + 0.05);
    g.gain.exponentialRampToValueAtTime(0.001, tb + dur * 0.95);
    osc.connect(g);
    g.connect(bgmGain);
    osc.start(tb);
    osc.stop(tb + dur);
    tb += dur;
  }
}

function stopBGM() {
  bgmPlaying = false;
  if (bgmTimer) {
    clearInterval(bgmTimer);
    bgmTimer = null;
  }
  if (bgmGain) {
    bgmGain.gain.setValueAtTime(bgmGain.gain.value, audioCtx.currentTime);
    bgmGain.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 0.5);
    setTimeout(() => {
      if (bgmGain && !muted) {
        bgmGain.gain.value = 0.15;
      }
    }, 600);
  }
}

// ===== ミュート切替 =====
function toggleMute() {
  initAudio();
  muted = !muted;
  if (masterGain) {
    masterGain.gain.value = muted ? 0 : 0.5;
  }
  if (muted) {
    stopBGM();
  } else {
    startBGM();
  }
  return muted;
}

function isMuted() {
  return muted;
}