require('dotenv').config();
const fs = require('fs');
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Read the extracted text
const text = fs.readFileSync('/tmp/dutch_vocab.txt', 'utf8');
const lines = text.split('\n');

// Categories mapping from chapters
const chapterCategories = {
  'Introductie': { name: 'Introductie', emoji: '📖' },
  'Hoofdstuk 1': { name: 'H1 - Kennismaken', emoji: '👋' },
  'Hoofdstuk 2': { name: 'H2 - Familie & Werk', emoji: '👨‍👩‍👧‍👦' },
  'Hoofdstuk 3': { name: 'H3 - Getallen & Data', emoji: '🔢' },
  'Hoofdstuk 4': { name: 'H4 - Tijd & Afspraken', emoji: '⏰' },
  'Hoofdstuk 5': { name: 'H5 - Plannen', emoji: '📅' },
  'Hoofdstuk 6': { name: 'H6 - Eten & Drinken', emoji: '🍽️' },
  'Hoofdstuk 7': { name: 'H7 - Smaak & Mening', emoji: '💬' },
  'Hoofdstuk 8': { name: 'H8 - Boodschappen', emoji: '🛒' },
  'Hoofdstuk 9': { name: 'H9 - Winkelen', emoji: '🛍️' },
  'Hoofdstuk 10': { name: 'H10 - Dagelijks Leven', emoji: '🏠' },
  'Hoofdstuk 11': { name: 'H11 - Uiterlijk & Familie', emoji: '👥' },
  'Hoofdstuk 12': { name: 'H12 - Reizen & Vervoer', emoji: '🚆' },
  'Hoofdstuk 13': { name: 'H13 - Lichaam & Gezondheid', emoji: '🏥' },
  'Hoofdstuk 14': { name: 'H14 - Documenten', emoji: '📄' },
  'Hoofdstuk 15': { name: 'H15 - Feesten & Weer', emoji: '🎉' },
  'Het Wat-weet-je-al-spel': { name: 'H5b - Spel', emoji: '🎲' },
};

// Parse the vocabulary
const cards = [];
let currentChapter = null;
let currentSection = null;

// Lines that are page headers/footers or section markers (not vocab)
const skipPatterns = [
  /^Nederlands\s+Engels/,
  /^Woordenlijst per hoofdstuk/,
  /^\d+\s+honderd/,
  /^honderd/,
  /^tweehonderd/,
  /^Andere taal/,
  /^Leer ook:/,
  /^–\s+de preposities/,
  /^–\s+de getallen/,
  /^–\s+de maanden/,
  /^–\s+de dagen/,
  /^–\s+Sport je/,
  /^–\s+de preposities/,
  /^–\s+eventueel/,
  /^–\s+de Nederlandse naam/,
  /^Uitleg woordenlijst/,
  /^In deze lijst/,
  /^staan in de lijst/,
  /^taalniveau/,
  /^elkaar\./,
  /^elke groep/,
  /^Alle woorden/,
  /^vertaald/,
  /^de context/,
  /^woord\./,
  /^De preposities/,
  /^op p\./,
  /^Toelichting/,
  /^Van alle/,
  /^Uitzondering/,
  /^steeds de/,
  /^Bij alle/,
  /^én de/,
  /^participium/,
  /^In de woordenlijst/,
  /^tussen haakjes/,
  /^Heeft het woord/,
  /^pluralisvorm/,
  /^Afgeleide/,
  /^direct onder/,
  /^haakjes/,
  /^transcripties/,
  /^voorkomen/,
  /^Afkortingen/,
  /^Eng\. =/,
  /^Fr\. =/,
  /^De uitspraak/,
  /^f\s+=\s+female/,
  /^m\s+=\s+male/,
  /^pl\s+=\s+pluralis/,
];

const sectionHeaders = [
  'verba', 'speciale verba', 'substantieven', 'adjectieven',
  'andere woorden', 'zinnen en vragen', 'vaste combinaties',
  'nouns', 'verbs', 'special verbs', 'adjectives', 'other words',
  'sentences and questions', 'collocations'
];

function isPageNumber(line) {
  return /^\d+\s/.test(line.trim()) && /honderd|tweehonderd/.test(line);
}

function isChapterHeader(line) {
  const trimmed = line.trim();
  for (const key of Object.keys(chapterCategories)) {
    if (trimmed === key) return key;
  }
  return null;
}

function isSectionHeader(line) {
  const trimmed = line.trim().toLowerCase();
  return sectionHeaders.includes(trimmed);
}

function shouldSkip(line) {
  const trimmed = line.trim();
  if (!trimmed) return true;
  if (isPageNumber(trimmed)) return true;
  for (const pat of skipPatterns) {
    if (pat.test(trimmed)) return true;
  }
  return false;
}

// Check if a line is an example sentence (indented, starts with a specific pattern)
function isExampleLine(line) {
  // Example lines are indented more than vocab lines
  const leadingSpaces = line.match(/^(\s*)/)[1].length;
  const trimmed = line.trim();
  // Example sentences often start with a capital and contain full sentences
  // or they are continuation lines of multi-line entries
  return leadingSpaces >= 4 && trimmed.length > 0 && !isSectionHeader(line);
}

// Main parsing: extract Dutch-English pairs from each line
// The format is: Dutch (left column) followed by English (right column)
// separated by significant whitespace

function parseLine(line) {
  const trimmed = line.trim();
  if (!trimmed) return null;

  // Try to split by multiple spaces (the columns are separated by 2+ spaces)
  const match = trimmed.match(/^(.+?)\s{2,}(.+?)(\s{2,}.*)?$/);
  if (!match) return null;

  let dutch = match[1].trim();
  let english = match[2].trim();

  // Skip if english column is just "Andere taal"
  if (english === 'Andere taal' || english === '') return null;

  return { dutch, english };
}

// Process line by line
let i = 0;
let pendingExample = null;

while (i < lines.length) {
  const line = lines[i];
  const trimmed = line.trim();

  // Check for chapter headers
  const chapter = isChapterHeader(trimmed);
  if (chapter) {
    currentChapter = chapter;
    currentSection = null;
    i++;
    continue;
  }

  // Check for section headers
  if (isSectionHeader(trimmed)) {
    currentSection = trimmed.toLowerCase();
    i++;
    continue;
  }

  // Skip non-content lines
  if (shouldSkip(trimmed)) {
    i++;
    continue;
  }

  // Skip if no chapter yet
  if (!currentChapter) {
    i++;
    continue;
  }

  // Check if this is an example/continuation line (indented)
  const leadingSpaces = line.match(/^(\s*)/)[1].length;

  if (leadingSpaces >= 4 && cards.length > 0) {
    // This might be an example sentence for the previous card
    const parsed = parseLine(line);
    if (parsed) {
      const lastCard = cards[cards.length - 1];
      // If it looks like a sentence (has a verb/period/question mark)
      if (parsed.dutch.includes('.') || parsed.dutch.includes('?') || parsed.dutch.includes('!') ||
          parsed.dutch.length > 15) {
        if (!lastCard.example_nl) {
          lastCard.example_nl = parsed.dutch;
          lastCard.example_en = parsed.english;
        }
      } else {
        // It's a sub-entry (compound word), add as its own card
        cards.push({
          chapter: currentChapter,
          section: currentSection,
          dutch: parsed.dutch,
          english: parsed.english,
          example_nl: null,
          example_en: null,
        });
      }
    }
    i++;
    continue;
  }

  // Parse as vocabulary entry
  const parsed = parseLine(line);
  if (parsed) {
    // Skip section header pairs like "verba    verbs"
    const dlc = parsed.dutch.toLowerCase();
    if (sectionHeaders.includes(dlc)) {
      currentSection = dlc;
      i++;
      continue;
    }

    // Skip meta lines
    if (parsed.dutch.startsWith('Leer ook') || parsed.dutch.startsWith('–')) {
      i++;
      continue;
    }

    cards.push({
      chapter: currentChapter,
      section: currentSection,
      dutch: parsed.dutch,
      english: parsed.english,
      example_nl: null,
      example_en: null,
    });
  }

  i++;
}

// Clean up dutch entries: remove conjugation hints for cleaner display
// but keep them as they are useful for learning
function cleanDutch(text) {
  return text
    .replace(/\s+/g, ' ')
    .trim();
}

function cleanEnglish(text) {
  return text
    .replace(/\s+/g, ' ')
    .trim();
}

// Deduplicate cards (same dutch+english in same chapter)
const seen = new Set();
const uniqueCards = cards.filter(c => {
  const key = `${c.chapter}|${c.dutch}|${c.english}`;
  if (seen.has(key)) return false;
  seen.add(key);
  return true;
});

console.log(`\nParsed ${uniqueCards.length} unique vocabulary entries across ${Object.keys(chapterCategories).length} chapters\n`);

// Show summary per chapter
const chapterCounts = {};
uniqueCards.forEach(c => {
  chapterCounts[c.chapter] = (chapterCounts[c.chapter] || 0) + 1;
});
for (const [ch, count] of Object.entries(chapterCounts)) {
  const cat = chapterCategories[ch];
  console.log(`  ${cat.emoji} ${cat.name}: ${count} words`);
}

async function importCards() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Create categories for each chapter
    const catIdMap = {};
    for (const [key, cat] of Object.entries(chapterCategories)) {
      const res = await client.query(
        `INSERT INTO categories (name, emoji)
         VALUES ($1, $2)
         ON CONFLICT (name) DO UPDATE SET emoji = $2
         RETURNING id`,
        [cat.name, cat.emoji]
      );
      catIdMap[key] = res.rows[0].id;
    }

    // Insert cards
    let inserted = 0;
    for (const card of uniqueCards) {
      const catId = catIdMap[card.chapter];
      if (!catId) continue;

      const dutch = cleanDutch(card.dutch);
      const english = cleanEnglish(card.english);

      // Skip very short or meaningless entries
      if (dutch.length < 1 || english.length < 1) continue;

      // Check if card already exists
      const existing = await client.query(
        'SELECT id FROM cards WHERE dutch = $1 AND category_id = $2',
        [dutch, catId]
      );

      if (existing.rows.length > 0) continue;

      const res = await client.query(
        `INSERT INTO cards (category_id, dutch, english, example_nl, example_en)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id`,
        [catId, dutch, english, card.example_nl, card.example_en]
      );

      await client.query(
        'INSERT INTO progress (card_id) VALUES ($1) ON CONFLICT (card_id) DO NOTHING',
        [res.rows[0].id]
      );

      inserted++;
    }

    await client.query('COMMIT');
    console.log(`\nImported ${inserted} new cards into the database!`);

  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

importCards().catch(err => {
  console.error('Error importing:', err);
  process.exit(1);
});
