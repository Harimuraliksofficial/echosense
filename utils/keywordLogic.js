export const DICTIONARY = [
  // Food / Eating
  {
    triggers: ['food', 'ate', 'eat', 'hungry', 'oota', 'khana', 'bhojana'],
    intent: 'You ate?',
    symbols: '👤🍽️❓',
    condition: (text) => text.includes('?') || text.includes('have you') || text.includes('did you')
  },
  {
    triggers: ['food', 'eat', 'hungry', 'oota', 'beku', 'khana', 'chahiye'],
    intent: 'Need food',
    symbols: '🧍🍽️'
  },
  // Water
  {
    triggers: ['water', 'thirsty', 'neeru', 'pani', 'kudiyoke'],
    intent: 'Need water',
    symbols: '🧍💧'
  },
  // Outside / Travel
  {
    triggers: ['outside', 'go out', 'horage', 'bahar', 'hogona', 'chale'],
    intent: 'Go out?',
    symbols: '🚶🌳❓',
    condition: (text) => text.includes('?') || text.includes('shall') || text.includes('can we')
  },
  {
    triggers: ['outside', 'horage', 'bahar'],
    intent: 'Going outside',
    symbols: '🚶🌳'
  },
  // Help / Emergency
  {
    triggers: ['help', 'danger', 'sahaya', 'madad', 'kapadi', 'bachao'],
    intent: 'Need help',
    symbols: '🧍🆘'
  },
  {
    triggers: ['stop', 'nillisu', 'ruko', 'nillu'],
    intent: 'Stop here',
    symbols: '✋🛑'
  },
  // Bathroom / Toilet
  {
    triggers: ['toilet', 'bathroom', 'washroom', 'souchalaya'],
    intent: 'Need toilet',
    symbols: '🧍🚽'
  }
];

export function processSpeech(text) {
  if (!text) return { summary: '', symbols: '' };
  
  const lower = text.toLowerCase();
  
  // 1. Try to find a direct intent match from the dictionary
  for (const item of DICTIONARY) {
    let matched = false;
    for (const trigger of item.triggers) {
      if (lower.includes(trigger)) {
        matched = true;
        break;
      }
    }
    if (matched) {
      if (item.condition && !item.condition(lower)) {
        continue; // Check next item in DICTIONARY
      }
      return { summary: item.intent, symbols: item.symbols };
    }
  }

  // 2. Fallback heuristic for unknown inputs
  const fillerRegex = /\b(the|is|and|a|an|of|to|in|for|that|on|at|i|me|my|am|are|was|were|it|this|with|has|have|had|just|can|you|we)\b/gi;
  let summary = text.replace(fillerRegex, '').replace(/\s+/g, ' ').trim();
  
  // Limit to 3-5 words
  const words = summary.split(' ');
  if (words.length > 5) {
    summary = words.slice(0, 5).join(' ');
  }
  
  let symbols = '🗣️';
  if (summary.includes('bus')) symbols = '🚌';
  if (summary.includes('train')) symbols = '🚂';
  if (summary.includes('auto') || lower.includes('rickshaw')) symbols = '🛺';
  if (summary.includes('home') || lower.includes('mane') || lower.includes('ghar')) symbols = '🏠';
  
  if (summary.length > 0) {
    summary = summary.charAt(0).toUpperCase() + summary.slice(1);
    return { summary, symbols };
  }
  
  return { summary: 'Repeat?', symbols: '❓' };
}
