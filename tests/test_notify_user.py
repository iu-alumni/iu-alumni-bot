# test_notify_user.py
# Usage: source venv/bin/activate && python3 test_notify_user.py [BASE_URL]

import requests
import sys
import json

# По умолчанию ваш базовый URL — точка входа в Netlify functions
BASE = "https://alumap-notification-bot.netlify.app/.netlify/functions"
TIMEOUT = 5

def test_notify_user():
    # Параметры теста: event и alias пользователя
    event_name = "summer_party"
    user_alias = "aladdinych"

    url = f"{BASE}/notifyUser/{event_name}/{user_alias}/"
    payload = {
        "text": "Test notification for user"
    }

    print(f"\n→ Calling notifyUser:\n  POST {url}\n  payload: {payload}")
    resp = requests.post(url, json=payload, timeout=TIMEOUT)
    # Если код ответа не 2xx — выбросит исключение
    resp.raise_for_status()

    data = resp.json()
    print("← notifyUser response:", resp.status_code)
    print(json.dumps(data, ensure_ascii=False, indent=2))

    # Можно добавить простую проверку
    # assert data.get("status") == "ok", "Expected status == 'ok'"
    return data

if __name__ == "__main__":
    # Позволяет переопределить BASE URL через аргумент
    if len(sys.argv) == 2:
        BASE = sys.argv[1].rstrip("/")
    test_notify_user()
