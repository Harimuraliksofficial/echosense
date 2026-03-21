const BACKEND_URL = "http://10.110.139.194:5000/process";

const langMap = {
  'english': null,
  'kannada': 'kn',
  'malayalam': 'ml',
  'telugu': 'te',
  'tamil': 'ta',
  'hindi': 'hi',
  'marathi': null,
  'gujarati': null,
  'bengali': null,
  'spanish': null
};

export async function processSpeech(text, targetLanguage = "English") {
  if (!text || text.trim().length < 2) {
    return { summary: 'Listening...', symbols: '' };
  }

  const code = langMap[targetLanguage.toLowerCase()];
  
  const payload = { text };
  if (code) {
    payload.target_lang = code;
  }

  try {
    const response = await fetch(BACKEND_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    
    if (!response.ok) {
        throw new Error(`API HTTP Error ${response.status}`);
    }

    const data = await response.json();
    
    if (data.error) {
       console.warn("Backend error", data.error);
       return { summary: text, symbols: '' };
    }

    const cleanedText = data.cleaned_text || text;
    const finalSummary = data.translated_text || cleanedText;
    
    // Generate simple symbols from cleaned text words for the UI
    const lower = cleanedText.toLowerCase();
    const words = lower.split(/[^a-z0-9]/).filter(w => w.length > 0);
    const fillers = ["i", "was", "we", "the", "if", "you", "are", "and", "then", "this", "is", "of", "about", "it", "a", "an", "that", "there", "their", "have", "had", "my", "me", "am", "but", "in", "on", "at", "end"];
    const keywords = words.filter(w => !fillers.includes(w)).slice(0, 3);
    const symbols = keywords.join(', ');

    return { 
        summary: finalSummary, 
        symbols: symbols 
    };

  } catch (err) {
    console.warn("Processing failed.", err);
    return { summary: text, symbols: '' };
  }
}
