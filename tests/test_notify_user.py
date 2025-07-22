
# Usage: source venv/bin/activate && python3 test_notify_user.py [BASE_URL]

import requests
import sys
import json

BASE = "https://alumap-notification-bot.netlify.app/.netlify/functions"
TIMEOUT = 5

def test_notify_user():
    # Задайте свои параметры
    event_name = "summer_party"
    owner_alias = "aladdinych"
    user_alias = "aladdinych"

    url = f"{BASE}/notifyUser/{event_name}/{owner_alias}/{user_alias}/"
    payload = {
        "text": "Тестовое уведомление: вы успешно присоединились к событию!"
    }

    print(f"\n→ Calling notifyUser:\n  POST {url}\n  payload: {payload}")
    resp = requests.post(url, json=payload, timeout=TIMEOUT)
    resp.raise_for_status()

    data = resp.json()
    print("← notifyUser response:", resp.status_code)
    print(json.dumps(data, ensure_ascii=False, indent=2))
    return data

if __name__ == "__main__":
    if len(sys.argv) == 2:
        BASE = sys.argv[1].rstrip("/")
    test_notify_user()
