/**
 * demoScenarioEngine.js
 *
 * Isolated demo-response mechanism for EcoSense Expo demonstration.
 * Implements exactly four predefined communication scenarios:
 *   Scenario 1: Bus Stop (Drawing)
 *   Scenario 2: Luggage Counter (Drawing)
 *   Scenario 3: Shirt Size Exchange (Writing)
 *   Scenario 4: Finding an ATM (Writing)
 *
 * Supports multilingual normal person spoken replies (English, Hindi, Kannada, Malayalam).
 * Provides strict confidence-based semantic matching and graceful fallback to the normal AI pipeline.
 */

export const DEMO_SCENARIOS = {
  SCENARIO_1: {
    id: 'scenario_1',
    name: 'Bus Stop',
    mode: 'drawing',
    question: {
      en: 'Where is the bus stop?',
      hi: 'बस स्टॉप कहाँ है?',
      kn: 'ಬಸ್ ನಿಲ್ದಾಣ ಎಲ್ಲಿದೆ?',
      ml: 'ബസ് സ്റ്റോപ്പ് എവിടെയാണ്?',
    },
    reply: {
      en: 'The nearest bus stop is approximately 200 metres from here. Walk straight along this road and cross at the pedestrian crossing. You will find the bus stop on your left.',
      hi: 'निकटतम बस स्टॉप यहां से लगभग 200 मीटर दूर है। इस सड़क पर सीधे चलें और पैदल यात्री क्रॉसिंग पर पार करें। बस स्टॉप आपको अपनी बायीं ओर मिलेगा।',
      kn: 'ಹತ್ತಿರದ ಬಸ್ ನಿಲ್ದಾಣವು ಇಲ್ಲಿಂದ ಸುಮಾರು 200 ಮೀಟರ್ ದೂರದಲ್ಲಿದೆ. ಈ ರಸ್ತೆಯಲ್ಲಿ ನೇರವಾಗಿ ನಡೆದು ಪಾದಚಾರಿ ಕ್ರಾಸಿಂಗ್‌ನಲ್ಲಿ ದಾಟಿ. ನಿಮ್ಮ ಎಡಭಾಗದಲ್ಲಿ ಬಸ್ ನಿಲ್ದಾಣವನ್ನು ನೀವು ಕಾಣಬಹುದು.',
      ml: 'ഇവിടെ നിന്ന് ഏകദേശം 200 മീറ്റർ അകലെയാണ് ഏറ്റവും അടുത്തുള്ള ബസ് സ്റ്റോപ്പ്. ഈ റോഡിലൂടെ നേരെ നടന്ന് കാൽനട ക്രോസിംഗിലൂടെ കടന്നുപോകുക. നിങ്ങളുടെ ഇടതുവശത്ത് ബസ് സ്റ്റോപ്പ് കാണാം.',
    },
    // Exact ordered pictorial sequence:
    // 1. Bus -> identifies destination
    // 2. 200 m -> displays distance clearly
    // 3. Go straight -> directional pictogram
    // 4. Road -> identifies the route
    // 5. Pedestrian crossing -> shows where to cross
    // 6. Turn left -> clear left-arrow pictogram
    // 7. Bus stop -> identifies the final destination
    pictograms: [
      { keyword: 'bus', label: 'Bus', url: 'https://static.arasaac.org/pictograms/2262/2262_500.png' },
      { keyword: '200 m', label: '200 m', isText: true, text: '200 m' },
      { keyword: 'go straight', label: 'Go straight', url: 'https://static.arasaac.org/pictograms/25195/25195_500.png' },
      { keyword: 'road', label: 'Road', url: 'https://static.arasaac.org/pictograms/2302/2302_500.png' },
      { keyword: 'pedestrian crossing', label: 'Pedestrian crossing', url: 'https://static.arasaac.org/pictograms/7197/7197_500.png' },
      { keyword: 'turn left', label: 'Turn left', url: 'https://static.arasaac.org/pictograms/38458/38458_500.png' },
      { keyword: 'bus stop', label: 'Bus stop', url: 'https://static.arasaac.org/pictograms/2499/2499_500.png' },
    ],
  },

  SCENARIO_2: {
    id: 'scenario_2',
    name: 'Luggage Counter',
    mode: 'drawing',
    question: {
      en: 'Where is the luggage counter?',
      hi: 'लगेज काउंटर कहाँ है?',
      kn: 'ಲಗೇಜ್ ಕೌಂಟರ್ ಎಲ್ಲಿದೆ?',
      ml: 'ലഗേജ് കൗണ്ടർ എവിടെയാണ്?',
    },
    reply: {
      en: 'The luggage counter is near the main entrance, beside the information desk. Walk straight towards the entrance and you will see the counter on your right.',
      hi: 'सामान काउंटर मुख्य प्रवेश द्वार के पास, सूचना डेस्क के बगल में है। सीधे प्रवेश द्वार की ओर चलें और आपको अपनी दाहिनी ओर काउंटर दिखाई देगा।',
      kn: 'ಲಗೇಜ್ ಕೌಂಟರ್ ಮುಖ್ಯ ದ್ವಾರದ ಬಳಿ, ಮಾಹಿತಿ ಮೇಜಿನ ಪಕ್ಕದಲ್ಲಿದೆ. ಪ್ರವೇಶದ್ವಾರದ ಕಡೆಗೆ ನೇರವಾಗಿ ನಡೆಯಿರಿ ಮತ್ತು ನಿಮ್ಮ ಬಲಭಾಗದಲ್ಲಿ ಕೌಂಟರ್ ಅನ್ನು ನೀವು ನೋಡುತ್ತೀರಿ.',
      ml: 'ലഗേജ് കൗണ്ടർ പ്രധാന കവാടത്തിനടുത്താണ്, ഇൻഫർമേഷൻ ഡെസ്‌കിന് അരികിലാണ്. നേരെ പ്രവേശന കവാടത്തിലേക്ക് നടക്കുക, നിങ്ങളുടെ വലതുവശത്ത് കൗണ്ടർ കാണാം.',
    },
    // Exact ordered pictorial sequence:
    // 1. Luggage trolley -> identifies the luggage
    // 2. Main entrance -> identifies the landmark
    // 3. Go straight -> shows the direction
    // 4. Information desk -> identifies nearby landmark
    // 5. Luggage counter -> identifies the destination
    // 6. Turn right -> shows final direction
    pictograms: [
      { keyword: 'luggage trolley', label: 'Luggage trolley', isText: true, text: 'Luggage trolley' },
      { keyword: 'main entrance', label: 'Main entrance', url: 'https://static.arasaac.org/pictograms/37334/37334_500.png' },
      { keyword: 'go straight', label: 'Go straight', url: 'https://static.arasaac.org/pictograms/25195/25195_500.png' },
      { keyword: 'information desk', label: 'Information desk', url: 'https://static.arasaac.org/pictograms/9897/9897_500.png' },
      { keyword: 'luggage counter', label: 'Luggage counter', isText: true, text: 'Luggage counter' },
      { keyword: 'turn right', label: 'Turn right', url: 'https://static.arasaac.org/pictograms/38456/38456_500.png' },
    ],
  },

  SCENARIO_3: {
    id: 'scenario_3',
    name: 'Shirt Size Exchange',
    mode: 'writing',
    question: {
      en: 'I purchased this shirt, but it is too small for me. Can I exchange it for a larger size?',
      hi: 'मैंने यह शर्ट खरीदी थी, लेकिन यह मेरे लिए बहुत छोटी है। क्या मैं इसे बड़े आकार में बदल सकता हूँ?',
      kn: 'ನಾನು ಈ ಶರ್ಟ್ ಖರೀದಿಸಿದೆ, ಆದರೆ ಇದು ನನಗೆ ತುಂಬಾ ಚಿಕ್ಕದಾಗಿದೆ. ನಾನು ಅದನ್ನು ದೊಡ್ಡ ಗಾತ್ರಕ್ಕೆ ವಿನಿಮಯ ಮಾಡಿಕೊಳ್ಳಬಹುದೇ?',
      ml: 'ഞാൻ ഈ ഷർട്ട് വാങ്ങി, പക്ഷേ ഇത് എനിക്ക് വളരെ ചെറുതാണ്. എനിക്ക് ഇത് വലിയ വലുപ്പത്തിലേക്ക് മാറ്റാൻ കഴിയുമോ?',
    },
    reply: {
      en: 'Of course! Please show me your purchase bill so I can verify the order. We can check the available sizes and exchange it for a larger one if it is in stock.',
      hi: 'बिल्कुल! कृपया मुझे अपना खरीद बिल दिखाएं ताकि मैं ऑर्डर सत्यापित कर सकूं। हम उपलब्ध आकारों की जांच कर सकते हैं और यदि यह स्टॉक में है तो इसे बड़े आकार में बदल सकते हैं।',
      kn: 'ಸಹಜವಾಗಿ! ದಯವಿಟ್ಟು ನಿಮ್ಮ ಖರೀದಿ ಬಿಲ್ ಅನ್ನು ನನಗೆ ತೋರಿಸಿ ಇದರಿಂದ ನಾನು ಆರ್ಡರ್ ಅನ್ನು ಪರಿಶೀಲಿಸಬಹುದು. ನಾವು ಲಭ್ಯವಿರುವ ಗಾತ್ರಗಳನ್ನು ಪರಿಶೀಲಿಸಬಹುದು ಮತ್ತು ಅದು ಸ್ಟಾಕ್‌ನಲ್ಲಿದ್ದರೆ ಅದನ್ನು ದೊಡ್ಡದಕ್ಕೆ ವಿನಿಮಯ ಮಾಡಿಕೊಳ್ಳಬಹುದು.',
      ml: 'തീർച്ചയായും! നിങ്ങളുടെ പർച്ചേസ് ബിൽ എന്നെ കാണിക്കൂ, അങ്ങനെ എനിക്ക് ഓർഡർ പരിശോധിച്ചുറപ്പിക്കാം. നമുക്ക് ലഭ്യമായ വലുപ്പങ്ങൾ പരിശോധിച്ച് സ്റ്റോക്കുണ്ടെങ്കിൽ വലുതായി മാറ്റാം.',
    },
    // Exact ordered pictorial sequence:
    // 1. Shirt -> identifies the product
    // 2. Receipt -> asks for purchase bill
    // 3. Verification -> checking the purchase
    // 4. Size selection -> selecting larger size
    // 5. Clothing store -> identifies exchange location
    // 6. Exchange -> shows exchange action
    // Note: Confirmation is NOT shown because exchange is pending verification
    pictograms: [
      { keyword: 'shirt', label: 'Shirt', url: 'https://static.arasaac.org/pictograms/2308/2308_500.png' },
      { keyword: 'receipt', label: 'Receipt', url: 'https://static.arasaac.org/pictograms/9184/9184_500.png' },
      { keyword: 'verification', label: 'Verification', isText: true, text: 'Verification' },
      { keyword: 'size selection', label: 'Size selection', isText: true, text: 'Size selection' },
      { keyword: 'clothing store', label: 'Clothing store', url: 'https://static.arasaac.org/pictograms/4885/4885_500.png' },
      { keyword: 'exchange', label: 'Exchange', url: 'https://static.arasaac.org/pictograms/8053/8053_500.png' },
    ],
  },

  SCENARIO_4: {
    id: 'scenario_4',
    name: 'Finding an ATM',
    mode: 'writing',
    question: {
      en: 'Excuse me, where is the nearest ATM? I need to withdraw some money.',
      hi: 'माफ़ कीजिए, निकटतम एटीएम कहाँ है? मुझे कुछ पैसे निकालने हैं।',
      kn: 'ಕ್ಷಮಿಸಿ, ಹತ್ತಿರದ ಎಟಿಎಂ ಎಲ್ಲಿದೆ? ನಾನು ಸ್ವಲ್ಪ ಹಣವನ್ನು ಹಿಂಪಡೆಯಬೇಕು.',
      ml: 'ക്ഷമിക്കണം, ഏറ്റവും അടുത്തുള്ള എടിഎം എവിടെയാണ്? എനിക്ക് കുറച്ച് പണം പിൻവലിക്കണം.',
    },
    reply: {
      en: 'There is an ATM about 100 metres from here, opposite the supermarket. Walk straight towards the supermarket and you will find the ATM on your right.',
      hi: 'यहां से लगभग 100 मीटर की दूरी पर, सुपरमार्केट के सामने एक एटीएम है। सीधे सुपरमार्केट की ओर चलें और आपको एटीएम आपके दाहिनी ओर मिलेगा।',
      kn: 'ಇಲ್ಲಿಂದ ಸುಮಾರು 100 ಮೀಟರ್ ದೂರದಲ್ಲಿ ಸೂಪರ್ ಮಾರ್ಕೆಟ್ ಎದುರು ಎಟಿಎಂ ಇದೆ. ನೇರವಾಗಿ ಸೂಪರ್ಮಾರ್ಕೆಟ್ ಕಡೆಗೆ ನಡೆಯಿರಿ ಮತ್ತು ನಿಮ್ಮ ಬಲಭಾಗದಲ್ಲಿ ಎಟಿಎಂ ಅನ್ನು ನೀವು ಕಾಣಬಹುದು.',
      ml: 'ഇവിടെ നിന്ന് 100 മീറ്റർ അകലെ സൂപ്പർമാർക്കറ്റിന് എതിർവശത്തായി ഒരു എടിഎം ഉണ്ട്. നേരെ സൂപ്പർമാർക്കറ്റിലേക്ക് നടക്കുക, നിങ്ങളുടെ വലതുവശത്ത് എടിഎം കാണാം.',
    },
    // Exact ordered pictorial sequence:
    // 1. Money -> communicates purpose
    // 2. ATM -> identifies destination
    // 3. 100 m -> displays distance
    // 4. Go straight -> displays direction
    // 5. Supermarket -> identifies landmark
    // 6. Turn right -> displays direction
    // 7. ATM -> identifies final destination
    pictograms: [
      { keyword: 'money', label: 'Money', url: 'https://static.arasaac.org/pictograms/4630/4630_500.png' },
      { keyword: 'atm', label: 'ATM', url: 'https://static.arasaac.org/pictograms/17190/17190_500.png' },
      { keyword: '100 m', label: '100 m', isText: true, text: '100 m' },
      { keyword: 'go straight', label: 'Go straight', url: 'https://static.arasaac.org/pictograms/25195/25195_500.png' },
      { keyword: 'supermarket', label: 'Supermarket', url: 'https://static.arasaac.org/pictograms/3389/3389_500.png' },
      { keyword: 'turn right', label: 'Turn right', url: 'https://static.arasaac.org/pictograms/38456/38456_500.png' },
      { keyword: 'atm', label: 'ATM', url: 'https://static.arasaac.org/pictograms/17190/17190_500.png' },
    ],
  },
};

// ── State Management ────────────────────────────────────────────────────────
let currentActiveScenarioId = null;

export const setActiveScenario = (scenarioId) => {
  currentActiveScenarioId = scenarioId;
};

export const getActiveScenario = () => {
  return currentActiveScenarioId;
};

export const clearActiveScenario = () => {
  currentActiveScenarioId = null;
};

// ── Strict Semantic Matchers ────────────────────────────────────────────────

/**
 * Match drawing recognition output against Scenario 1 or Scenario 2.
 * Strict confidence matching: requires destination/counter/shelter indicators.
 * An ordinary drawing of just a bus or suitcase must NOT activate a scenario.
 */
export const matchDrawingScenario = (keyword, description = '') => {
  if (!keyword && !description) return null;
  const combined = `${keyword || ''} ${description || ''}`.toLowerCase();

  // Scenario 1: Bus Stop
  // Must NOT classify an ordinary bus drawing as a bus-stop question automatically.
  const hasBus = combined.includes('bus');
  const hasStopIndicator =
    combined.includes('stop') ||
    combined.includes('shelter') ||
    combined.includes('station') ||
    combined.includes('stand') ||
    combined.includes('question') ||
    combined.includes('where');

  if (hasBus && hasStopIndicator) {
    return DEMO_SCENARIOS.SCENARIO_1;
  }

  // Scenario 2: Luggage Counter
  // Must NOT classify an ordinary suitcase drawing as a luggage-counter question automatically.
  const hasLuggage =
    combined.includes('luggage') ||
    combined.includes('suitcase') ||
    combined.includes('baggage') ||
    combined.includes('trolley');
  const hasCounterIndicator =
    combined.includes('counter') ||
    combined.includes('shed') ||
    combined.includes('desk') ||
    combined.includes('information') ||
    combined.includes('question') ||
    combined.includes('where');

  if (hasLuggage && hasCounterIndicator) {
    return DEMO_SCENARIOS.SCENARIO_2;
  }

  return null;
};

/**
 * Match user written input against Scenario 3 or Scenario 4.
 * Uses confidence-based semantic matching rather than exact string comparison.
 */
export const matchWritingScenario = (text) => {
  if (!text || typeof text !== 'string') return null;
  const t = text.toLowerCase().trim();

  // Scenario 3: Shirt Size Exchange
  // Meaning: Wants to exchange a shirt because it is too small / tight.
  // Variations: "Can I get a bigger shirt?", "This shirt is too tight. Can you exchange it?",
  // "I want to change this shirt for a larger size."
  const hasClothing = t.includes('shirt') || t.includes('t-shirt') || t.includes('clothes') || t.includes('dress');
  const hasSizeIssue = t.includes('small') || t.includes('tight') || t.includes('fit') || t.includes('larger') || t.includes('bigger') || t.includes('size');
  const hasExchangeIntent = t.includes('exchange') || t.includes('change') || t.includes('replace') || t.includes('swap') || t.includes('get a bigger') || t.includes('get a larger') || t.includes('another size');

  if ((hasClothing && hasSizeIssue && hasExchangeIntent) ||
      (hasClothing && hasExchangeIntent) ||
      (hasClothing && hasSizeIssue && (t.includes('can i') || t.includes('want') || t.includes('need'))) ||
      (t.includes('exchange') && t.includes('shirt'))) {
    return DEMO_SCENARIOS.SCENARIO_3;
  }

  // Scenario 4: Finding an ATM
  // Meaning: Locate an ATM to withdraw money.
  // Variations: "Where can I find an ATM?", "Is there an ATM nearby?",
  // "I need to withdraw money. Where should I go?", "nearest atm"
  const hasAtm = t.includes('atm') || t.includes('cash machine') || t.includes('automated teller');
  const hasLocationIntent = t.includes('where') || t.includes('nearest') || t.includes('nearby') || t.includes('find') || t.includes('locate') || t.includes('is there') || t.includes('which way') || t.includes('how to get');
  const hasWithdrawIntent = t.includes('withdraw') || t.includes('take out') || t.includes('money') || t.includes('cash');

  // Must NOT match a single word "atm" or "money" alone
  if (hasAtm && (hasLocationIntent || hasWithdrawIntent)) {
    return DEMO_SCENARIOS.SCENARIO_4;
  }
  if (!hasAtm && hasWithdrawIntent && (hasLocationIntent || t.includes('bank') || t.includes('counter'))) {
    return DEMO_SCENARIOS.SCENARIO_4;
  }

  return null;
};

/**
 * Match normal person's spoken reply (Whisper output) across English, Kannada, Malayalam, and Hindi.
 * Requires consistent instruction meaning; does NOT match on a single keyword alone.
 */
export const matchSpokenReply = (text, activeId = null) => {
  if (!text || typeof text !== 'string') return null;
  const t = text.toLowerCase().trim();

  // ── Scenario 1: Bus Stop reply ────────────────────────────
  // Instructions: 200m away, walk straight, cross pedestrian crossing, turn left / bus stop on left
  const s1_en = (t.includes('bus') || t.includes('stand') || t.includes('stop')) &&
    (t.includes('200') ||
     (t.includes('straight') && t.includes('left')) ||
     (t.includes('cross') && t.includes('left')) ||
     (t.includes('straight') && t.includes('200')));
  const s1_hi = (t.includes('बस') || t.includes('स्टॉप')) &&
    (t.includes('200') ||
     (t.includes('सीधे') && (t.includes('बाएं') || t.includes('बायीं'))) ||
     (t.includes('क्रॉसिंग') && (t.includes('बाएं') || t.includes('बायीं'))));
  const s1_kn = (t.includes('ಬಸ್') || t.includes('ನಿಲ್ದಾಣ')) &&
    (t.includes('200') ||
     (t.includes('ನೇರವಾಗಿ') && t.includes('ಎಡ')) ||
     (t.includes('ದಾಟಿ') && t.includes('ಎಡ')));
  const s1_ml = (t.includes('ബസ്') || t.includes('സ്റ്റോപ്പ്')) &&
    (t.includes('200') ||
     (t.includes('നേരെ') && t.includes('ഇടത്')) ||
     (t.includes('മുറിച്ചുകടക്കുക') && t.includes('ഇടത്')));

  if (s1_en || s1_hi || s1_kn || s1_ml) {
    return DEMO_SCENARIOS.SCENARIO_1;
  }

  // ── Scenario 2: Luggage Counter reply ─────────────────────
  // Instructions: near main entrance, beside info desk, walk straight, counter on right
  const s2_en = (t.includes('luggage') || t.includes('counter') || t.includes('baggage')) &&
    ((t.includes('entrance') && t.includes('information')) ||
     (t.includes('entrance') && t.includes('right')) ||
     (t.includes('information') && t.includes('right')) ||
     (t.includes('main entrance') && t.includes('counter')) ||
     (t.includes('straight') && t.includes('counter') && t.includes('right')));
  const s2_hi = (t.includes('सामान') || t.includes('लगेज') || t.includes('काउंटर')) &&
    ((t.includes('प्रवेश') && t.includes('सूचना')) ||
     (t.includes('प्रवेश') && (t.includes('दाईं') || t.includes('दाहिने'))) ||
     (t.includes('सूचना') && (t.includes('दाईं') || t.includes('दाहिने'))));
  const s2_kn = (t.includes('ಲಗೇಜ್') || t.includes('ಕೌಂಟರ್')) &&
    ((t.includes('ಪ್ರವೇಶ') && t.includes('ಮಾಹಿತಿ')) ||
     (t.includes('ಪ್ರವೇಶ') && (t.includes('ಬಲ') || t.includes('ಬಲಭಾಗ'))) ||
     (t.includes('ಮಾಹಿತಿ') && (t.includes('ಬಲ') || t.includes('ಬಲಭಾಗ'))));
  const s2_ml = (t.includes('ലഗേജ്') || t.includes('കൗണ്ടർ')) &&
    ((t.includes('കവാട') && t.includes('ഇൻഫർമേഷൻ')) ||
     (t.includes('പ്രവേശന') && t.includes('ഇൻഫർമേഷൻ')) ||
     (t.includes('കവാട') && (t.includes('വലത്') || t.includes('വലതുവശ'))) ||
     (t.includes('ഇൻഫർമേഷൻ') && (t.includes('വലത്') || t.includes('വലതുവശ'))) ||
     t.includes('ഡെസ്ക്') || t.includes('ഡെസ്‌ക്'));

  if (s2_en || s2_hi || s2_kn || s2_ml) {
    return DEMO_SCENARIOS.SCENARIO_2;
  }

  // ── Scenario 3: Shirt Size Exchange reply ─────────────────
  // Instructions: show purchase bill to verify order, check available sizes, exchange for larger if in stock
  const s3_en = (t.includes('bill') || t.includes('receipt') || (t.includes('order') && t.includes('verify'))) &&
    (t.includes('verify') || t.includes('check') || t.includes('size') || t.includes('larger') || t.includes('stock') || t.includes('exchange'));
  const s3_hi = (t.includes('बिल') || t.includes('रसीद') || t.includes('सत्यापित')) &&
    (t.includes('सत्यापित') || t.includes('जांच') || t.includes('आकार') || t.includes('स्टॉक') || t.includes('बदल'));
  const s3_kn = (t.includes('ಬಿಲ್') || t.includes('ರಶೀದಿ') || t.includes('ಖರೀದಿ') || t.includes('ಆರ್ಡರ್')) &&
    (t.includes('ಪರಿಶೀಲಿ') || t.includes('ಗಾತ್ರ') || t.includes('ಅಳತೆ') || t.includes('ಸ್ಟಾಕ್') || t.includes('ವಿನಿಮಯ') || t.includes('ತೋರಿಸಿ'));
  const s3_ml = (t.includes('ബിൽ') || t.includes('പർച്ചേസ്') || t.includes('ഓർഡർ')) &&
    (t.includes('പരിശോധി') || t.includes('വലുപ്പം') || t.includes('അളവ്') || t.includes('മാറ്റി') || t.includes('സ്റ്റോക്ക്') || t.includes('കാണിക്കൂ'));

  if (s3_en || s3_hi || s3_kn || s3_ml) {
    return DEMO_SCENARIOS.SCENARIO_3;
  }

  // ── Scenario 4: Finding an ATM reply ──────────────────────
  // Instructions: ATM 100m away, opposite supermarket, walk straight towards supermarket, ATM on right
  const s4_en = (t.includes('atm') || t.includes('cash machine')) &&
    ((t.includes('100') && t.includes('supermarket')) ||
     (t.includes('supermarket') && t.includes('right')) ||
     (t.includes('100') && t.includes('right')) ||
     t.includes('opposite the supermarket'));
  const s4_hi = (t.includes('एटीएम') || t.includes('atm')) &&
    ((t.includes('100') && t.includes('सुपरमार्केट')) ||
     (t.includes('सुपरमार्केट') && (t.includes('दाईं') || t.includes('दाहिने'))) ||
     (t.includes('100') && (t.includes('दाईं') || t.includes('दाहिने'))));
  const s4_kn = (t.includes('ಎಟಿಎಂ') || t.includes('atm')) &&
    ((t.includes('100') && (t.includes('ಸೂಪರ್') || t.includes('ಮಾರ್ಕೆಟ್'))) ||
     (t.includes('ಸೂಪರ್') && (t.includes('ಬಲ') || t.includes('ಬಲಭಾಗ'))) ||
     (t.includes('100') && (t.includes('ಬಲ') || t.includes('ಬಲಭಾಗ'))));
  const s4_ml = (t.includes('എടിഎം') || t.includes('atm')) &&
    ((t.includes('100') && t.includes('സൂപ്പർ')) ||
     (t.includes('സൂപ്പർ') && (t.includes('വലത്') || t.includes('വലതുവശ'))) ||
     (t.includes('100') && (t.includes('വലത്') || t.includes('വലതുവശ'))));

  if (s4_en || s4_hi || s4_kn || s4_ml) {
    return DEMO_SCENARIOS.SCENARIO_4;
  }

  // ── Contextual Match (if an active scenario was primed by drawing/writing) ─
  if (activeId) {
    const active = Object.values(DEMO_SCENARIOS).find(s => s.id === activeId);
    if (active) {
      if (active.id === 'scenario_1' && (t.includes('200') || (t.includes('bus') && t.includes('left')) || t.includes('cross'))) {
        return active;
      }
      if (active.id === 'scenario_2' && (t.includes('entrance') || t.includes('information') || (t.includes('counter') && t.includes('right')))) {
        return active;
      }
      if (active.id === 'scenario_3' && (t.includes('bill') || t.includes('receipt') || t.includes('verify') || t.includes('size'))) {
        return active;
      }
      if (active.id === 'scenario_4' && (t.includes('100') || t.includes('supermarket') || (t.includes('atm') && t.includes('right')))) {
        return active;
      }
    }
  }

  return null;
};

/**
 * Build the complete response object for a matched scenario in the requested language.
 */
export const getScenarioResponse = (scenario, targetLang = 'English') => {
  if (!scenario) return null;
  const langKey = {
    'English': 'en',
    'Hindi': 'hi',
    'Kannada': 'kn',
    'Malayalam': 'ml',
  }[targetLang] || 'en';

  const replyText = scenario.reply[langKey] || scenario.reply.en;
  const replyTextEn = scenario.reply.en;

  return {
    summary: replyText,
    cleanedText: replyTextEn,
    symbols: scenario.pictograms.map(p => ({ ...p })),
    isDemoScenario: true,
    scenarioId: scenario.id,
  };
};
