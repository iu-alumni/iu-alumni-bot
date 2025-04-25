import requests

def notify_owner(event_id: str, owner_alias: str, user_alias: str):
    url = "https://alumap-notification-bot.netlify.app/netlify/functions/notify_event_participation/" \
          f"{event_id}/{owner_alias}/{user_alias}/"
    resp = requests.post(url, timeout=5)
    resp.raise_for_status()

notify_owner( "123", "owner_alias", "user_alias")