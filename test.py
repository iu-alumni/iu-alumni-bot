import requests

def notify_owner(event_id, owner_alias, user_alias):
    url = (
        "https://alumap-notification-bot.netlify.app"  # <-- точка перед netlify.app!
        "/.netlify/functions/notify_event_participation"
        f"/{event_id}/{owner_alias}/{user_alias}/"
    )
    print("Calling:", url)
    resp = requests.post(url, timeout=5)
    resp.raise_for_status()
    print("Response:", resp.status_code, resp.text)

if __name__ == "__main__":
    notify_owner("123", "owner_alias", "user_alias")
