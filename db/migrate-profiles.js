require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function migrate() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Add profile_id column to categories
    await client.query(`
      ALTER TABLE categories ADD COLUMN IF NOT EXISTS profile_id VARCHAR(20) NOT NULL DEFAULT 'dutch'
    `);

    // Drop old unique constraint on name (may have different names)
    const constraints = await client.query(`
      SELECT conname FROM pg_constraint
      WHERE conrelid = 'categories'::regclass
        AND contype = 'u'
        AND conname != 'categories_profile_name_unique'
    `);
    for (const row of constraints.rows) {
      await client.query(`ALTER TABLE categories DROP CONSTRAINT IF EXISTS "${row.conname}"`);
    }

    // Add new composite unique constraint
    await client.query(`
      DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'categories_profile_name_unique'
        ) THEN
          ALTER TABLE categories ADD CONSTRAINT categories_profile_name_unique UNIQUE(profile_id, name);
        END IF;
      END $$;
    `);

    // Add farsi_script column to cards
    await client.query(`
      ALTER TABLE cards ADD COLUMN IF NOT EXISTS farsi_script VARCHAR(500)
    `);

    await client.query('COMMIT');
    console.log('Migration complete! Added profile_id to categories and farsi_script to cards.');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

migrate().catch(err => {
  console.error('Migration error:', err);
  process.exit(1);
});
