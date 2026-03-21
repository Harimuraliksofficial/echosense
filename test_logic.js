const OPENROUTER_API_KEY = "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";
const langMap = {'english': 'en', 'kannada': 'kn'};

async function translateText(text, targetLanguage) {
  const code = langMap[targetLanguage.toLowerCase()] || 'en';
  if (code === 'en') return text;
  const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=${code}&dt=t&q=${encodeURIComponent(text)}`;
  const response = await fetch(url);
  const data = await response.json();
  let translated = '';
  if (data && data[0]) { data[0].forEach(item => { if (item[0]) translated += item[0]; }); }
  return translated || text;
}

async function processSpeech(text, targetLanguage) {
  const prompt = `
You are a highly advanced analytical AI interpreter designed for a Deaf/Mute accessibility application. Your goal is to deeply analyze the following English transcript and provide a comprehensive, meaningful summary.

Rules:
1. Deep Analysis: Do NOT just provide a one-line summary. Thoroughly analyze the context, identify any problems, directions, or specific details mentioned, and summarize them comprehensively. For example, if someone is giving directions, output exactly the clear driving directions without unwanted words.
2. Meaning & Context: Remove conversational fillers (like 'so yeah', 'uh'), but preserve the exact intent and actionable info.
3. Language Requirement: The summary output MUST be written natively in pure English. 
4. Keyword Mapping: Pick the 2-3 most crucial physical concept nouns/verbs in English for UI visual icons.

Output EXACTLY this JSON schema:
{
  "summary": "<your detailed, highly optimized, multi-sentence analytical summary in pure English>",
  "keywords": "word1, word2, word3"
}

Transcript: "${text}"`;

  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: { "Authorization": `Bearer ${OPENROUTER_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ "model": "google/gemma-3n-e4b-it:free", "messages": [{ "role": "user", "content": prompt }] })
  });
  const data = await response.json();
  if (data.error) {
    console.error("API ERROR:", data.error.message);
    return;
  }
  let rawText = data.choices[0].message.content.trim();
  if (rawText.startsWith('```json')) rawText = rawText.replace(/^```json/, '').replace(/```$/, '').trim();
  else if (rawText.startsWith('```')) rawText = rawText.replace(/^```/, '').replace(/```$/, '').trim();
  const obj = JSON.parse(rawText);
  const fin = await translateText(obj.summary, targetLanguage);
  console.log('--- TEST: ' + text + ' ---');
  console.log('LANG:', targetLanguage);
  console.log('SUMMARY:', fin);
  console.log('KEYWORDS:', obj.keywords);
}

(async () => {
    const txt = "yeah so basically going straight, there is a left turn in half a kilometer. If you take the left and go straight, you will find a way to go up. If you go straight you will finally find the hospital.";
    await processSpeech(txt, 'English');
    await processSpeech(txt, 'Kannada');
})();
