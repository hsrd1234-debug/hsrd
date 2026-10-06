const fs = require('fs');

const boardB64 = fs.readFileSync('board.b64.txt', 'utf8').trim();
const titleB64 = fs.readFileSync('title.b64.txt', 'utf8').trim();
const avatarB64 = fs.readFileSync('avatar.b64.txt', 'utf8').trim();

// Read CSS
const css = fs.readFileSync('styles.css', 'utf8');

const jsCode = `
// Game Engine and State Management
(function() {
  'use strict';

  // Constants
  const RAW_BOARD_URL = "https://raw.githubusercontent.com/cs0028monglish-cmd/pictures-for-my-site-/main/snakes%20and%20Ladder.png";
  const RAW_TITLE_URL = "https://raw.githubusercontent.com/cs0028monglish-cmd/pictures-for-my-site-/main/title%20for%20snakes%20and%20ladder%20.png";
  const RAW_AVATAR_URL = "https://raw.githubusercontent.com/cs0028monglish-cmd/pictures-for-my-site-/main/snakes%20and%20ladder%203.png";

  const PLAYER_COLORS = ['#ff5d66', '#1878ee', '#18a75b', '#8a4de1', '#ef8b20'];
  const DEFAULT_NAMES = ['P1', 'P2', 'P3', 'P4', 'P5'];
  const LADDERS = { 2: 9, 7: 14, 12: 19 };
  const SNAKES = { 11: 10, 13: 8, 15: 6 };

  // 5 repeating question icon colors per column
  const COL_COLORS = ['q-col-1', 'q-col-2', 'q-col-3', 'q-col-4', 'q-col-5'];

  // Audio Context
  let audioCtx = null;
  function getAudioCtx() {
    if (!audioCtx) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (AudioContextClass) audioCtx = new AudioContextClass();
    }
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
    return audioCtx;
  }

  const soundFx = {
    playTone: function(freq, duration, type = 'sine', gainVal = 0.15) {
      if (!state.soundEnabled) return;
      try {
        const ctx = getAudioCtx();
        if (!ctx) return;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, ctx.currentTime);
        gain.gain.setValueAtTime(gainVal, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + duration);
      } catch (e) {
        console.error(e);
      }
    },
    save: function() {
      if (!state.soundEnabled) return;
      this.playTone(523.25, 0.15, 'triangle');
      setTimeout(() => this.playTone(659.25, 0.25, 'triangle'), 120);
    },
    roll: function() {
      if (!state.soundEnabled) return;
      for (let i = 0; i < 6; i++) {
        setTimeout(() => this.playTone(200 + Math.random() * 350, 0.06, 'square', 0.08), i * 80);
      }
    },
    step: function() {
      if (!state.soundEnabled) return;
      this.playTone(480, 0.1, 'sine', 0.2);
    },
    blocked: function() {
      if (!state.soundEnabled) return;
      this.playTone(180, 0.3, 'sawtooth', 0.15);
    },
    ladder: function() {
      if (!state.soundEnabled) return;
      const notes = [261.63, 329.63, 392.00, 523.25, 659.25];
      notes.forEach((f, idx) => {
        setTimeout(() => this.playTone(f, 0.2, 'triangle', 0.18), idx * 100);
      });
    },
    snake: function() {
      if (!state.soundEnabled) return;
      try {
        const ctx = getAudioCtx();
        if (!ctx) return;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(440, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(110, ctx.currentTime + 0.6);
        gain.gain.setValueAtTime(0.2, ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0.0001, ctx.currentTime + 0.6);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.6);
      } catch (e) {}
    },
    wrong: function() {
      if (!state.soundEnabled) return;
      this.playTone(220, 0.2, 'sawtooth', 0.18);
      setTimeout(() => this.playTone(196, 0.35, 'sawtooth', 0.18), 180);
    },
    correct: function() {
      if (!state.soundEnabled) return;
      this.playTone(587.33, 0.15, 'sine', 0.2);
      setTimeout(() => this.playTone(880, 0.3, 'triangle', 0.22), 140);
    },
    trophy: function() {
      if (!state.soundEnabled) return;
      const notes = [523.25, 659.25, 783.99, 1046.5];
      notes.forEach((f, idx) => {
        setTimeout(() => this.playTone(f, 0.25, 'triangle', 0.2), idx * 90);
      });
    },
    victory: function() {
      if (!state.soundEnabled) return;
      const melody = [
        { f: 523.25, d: 0.18, t: 0 },
        { f: 523.25, d: 0.18, t: 180 },
        { f: 523.25, d: 0.18, t: 360 },
        { f: 659.25, d: 0.35, t: 540 },
        { f: 783.99, d: 0.35, t: 800 },
        { f: 1046.5, d: 0.65, t: 1100 }
      ];
      melody.forEach(m => {
        setTimeout(() => this.playTone(m.f, m.d, 'triangle', 0.25), m.t);
      });
    }
  };

  // State
  const state = {
    mode: 'cpu', // 'cpu' | 'local'
    playerCount: 2,
    players: [],
    savedNames: [],
    activeIdx: 0,
    rolledValue: 0,
    isRolling: false,
    isMoving: false,
    soundEnabled: true,
    questions: Array.from({ length: 20 }, () => ({ q: '', a: '' })),
    activeModalSquare: null,
    gameOver: false,
    winner: null,
    winReason: '',
    cpuTimer: null
  };

  // Safe escape HTML
  function escapeHTML(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // LocalStorage Helpers
  function loadPersistedData() {
    try {
      const namesJson = localStorage.getItem('snakeTrailNames');
      if (namesJson) {
        const parsed = JSON.parse(namesJson);
        if (Array.isArray(parsed)) {
          state.savedNames = parsed.slice(0, 5);
        }
      }
    } catch (e) {
      console.warn('Failed to load snakeTrailNames:', e);
    }

    try {
      const questionsJson = localStorage.getItem('snakeTrailQuestions');
      if (questionsJson) {
        const parsed = JSON.parse(questionsJson);
        if (Array.isArray(parsed)) {
          for (let i = 0; i < 20; i++) {
            if (parsed[i] && typeof parsed[i] === 'object') {
              state.questions[i] = {
                q: String(parsed[i].q || '').trim(),
                a: String(parsed[i].a || '').trim()
              };
            }
          }
        }
      }
    } catch (e) {
      console.warn('Failed to load snakeTrailQuestions:', e);
    }
  }

  function saveNamesToStorage() {
    const inputs = document.querySelectorAll('.name-input');
    const newNames = [];
    inputs.forEach((input, idx) => {
      newNames.push(input.value.trim().slice(0, 22));
    });
    state.savedNames = newNames;
    try {
      localStorage.setItem('snakeTrailNames', JSON.stringify(newNames));
    } catch (e) {}

    const statusEl = document.getElementById('names-status-msg');
    if (statusEl) {
      const count = newNames.filter(n => n.length > 0).length;
      statusEl.textContent = '✓ ' + count + ' names saved';
      statusEl.className = 'names-status-msg saved';
    }
    soundFx.save();
  }

  function saveQuestionsToStorage() {
    try {
      localStorage.setItem('snakeTrailQuestions', JSON.stringify(state.questions));
    } catch (e) {}
    updateBoardQuestionBadges();
  }

  // DOM Elements
  let settingsView, gameView, modalBackdrop, victoryOverlay;
  let statusTextEl, activeNameEl, activeDotEl, diceBtn, diceCube, moveSpaceBtn;
  let playersListEl, boardGridEl, tokensLayerEl, dockSlotsEl;
  let cryOverlay;

  function initDOM() {
    settingsView = document.getElementById('settings-view');
    gameView = document.getElementById('game-view');
    modalBackdrop = document.getElementById('modal-backdrop');
    victoryOverlay = document.getElementById('victory-overlay');
    statusTextEl = document.getElementById('turn-status-text');
    activeNameEl = document.getElementById('active-player-name-text');
    activeDotEl = document.getElementById('active-player-dot');
    diceBtn = document.getElementById('dice-btn');
    diceCube = document.getElementById('dice-cube');
    moveSpaceBtn = document.getElementById('btn-move-space');
    playersListEl = document.getElementById('player-list');
    boardGridEl = document.getElementById('board-grid');
    tokensLayerEl = document.getElementById('tokens-layer');
    dockSlotsEl = document.getElementById('dock-slots');
    cryOverlay = document.getElementById('cry-overlay');

    // Build board squares
    buildBoardSquares();

    // Setup Event Listeners
    setupEventListeners();

    // Render Settings View
    renderSettingsInputs();

    // Sound toggle button
    const soundToggle = document.getElementById('btn-sound-toggle');
    soundToggle.addEventListener('click', toggleSound);

    window.addEventListener('resize', () => {
      positionAllTokens();
    });
  }

  function toggleSound() {
    state.soundEnabled = !state.soundEnabled;
    const soundToggle = document.getElementById('btn-sound-toggle');
    if (state.soundEnabled) {
      soundToggle.innerHTML = '🔊 Sound on';
      soundToggle.setAttribute('aria-pressed', 'true');
      getAudioCtx();
    } else {
      soundToggle.innerHTML = '🔇 Sound off';
      soundToggle.setAttribute('aria-pressed', 'false');
    }
  }

  // Build 20 Squares in Serpentine Order
  // Row 1 (top): 20 19 18 17 16
  // Row 2:       11 12 13 14 15
  // Row 3:       10  9  8  7  6
  // Row 4 (bot):  1  2  3  4  5
  const SQUARE_ORDER = [
    20, 19, 18, 17, 16,
    11, 12, 13, 14, 15,
    10,  9,  8,  7,  6,
     1,  2,  3,  4,  5
  ];

  function buildBoardSquares() {
    boardGridEl.innerHTML = '';
    SQUARE_ORDER.forEach((sqNum, idx) => {
      const colIdx = idx % 5;
      const cell = document.createElement('div');
      cell.className = 'square-cell';
      cell.setAttribute('data-sq', sqNum);
      cell.setAttribute('role', 'region');
      cell.setAttribute('aria-label', 'Square ' + sqNum);

      // Question button
      const qBtn = document.createElement('button');
      qBtn.type = 'button';
      qBtn.className = 'q-mark-btn ' + COL_COLORS[colIdx];
      qBtn.setAttribute('data-sq', sqNum);
      qBtn.setAttribute('aria-label', 'Open question for square ' + sqNum);
      qBtn.innerHTML = '<span class="sr-only">Square ' + sqNum + '</span>?';

      if (state.questions[sqNum - 1] && state.questions[sqNum - 1].q.trim()) {
        qBtn.classList.add('has-saved-q');
      }

      qBtn.addEventListener('click', () => handleQuestionClick(sqNum));
      cell.appendChild(qBtn);
      boardGridEl.appendChild(cell);
    });
  }

  function updateBoardQuestionBadges() {
    document.querySelectorAll('.q-mark-btn').forEach(btn => {
      const sq = parseInt(btn.getAttribute('data-sq'), 10);
      if (state.questions[sq - 1] && state.questions[sq - 1].q.trim()) {
        btn.classList.add('has-saved-q');
      } else {
        btn.classList.remove('has-saved-q');
      }
    });
  }

  // Setup Event Listeners
  function setupEventListeners() {
    // Mode cards
    const modeCards = document.querySelectorAll('.mode-card');
    modeCards.forEach(card => {
      card.addEventListener('click', () => {
        const mode = card.getAttribute('data-mode');
        setGameMode(mode);
      });
    });

    // Count buttons
    const countBtns = document.querySelectorAll('.btn-count');
    countBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const count = parseInt(btn.getAttribute('data-count'), 10);
        setPlayerCount(count);
      });
    });

    // Save player names button
    document.getElementById('btn-save-names').addEventListener('click', saveNamesToStorage);

    // Single square editor
    const sqSelect = document.getElementById('single-sq-select');
    const inputQ = document.getElementById('input-single-q');
    const inputA = document.getElementById('input-single-a');
    const sqStatus = document.getElementById('single-q-status');

    sqSelect.addEventListener('change', () => {
      const sq = parseInt(sqSelect.value, 10);
      const cur = state.questions[sq - 1] || { q: '', a: '' };
      inputQ.value = cur.q;
      inputA.value = cur.a;
      sqStatus.textContent = '';
    });

    document.getElementById('btn-sq-save').addEventListener('click', () => {
      const sq = parseInt(sqSelect.value, 10);
      state.questions[sq - 1] = {
        q: inputQ.value.trim(),
        a: inputA.value.trim()
      };
      saveQuestionsToStorage();
      sqStatus.textContent = '✓ Square ' + sq + ' saved!';
      sqStatus.style.color = '#4be090';
      soundFx.save();
    });

    document.getElementById('btn-sq-clear').addEventListener('click', () => {
      const sq = parseInt(sqSelect.value, 10);
      state.questions[sq - 1] = { q: '', a: '' };
      inputQ.value = '';
      inputA.value = '';
      saveQuestionsToStorage();
      sqStatus.textContent = 'Square ' + sq + ' cleared.';
      sqStatus.style.color = '#ffd85b';
      soundFx.save();
    });

    // Bulk questions import
    document.getElementById('btn-bulk-import').addEventListener('click', () => {
      const qText = document.getElementById('bulk-questions-input').value;
      const aText = document.getElementById('bulk-answers-input').value;
      const statusEl = document.getElementById('bulk-q-status');

      const qLines = qText.split('\\n').map(l => l.trim()).filter(l => l.length > 0);
      const aLines = aText.split('\\n').map(l => l.trim()).filter(l => l.length > 0);

      if (qLines.length === 0 || aLines.length === 0) {
        statusEl.textContent = 'Error: Please enter at least one question and answer.';
        statusEl.style.color = '#ff6b6b';
        soundFx.wrong();
        return;
      }

      if (qLines.length !== aLines.length) {
        statusEl.textContent = 'Error: Questions (' + qLines.length + ' lines) and Answers (' + aLines.length + ' lines) must have equal lines.';
        statusEl.style.color = '#ff6b6b';
        soundFx.wrong();
        return;
      }

      const count = Math.min(20, qLines.length);
      for (let i = 0; i < count; i++) {
        state.questions[i] = {
          q: qLines[i],
          a: aLines[i]
        };
      }
      saveQuestionsToStorage();
      statusEl.textContent = '✓ ' + count + ' questions imported to squares 1–' + count + '!';
      statusEl.style.color = '#4be090';
      soundFx.save();

      // Update single editor if visible
      const sq = parseInt(sqSelect.value, 10);
      inputQ.value = state.questions[sq - 1].q;
      inputA.value = state.questions[sq - 1].a;
    });

    // Start game button
    document.getElementById('btn-start-game').addEventListener('click', startGame);

    // Top navigation buttons
    document.getElementById('btn-back-settings').addEventListener('click', backToSettings);
    document.getElementById('btn-restart-game').addEventListener('click', restartGame);

    // Dice click
    diceBtn.addEventListener('click', handleDiceClick);
    moveSpaceBtn.addEventListener('click', handleMoveClick);

    // Modal buttons
    document.getElementById('btn-modal-close').addEventListener('click', closeModal);
    document.getElementById('btn-modal-cancel').addEventListener('click', closeModal);
    document.getElementById('btn-modal-submit').addEventListener('click', submitAnswer);
    document.getElementById('modal-answer-input').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') submitAnswer();
      if (e.key === 'Escape') closeModal();
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && modalBackdrop.style.display === 'flex') {
        closeModal();
      }
    });

    // Play again button
    document.getElementById('btn-play-again').addEventListener('click', () => {
      victoryOverlay.style.display = 'none';
      restartGame();
    });
  }

  function setGameMode(mode) {
    state.mode = mode;
    document.querySelectorAll('.mode-card').forEach(c => {
      c.setAttribute('aria-pressed', c.getAttribute('data-mode') === mode ? 'true' : 'false');
    });
    const picker = document.getElementById('player-count-picker');
    if (mode === 'local') {
      picker.style.display = 'flex';
      setPlayerCount(Math.max(2, state.playerCount));
    } else {
      picker.style.display = 'none';
      setPlayerCount(2);
    }
  }

  function setPlayerCount(count) {
    state.playerCount = count;
    document.querySelectorAll('.btn-count').forEach(b => {
      b.setAttribute('aria-pressed', parseInt(b.getAttribute('data-count'), 10) === count ? 'true' : 'false');
    });
    renderSettingsInputs();
  }

  function renderSettingsInputs() {
    const grid = document.getElementById('names-grid');
    grid.innerHTML = '';
    const count = state.mode === 'cpu' ? 2 : state.playerCount;

    for (let i = 0; i < count; i++) {
      const row = document.createElement('div');
      row.className = 'name-input-row';

      const preview = document.createElement('div');
      preview.className = 'token-preview';
      preview.style.backgroundColor = PLAYER_COLORS[i];
      preview.textContent = i + 1;

      const input = document.createElement('input');
      input.type = 'text';
      input.className = 'name-input';
      input.maxLength = 22;
      input.setAttribute('data-idx', i);

      if (state.mode === 'cpu' && i === 1) {
        input.value = 'CPU';
        input.disabled = true;
        input.title = 'Player 2 is the computer';
      } else {
        const defaultPlaceholder = DEFAULT_NAMES[i];
        input.placeholder = defaultPlaceholder;
        input.value = state.savedNames[i] || '';
        input.addEventListener('input', () => {
          const statusEl = document.getElementById('names-status-msg');
          if (statusEl) {
            statusEl.textContent = 'Unsaved changes';
            statusEl.className = 'names-status-msg unsaved';
          }
        });
      }

      row.appendChild(preview);
      row.appendChild(input);
      grid.appendChild(row);
    }
  }

  // Start Game
  function startGame() {
    clearTimeout(state.cpuTimer);
    getAudioCtx();

    // Read names
    const inputs = document.querySelectorAll('.name-input');
    const names = [];
    inputs.forEach((inp, idx) => {
      let val = inp.value.trim().slice(0, 22);
      if (state.mode === 'cpu' && idx === 1) {
        val = 'CPU';
      } else if (!val) {
        val = DEFAULT_NAMES[idx];
      }
      names.push(val);
    });

    const count = state.mode === 'cpu' ? 2 : state.playerCount;
    state.players = [];
    for (let i = 0; i < count; i++) {
      state.players.push({
        id: i + 1,
        name: names[i] || DEFAULT_NAMES[i],
        color: PLAYER_COLORS[i],
        pos: 0,
        trophies: new Set(),
        isCpu: state.mode === 'cpu' && i === 1
      });
    }

    state.activeIdx = 0;
    state.rolledValue = 0;
    state.isRolling = false;
    state.isMoving = false;
    state.gameOver = false;
    state.winner = null;

    settingsView.style.display = 'none';
    gameView.style.display = 'block';

    renderControlPanel();
    buildTokens();
    setTimeout(() => {
      positionAllTokens();
      checkTurnStart();
    }, 50);
  }

  function backToSettings() {
    clearTimeout(state.cpuTimer);
    gameView.style.display = 'none';
    settingsView.style.display = 'block';
  }

  function restartGame() {
    clearTimeout(state.cpuTimer);
    state.players.forEach(p => {
      p.pos = 0;
      p.trophies.clear();
    });
    state.activeIdx = 0;
    state.rolledValue = 0;
    state.isRolling = false;
    state.isMoving = false;
    state.gameOver = false;
    state.winner = null;
    state.winReason = '';

    moveSpaceBtn.style.display = 'none';
    renderControlPanel();
    positionAllTokens();
    checkTurnStart();
  }

  // Render Control Panel
  function renderControlPanel() {
    const curPlayer = state.players[state.activeIdx];
    if (!curPlayer) return;

    activeNameEl.textContent = curPlayer.name;
    activeDotEl.style.backgroundColor = curPlayer.color;
    activeDotEl.style.boxShadow = '0 0 8px ' + curPlayer.color;

    if (!state.isRolling && !state.isMoving) {
      if (curPlayer.isCpu) {
        statusTextEl.textContent = curPlayer.name + ' is thinking...';
      } else {
        statusTextEl.textContent = 'Click the dice to roll.';
      }
    }

    // Players list
    playersListEl.innerHTML = '';
    state.players.forEach((p, idx) => {
      const row = document.createElement('div');
      row.className = 'player-row' + (idx === state.activeIdx ? ' active' : '');
      if (idx === state.activeIdx) {
        row.style.borderColor = p.color;
        row.style.boxShadow = '0 0 12px ' + p.color + '55';
      }

      const left = document.createElement('div');
      left.className = 'player-row-left';

      const dot = document.createElement('div');
      dot.className = 'player-row-dot';
      dot.style.backgroundColor = p.color;

      const name = document.createElement('div');
      name.className = 'player-row-name';
      name.textContent = p.name + (p.isCpu ? ' (CPU)' : '');

      left.appendChild(dot);
      left.appendChild(name);

      const trophies = document.createElement('div');
      trophies.className = 'player-row-trophies';
      trophies.setAttribute('aria-label', p.trophies.size + ' of 5 trophies');
      trophies.innerHTML = '🏆 ' + p.trophies.size + '/5';

      row.appendChild(left);
      row.appendChild(trophies);
      playersListEl.appendChild(row);
    });
  }

  // Create Tokens in DOM
  function buildTokens() {
    tokensLayerEl.innerHTML = '';
    state.players.forEach(p => {
      const tok = document.createElement('div');
      tok.className = 'player-token';
      tok.id = 'player-token-' + p.id;
      tok.style.backgroundColor = p.color;
      tok.textContent = p.id;
      tok.setAttribute('title', p.name);
      tok.setAttribute('aria-label', p.name + ' token');
      tokensLayerEl.appendChild(tok);
    });
  }

  // Token Positioning & Exact Centering Logic
  function positionAllTokens() {
    // Group players by position
    const posGroups = {};
    state.players.forEach(p => {
      if (!posGroups[p.pos]) posGroups[p.pos] = [];
      posGroups[p.pos].push(p);
    });

    const boardInner = document.querySelector('.board-inner-frame');
    if (!boardInner) return;
    const boardRect = boardInner.getBoundingClientRect();

    Object.keys(posGroups).forEach(posStr => {
      const pos = parseInt(posStr, 10);
      const playersAtPos = posGroups[pos];
      const count = playersAtPos.length;

      if (pos === 0) {
        // Position tokens in Starting Dock
        const dockRect = dockSlotsEl.getBoundingClientRect();
        playersAtPos.forEach((p, idx) => {
          const tok = document.getElementById('player-token-' + p.id);
          if (!tok) return;
          const spacing = 44;
          const totalW = count * spacing;
          const startX = (dockRect.left - boardRect.left) + (dockRect.width / 2) - (totalW / 2) + (spacing / 2);
          const x = startX + idx * spacing;
          const y = (dockRect.top - boardRect.top) + (dockRect.height / 2);

          tok.style.left = x + 'px';
          tok.style.top = y + 'px';
        });
      } else {
        // Position inside board square
        const cell = document.querySelector('.square-cell[data-sq="' + pos + '"]');
        if (!cell) return;
        const cellRect = cell.getBoundingClientRect();
        const centerX = (cellRect.left - boardRect.left) + (cellRect.width / 2);
        const centerY = (cellRect.top - boardRect.top) + (cellRect.height / 2);

        // Clustered offsets
        let offsets = [[0, 0]];
        if (count === 1) {
          // Exactly 0px offset on both axes!
          offsets = [[0, 0]];
        } else if (count === 2) {
          offsets = [[-12, 0], [12, 0]];
        } else if (count === 3) {
          offsets = [[-11, -9], [11, -9], [0, 10]];
        } else if (count === 4) {
          offsets = [[-11, -10], [11, -10], [-11, 10], [11, 10]];
        } else if (count === 5) {
          offsets = [[-12, -12], [12, -12], [-12, 12], [12, 12], [0, 0]];
        }

        playersAtPos.forEach((p, idx) => {
          const tok = document.getElementById('player-token-' + p.id);
          if (!tok) return;
          const off = offsets[idx] || [0, 0];
          tok.style.left = (centerX + off[0]) + 'px';
          tok.style.top = (centerY + off[1]) + 'px';
        });
      }
    });
  }

  // 3D Dice Rotations
  // Resting tilt: rotateX(-12deg) rotateY(16deg)
  const DICE_FINAL_ROTATIONS = {
    1: 'rotateX(-12deg) rotateY(16deg)',
    2: 'rotateX(78deg) rotateY(16deg)',
    3: 'rotateX(-12deg) rotateY(-74deg)',
    4: 'rotateX(-12deg) rotateY(106deg)',
    5: 'rotateX(-102deg) rotateY(16deg)',
    6: 'rotateX(-12deg) rotateY(196deg)'
  };

  function rollDiceAnimation(finalVal, onComplete) {
    state.isRolling = true;
    soundFx.roll();

    // Extra full turns for spin effect
    const spinX = 720;
    const spinY = 1080;
    const target = DICE_FINAL_ROTATIONS[finalVal];

    // Initial spin
    diceCube.style.transition = 'transform 1s cubic-bezier(0.2, 0.9, 0.3, 1)';
    diceCube.style.transform = 'rotateX(' + (spinX - 12) + 'deg) rotateY(' + (spinY + 16) + 'deg)';

    setTimeout(() => {
      diceCube.style.transition = 'transform 0.25s ease-out';
      diceCube.style.transform = target;
      state.isRolling = false;
      if (onComplete) onComplete();
    }, 1000);
  }

  function handleDiceClick() {
    if (state.gameOver || state.isRolling || state.isMoving) return;
    const curPlayer = state.players[state.activeIdx];
    if (curPlayer.isCpu) return; // CPU rolls automatically

    performRoll(curPlayer);
  }

  function performRoll(player) {
    const roll = Math.floor(Math.random() * 6) + 1;
    state.rolledValue = roll;
    statusTextEl.textContent = player.name + ' rolled ' + roll + '!';

    rollDiceAnimation(roll, () => {
      if (player.isCpu) {
        statusTextEl.textContent = player.name + ' rolled ' + roll + '. Moving...';
        state.cpuTimer = setTimeout(() => {
          executeMove(player, roll);
        }, 1100);
      } else {
        // Show human Move button
        const label = roll === 1 ? 'Move 1 space ▶' : 'Move ' + roll + ' spaces ▶';
        moveSpaceBtn.textContent = label;
        moveSpaceBtn.style.display = 'block';
        statusTextEl.textContent = 'Rolled ' + roll + '! Click Move to proceed.';
      }
    });
  }

  function handleMoveClick() {
    if (state.gameOver || state.isMoving) return;
    moveSpaceBtn.style.display = 'none';
    const curPlayer = state.players[state.activeIdx];
    executeMove(curPlayer, state.rolledValue);
  }

  function checkTurnStart() {
    if (state.gameOver) return;
    renderControlPanel();
    const curPlayer = state.players[state.activeIdx];
    if (curPlayer.isCpu) {
      statusTextEl.textContent = curPlayer.name + ' is rolling...';
      state.cpuTimer = setTimeout(() => {
        performRoll(curPlayer);
      }, 1000);
    }
  }

  // Movement Logic
  function executeMove(player, steps) {
    state.isMoving = true;
    moveSpaceBtn.style.display = 'none';

    const targetPos = player.pos + steps;

    // Exact roll rule: if over 20, token stays put!
    if (targetPos > 20) {
      soundFx.blocked();
      statusTextEl.textContent = player.name + ' needs an exact roll. The token stays put.';
      setTimeout(() => {
        state.isMoving = false;
        nextTurn();
      }, 1400);
      return;
    }

    // Step by step hop
    let curStep = 0;
    const startPos = player.pos;

    function stepNext() {
      if (curStep < steps) {
        curStep++;
        player.pos = startPos + curStep;
        soundFx.step();

        const tok = document.getElementById('player-token-' + player.id);
        if (tok) {
          tok.classList.remove('hop-anim');
          void tok.offsetWidth;
          tok.classList.add('hop-anim');
        }

        positionAllTokens();
        setTimeout(stepNext, 260);
      } else {
        // Finished steps, check snake, ladder, or win
        setTimeout(() => {
          checkSquareEvents(player);
        }, 220);
      }
    }

    stepNext();
  }

  function checkSquareEvents(player) {
    const pos = player.pos;

    // Check Win at 20
    if (pos === 20) {
      declareVictory(player, 'reached square 20!');
      return;
    }

    // Check Ladder
    if (LADDERS[pos]) {
      const dest = LADDERS[pos];
      statusTextEl.textContent = 'Ladder! ' + player.name + ' climbs to square ' + dest + '.';
      soundFx.ladder();
      setTimeout(() => {
        player.pos = dest;
        positionAllTokens();
        setTimeout(() => {
          if (player.pos === 20) {
            declareVictory(player, 'reached square 20!');
          } else {
            finishMove();
          }
        }, 400);
      }, 500);
      return;
    }

    // Check Snake
    if (SNAKES[pos]) {
      const dest = SNAKES[pos];
      statusTextEl.textContent = 'Oh no! A snake bites ' + player.name + ' and slides the token down to square ' + dest + '.';
      soundFx.snake();

      // Show crying emoji overlay
      cryOverlay.classList.add('show');

      setTimeout(() => {
        cryOverlay.classList.remove('show');
        player.pos = dest;
        positionAllTokens();
        setTimeout(finishMove, 400);
      }, 900);
      return;
    }

    finishMove();
  }

  function finishMove() {
    state.isMoving = false;
    nextTurn();
  }

  function nextTurn() {
    if (state.gameOver) return;
    state.activeIdx = (state.activeIdx + 1) % state.players.length;
    renderControlPanel();
    checkTurnStart();
  }

  // Question Interaction
  function handleQuestionClick(sqNum) {
    if (state.isMoving || state.isRolling || state.gameOver) return;
    const curPlayer = state.players[state.activeIdx];
    if (curPlayer.isCpu) return; // Only human turn

    const record = state.questions[sqNum - 1];
    if (!record || !record.q.trim()) {
      alert('No question is saved for square ' + sqNum + ' yet. Add it in settings.');
      return;
    }

    openQuestionModal(sqNum, record);
  }

  function openQuestionModal(sqNum, record) {
    state.activeModalSquare = sqNum;
    document.getElementById('modal-title').textContent = 'Square ' + sqNum + ' question';
    document.getElementById('modal-question-text').textContent = record.q;
    const input = document.getElementById('modal-answer-input');
    input.value = '';
    const feedback = document.getElementById('modal-feedback');
    feedback.textContent = '';
    feedback.className = 'modal-feedback';

    modalBackdrop.style.display = 'flex';
    setTimeout(() => input.focus(), 100);
  }

  function closeModal() {
    modalBackdrop.style.display = 'none';
    state.activeModalSquare = null;
  }

  function submitAnswer() {
    const sqNum = state.activeModalSquare;
    if (!sqNum) return;
    const record = state.questions[sqNum - 1];
    if (!record) return;

    const input = document.getElementById('modal-answer-input');
    const feedback = document.getElementById('modal-feedback');
    const curPlayer = state.players[state.activeIdx];

    // Normalize comparison: trim outer spaces, collapse repeated spaces, lowercase
    const userClean = input.value.trim().toLowerCase().replace(/\\s+/g, ' ');
    const expectedClean = record.a.trim().toLowerCase().replace(/\\s+/g, ' ');

    if (!userClean || userClean !== expectedClean) {
      soundFx.wrong();
      feedback.textContent = 'Not quite—try again. Check spelling and spacing.';
      feedback.className = 'modal-feedback wrong';
      return;
    }

    // Correct!
    if (curPlayer.trophies.has(sqNum)) {
      soundFx.correct();
      feedback.textContent = 'Correct! You already earned the trophy for this square.';
      feedback.className = 'modal-feedback correct';
      setTimeout(closeModal, 1500);
      return;
    }

    // Award trophy
    curPlayer.trophies.add(sqNum);
    soundFx.trophy();
    feedback.textContent = 'Correct! Trophy earned! ✨🏆';
    feedback.className = 'modal-feedback correct';

    renderControlPanel();

    // Check 5 trophies win condition
    if (curPlayer.trophies.size >= 5) {
      setTimeout(() => {
        closeModal();
        // Move to square 20 and win immediately
        curPlayer.pos = 20;
        positionAllTokens();
        declareVictory(curPlayer, 'collected five trophies!');
      }, 1000);
    } else {
      setTimeout(closeModal, 1300);
    }
  }

  // Victory Routine
  function declareVictory(player, reason) {
    state.gameOver = true;
    state.winner = player;
    state.winReason = reason;
    clearTimeout(state.cpuTimer);

    soundFx.victory();

    document.getElementById('winner-desc').textContent = player.name + ' wins! ' + player.name + ' ' + reason;
    spawnConfetti();
    victoryOverlay.style.display = 'flex';
  }

  function spawnConfetti() {
    const container = document.getElementById('confetti-layer');
    container.innerHTML = '';
    const colors = ['#ffd700', '#ff4081', '#00e5ff', '#76ff03', '#ff9100', '#d500f9', '#ffffff'];
    for (let i = 0; i < 90; i++) {
      const piece = document.createElement('div');
      piece.className = 'confetti-piece';
      piece.style.left = Math.random() * 100 + 'vw';
      piece.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
      piece.style.animationDuration = (2 + Math.random() * 3) + 's';
      piece.style.animationDelay = (Math.random() * 2) + 's';
      piece.style.width = (6 + Math.random() * 8) + 'px';
      piece.style.height = (10 + Math.random() * 14) + 'px';
      container.appendChild(piece);
    }
  }

  // Startup
  document.addEventListener('DOMContentLoaded', () => {
    loadPersistedData();
    initDOM();
  });
})();
`;

const htmlTemplate = `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Snakes and Ladder</title>
  <meta name="description" content="Snakes and Ladder learning game featuring 3D dice, custom question bank, and multiplayer modes.">
  <meta property="og:title" content="Snakes and Ladder">
  <meta property="og:description" content="Interactive Snakes and Ladder learning game.">
  <style>
${css}
  </style>
</head>
<body>
  <div class="app-wrapper">
    <!-- Header -->
    <header class="app-header" role="banner">
      <div class="title-img-container">
        <img class="title-img" src="${titleB64}" alt="SNAKES AND LADDER" width="720" height="120">
      </div>
      <div class="header-controls">
        <button id="btn-sound-toggle" class="btn-sound" type="button" aria-pressed="true" aria-label="Toggle game sound">
          🔊 Sound on
        </button>
      </div>
    </header>

    <!-- Settings View -->
    <main id="settings-view" class="settings-view" role="main" aria-label="Game Setup">
      <div class="settings-header">
        <h1>Set up your game</h1>
        <p>Choose how to play, save the player names, and add your learning questions.</p>
      </div>

      <!-- Play Modes -->
      <section aria-labelledby="mode-heading">
        <h2 id="mode-heading" class="section-title">🎮 Play Mode</h2>
        <div class="mode-cards" role="radiogroup" aria-label="Play mode selection">
          <div class="mode-card" data-mode="cpu" role="radio" aria-checked="true" aria-pressed="true" tabindex="0">
            <h3>🤖 Versus computer</h3>
            <p>One human player against an automatic CPU competitor.</p>
          </div>
          <div class="mode-card" data-mode="local" role="radio" aria-checked="false" aria-pressed="false" tabindex="0">
            <h3>👥 Various players</h3>
            <p>2 to 5 local players sharing one device.</p>
          </div>
        </div>

        <div id="player-count-picker" class="player-count-picker" style="display: none;" role="group" aria-label="Select number of players">
          <span style="font-size:0.95rem; font-weight:bold; color:#b5d5ff; margin-right:8px;">Players:</span>
          <button type="button" class="btn-count" data-count="2" aria-pressed="true">2 Players</button>
          <button type="button" class="btn-count" data-count="3" aria-pressed="false">3 Players</button>
          <button type="button" class="btn-count" data-count="4" aria-pressed="false">4 Players</button>
          <button type="button" class="btn-count" data-count="5" aria-pressed="false">5 Players</button>
        </div>
      </section>

      <!-- Player Names -->
      <section aria-labelledby="names-heading" style="margin-top:20px;">
        <h2 id="names-heading" class="section-title">🏷️ Player Names</h2>
        <div class="names-box">
          <div id="names-grid" class="names-grid">
            <!-- Inputs populated dynamically -->
          </div>
          <div class="names-actions">
            <button id="btn-save-names" type="button" class="btn-save-names">
              Save player names
            </button>
            <div id="names-status-msg" class="names-status-msg" role="status" aria-live="polite"></div>
          </div>
        </div>
      </section>

      <!-- Questions Collapsible -->
      <section aria-labelledby="questions-heading">
        <details class="questions-accordion" id="questions-accordion">
          <summary id="questions-heading">Add or edit my questions</summary>
          <div class="question-accordion-body">
            <p style="color:#b5d5ff; font-size:0.92rem; margin-bottom:14px;">
              Add learning questions for up to 20 squares. Correct answers earn trophies!
            </p>

            <!-- Bulk textareas -->
            <div class="bulk-editor-grid">
              <div class="textarea-col">
                <label for="bulk-questions-input">Questions, one per line</label>
                <textarea id="bulk-questions-input" class="bulk-textarea" placeholder="What is 5 + 7?&#10;Capital of France?&#10;Opposite of Hot?"></textarea>
              </div>
              <div class="textarea-col">
                <label for="bulk-answers-input">Answers, one per line</label>
                <textarea id="bulk-answers-input" class="bulk-textarea" placeholder="12&#10;Paris&#10;Cold"></textarea>
              </div>
            </div>
            <button type="button" id="btn-bulk-import" class="btn-bulk-import">Import bulk questions</button>
            <div id="bulk-q-status" class="q-status-msg" role="status" aria-live="polite"></div>

            <!-- Single Square Editor -->
            <div class="single-square-editor">
              <h4 style="color:#ffd85b; font-size:1rem; margin-bottom:6px;">Single Square Question Editor</h4>
              <div class="single-editor-controls">
                <select id="single-sq-select" class="square-select" aria-label="Select Square 1 to 20">
                  <option value="1">Square 1</option>
                  <option value="2">Square 2</option>
                  <option value="3">Square 3</option>
                  <option value="4">Square 4</option>
                  <option value="5">Square 5</option>
                  <option value="6">Square 6</option>
                  <option value="7">Square 7</option>
                  <option value="8">Square 8</option>
                  <option value="9">Square 9</option>
                  <option value="10">Square 10</option>
                  <option value="11">Square 11</option>
                  <option value="12">Square 12</option>
                  <option value="13">Square 13</option>
                  <option value="14">Square 14</option>
                  <option value="15">Square 15</option>
                  <option value="16">Square 16</option>
                  <option value="17">Square 17</option>
                  <option value="18">Square 18</option>
                  <option value="19">Square 19</option>
                  <option value="20">Square 20</option>
                </select>
                <input type="text" id="input-single-q" class="input-q" placeholder="Square question..." aria-label="Square question">
                <input type="text" id="input-single-a" class="input-a" placeholder="Exact answer..." aria-label="Square answer">
                <button type="button" id="btn-sq-save" class="btn-sq-save">Save this square</button>
                <button type="button" id="btn-sq-clear" class="btn-sq-clear">Clear this square</button>
              </div>
              <div id="single-q-status" class="q-status-msg" role="status" aria-live="polite"></div>
            </div>
          </div>
        </details>
      </section>

      <!-- Start Button -->
      <button id="btn-start-game" type="button" class="btn-start-game" aria-label="Start the game">
        Start the game ▶
      </button>
    </main>

    <!-- Game View -->
    <main id="game-view" class="game-view" role="main" aria-label="Snakes and Ladder Game Stage">
      <!-- Top Action Bar -->
      <div class="top-nav-bar">
        <button id="btn-back-settings" type="button" class="btn-nav" aria-label="Back to settings screen">
          ← Back to settings
        </button>
        <button id="btn-restart-game" type="button" class="btn-nav" aria-label="Restart current game">
          ↻ Restart game
        </button>
      </div>

      <div class="game-layout">
        <!-- Board Column -->
        <section class="board-column" aria-label="Game board and token dock">
          <div class="board-outer-halo">
            <div class="board-inner-frame" aria-label="Snakes and Ladder Game Board, 20 squares">
              <!-- Mandatory Main Board Asset -->
              <img class="board-bg-img" src="${boardB64}" alt="Snakes and Ladder 20 Square Board" width="800" height="640">

              <!-- 5x4 Grid Cells -->
              <div id="board-grid" class="board-grid"></div>

              <!-- Tokens Layer -->
              <div id="tokens-layer" class="tokens-layer" aria-live="polite"></div>

              <!-- Crying Snake overlay -->
              <div id="cry-overlay" class="cry-overlay" aria-hidden="true">😭</div>
            </div>
          </div>

          <!-- Starting Dock -->
          <div class="starting-dock" role="region" aria-label="Starting Dock">
            <div class="dock-label">STARTING DOCK</div>
            <div id="dock-slots" class="dock-slots" aria-label="Tokens in dock"></div>
          </div>
        </section>

        <!-- Right Control Column -->
        <aside class="control-column" aria-label="Controls and status">
          <div class="control-panel">
            <div class="turn-header">
              <div class="turn-badge">CURRENT TURN</div>
              <div class="active-player-name">
                <span id="active-player-dot" class="active-player-dot"></span>
                <span id="active-player-name-text">P1</span>
              </div>
              <div id="turn-status-text" class="turn-status-text" role="status" aria-live="polite">
                Click the dice to roll.
              </div>
            </div>

            <!-- Avatar & 3D Dice Stage -->
            <div class="stage-row">
              <!-- Avatar with animated question marks -->
              <div class="avatar-wrapper" aria-label="Snake guide avatar">
                <div class="avatar-qmarks" aria-hidden="true">
                  <span>?</span>
                  <span>?</span>
                  <span>?</span>
                </div>
                <div class="avatar-box">
                  <img class="avatar-img" src="${avatarB64}" alt="Snake Mascot Guide">
                </div>
              </div>

              <!-- Stationary Dice Button with 3D Cube -->
              <button id="dice-btn" class="dice-btn" type="button" aria-label="Roll 3D Dice">
                <div id="dice-cube" class="dice-cube">
                  <div class="dice-face face-1"><span class="pip"></span></div>
                  <div class="dice-face face-2"><span class="pip"></span><span class="pip"></span></div>
                  <div class="dice-face face-3"><span class="pip"></span><span class="pip"></span><span class="pip"></span></div>
                  <div class="dice-face face-4"><span class="pip"></span><span class="pip"></span><span class="pip"></span><span class="pip"></span></div>
                  <div class="dice-face face-5"><span class="pip"></span><span class="pip"></span><span class="pip"></span><span class="pip"></span><span class="pip"></span></div>
                  <div class="dice-face face-6"><span class="pip"></span><span class="pip"></span><span class="pip"></span><span class="pip"></span><span class="pip"></span><span class="pip"></span></div>
                </div>
              </button>
            </div>

            <!-- Move Spaces Button -->
            <button id="btn-move-space" class="btn-move-space" type="button">
              Move spaces ▶
            </button>

            <!-- Player Scores List -->
            <div id="player-list" class="player-list" role="list" aria-label="Players and trophies"></div>
          </div>

          <!-- Author Signature -->
          <footer class="author-signature" aria-label="Author information">
            <div class="sig-name">Dr.Abir Wafa</div>
            <div class="sig-title">Head of EdTech at Edulixa</div>
          </footer>
        </aside>
      </div>
    </main>
  </div>

  <!-- Question Modal -->
  <div id="modal-backdrop" class="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="modal-title">
    <div class="modal-card">
      <div class="modal-header">
        <h3 id="modal-title" class="modal-title">Square question</h3>
        <button id="btn-modal-close" class="btn-modal-close" type="button" aria-label="Close question modal">✕</button>
      </div>
      <div id="modal-question-text" class="modal-question-text">Question text goes here</div>
      <label for="modal-answer-input" class="sr-only">Type your answer</label>
      <input type="text" id="modal-answer-input" class="modal-answer-input" placeholder="Type your answer...">
      <div id="modal-feedback" class="modal-feedback" role="alert" aria-live="assertive"></div>
      <div class="modal-actions">
        <button id="btn-modal-cancel" type="button" class="btn-modal-cancel">Close</button>
        <button id="btn-modal-submit" type="button" class="btn-modal-submit">Check my answer</button>
      </div>
    </div>
  </div>

  <!-- Victory Overlay -->
  <div id="victory-overlay" class="victory-overlay" role="dialog" aria-modal="true" aria-label="Victory">
    <div id="confetti-layer" class="confetti-layer" aria-hidden="true"></div>
    <div class="victory-card">
      <div class="trophy-big" aria-hidden="true">🏆</div>
      <h2 class="victory-title">Victory!</h2>
      <p id="winner-desc" class="winner-desc">Player 1 wins!</p>
      <button id="btn-play-again" type="button" class="btn-play-again">Play again ↺</button>
    </div>
  </div>

  <script>
${jsCode}
  </script>
</body>
</html>
`;

fs.writeFileSync('index.html', htmlTemplate);
fs.writeFileSync('snake-learning-game-latest-edition.html', htmlTemplate);
console.log('Successfully generated index.html and snake-learning-game-latest-edition.html. Size:', htmlTemplate.length);
