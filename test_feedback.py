import requests
import sys
import json

BASE = "https://alumap-notification-bot.netlify.app/.netlify/functions"
TIMEOUT = 5

def get_feedback():
    url = f"{BASE}/getFeedback"
    print(f"\n→ Calling getFeedback:\n  {url}")
    resp = requests.get(url, timeout=TIMEOUT)
    resp.raise_for_status()

    data = resp.json()
    print("← getFeedback response:", resp.status_code)
    # Красиво печатаем JSON
    print(json.dumps(data, ensure_ascii=False, indent=2))
    return data

if __name__ == "__main__":
    # Можно передать BASE как аргумент: python3 test_feedback.py https://my-site/.netlify/functions
    if len(sys.argv) == 2:
        BASE = sys.argv[1].rstrip("/")
    get_feedback()
