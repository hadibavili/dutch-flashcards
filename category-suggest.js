const CATEGORY_KEYWORDS = {
  dutch: {
    'Greetings': ['hello', 'hi', 'goodbye', 'bye', 'thank', 'thanks', 'please', 'sorry', 'excuse', 'welcome', 'good morning', 'good evening', 'good night', 'good afternoon', 'how are you', 'nice to meet'],
    'Numbers': ['one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'hundred', 'thousand', 'first', 'second', 'third', 'number', 'zero', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety', 'million'],
    'Food & Drink': ['eat', 'food', 'drink', 'cook', 'bread', 'cheese', 'milk', 'water', 'coffee', 'tea', 'beer', 'wine', 'meat', 'fish', 'rice', 'soup', 'fruit', 'apple', 'meal', 'breakfast', 'lunch', 'dinner', 'hungry', 'thirsty', 'delicious', 'restaurant', 'sugar', 'salt', 'butter', 'egg', 'chicken', 'vegetable', 'potato', 'cake', 'chocolate', 'juice', 'pizza', 'sandwich'],
    'Daily Life': ['house', 'home', 'book', 'phone', 'sleep', 'read', 'write', 'live', 'door', 'room', 'table', 'chair', 'kitchen', 'bathroom', 'bed', 'garden', 'key', 'window', 'clean', 'wash', 'shower', 'lamp', 'sofa', 'television', 'computer', 'internet', 'newspaper', 'letter', 'music'],
    'Travel': ['train', 'bus', 'car', 'bicycle', 'bike', 'airplane', 'plane', 'hotel', 'street', 'road', 'left', 'right', 'ticket', 'station', 'airport', 'map', 'travel', 'trip', 'drive', 'walk', 'fly', 'taxi', 'passport', 'suitcase', 'bridge', 'city', 'country'],
    'People': ['friend', 'family', 'child', 'children', 'man', 'woman', 'boy', 'girl', 'mother', 'father', 'brother', 'sister', 'son', 'daughter', 'teacher', 'doctor', 'baby', 'person', 'people', 'parent', 'husband', 'wife', 'uncle', 'aunt', 'grandfather', 'grandmother', 'neighbor', 'colleague'],
    'Colors': ['red', 'blue', 'green', 'yellow', 'black', 'white', 'orange', 'purple', 'brown', 'pink', 'grey', 'gray', 'color', 'colour', 'gold', 'silver'],
    'Time': ['today', 'tomorrow', 'yesterday', 'now', 'always', 'never', 'sometimes', 'often', 'week', 'month', 'year', 'hour', 'minute', 'day', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday', 'time', 'clock', 'early', 'late', 'soon', 'morning', 'evening', 'night', 'afternoon', 'season', 'spring', 'summer', 'autumn', 'winter'],
  },
  persian: {
    'Greetings & Phrases': ['hello', 'hi', 'goodbye', 'bye', 'thank', 'thanks', 'please', 'sorry', 'excuse', 'welcome', 'good morning', 'good evening', 'good night', 'how are you', 'nice to meet', 'peace', 'fine'],
    'Numbers': ['one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'hundred', 'thousand', 'zero', 'first', 'second', 'third', 'number', 'twenty', 'thirty', 'million'],
    'Colors': ['red', 'blue', 'green', 'yellow', 'black', 'white', 'orange', 'purple', 'brown', 'pink', 'grey', 'gray', 'color', 'colour', 'gold', 'silver'],
    'Family & People': ['mother', 'father', 'brother', 'sister', 'family', 'child', 'children', 'son', 'daughter', 'uncle', 'aunt', 'grandfather', 'grandmother', 'cousin', 'husband', 'wife', 'baby', 'friend', 'neighbor', 'person', 'people', 'man', 'woman', 'boy', 'girl'],
    'Food & Drink': ['eat', 'food', 'drink', 'cook', 'bread', 'rice', 'meat', 'water', 'tea', 'coffee', 'milk', 'soup', 'meal', 'breakfast', 'lunch', 'dinner', 'hungry', 'thirsty', 'delicious', 'restaurant', 'taste', 'salt', 'sugar', 'oil', 'butter', 'yogurt', 'cheese', 'egg', 'pizza', 'sandwich'],
    'Fruits & Vegetables': ['apple', 'banana', 'orange', 'grape', 'strawberry', 'watermelon', 'melon', 'cherry', 'peach', 'lemon', 'tomato', 'potato', 'onion', 'cucumber', 'carrot', 'garlic', 'pepper', 'lettuce', 'fruit', 'vegetable', 'pear', 'pomegranate', 'fig', 'date'],
    'Animals': ['cat', 'dog', 'bird', 'fish', 'horse', 'cow', 'sheep', 'chicken', 'lion', 'tiger', 'rabbit', 'mouse', 'elephant', 'monkey', 'bear', 'wolf', 'snake', 'insect', 'animal', 'pet', 'duck', 'goat', 'camel'],
    'Body & Health': ['head', 'hand', 'eye', 'ear', 'nose', 'mouth', 'foot', 'leg', 'arm', 'heart', 'tooth', 'hair', 'face', 'body', 'sick', 'healthy', 'pain', 'doctor', 'hospital', 'medicine', 'fever', 'cold', 'stomach', 'finger', 'knee', 'back', 'neck', 'blood'],
    'Clothing & Accessories': ['shirt', 'pants', 'dress', 'shoe', 'hat', 'jacket', 'coat', 'sock', 'scarf', 'glasses', 'watch', 'ring', 'bag', 'belt', 'tie', 'cloth', 'wear', 'button', 'skirt', 'boot', 'glove'],
    'Home & Furniture': ['house', 'home', 'room', 'door', 'window', 'table', 'chair', 'bed', 'kitchen', 'bathroom', 'sofa', 'mirror', 'carpet', 'lamp', 'wall', 'floor', 'ceiling', 'garden', 'key', 'roof', 'furniture', 'shelf', 'closet', 'pillow', 'blanket'],
    'Travel & Transport': ['car', 'bus', 'train', 'airplane', 'plane', 'bicycle', 'bike', 'taxi', 'road', 'street', 'map', 'ticket', 'hotel', 'airport', 'station', 'travel', 'trip', 'drive', 'fly', 'passport', 'suitcase', 'bridge', 'city', 'country'],
    'Weather & Nature': ['sun', 'rain', 'snow', 'wind', 'cloud', 'hot', 'warm', 'weather', 'spring', 'summer', 'autumn', 'fall', 'winter', 'tree', 'flower', 'mountain', 'sea', 'river', 'sky', 'star', 'moon', 'earth', 'nature', 'lake', 'desert', 'forest'],
    'Time & Calendar': ['today', 'tomorrow', 'yesterday', 'now', 'time', 'clock', 'hour', 'minute', 'week', 'month', 'year', 'day', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday', 'always', 'never', 'calendar', 'season', 'date', 'morning', 'evening', 'night'],
    'Work & School': ['work', 'job', 'school', 'teacher', 'student', 'book', 'pen', 'class', 'study', 'learn', 'office', 'boss', 'colleague', 'university', 'exam', 'homework', 'paper', 'desk', 'meeting', 'project'],
    'Shopping & Money': ['buy', 'sell', 'shop', 'store', 'money', 'price', 'cheap', 'expensive', 'pay', 'cost', 'market', 'dollar', 'coin', 'bank', 'cash', 'card', 'discount', 'receipt', 'wallet'],
    'Emotions & Descriptions': ['happy', 'sad', 'angry', 'tired', 'beautiful', 'ugly', 'big', 'small', 'tall', 'short', 'good', 'bad', 'new', 'old', 'fast', 'slow', 'easy', 'hard', 'difficult', 'nice', 'kind', 'love', 'hate', 'afraid', 'scared', 'excited', 'bored', 'lonely', 'proud', 'strong', 'weak', 'important', 'strange'],
    'Common Verbs': ['go', 'come', 'see', 'give', 'take', 'make', 'do', 'say', 'tell', 'know', 'think', 'want', 'need', 'can', 'have', 'get', 'put', 'run', 'sit', 'stand', 'open', 'close', 'begin', 'start', 'finish', 'stop', 'help', 'try', 'ask', 'answer', 'bring', 'send', 'wait', 'listen', 'look', 'play', 'hold', 'turn', 'fall', 'grow'],
    'Everyday Phrases': ["let's go", 'of course', "i don't know", 'no problem', "doesn't matter", 'be careful', 'hurry up', 'wait a moment', 'what happened', 'i agree', 'it depends', 'god willing', 'hopefully', 'congratulations', 'never mind', 'by the way', 'for example'],
  },
};

function suggestCategory(englishText, profileId, categories) {
  const text = englishText.toLowerCase().trim();
  if (!text) return null;

  const keywords = CATEGORY_KEYWORDS[profileId];
  if (!keywords) return null;

  const scores = {};

  for (const [categoryName, words] of Object.entries(keywords)) {
    let score = 0;
    for (const keyword of words) {
      const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(`\\b${escaped}\\b`, 'i');
      if (regex.test(text)) {
        // Multi-word phrases score higher
        score += keyword.split(' ').length;
      }
    }
    if (score > 0) {
      scores[categoryName] = score;
    }
  }

  const bestMatch = Object.entries(scores)
    .sort((a, b) => b[1] - a[1])[0];

  if (!bestMatch) return null;

  const matched = categories.find(c => c.name === bestMatch[0]);
  if (!matched) return null;

  return { id: matched.id, name: matched.name, emoji: matched.emoji };
}

module.exports = { suggestCategory };
