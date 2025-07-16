import requests
import sys

BASE = "https://alumap-notification-bot.netlify.app/.netlify/functions"
TIMEOUT = 5

# def notify_join(event_name, owner_alias, user_alias):
#     url = f"{BASE}/notifyJoin/{event_name}/{owner_alias}/{user_alias}/"
#     print(f"\n→ Calling notifyJoin:\n  {url}")
#     resp = requests.post(url, timeout=TIMEOUT)
#     resp.raise_for_status()
#     print("← notifyJoin response:", resp.status_code, resp.text)

def notify_upcoming(event_name, user_alias):
    url = f"{BASE}/notifyUpcoming/{event_name}/{user_alias}/"
    print(f"\n→ Calling notifyUpcoming:\n  {url}")
    resp = requests.post(url, timeout=TIMEOUT)
    resp.raise_for_status()
    print("← notifyUpcoming response:", resp.status_code, resp.text)

if __name__ == "__main__":
    # override these via command-line arguments: python3 test.py EventName ownerAlias userAlias
    if len(sys.argv) == 4:
        event, owner, user = sys.argv[1:]
    else:
        event = "Тест"
        owner = "aladdinych"
        user  = "aladdinych"

    print(f"Testing with event='{event}', owner='{owner}', user='{user}'")

    # try:
    #     notify_join(event, owner, user)
    # except Exception as e:
    #     print("ERROR during notifyJoin:", e)

    # PSEUDO CODE
    # if Math.abs(NOW - event.startsAt) < 12 * 60 * 60 * 1000:
    #   notify_upcoming(event, user)

    try:
        notify_upcoming(event, user)
    except Exception as e:
        print("ERROR during notifyUpcoming:", e)
