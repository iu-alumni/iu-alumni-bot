import os
import json
import logging
import requests

logger = logging.getLogger()
logger.setLevel(logging.INFO)

# Ожидаем только TELEGRAM_TOKEN в переменных окружения
TELEGRAM_TOKEN = os.getenv("TELEGRAM_TOKEN")

def handler(event, context):
    # Разрешаем только POST-запросы
    if event.get("httpMethod") != "POST":
        return {"statusCode": 405, "body": "Method Not Allowed"}

    # Ожидаем путь вида /notify/event-participation/{eventId}/{ownerAlias}/{userAlias}/
    path_parts = event["path"].rstrip("/").split("/")
    try:
        _, notify, action, event_id, owner_alias, user_alias = path_parts
        assert notify == "notify" and action == "event-participation"
    except Exception:
        return {"statusCode": 400, "body": "Bad Request: invalid path"}

    # Шаг 1: используем статический chat_id для теста
    chat_id = "191699380"

    # Шаг 2: отправить сообщение в Telegram
    text = f"👋 Пользователь @{user_alias} присоединился к событию {event_id}."
    try:
        tg_resp = requests.post(
            f"https://api.telegram.org/bot{TELEGRAM_TOKEN}/sendMessage",
            data={"chat_id": chat_id, "text": text},
            timeout=5
        )
        tg_resp.raise_for_status()
    except Exception as e:
        logger.error(f"Telegram API error: {e} — response: {getattr(e, 'response', None)}")
        return {"statusCode": 502, "body": "Bad Gateway: Telegram API error"}

    return {
        "statusCode": 200,
        "body": json.dumps({"status": "ok"})
    }
