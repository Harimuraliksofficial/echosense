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

  // Filler stripping NLP algorithm
  const fillers = ["uh", "um", "so", "like", "i", "was", "thinking", "maybe", "we", "could", "to", "the", "if", "you", "are", "and", "then", "this", "is", "of", "about", "it", "told", "a", "an", "that", "there", "their", "have", "had", "my", "me", "am", "but", "in", "on", "at", "end", "story", "wanted", "tell"];
  let words = lower.split(/[^a-z0-9]/).filter(w => w.length > 0 && !fillers.includes(w));
  if (words.length === 0) return { summary: 'Listening...', symbols: '' };

  let matchedIntent = null;
  // Deep protection: Only hijack via intents if the sentence is simple/short (<= 8 words)
  if (words.length <= 8) {
    for (const item of INTENTS) {
      if (item.t.some(trigger => lower.includes(trigger))) {
        matchedIntent = item;
        break;
      }
    }
  }

  if (matchedIntent) {
    coreSummary = matchedIntent.i;
    const finalTranslation = await translateText(coreSummary, targetLanguage);
    return { summary: finalTranslation, symbols: matchedIntent.s };
  }
  
  const coreMeaning = words.slice(0, 10).join(' ');
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
You are a real-time conversational interpreter for a Deaf/Mute user. The transcript you receive is someone speaking directly TO the deaf user. 
There are two possibilities of context:
1. Answering a Question: The speaker is answering a question the deaf user just asked (e.g., getting directions, explaining something).
2. Initiating: The speaker is starting a new conversation with the user.

Rules:
1. Crisp & Grammatically Proper: Clean up the grammar and completely remove conversational fillers ("um", "so yeah", "like"), making it a straightforward, clear-cut version of what was strictly said.
2. Preserve Vital Information: Do NOT completely modify or cut out details from the transcribed version. If the speaker is giving directions, locations, or answering a problem, every word is important. Keep the full structure intact, just shortened slightly by stripping the junk words.
3. Language Requirement: The output MUST be written natively in pure, grammatically perfect English. 
4. Keyword Mapping: Pick the 2-3 most crucial physical concept nouns/verbs in English for UI visual icons.

Output EXACTLY this JSON schema:
{
  "summary": "<the crisp, grammatically proper, straightforward English version>",
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
