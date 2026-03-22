import requests, json, sys
sys.stdout.reconfigure(encoding='utf-8')

url = "http://127.0.0.1:5000/process"

tests = [
    {
        "text": "Hello uh how are you actually I was telling like we should go to the market tomorrow at 10 o'clock because the vegetables are very cheap there and also we need to buy some rice and dal for the week no?",
        "target_lang": "kn"
    },
    {
        "text": "So basically you need to go straight uh turn left at the signal then take the second right after the temple and the shop is next to the big banyan tree on the left side you know",
        "target_lang": "hi"
    },
    {
        "text": "I mean the meeting is at 3pm tomorrow uh we need to discuss the budget and um the marketing strategy and also like the new product launch is happening next week so yeah we need to prepare for that as well you know",
        "target_lang": None
    }
]

for i, t in enumerate(tests, 1):
    print(f"\n{'='*60}")
    print(f"TEST {i}")
    print(f"{'='*60}")
    print(f"RAW INPUT:    {t['text']}")
    
    payload = {"text": t["text"]}
    if t.get("target_lang"):
        payload["target_lang"] = t["target_lang"]
    
    r = requests.post(url, json=payload, timeout=120)
    d = r.json()
    
    print(f"CLEANED:      {d.get('cleaned_text', 'N/A')}")
    print(f"AI SUMMARY:   {d.get('summary', 'N/A')}")
    if t.get("target_lang"):
        print(f"TRANSLATED:   {d.get('translated_text', 'N/A')}")
    print(f"STATUS: {'OK' if not d.get('error') else 'ERROR: ' + d['error']}")

print(f"\n{'='*60}")
print("ALL TESTS COMPLETE")
