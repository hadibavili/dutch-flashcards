require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function init() {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS categories (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL UNIQUE,
        emoji VARCHAR(10) DEFAULT '📚'
      );

      CREATE TABLE IF NOT EXISTS cards (
        id SERIAL PRIMARY KEY,
        category_id INTEGER REFERENCES categories(id),
        dutch VARCHAR(500) NOT NULL,
        english VARCHAR(500) NOT NULL,
        example_nl VARCHAR(500),
        example_en VARCHAR(500),
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS progress (
        id SERIAL PRIMARY KEY,
        card_id INTEGER REFERENCES cards(id) UNIQUE,
        repetitions INTEGER DEFAULT 0,
        ease_factor REAL DEFAULT 2.5,
        interval_days REAL DEFAULT 0,
        next_review TIMESTAMP DEFAULT NOW(),
        last_reviewed TIMESTAMP,
        times_correct INTEGER DEFAULT 0,
        times_wrong INTEGER DEFAULT 0
      );
    `);
    console.log('Database tables created successfully!');
  } finally {
    client.release();
    await pool.end();
  }
}

init().catch(err => {
  console.error('Error initializing database:', err);
  process.exit(1);
});
