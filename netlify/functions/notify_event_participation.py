import os, json, logging, requests

logger = logging.getLogger()
logger.setLevel(logging.INFO)

TELEGRAM_TOKEN = os.getenv("TELEGRAM_TOKEN")
TEST_CHAT_ID  = "191699380"

def handler(event, context):
    # 1) Только POST
    if event.get("httpMethod") != "POST":
        return {"statusCode": 405, "body": "Method Not Allowed"}

    # 2) Разбираем путь и берём последние 3 сегмента
    #    /foo/bar/baz/<eventId>/<ownerAlias>/<userAlias>/
    parts = [p for p in event["path"].rstrip("/").split("/") if p]
    if len(parts) < 3:
        return {"statusCode": 400, "body": "Bad Request: path too short"}
    event_id, owner_alias, user_alias = parts[-3:]

    # 3) Формируем и шлём сообщение
    text = f"👋 Пользователь @{user_alias} присоединился к событию {event_id}."
    try:
        r = requests.post(
            f"https://api.telegram.org/bot{TELEGRAM_TOKEN}/sendMessage",
            data={"chat_id": TEST_CHAT_ID, "text": text},
            timeout=5
        )
        r.raise_for_status()
    except Exception as e:
        logger.error(f"Telegram API error: {e}")
        return {"statusCode": 502, "body": "Bad Gateway: Telegram API error"}

    return {"statusCode": 200, "body": json.dumps({"status": "ok"})}
