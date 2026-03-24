require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

const categories = [
  { name: 'Greetings', emoji: '👋' },
  { name: 'Numbers', emoji: '🔢' },
  { name: 'Food & Drink', emoji: '🍽️' },
  { name: 'Daily Life', emoji: '🏠' },
  { name: 'Travel', emoji: '✈️' },
  { name: 'People', emoji: '👥' },
  { name: 'Colors', emoji: '🎨' },
  { name: 'Time', emoji: '⏰' },
];

const cards = [
  // Greetings
  { cat: 'Greetings', dutch: 'Hallo', english: 'Hello', example_nl: 'Hallo, hoe gaat het?', example_en: 'Hello, how are you?' },
  { cat: 'Greetings', dutch: 'Goedemorgen', english: 'Good morning', example_nl: 'Goedemorgen! Lekker geslapen?', example_en: 'Good morning! Did you sleep well?' },
  { cat: 'Greetings', dutch: 'Goedemiddag', english: 'Good afternoon', example_nl: 'Goedemiddag, kan ik u helpen?', example_en: 'Good afternoon, can I help you?' },
  { cat: 'Greetings', dutch: 'Goedenavond', english: 'Good evening', example_nl: 'Goedenavond, welkom!', example_en: 'Good evening, welcome!' },
  { cat: 'Greetings', dutch: 'Tot ziens', english: 'Goodbye', example_nl: 'Tot ziens, fijne dag!', example_en: 'Goodbye, have a nice day!' },
  { cat: 'Greetings', dutch: 'Dank je wel', english: 'Thank you', example_nl: 'Dank je wel voor je hulp.', example_en: 'Thank you for your help.' },
  { cat: 'Greetings', dutch: 'Alsjeblieft', english: 'Please / Here you go', example_nl: 'Alsjeblieft, je koffie.', example_en: 'Here you go, your coffee.' },
  { cat: 'Greetings', dutch: 'Sorry', english: 'Sorry', example_nl: 'Sorry, dat was mijn fout.', example_en: 'Sorry, that was my fault.' },
  { cat: 'Greetings', dutch: 'Ja', english: 'Yes', example_nl: 'Ja, dat klopt.', example_en: 'Yes, that is correct.' },
  { cat: 'Greetings', dutch: 'Nee', english: 'No', example_nl: 'Nee, dank je.', example_en: 'No, thank you.' },

  // Numbers
  { cat: 'Numbers', dutch: 'Één', english: 'One', example_nl: 'Ik heb één broer.', example_en: 'I have one brother.' },
  { cat: 'Numbers', dutch: 'Twee', english: 'Two', example_nl: 'Twee koffie, alsjeblieft.', example_en: 'Two coffees, please.' },
  { cat: 'Numbers', dutch: 'Drie', english: 'Three', example_nl: 'Ik heb drie katten.', example_en: 'I have three cats.' },
  { cat: 'Numbers', dutch: 'Vier', english: 'Four', example_nl: 'Het is vier uur.', example_en: 'It is four o\'clock.' },
  { cat: 'Numbers', dutch: 'Vijf', english: 'Five', example_nl: 'Vijf minuten nog.', example_en: 'Five more minutes.' },
  { cat: 'Numbers', dutch: 'Tien', english: 'Ten', example_nl: 'Tien euro, alsjeblieft.', example_en: 'Ten euros, please.' },
  { cat: 'Numbers', dutch: 'Twintig', english: 'Twenty', example_nl: 'Ik ben twintig jaar oud.', example_en: 'I am twenty years old.' },
  { cat: 'Numbers', dutch: 'Honderd', english: 'Hundred', example_nl: 'Het kost honderd euro.', example_en: 'It costs one hundred euros.' },

  // Food & Drink
  { cat: 'Food & Drink', dutch: 'Water', english: 'Water', example_nl: 'Mag ik een glas water?', example_en: 'May I have a glass of water?' },
  { cat: 'Food & Drink', dutch: 'Koffie', english: 'Coffee', example_nl: 'Ik drink graag koffie.', example_en: 'I like to drink coffee.' },
  { cat: 'Food & Drink', dutch: 'Brood', english: 'Bread', example_nl: 'We eten brood bij het ontbijt.', example_en: 'We eat bread for breakfast.' },
  { cat: 'Food & Drink', dutch: 'Kaas', english: 'Cheese', example_nl: 'Nederlandse kaas is lekker.', example_en: 'Dutch cheese is delicious.' },
  { cat: 'Food & Drink', dutch: 'Melk', english: 'Milk', example_nl: 'Wil je melk in je thee?', example_en: 'Do you want milk in your tea?' },
  { cat: 'Food & Drink', dutch: 'Bier', english: 'Beer', example_nl: 'Een biertje, alsjeblieft.', example_en: 'A beer, please.' },
  { cat: 'Food & Drink', dutch: 'Appel', english: 'Apple', example_nl: 'Deze appel is heel zoet.', example_en: 'This apple is very sweet.' },
  { cat: 'Food & Drink', dutch: 'Vis', english: 'Fish', example_nl: 'Ik eet graag vis.', example_en: 'I like to eat fish.' },

  // Daily Life
  { cat: 'Daily Life', dutch: 'Huis', english: 'House', example_nl: 'Ons huis is groot.', example_en: 'Our house is big.' },
  { cat: 'Daily Life', dutch: 'Werk', english: 'Work', example_nl: 'Ik ga naar mijn werk.', example_en: 'I am going to work.' },
  { cat: 'Daily Life', dutch: 'Boek', english: 'Book', example_nl: 'Dit boek is interessant.', example_en: 'This book is interesting.' },
  { cat: 'Daily Life', dutch: 'Telefoon', english: 'Phone', example_nl: 'Waar is mijn telefoon?', example_en: 'Where is my phone?' },
  { cat: 'Daily Life', dutch: 'Slapen', english: 'To sleep', example_nl: 'Ik wil slapen.', example_en: 'I want to sleep.' },
  { cat: 'Daily Life', dutch: 'Eten', english: 'To eat', example_nl: 'We gaan eten om zes uur.', example_en: 'We are going to eat at six.' },
  { cat: 'Daily Life', dutch: 'Lezen', english: 'To read', example_nl: 'Ik lees elke dag.', example_en: 'I read every day.' },
  { cat: 'Daily Life', dutch: 'Schrijven', english: 'To write', example_nl: 'Ik moet een brief schrijven.', example_en: 'I have to write a letter.' },

  // Travel
  { cat: 'Travel', dutch: 'Trein', english: 'Train', example_nl: 'De trein vertrekt om negen uur.', example_en: 'The train departs at nine.' },
  { cat: 'Travel', dutch: 'Fiets', english: 'Bicycle', example_nl: 'Ik ga met de fiets.', example_en: 'I go by bicycle.' },
  { cat: 'Travel', dutch: 'Vliegtuig', english: 'Airplane', example_nl: 'Het vliegtuig landt om drie uur.', example_en: 'The airplane lands at three.' },
  { cat: 'Travel', dutch: 'Hotel', english: 'Hotel', example_nl: 'Het hotel is in het centrum.', example_en: 'The hotel is in the center.' },
  { cat: 'Travel', dutch: 'Straat', english: 'Street', example_nl: 'De straat is heel lang.', example_en: 'The street is very long.' },
  { cat: 'Travel', dutch: 'Links', english: 'Left', example_nl: 'Ga naar links bij het kruispunt.', example_en: 'Go left at the intersection.' },
  { cat: 'Travel', dutch: 'Rechts', english: 'Right', example_nl: 'Het station is rechts.', example_en: 'The station is on the right.' },
  { cat: 'Travel', dutch: 'Kaartje', english: 'Ticket', example_nl: 'Ik wil een kaartje kopen.', example_en: 'I want to buy a ticket.' },

  // People
  { cat: 'People', dutch: 'Vriend', english: 'Friend', example_nl: 'Hij is mijn beste vriend.', example_en: 'He is my best friend.' },
  { cat: 'People', dutch: 'Familie', english: 'Family', example_nl: 'Mijn familie woont in Amsterdam.', example_en: 'My family lives in Amsterdam.' },
  { cat: 'People', dutch: 'Kind', english: 'Child', example_nl: 'Het kind speelt buiten.', example_en: 'The child plays outside.' },
  { cat: 'People', dutch: 'Man', english: 'Man', example_nl: 'De man leest de krant.', example_en: 'The man reads the newspaper.' },
  { cat: 'People', dutch: 'Vrouw', english: 'Woman', example_nl: 'De vrouw werkt in het ziekenhuis.', example_en: 'The woman works at the hospital.' },
  { cat: 'People', dutch: 'Leraar', english: 'Teacher', example_nl: 'De leraar is heel aardig.', example_en: 'The teacher is very nice.' },

  // Colors
  { cat: 'Colors', dutch: 'Rood', english: 'Red', example_nl: 'De auto is rood.', example_en: 'The car is red.' },
  { cat: 'Colors', dutch: 'Blauw', english: 'Blue', example_nl: 'De lucht is blauw.', example_en: 'The sky is blue.' },
  { cat: 'Colors', dutch: 'Groen', english: 'Green', example_nl: 'Het gras is groen.', example_en: 'The grass is green.' },
  { cat: 'Colors', dutch: 'Geel', english: 'Yellow', example_nl: 'De zon is geel.', example_en: 'The sun is yellow.' },
  { cat: 'Colors', dutch: 'Zwart', english: 'Black', example_nl: 'De kat is zwart.', example_en: 'The cat is black.' },
  { cat: 'Colors', dutch: 'Wit', english: 'White', example_nl: 'De sneeuw is wit.', example_en: 'The snow is white.' },

  // Time
  { cat: 'Time', dutch: 'Vandaag', english: 'Today', example_nl: 'Vandaag is het mooi weer.', example_en: 'Today the weather is nice.' },
  { cat: 'Time', dutch: 'Morgen', english: 'Tomorrow', example_nl: 'Morgen ga ik naar school.', example_en: 'Tomorrow I go to school.' },
  { cat: 'Time', dutch: 'Gisteren', english: 'Yesterday', example_nl: 'Gisteren was het koud.', example_en: 'Yesterday it was cold.' },
  { cat: 'Time', dutch: 'Nu', english: 'Now', example_nl: 'Ik moet nu gaan.', example_en: 'I have to go now.' },
  { cat: 'Time', dutch: 'Altijd', english: 'Always', example_nl: 'Ik drink altijd koffie.', example_en: 'I always drink coffee.' },
  { cat: 'Time', dutch: 'Nooit', english: 'Never', example_nl: 'Ik ben nooit in Japan geweest.', example_en: 'I have never been to Japan.' },
];

async function seed() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Insert categories
    for (const cat of categories) {
      await client.query(
        'INSERT INTO categories (name, emoji) VALUES ($1, $2) ON CONFLICT (name) DO NOTHING',
        [cat.name, cat.emoji]
      );
    }

    // Get category IDs
    const catRows = await client.query('SELECT id, name FROM categories');
    const catMap = {};
    catRows.rows.forEach(r => { catMap[r.name] = r.id; });

    // Insert cards
    for (const card of cards) {
      const res = await client.query(
        `INSERT INTO cards (category_id, dutch, english, example_nl, example_en)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT DO NOTHING
         RETURNING id`,
        [catMap[card.cat], card.dutch, card.english, card.example_nl, card.example_en]
      );

      // Create progress entry for each card
      if (res.rows.length > 0) {
        await client.query(
          'INSERT INTO progress (card_id) VALUES ($1) ON CONFLICT (card_id) DO NOTHING',
          [res.rows[0].id]
        );
      }
    }

    await client.query('COMMIT');
    console.log(`Seeded ${categories.length} categories and ${cards.length} cards!`);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

seed().catch(err => {
  console.error('Error seeding database:', err);
  process.exit(1);
});
