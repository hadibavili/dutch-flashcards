// --- Profile Config ---
const PROFILES = {
  dutch: {
    id: 'dutch',
    name: 'Hadi',
    title: '\u{1F1F3}\u{1F1F1} Dutch Cards',
    frontLabel: 'Dutch',
    backLabel: 'English',
    frontLang: 'nl-NL',
    backLang: 'en-US',
    addFrontLabel: 'Dutch word / phrase',
    addFrontPlaceholder: 'e.g. Huis',
    addExampleFrontLabel: 'Example sentence (Dutch)',
    addExampleFrontPlaceholder: 'e.g. Ons huis is groot.',
  },
  persian: {
    id: 'persian',
    name: 'Nadine',
    title: '\u{1F1EE}\u{1F1F7} Persian Cards',
    frontLabel: 'Fenglish',
    backLabel: 'English',
    frontLang: 'fa-IR',
    backLang: 'en-US',
    addFrontLabel: 'Fenglish (Persian in English letters)',
    addFrontPlaceholder: 'e.g. salam',
    addExampleFrontLabel: 'Example sentence (Fenglish)',
    addExampleFrontPlaceholder: 'e.g. Salam, chetori?',
  },
};

// --- State ---
let currentProfile = null;
let cards = [];
let currentIndex = 0;
let sessionCorrect = 0;
let sessionWrong = 0;
let studyMode = 'due'; // 'due' or 'all'
let selectedCategory = null;

// --- Speech ---
let cachedVoices = [];

function loadVoices() {
  return new Promise((resolve) => {
    cachedVoices = window.speechSynthesis.getVoices();
    if (cachedVoices.length > 0) {
      resolve(cachedVoices);
    } else {
      window.speechSynthesis.onvoiceschanged = () => {
        cachedVoices = window.speechSynthesis.getVoices();
        resolve(cachedVoices);
      };
    }
  });
}

function findVoice(lang) {
  const langPrefix = lang.split('-')[0]; // 'nl', 'en', 'fa'

  // Exact match first (e.g. nl-NL)
  let voice = cachedVoices.find(v => v.lang === lang);
  if (voice) return voice;

  // Prefix match (e.g. nl)
  voice = cachedVoices.find(v => v.lang.startsWith(langPrefix + '-'));
  if (voice) return voice;

  // Loose match (e.g. lang contains 'nl')
  voice = cachedVoices.find(v => v.lang.toLowerCase().startsWith(langPrefix));
  return voice || null;
}

async function speak(text, lang) {
  if (!('speechSynthesis' in window)) return;
  window.speechSynthesis.cancel();

  // Ensure voices are loaded before speaking
  if (cachedVoices.length === 0) {
    await loadVoices();
  }

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = lang;
  utterance.rate = 0.85;

  // Explicitly set voice
  const voice = findVoice(lang);
  if (voice) {
    utterance.voice = voice;
  }

  // Animate button
  const isFront = lang !== 'en-US';
  const btn = isFront
    ? document.getElementById('btn-speak-front')
    : document.getElementById('btn-speak-back');

  if (btn) btn.classList.add('speaking');
  utterance.onend = () => { if (btn) btn.classList.remove('speaking'); };
  utterance.onerror = () => { if (btn) btn.classList.remove('speaking'); };

  window.speechSynthesis.speak(utterance);
}

// Preload voices as early as possible
if ('speechSynthesis' in window) {
  loadVoices();
}

// --- DOM Elements ---
const screens = {
  profile: document.getElementById('profile-screen'),
  home: document.getElementById('home-screen'),
  study: document.getElementById('study-screen'),
  add: document.getElementById('add-screen'),
};

const flashcard = document.getElementById('flashcard');
const frontWord = document.getElementById('card-front-word');
const backWord = document.getElementById('card-back-word');
const cardExample = document.getElementById('card-example');
const ratingButtons = document.getElementById('rating-buttons');
const studyProgress = document.getElementById('study-progress');
const studyCategory = document.getElementById('study-category');
const emptyState = document.getElementById('empty-state');
const completeState = document.getElementById('complete-state');
const cardContainer = document.getElementById('card-container');

// --- Navigation ---
function showScreen(name) {
  Object.values(screens).forEach(s => s.classList.remove('active'));
  screens[name].classList.add('active');
}

// --- Profile ---
function selectProfile(profileId) {
  currentProfile = profileId;
  localStorage.setItem('lastProfile', profileId);
  applyProfile();
  showScreen('home');
  loadHome();
}

function applyProfile() {
  const p = PROFILES[currentProfile];
  document.getElementById('home-title').textContent = p.title;
  document.getElementById('front-label').textContent = p.frontLabel;
  document.getElementById('back-label').textContent = p.backLabel;
  // Add card form
  document.getElementById('label-front-word').textContent = p.addFrontLabel;
  document.getElementById('input-dutch').placeholder = p.addFrontPlaceholder;
  document.getElementById('label-example-front').textContent = p.addExampleFrontLabel;
  document.getElementById('input-example-nl').placeholder = p.addExampleFrontPlaceholder;
}

// --- API Helpers ---
async function api(path, options) {
  const res = await fetch(`/api${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  return res.json();
}

// --- Home Screen ---
async function loadHome() {
  const [categories, stats] = await Promise.all([
    api(`/categories?profile=${currentProfile}`),
    api(`/stats?profile=${currentProfile}`),
  ]);

  // Stats bar
  const statsBar = document.getElementById('home-stats');
  const accuracy = stats.total_correct + stats.total_wrong > 0
    ? Math.round((stats.total_correct / (Number(stats.total_correct) + Number(stats.total_wrong))) * 100)
    : 0;
  statsBar.innerHTML = `
    <span>${stats.learned} learned</span>
    <span>${accuracy}% accuracy</span>
  `;

  // Due badge
  const dueBadge = document.getElementById('due-badge');
  const dueCount = Number(stats.due_now);
  dueBadge.textContent = dueCount;
  dueBadge.style.display = dueCount > 0 ? 'inline' : 'none';

  // Category grid
  const grid = document.getElementById('category-list');
  grid.innerHTML = categories.map(cat => {
    const pct = cat.total_cards > 0
      ? Math.round((cat.learned_cards / cat.total_cards) * 100)
      : 0;
    return `
      <div class="category-card" data-id="${cat.id}">
        <span class="emoji">${cat.emoji}</span>
        <div class="name">${cat.name}</div>
        <div class="count">${cat.learned_cards}/${cat.total_cards} learned</div>
        <div class="progress-bar"><div class="progress-fill" style="width:${pct}%"></div></div>
      </div>
    `;
  }).join('');

  // Category click handlers
  grid.querySelectorAll('.category-card').forEach(el => {
    el.addEventListener('click', () => {
      selectedCategory = el.dataset.id;
      startStudy('due');
    });
  });

  // Populate add form categories
  const select = document.getElementById('input-category');
  select.innerHTML = categories.map(c =>
    `<option value="${c.id}">${c.emoji} ${c.name}</option>`
  ).join('');
}

// --- Study Session ---
async function startStudy(mode) {
  studyMode = mode;
  sessionCorrect = 0;
  sessionWrong = 0;
  currentIndex = 0;

  const params = new URLSearchParams();
  params.set('profile', currentProfile);
  if (selectedCategory) params.set('category', selectedCategory);
  if (mode === 'due') params.set('limit', '50');

  const endpoint = mode === 'due' ? '/cards/due' : '/cards';
  cards = await api(`${endpoint}?${params}`);

  // Shuffle for variety
  if (mode === 'all') {
    cards.sort(() => Math.random() - 0.5);
    cards = cards.slice(0, 30); // limit for all mode
  }

  showScreen('study');

  if (cards.length === 0) {
    cardContainer.classList.add('hidden');
    ratingButtons.classList.add('hidden');
    completeState.classList.add('hidden');
    emptyState.classList.remove('hidden');
    return;
  }

  emptyState.classList.add('hidden');
  completeState.classList.add('hidden');
  cardContainer.classList.remove('hidden');

  showCard();
}

function showCard() {
  if (currentIndex >= cards.length) {
    finishSession();
    return;
  }

  const card = cards[currentIndex];
  studyProgress.textContent = `${currentIndex + 1} / ${cards.length}`;
  studyCategory.textContent = `${card.emoji} ${card.category}`;

  frontWord.textContent = card.dutch;
  backWord.textContent = card.english;

  if (card.example_nl) {
    cardExample.innerHTML = `
      <div class="nl">${card.example_nl}</div>
      <div>${card.example_en}</div>
    `;
  } else {
    cardExample.innerHTML = '';
  }

  flashcard.classList.remove('flipped');
  ratingButtons.classList.add('hidden');
}

function flipCard() {
  const isFlipped = flashcard.classList.toggle('flipped');
  if (isFlipped) {
    ratingButtons.classList.remove('hidden');
  } else {
    ratingButtons.classList.add('hidden');
  }
}

async function rateCard(rating) {
  const card = cards[currentIndex];

  if (rating > 0) sessionCorrect++;
  else sessionWrong++;

  // Send review to API (fire and forget for speed)
  api(`/cards/${card.id}/review`, {
    method: 'POST',
    body: JSON.stringify({ rating }),
  });

  currentIndex++;
  showCard();
}

function finishSession() {
  cardContainer.classList.add('hidden');
  ratingButtons.classList.add('hidden');
  emptyState.classList.add('hidden');
  completeState.classList.remove('hidden');

  const total = sessionCorrect + sessionWrong;
  const pct = total > 0 ? Math.round((sessionCorrect / total) * 100) : 0;

  document.getElementById('session-stats').innerHTML = `
    <div>Cards reviewed: <strong>${total}</strong></div>
    <div>Correct: <strong style="color:var(--success)">${sessionCorrect}</strong></div>
    <div>Wrong: <strong style="color:var(--danger)">${sessionWrong}</strong></div>
    <div>Accuracy: <strong>${pct}%</strong></div>
  `;
}

function goHome() {
  selectedCategory = null;
  showScreen('home');
  loadHome();
}

function showToast(msg) {
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = msg;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 2000);
}

// --- Add Card ---
async function addCard(e) {
  e.preventDefault();
  const dutch = document.getElementById('input-dutch').value.trim();
  const english = document.getElementById('input-english').value.trim();
  const category_id = document.getElementById('input-category').value;
  const example_nl = document.getElementById('input-example-nl').value.trim();
  const example_en = document.getElementById('input-example-en').value.trim();

  await api('/cards', {
    method: 'POST',
    body: JSON.stringify({ dutch, english, category_id, example_nl, example_en }),
  });

  document.getElementById('add-form').reset();
  showToast('Card added!');
}

// --- Event Listeners ---
flashcard.addEventListener('click', (e) => {
  // Don't flip when tapping the speak or know button
  if (e.target.closest('.btn-speak') || e.target.closest('.btn-known')) return;
  flipCard();
});

document.getElementById('btn-known').addEventListener('click', async (e) => {
  e.stopPropagation();
  const card = cards[currentIndex];
  if (!card) return;

  // Mark as mastered in DB
  api(`/cards/${card.id}/master`, { method: 'POST' });

  // Remove from current session and show next
  cards.splice(currentIndex, 1);
  if (currentIndex >= cards.length) currentIndex = Math.max(0, cards.length - 1);

  showToast('Marked as known!');

  if (cards.length === 0) {
    finishSession();
  } else {
    showCard();
  }
});

document.getElementById('btn-speak-front').addEventListener('click', (e) => {
  e.stopPropagation();
  const card = cards[currentIndex];
  if (!card) return;

  const p = PROFILES[currentProfile];
  if (currentProfile === 'persian') {
    // Try Farsi TTS with actual script, fallback to Fenglish with English voice
    if (card.farsi_script && findVoice('fa-IR')) {
      speak(card.farsi_script, 'fa-IR');
    } else {
      speak(card.dutch, 'en-US');
    }
  } else {
    speak(card.dutch, p.frontLang);
  }
});

document.getElementById('btn-speak-back').addEventListener('click', (e) => {
  e.stopPropagation();
  const card = cards[currentIndex];
  if (card) speak(card.english, 'en-US');
});

ratingButtons.querySelectorAll('.btn-rating').forEach(btn => {
  btn.addEventListener('click', () => rateCard(parseInt(btn.dataset.rating)));
});

document.getElementById('btn-study').addEventListener('click', () => {
  selectedCategory = null;
  startStudy('due');
});

document.getElementById('btn-study-all').addEventListener('click', () => {
  selectedCategory = null;
  startStudy('all');
});

document.getElementById('btn-back').addEventListener('click', goHome);
document.getElementById('btn-back-empty').addEventListener('click', goHome);
document.getElementById('btn-back-complete').addEventListener('click', goHome);
document.getElementById('btn-add').addEventListener('click', () => showScreen('add'));
document.getElementById('btn-back-add').addEventListener('click', goHome);
document.getElementById('add-form').addEventListener('submit', addCard);

document.getElementById('btn-switch-profile').addEventListener('click', () => {
  showScreen('profile');
});

// Profile selection
document.querySelectorAll('.profile-card').forEach(btn => {
  btn.addEventListener('click', () => {
    selectProfile(btn.dataset.profile);
  });
});

// Keyboard shortcuts for study
document.addEventListener('keydown', (e) => {
  if (!screens.study.classList.contains('active')) return;

  if (e.key === ' ' || e.key === 'Enter') {
    e.preventDefault();
    if (!flashcard.classList.contains('flipped')) {
      flipCard();
    }
  } else if (e.key >= '1' && e.key <= '4' && flashcard.classList.contains('flipped')) {
    rateCard(parseInt(e.key) - 1);
  }
});

// --- Service Worker ---
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js');
}

// --- Init ---
// Highlight last used profile
const lastProfile = localStorage.getItem('lastProfile');
if (lastProfile) {
  const btn = document.querySelector(`.profile-card[data-profile="${lastProfile}"]`);
  if (btn) btn.classList.add('last-used');
}
showScreen('profile');
