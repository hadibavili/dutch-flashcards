require('dotenv').config();
const express = require('express');
const path = require('path');
const { Pool } = require('pg');
const webpush = require('web-push');
const cron = require('node-cron');
const { suggestCategory } = require('./category-suggest');

const app = express();
const PORT = process.env.PORT || 3000;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

const persianTtsCache = new Map();
const PERSIAN_TTS_VOICE = 'fa-IR-DilaraNeural';
const OPENAI_TTS_MODEL = process.env.OPENAI_TTS_MODEL || 'gpt-4o-mini-tts';
const OPENAI_TTS_VOICE = process.env.OPENAI_TTS_VOICE || 'marin';
const MAX_TTS_TEXT_LENGTH = 500;
const MAX_TTS_CACHE_ITEMS = 200;

function getPersianTtsCacheKey(provider, text) {
  return `${provider}:${text}`;
}

function cachePersianTts(provider, text, audioBuffer) {
  if (persianTtsCache.size >= MAX_TTS_CACHE_ITEMS) {
    const oldestKey = persianTtsCache.keys().next().value;
    persianTtsCache.delete(oldestKey);
  }
  persianTtsCache.set(getPersianTtsCacheKey(provider, text), audioBuffer);
}

async function generateOpenAiPersianTts(text) {
  if (!process.env.OPENAI_API_KEY) return null;

  const response = await fetch('https://api.openai.com/v1/audio/speech', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: OPENAI_TTS_MODEL,
      voice: OPENAI_TTS_VOICE,
      input: text,
      response_format: 'mp3',
      instructions: 'Speak in natural Persian (Farsi), clearly and without adding extra words.',
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('OpenAI Persian TTS failed:', response.status, errorText);
    throw new Error('OpenAI TTS service failed');
  }

  return Buffer.from(await response.arrayBuffer());
}

async function generateFreePersianTts(text) {
  const ttsResult = await fetch('https://freetts.org/api/tts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      text,
      voice: PERSIAN_TTS_VOICE,
      rate: '-10%',
      pitch: '+0Hz',
    }),
  });

  if (!ttsResult.ok) {
    const errorText = await ttsResult.text();
    console.error('Persian TTS generation failed:', ttsResult.status, errorText);
    throw new Error('FreeTTS service failed');
  }

  const { file_id } = await ttsResult.json();
  if (!file_id) {
    throw new Error('FreeTTS service returned no audio id');
  }

  const audioResult = await fetch(`https://freetts.org/api/audio/${encodeURIComponent(file_id)}`);
  if (!audioResult.ok) {
    const errorText = await audioResult.text();
    console.error('Persian TTS audio download failed:', audioResult.status, errorText);
    throw new Error('FreeTTS audio download failed');
  }

  return Buffer.from(await audioResult.arrayBuffer());
}

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// --- Web Push Setup ---
if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || 'mailto:example@example.com',
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );
}

// --- API Routes ---

// Persian TTS proxy. Browsers often have no local fa-IR Web Speech voice.
app.get('/api/tts/persian', async (req, res) => {
  try {
    const text = (req.query.text || '').trim();

    if (!text) {
      return res.status(400).json({ error: 'text is required' });
    }

    if (text.length > MAX_TTS_TEXT_LENGTH) {
      return res.status(400).json({ error: 'text is too long' });
    }

    const provider = process.env.OPENAI_API_KEY ? 'openai' : 'freetts';
    const cachedAudio = persianTtsCache.get(getPersianTtsCacheKey(provider, text));
    if (cachedAudio) {
      res.set('Content-Type', 'audio/mpeg');
      res.set('Cache-Control', 'public, max-age=3600');
      return res.send(cachedAudio);
    }

    const audioBuffer = await generateOpenAiPersianTts(text) || await generateFreePersianTts(text);
    cachePersianTts(provider, text, audioBuffer);

    res.set('Content-Type', 'audio/mpeg');
    res.set('Cache-Control', 'public, max-age=3600');
    res.send(audioBuffer);
  } catch (err) {
    console.error('Persian TTS error:', err);
    res.status(500).json({ error: 'TTS server error' });
  }
});

// Get all categories with card counts
app.get('/api/categories', async (req, res) => {
  try {
    const profile = req.query.profile || 'dutch';
    const result = await pool.query(`
      SELECT c.id, c.name, c.emoji,
        COUNT(ca.id) as total_cards,
        COUNT(CASE WHEN p.repetitions > 0 THEN 1 END) as learned_cards
      FROM categories c
      LEFT JOIN cards ca ON ca.category_id = c.id
      LEFT JOIN progress p ON p.card_id = ca.id
      WHERE c.profile_id = $1
      GROUP BY c.id, c.name, c.emoji
      ORDER BY c.id
    `, [profile]);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Suggest a category based on English translation
app.get('/api/categories/suggest', async (req, res) => {
  try {
    const profile = req.query.profile || 'dutch';
    const english = req.query.english || '';

    if (!english.trim()) {
      return res.json({ suggestion: null });
    }

    const catResult = await pool.query(
      'SELECT id, name, emoji FROM categories WHERE profile_id = $1 ORDER BY id',
      [profile]
    );

    const suggestion = suggestCategory(english, profile, catResult.rows);
    res.json({ suggestion });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get due cards (cards ready for review)
app.get('/api/cards/due', async (req, res) => {
  try {
    const profile = req.query.profile || 'dutch';
    const categoryId = req.query.category;
    const limit = parseInt(req.query.limit) || 20;

    let query = `
      SELECT ca.id, ca.dutch, ca.english, ca.example_nl, ca.example_en, ca.farsi_script,
        cat.name as category, cat.emoji,
        p.repetitions, p.ease_factor, p.interval_days, p.next_review,
        p.times_correct, p.times_wrong
      FROM cards ca
      JOIN categories cat ON cat.id = ca.category_id
      JOIN progress p ON p.card_id = ca.id
      WHERE p.next_review <= NOW() AND p.mastered = false AND cat.profile_id = $1
    `;
    const params = [profile];

    if (categoryId) {
      params.push(categoryId);
      query += ` AND ca.category_id = $${params.length}`;
    }

    query += ' ORDER BY p.next_review ASC';
    params.push(limit);
    query += ` LIMIT $${params.length}`;

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get all cards (for browse mode)
app.get('/api/cards', async (req, res) => {
  try {
    const profile = req.query.profile || 'dutch';
    const categoryId = req.query.category;

    let query = `
      SELECT ca.id, ca.dutch, ca.english, ca.example_nl, ca.example_en, ca.farsi_script,
        cat.name as category, cat.emoji,
        p.repetitions, p.ease_factor, p.interval_days, p.next_review,
        p.times_correct, p.times_wrong
      FROM cards ca
      JOIN categories cat ON cat.id = ca.category_id
      JOIN progress p ON p.card_id = ca.id
      WHERE p.mastered = false AND cat.profile_id = $1
    `;
    const params = [profile];

    if (categoryId) {
      params.push(categoryId);
      query += ` AND ca.category_id = $${params.length}`;
    }

    query += ' ORDER BY ca.id';
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Submit a review (spaced repetition logic)
app.post('/api/cards/:id/review', async (req, res) => {
  try {
    const cardId = parseInt(req.params.id);
    const { rating } = req.body; // 0 = wrong, 1 = hard, 2 = good, 3 = easy

    if (rating === undefined || rating < 0 || rating > 3) {
      return res.status(400).json({ error: 'Rating must be 0-3' });
    }

    // Get current progress
    const current = await pool.query(
      'SELECT * FROM progress WHERE card_id = $1',
      [cardId]
    );

    if (current.rows.length === 0) {
      return res.status(404).json({ error: 'Card not found' });
    }

    const p = current.rows[0];
    let { repetitions, ease_factor, interval_days } = p;

    // SM-2 inspired algorithm
    if (rating === 0) {
      // Wrong: reset
      repetitions = 0;
      interval_days = 0;
      ease_factor = Math.max(1.3, ease_factor - 0.2);
    } else {
      // Correct (hard/good/easy)
      repetitions += 1;

      if (repetitions === 1) {
        interval_days = rating === 1 ? 0.0069 : rating === 2 ? 1 : 2; // hard=~10min, good=1day, easy=2days
      } else if (repetitions === 2) {
        interval_days = rating === 1 ? 1 : rating === 2 ? 3 : 6;
      } else {
        interval_days = interval_days * ease_factor;
      }

      // Adjust ease factor
      if (rating === 1) ease_factor = Math.max(1.3, ease_factor - 0.15);
      else if (rating === 3) ease_factor = ease_factor + 0.15;
    }

    // Calculate next review time
    const intervalMs = interval_days * 24 * 60 * 60 * 1000;
    const nextReview = new Date(Date.now() + intervalMs);

    // Update progress
    const timesCorrect = p.times_correct + (rating > 0 ? 1 : 0);
    const timesWrong = p.times_wrong + (rating === 0 ? 1 : 0);

    await pool.query(`
      UPDATE progress
      SET repetitions = $1, ease_factor = $2, interval_days = $3,
          next_review = $4, last_reviewed = NOW(),
          times_correct = $5, times_wrong = $6
      WHERE card_id = $7
    `, [repetitions, ease_factor, interval_days, nextReview, timesCorrect, timesWrong, cardId]);

    res.json({
      repetitions, ease_factor, interval_days,
      next_review: nextReview,
      times_correct: timesCorrect,
      times_wrong: timesWrong
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Mark a card as mastered (never show again)
app.post('/api/cards/:id/master', async (req, res) => {
  try {
    const cardId = parseInt(req.params.id);
    await pool.query(
      'UPDATE progress SET mastered = true WHERE card_id = $1',
      [cardId]
    );
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get overall stats
app.get('/api/stats', async (req, res) => {
  try {
    const profile = req.query.profile || 'dutch';
    const result = await pool.query(`
      SELECT
        COUNT(*) as total_cards,
        COUNT(CASE WHEN p.repetitions > 0 THEN 1 END) as learned,
        COUNT(CASE WHEN p.next_review <= NOW() AND p.mastered = false THEN 1 END) as due_now,
        COUNT(CASE WHEN p.mastered = true THEN 1 END) as mastered,
        COALESCE(SUM(p.times_correct), 0) as total_correct,
        COALESCE(SUM(p.times_wrong), 0) as total_wrong
      FROM progress p
      JOIN cards ca ON ca.id = p.card_id
      JOIN categories cat ON cat.id = ca.category_id
      WHERE cat.profile_id = $1
    `, [profile]);
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Add a new card
app.post('/api/cards', async (req, res) => {
  try {
    const { dutch, english, category_id, example_nl, example_en, farsi_script } = req.body;

    if (!dutch || !english || !category_id) {
      return res.status(400).json({ error: 'dutch, english, and category_id are required' });
    }

    const cardResult = await pool.query(
      `INSERT INTO cards (dutch, english, category_id, example_nl, example_en, farsi_script)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
      [dutch, english, category_id, example_nl || null, example_en || null, farsi_script || null]
    );

    await pool.query(
      'INSERT INTO progress (card_id) VALUES ($1)',
      [cardResult.rows[0].id]
    );

    res.status(201).json({ id: cardResult.rows[0].id, dutch, english });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// --- Push Notification Endpoints ---

app.get('/api/push/vapid-public-key', (req, res) => {
  res.json({ publicKey: process.env.VAPID_PUBLIC_KEY || '' });
});

app.post('/api/push/subscribe', async (req, res) => {
  try {
    const { profile, subscription } = req.body;
    if (!profile || !subscription?.endpoint || !subscription?.keys) {
      return res.status(400).json({ error: 'profile and subscription required' });
    }
    await pool.query(`
      INSERT INTO push_subscriptions (profile_id, endpoint, p256dh, auth)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (endpoint) DO UPDATE
      SET profile_id = $1, p256dh = $3, auth = $4
    `, [profile, subscription.endpoint, subscription.keys.p256dh, subscription.keys.auth]);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.delete('/api/push/subscribe', async (req, res) => {
  try {
    const { endpoint } = req.body;
    if (!endpoint) return res.status(400).json({ error: 'endpoint required' });
    await pool.query('DELETE FROM push_subscriptions WHERE endpoint = $1', [endpoint]);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// --- Daily Push Notification Cron (10 PM Amsterdam) ---
async function sendDailyPush() {
  console.log('[CRON] Sending daily push notifications...');
  const profiles = ['dutch', 'persian'];
  const profileNames = { dutch: 'Hadi', persian: 'Nadine' };

  for (const profile of profiles) {
    try {
      const statsResult = await pool.query(`
        SELECT COUNT(*) as due_now
        FROM progress p
        JOIN cards ca ON ca.id = p.card_id
        JOIN categories cat ON cat.id = ca.category_id
        WHERE p.next_review <= NOW() AND p.mastered = false AND cat.profile_id = $1
      `, [profile]);
      const dueCount = parseInt(statsResult.rows[0].due_now);

      const subsResult = await pool.query(
        'SELECT * FROM push_subscriptions WHERE profile_id = $1',
        [profile]
      );
      if (subsResult.rows.length === 0) continue;

      const name = profileNames[profile];
      const body = dueCount > 0
        ? `${name}, you have ${dueCount} card${dueCount !== 1 ? 's' : ''} due for review!`
        : `${name}, great job! No cards due. Keep it up!`;

      const payload = JSON.stringify({
        title: 'Flashcards',
        body,
        icon: '/icon-192.svg',
        data: { url: '/' },
      });

      for (const sub of subsResult.rows) {
        try {
          await webpush.sendNotification(
            { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
            payload
          );
        } catch (err) {
          if (err.statusCode === 410 || err.statusCode === 404) {
            await pool.query('DELETE FROM push_subscriptions WHERE endpoint = $1', [sub.endpoint]);
            console.log(`[CRON] Removed expired subscription for ${profile}`);
          } else {
            console.error(`[CRON] Push error for ${profile}:`, err.message);
          }
        }
      }
    } catch (err) {
      console.error(`[CRON] Error for ${profile}:`, err);
    }
  }
  console.log('[CRON] Push notifications sent.');
}

cron.schedule('0 22 * * *', sendDailyPush, { timezone: 'Europe/Amsterdam' });

// Test endpoint (send push now)
app.post('/api/push/test', async (req, res) => {
  try {
    await sendDailyPush();
    res.json({ sent: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to send' });
  }
});

// SPA fallback (Express 5 syntax)
app.get('/{*splat}', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Flashcard app running on http://localhost:${PORT}`);
});
