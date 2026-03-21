const OPENROUTER_API_KEY = "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";

const langMap = {
  'english': 'en',
  'kannada': 'kn',
  'malayalam': 'ml',
  'telugu': 'te',
  'tamil': 'ta',
  'hindi': 'hi',
  'marathi': 'mr',
  'gujarati': 'gu',
  'bengali': 'bn',
  'spanish': 'es'
};

async function translateText(text, targetLanguage) {
  const code = langMap[targetLanguage.toLowerCase()] || 'en';
  if (code === 'en') return text;
  
  try {
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=${code}&dt=t&q=${encodeURIComponent(text)}`;
    const response = await fetch(url);
    const data = await response.json();
    let translated = '';
    if (data && data[0]) {
      data[0].forEach(item => {
        if (item[0]) translated += item[0];
      });
    }
    return translated || text;
  } catch(e) {
    console.warn('Google Translate failed', e);
    return `[Translation Error] ${text}`;
  }
}

async function localFallbackSummarize(text, targetLanguage = 'English') {
  const lower = text.toLowerCase();
  let coreSummary = "";
  
  const INTENTS = [
    { t: ['food', 'eat', 'hungry', 'lunch', 'dinner', 'breakfast'], i: 'Wants Food', s: '🍽️, Food' },
    { t: ['water', 'thirsty', 'drink'], i: 'Needs Water', s: '💧, Water' },
    { t: ['outside', 'out', 'park', 'walk', 'market'], i: 'Going Out / Market', s: '🚶, Out' },
    { t: ['home', 'house', 'return', 'back'], i: 'Going Home', s: '🏠, Home' },
    { t: ['bathroom', 'toilet', 'washroom', 'restroom'], i: 'Needs Washroom', s: '🚽, Toilet' },
    { t: ['help', 'pain', 'doctor', 'hospital', 'hurt'], i: 'Needs Help!', s: '🆘, Help' },
    { t: ['sleep', 'tired', 'rest', 'bed'], i: 'Needs Rest', s: '🛌, Sleep' },
    { t: ['bus', 'train', 'auto', 'rickshaw', 'travel'], i: 'Traveling', s: '🚌, Travel' }
  ];

  let matchedIntent = null;
  for (const item of INTENTS) {
    if (item.t.some(trigger => lower.includes(trigger))) {
      matchedIntent = item;
      break;
    }
  }

  if (matchedIntent) {
    coreSummary = matchedIntent.i;
    const finalTranslation = await translateText(coreSummary, targetLanguage);
    return { summary: finalTranslation, symbols: matchedIntent.s };
  }

  // Filler stripping NLP algorithm
  const fillers = ["uh", "um", "so", "like", "i", "was", "thinking", "maybe", "we", "could", "to", "the", "if", "you", "are", "and", "then", "this", "is", "of", "about", "it", "told", "a", "an", "that", "there", "their", "have", "had", "my", "me", "am", "but", "in", "on", "at", "end", "story", "wanted", "tell"];
  
  let words = lower.split(/[^a-z0-9]/).filter(w => w.length > 0 && !fillers.includes(w));
  if (words.length === 0) return { summary: 'Listening...', symbols: '' };
  
  const coreMeaning = words.slice(0, 5).join(' ');
  coreSummary = coreMeaning.charAt(0).toUpperCase() + coreMeaning.slice(1);
  const symbols = words.slice(0, 3).join(', ');
  
  const finalTranslation = await translateText(coreSummary, targetLanguage);
  return { summary: finalTranslation, symbols };
}

export async function processSpeech(text, targetLanguage = "English") {
  if (!text || text.trim().length < 2) {
    return { summary: 'Listening...', symbols: '' };
  }

  const prompt = `
You are a master deaf/mute accessibility interpreter. Analyze the English transcript.

Rules:
1. Summary Quality: Extract the core meaning with extreme accuracy, clarity, and logical grammar. Summarize the transcript into a readable, highly optimized concise form without losing human meaning. (e.g. Instead of "I went to college yesterday after Breakfast" -> "Finished breakfast and went to college yesterday").
2. Language Requirement: The summary output MUST be written natively in pure English. 
3. Keyword Mapping: Pick the 2-3 most crucial physical concept nouns in English.

Output EXACTLY this JSON schema:
{
  "summary": "<the pure English highly refined summary>",
  "keywords": "word1, word2, word3"
}

Transcript: "${text}"`;

  try {
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "http://localhost:8081",
        "X-Title": "EchoSense"
      },
      body: JSON.stringify({
        "model": "google/gemma-3n-e4b-it:free",
        "messages": [
          {
            "role": "user",
            "content": prompt
          }
        ]
      })
    });

    if (!response.ok) {
        throw new Error(`API HTTP Error ${response.status}`);
    }

    const data = await response.json();
    
    if (data.error) {
       throw new Error(data.error.message || "Model failed");
    }

    let rawText = data.choices[0].message.content.trim();
    if (rawText.startsWith('```json')) {
        rawText = rawText.replace(/^```json/, '').replace(/```$/, '').trim();
    } else if (rawText.startsWith('```')) {
        rawText = rawText.replace(/^```/, '').replace(/```$/, '').trim();
    }
    const resultObj = JSON.parse(rawText);

    let finalSummary = resultObj.summary || 'Listening...';
    if (finalSummary !== 'Listening...') {
       finalSummary = await translateText(finalSummary, targetLanguage);
    }

    return { 
        summary: finalSummary, 
        symbols: resultObj.keywords || '' 
    };

  } catch (err) {
    console.warn("OpenRouter API Failed. Failing over to local offline Summarizer.", err);
    return await localFallbackSummarize(text, targetLanguage);
  }
}
