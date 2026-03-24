require('dotenv').config();
const express = require('express');
const path = require('path');
const { Pool } = require('pg');

const app = express();
const PORT = process.env.PORT || 3000;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// --- API Routes ---

// Get all categories with card counts
app.get('/api/categories', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT c.id, c.name, c.emoji,
        COUNT(ca.id) as total_cards,
        COUNT(CASE WHEN p.repetitions > 0 THEN 1 END) as learned_cards
      FROM categories c
      LEFT JOIN cards ca ON ca.category_id = c.id
      LEFT JOIN progress p ON p.card_id = ca.id
      GROUP BY c.id, c.name, c.emoji
      ORDER BY c.id
    `);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get due cards (cards ready for review)
app.get('/api/cards/due', async (req, res) => {
  try {
    const categoryId = req.query.category;
    const limit = parseInt(req.query.limit) || 20;

    let query = `
      SELECT ca.id, ca.dutch, ca.english, ca.example_nl, ca.example_en,
        cat.name as category, cat.emoji,
        p.repetitions, p.ease_factor, p.interval_days, p.next_review,
        p.times_correct, p.times_wrong
      FROM cards ca
      JOIN categories cat ON cat.id = ca.category_id
      JOIN progress p ON p.card_id = ca.id
      WHERE p.next_review <= NOW() AND p.mastered = false
    `;
    const params = [];

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
    const categoryId = req.query.category;

    let query = `
      SELECT ca.id, ca.dutch, ca.english, ca.example_nl, ca.example_en,
        cat.name as category, cat.emoji,
        p.repetitions, p.ease_factor, p.interval_days, p.next_review,
        p.times_correct, p.times_wrong
      FROM cards ca
      JOIN categories cat ON cat.id = ca.category_id
      JOIN progress p ON p.card_id = ca.id
      WHERE p.mastered = false
    `;
    const params = [];

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
    const result = await pool.query(`
      SELECT
        COUNT(*) as total_cards,
        COUNT(CASE WHEN repetitions > 0 THEN 1 END) as learned,
        COUNT(CASE WHEN next_review <= NOW() AND mastered = false THEN 1 END) as due_now,
        COUNT(CASE WHEN mastered = true THEN 1 END) as mastered,
        COALESCE(SUM(times_correct), 0) as total_correct,
        COALESCE(SUM(times_wrong), 0) as total_wrong
      FROM progress
    `);
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Add a new card
app.post('/api/cards', async (req, res) => {
  try {
    const { dutch, english, category_id, example_nl, example_en } = req.body;

    if (!dutch || !english || !category_id) {
      return res.status(400).json({ error: 'dutch, english, and category_id are required' });
    }

    const cardResult = await pool.query(
      `INSERT INTO cards (dutch, english, category_id, example_nl, example_en)
       VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      [dutch, english, category_id, example_nl || null, example_en || null]
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

// SPA fallback (Express 5 syntax)
app.get('/{*splat}', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Dutch Flashcard app running on http://localhost:${PORT}`);
});
