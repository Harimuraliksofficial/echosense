import { BACKEND_BASE_URL } from '../constants/config';

export const processSpeech = async (text, targetLang, sessionId = 0, signal = null) => {
  if (!text || !text.trim()) {
    return { summary: '', symbols: null };
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
    
    let finalSummary = extractResult.cleaned_text || text;
    const finalSymbols = extractResult.keywords || null;

    // 2. Translate only if needed, using the cleaned English text
    if (targetLang && targetLang !== 'English') {
      const langMap = {
        'Hindi': 'hi',
        'Kannada': 'kn',
        'Malayalam': 'ml',
        'Tamil': 'ta'
      };
      const langCode = langMap[targetLang] || 'en';

      const translateResponse = await fetch(`${BACKEND_BASE_URL}/api/translate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          text: finalSummary,
          target_lang: langCode
        }),
        signal
      });

      if (translateResponse.ok) {
        const translateResult = await translateResponse.json();
        if (translateResult.translated_text) {
          finalSummary = translateResult.translated_text;
        }
      }
    }

    return {
      summary: finalSummary,
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
