import { BACKEND_BASE_URL } from '../constants/config';

export const translateOnly = async (text, targetLang, signal = null) => {
  if (!text || !text.trim() || !targetLang || targetLang === 'English') {
    return text || '';
  }
  const langMap = {
    'Hindi': 'hi',
    'Kannada': 'kn',
    'Malayalam': 'ml',
    'Tamil': 'ta'
  };
  const langCode = langMap[targetLang] || targetLang.toLowerCase();

  const response = await fetch(`${BACKEND_BASE_URL}/api/translate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ 
      text,
      target_lang: langCode
    }),
    signal
  });

  if (!response.ok) {
    throw new Error(`Translate API returned ${response.status}`);
  }

  const result = await response.json();
  return result.translated_text || text;
};

export const processSpeech = async (text, targetLang, sessionId = 0, signal = null) => {
  if (!text || !text.trim()) {
    return { summary: '', cleanedText: '', symbols: null };
  }

  try {
    // 1. Extract keywords and get cleaned English text from Mistral
    const extractResponse = await fetch(`${BACKEND_BASE_URL}/api/extract-keywords`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ 
        text,
        session_id: sessionId
      }),
      signal
    });

    if (!extractResponse.ok) {
      throw new Error(`API returned ${extractResponse.status}`);
    }

    const extractResult = await extractResponse.json();
    if (extractResult.error) {
      throw new Error(extractResult.error);
    }
    
    const cleanedText = extractResult.cleaned_text || text;
    let finalSummary = cleanedText;
    const finalSymbols = extractResult.keywords || null;

    // 2. Translate only if needed, using the cleaned English text
    if (targetLang && targetLang !== 'English') {
      try {
        finalSummary = await translateOnly(cleanedText, targetLang, signal);
      } catch (tErr) {
        console.warn("Translation sub-call error:", tErr);
      }
    }

    return {
      summary: finalSummary,
      cleanedText,
      symbols: finalSymbols
    };

  } catch (error) {
    if (error.name === 'AbortError') {
      throw error; // Re-throw to be caught in the component
    }
    console.warn("processSpeech api error:", error);
    throw error;
  }
};
