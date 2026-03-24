// --- State ---
let cards = [];
let currentIndex = 0;
let sessionCorrect = 0;
let sessionWrong = 0;
let studyMode = 'due'; // 'due' or 'all'
let selectedCategory = null;

// --- DOM Elements ---
const screens = {
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
    api('/categories'),
    api('/stats'),
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
  if (flashcard.classList.contains('flipped')) return;
  flashcard.classList.add('flipped');
  ratingButtons.classList.remove('hidden');
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
flashcard.addEventListener('click', flipCard);

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
loadHome();
