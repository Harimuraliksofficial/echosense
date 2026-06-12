import { BACKEND_BASE_URL } from '../constants/config';

const BASE_URL = `${BACKEND_BASE_URL}/process`;

const langMap = {
  'english': null,
  'hindi': 'hi',
  'kannada': 'kn',
  'malayalam': 'ml',
  'tamil': 'ta',
  'telugu': 'te',
  'konkani': 'kok',
  'urdu': 'ur',
};

export async function processSpeech(text, targetLanguage = "English", sessionId = 0, signal = null) {
  if (!text || text.trim().length < 2) {
    return { summary: 'Listening...', symbols: '' };
  }

  const code = langMap[targetLanguage.toLowerCase()];
  
  const payload = { text, session_id: sessionId };
  if (code) {
    payload.target_lang = code;
  }

  try {
    const fetchOptions = {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    };
    if (signal) {
      fetchOptions.signal = signal;
    }
    
    const response = await fetch(BASE_URL, fetchOptions);
    
    if (!response.ok) {
        throw new Error(`API HTTP Error ${response.status}`);
    }

    const data = await response.json();
    
    if (data.error) {
       console.warn("Backend error", data.error);
       return { summary: text, symbols: '' };
    }

    const cleanedText = data.cleaned_text || text;
    // Use the AI-generated summary from the backend
    const aiSummary = data.summary || cleanedText;
    // If a translation was requested, show translated text; otherwise show the English AI summary
    const finalSummary = data.translated_text || aiSummary;
    
    const symbols = data.symbols || []; // Use the robust symbols from backend

    return { 
        summary: finalSummary, 
        symbols: symbols 
    };

  } catch (err) {
    console.warn("Processing failed.", err);
    return { summary: text, symbols: '' };
  }
}
