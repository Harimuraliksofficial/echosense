import requests, json, sys
sys.stdout.reconfigure(encoding='utf-8')

url = "http://127.0.0.1:5000/process"

p1 = {
    "text": "Hello uh how are you actually I was telling like we should go to the market tomorrow at 10 o'clock because the vegetables are very cheap there and also we need to buy some rice and dal for the week no?",
    "target_lang": "kn"
}
p2 = {
    "text": "So basically you need to go straight uh turn left at the signal then take the second right after the temple and the shop is next to the big banyan tree on the left side you know",
    "target_lang": "kn"
}

for i, p in enumerate([p1, p2], 1):
    print(f"\n--- Test {i} ---")
    print(f"ORIGINAL:  {p['text']}")
    r = requests.post(url, json=p, timeout=60)
    d = r.json()
    print(f"CLEANED:   {d.get('cleaned_text','N/A')}")
    print(f"TRANSLATED: {d.get('translated_text','N/A')}")
