# test_notify_admins.py
# Usage: source venv/bin/activate && python3 test_notify_admins.py [BASE_URL]

import requests
import sys
import json

BASE = "https://alumap-notification-bot.netlify.app/.netlify/functions"
TIMEOUT = 5

def test_notify_admins():
    url = f"{BASE}/notifyAdmins"
    payload = {"s": "Test notification to admins"}
    print(f"\n→ Calling notifyAdmins:\n  POST {url}\n  payload: {payload}")
    resp = requests.post(url, json=payload, timeout=TIMEOUT)
    resp.raise_for_status()

    data = resp.json()
    print("← notifyAdmins response:", resp.status_code)
    print(json.dumps(data, ensure_ascii=False, indent=2))
    return data

if __name__ == "__main__":
    if len(sys.argv) == 2:
        BASE = sys.argv[1].rstrip("/")
    test_notify_admins()
