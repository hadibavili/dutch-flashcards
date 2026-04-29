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
let voicesPromise = null;
let activeUtterance = null;
let activeAudio = null;
let pendingSpeechTimer = null;
let speechRequestId = 0;
const voiceListeners = new Set();

function refreshVoices() {
  if (!('speechSynthesis' in window)) return [];
  cachedVoices = window.speechSynthesis.getVoices();
  return cachedVoices;
}

function notifyVoiceListeners() {
  refreshVoices();
  voiceListeners.forEach(listener => listener());
}

function addVoicesChangedListener(listener) {
  const synth = window.speechSynthesis;
  voiceListeners.add(listener);

  if (typeof synth.addEventListener === 'function') {
    synth.addEventListener('voiceschanged', listener);
  } else {
    synth.onvoiceschanged = notifyVoiceListeners;
  }
}

function removeVoicesChangedListener(listener) {
  const synth = window.speechSynthesis;
  voiceListeners.delete(listener);

  if (typeof synth.removeEventListener === 'function') {
    synth.removeEventListener('voiceschanged', listener);
  } else if (voiceListeners.size === 0) {
    synth.onvoiceschanged = null;
  }
}

function loadVoices(timeout = 350) {
  return new Promise((resolve) => {
    cachedVoices = refreshVoices();
    if (cachedVoices.length > 0) {
      resolve(cachedVoices);
      return;
    }

    if (voicesPromise) {
      voicesPromise.then(resolve);
      return;
    }

    voicesPromise = new Promise((voiceResolve) => {
      let settled = false;
      let timeoutId = null;

      const finish = () => {
        if (settled) return;
        settled = true;
        if (timeoutId) window.clearTimeout(timeoutId);
        removeVoicesChangedListener(finish);
        voicesPromise = null;
        voiceResolve(refreshVoices());
      };

      addVoicesChangedListener(finish);
      timeoutId = window.setTimeout(finish, timeout);
    });

    voicesPromise.then(resolve);
  });
}

function normalizeLangCode(lang) {
  return (lang || '').toLowerCase().replace(/_/g, '-');
}

function findVoice(lang) {
  const voices = cachedVoices.length > 0 ? cachedVoices : refreshVoices();
  const targetLang = normalizeLangCode(lang);
  const langPrefix = targetLang.split('-')[0]; // 'nl', 'en', 'fa'

  // Exact match first (e.g. nl-NL)
  let voice = voices.find(v => normalizeLangCode(v.lang) === targetLang);
  if (voice) return voice;

  // Prefix match (e.g. nl)
  voice = voices.find(v => normalizeLangCode(v.lang).startsWith(langPrefix + '-'));
  if (voice) return voice;

  // Loose match (e.g. lang contains 'nl')
  voice = voices.find(v => normalizeLangCode(v.lang).startsWith(langPrefix));
  if (voice) return voice;

  // Some browsers expose Persian voices by name with incomplete lang metadata.
  if (langPrefix === 'fa') {
    voice = voices.find(v => /persian|farsi|فارسی/i.test(v.name || ''));
  }

  return voice || null;
}

function clearSpeakingState() {
  document.querySelectorAll('.btn-speak.speaking').forEach(btn => {
    btn.classList.remove('speaking');
  });
}

function stopActiveAudio() {
  if (!activeAudio) return;
  activeAudio.pause();
  activeAudio.removeAttribute('src');
  activeAudio.load();
  activeAudio = null;
}

function hasPersianScript(text) {
  return /[\u0600-\u06FF]/.test(text || '');
}

function getPersianFrontSpeech(card) {
  const farsiScript = (card.farsi_script || '').trim();
  if (farsiScript) return { text: farsiScript, lang: 'fa-IR' };

  const frontText = (card.dutch || '').trim();
  return {
    text: frontText,
    lang: hasPersianScript(frontText) ? 'fa-IR' : 'en-US',
  };
}

function normalizeSpeechText(text) {
  const speechText = (text || '').trim();
  return speechText || null;
}

function buildRemoteTtsUrl(text, lang) {
  const ttsLang = normalizeLangCode(lang).split('-')[0] || 'en';
  if (ttsLang !== 'fa') return null;

  const params = new URLSearchParams({ text });
  return `/api/tts/persian?${params.toString()}`;
}

function speakWithAudioTts(text, lang, buttonId) {
  const speechText = normalizeSpeechText(text);
  if (!speechText) return;

  const audioUrl = buildRemoteTtsUrl(speechText, lang);
  if (!audioUrl) {
    speak(speechText, lang, buttonId);
    return;
  }

  const requestId = ++speechRequestId;
  const btn = buttonId ? document.getElementById(buttonId) : null;

  if (pendingSpeechTimer) {
    window.clearTimeout(pendingSpeechTimer);
    pendingSpeechTimer = null;
  }

  if ('speechSynthesis' in window) {
    window.speechSynthesis.cancel();
  }

  stopActiveAudio();
  clearSpeakingState();

  const audio = new Audio(audioUrl);
  activeAudio = audio;

  const finish = () => {
    if (requestId !== speechRequestId) return;
    if (btn) btn.classList.remove('speaking');
    if (activeAudio === audio) activeAudio = null;
  };

  const fallbackToWebSpeech = () => {
    if (requestId !== speechRequestId) return;
    finish();
    speak(speechText, lang, buttonId);
  };

  if (btn) btn.classList.add('speaking');
  audio.onended = finish;
  audio.onerror = fallbackToWebSpeech;

  audio.play().catch(fallbackToWebSpeech);
}

async function speak(text, lang, buttonId) {
  if (!('speechSynthesis' in window)) {
    showToast('Speech is not available in this browser.');
    return;
  }

  const speechText = normalizeSpeechText(text);
  if (!speechText) return;

  const synth = window.speechSynthesis;
  const requestId = ++speechRequestId;
  const btn = buttonId ? document.getElementById(buttonId) : null;

  if (pendingSpeechTimer) {
    window.clearTimeout(pendingSpeechTimer);
    pendingSpeechTimer = null;
  }

  clearSpeakingState();
  stopActiveAudio();
  synth.cancel();
  synth.resume();

  // Refresh voices when available, but do not block the click on voice loading.
  if (cachedVoices.length === 0) {
    loadVoices();
  } else {
    refreshVoices();
  }

  pendingSpeechTimer = window.setTimeout(() => {
    if (requestId !== speechRequestId) return;
    pendingSpeechTimer = null;

    const utterance = new SpeechSynthesisUtterance(speechText);
    utterance.lang = lang;
    utterance.rate = 0.85;

    // Explicitly set voice when the browser exposes a matching one.
    const voice = findVoice(lang);
    if (voice) {
      utterance.voice = voice;
    }

    const finish = () => {
      if (requestId !== speechRequestId) return;
      if (btn) btn.classList.remove('speaking');
      if (activeUtterance === utterance) activeUtterance = null;
    };

    if (btn) btn.classList.add('speaking');
    utterance.onend = finish;
    utterance.onerror = (event) => {
      const speechError = event.error || '';
      if (!['canceled', 'cancelled', 'interrupted'].includes(speechError)) {
        console.warn('Speech failed:', speechError || event);
        showToast('No voice is available for this card.');
      }
      finish();
    };

    activeUtterance = utterance;
    synth.speak(utterance);
    synth.resume();
  }, 60);
}

// Preload voices as early as possible
if ('speechSynthesis' in window) {
  loadVoices(1000);
  addVoicesChangedListener(refreshVoices);
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

  const farsiScriptField = document.getElementById('farsi-script-field');
  const farsiScriptInput = document.getElementById('input-farsi-script');
  if (currentProfile === 'persian') {
    farsiScriptField.classList.remove('hidden');
  } else {
    farsiScriptField.classList.add('hidden');
    farsiScriptInput.value = '';
  }
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

  // Update notification button state
  initNotifications();
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
  const farsi_script = currentProfile === 'persian'
    ? document.getElementById('input-farsi-script').value.trim()
    : '';

  await api('/cards', {
    method: 'POST',
    body: JSON.stringify({ dutch, english, category_id, example_nl, example_en, farsi_script }),
  });

  document.getElementById('add-form').reset();
  document.getElementById('category-suggestion-hint').classList.add('hidden');
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
    const speech = getPersianFrontSpeech(card);
    speakWithAudioTts(speech.text, speech.lang, 'btn-speak-front');
  } else {
    speak(card.dutch, p.frontLang, 'btn-speak-front');
  }
});

document.getElementById('btn-speak-back').addEventListener('click', (e) => {
  e.stopPropagation();
  const card = cards[currentIndex];
  if (card) speak(card.english, 'en-US', 'btn-speak-back');
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

// Auto-suggest category when English translation changes
let suggestTimeout = null;
document.getElementById('input-english').addEventListener('input', (e) => {
  clearTimeout(suggestTimeout);
  const english = e.target.value.trim();
  if (english.length < 2) return;

  suggestTimeout = setTimeout(async () => {
    const result = await api(`/categories/suggest?profile=${currentProfile}&english=${encodeURIComponent(english)}`);
    if (result.suggestion) {
      const select = document.getElementById('input-category');
      select.value = result.suggestion.id;
      const hint = document.getElementById('category-suggestion-hint');
      hint.textContent = `Auto-suggested: ${result.suggestion.emoji} ${result.suggestion.name}`;
      hint.classList.remove('hidden');
    }
  }, 400);
});

document.getElementById('input-category').addEventListener('change', () => {
  document.getElementById('category-suggestion-hint').classList.add('hidden');
});

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

// --- Push Notifications ---
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

async function initNotifications() {
  const btn = document.getElementById('btn-notifications');
  btn.style.display = '';

  const hasNotification = 'Notification' in window;
  const hasPushManager = 'PushManager' in window;
  const hasSW = 'serviceWorker' in navigator;
  const isStandalone = window.navigator.standalone === true || window.matchMedia('(display-mode: standalone)').matches;

  if (!hasNotification || !hasPushManager || !hasSW) {
    if (!isStandalone) {
      btn.textContent = 'Add to Home Screen for notifications';
    } else {
      btn.textContent = 'Notifications not supported';
    }
    btn.disabled = true;
    return;
  }

  btn.disabled = false;

  if (Notification.permission === 'denied') {
    btn.textContent = 'Notifications Blocked';
    btn.disabled = true;
    btn.classList.remove('btn-notif-active');
    return;
  }

  if (Notification.permission === 'granted') {
    const reg = await navigator.serviceWorker.ready;
    const subscription = await reg.pushManager.getSubscription();
    if (subscription) {
      btn.textContent = 'Disable Notifications';
      btn.classList.add('btn-notif-active');
      return;
    }
  }

  btn.textContent = 'Enable Notifications';
  btn.disabled = false;
  btn.classList.remove('btn-notif-active');
}

async function subscribePush() {
  try {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      showToast('Notification permission denied');
      initNotifications();
      return;
    }

    const { publicKey } = await api('/push/vapid-public-key');
    const vapidKey = urlBase64ToUint8Array(publicKey);

    const reg = await navigator.serviceWorker.ready;
    const subscription = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: vapidKey,
    });

    await api('/push/subscribe', {
      method: 'POST',
      body: JSON.stringify({ profile: currentProfile, subscription: subscription.toJSON() }),
    });

    showToast('Notifications enabled!');
    initNotifications();
  } catch (err) {
    console.error('Push subscription failed:', err);
    showToast('Could not enable notifications');
  }
}

async function unsubscribePush() {
  try {
    const reg = await navigator.serviceWorker.ready;
    const subscription = await reg.pushManager.getSubscription();
    if (subscription) {
      await api('/push/subscribe', {
        method: 'DELETE',
        body: JSON.stringify({ endpoint: subscription.endpoint }),
      });
      await subscription.unsubscribe();
      showToast('Notifications disabled');
    }
    initNotifications();
  } catch (err) {
    console.error('Unsubscribe failed:', err);
    showToast('Could not disable notifications');
  }
}

document.getElementById('btn-notifications').addEventListener('click', async () => {
  const reg = await navigator.serviceWorker.ready;
  const subscription = await reg.pushManager.getSubscription();
  if (subscription) {
    unsubscribePush();
  } else {
    subscribePush();
  }
});

// --- Init ---
// Highlight last used profile
const lastProfile = localStorage.getItem('lastProfile');
if (lastProfile) {
  const btn = document.querySelector(`.profile-card[data-profile="${lastProfile}"]`);
  if (btn) btn.classList.add('last-used');
}
showScreen('profile');
