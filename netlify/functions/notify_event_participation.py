import os
import json
import logging
import requests

logger = logging.getLogger()
logger.setLevel(logging.INFO)

# Единственная переменная окружения: ваш токен бота
TELEGRAM_TOKEN = os.getenv("TELEGRAM_TOKEN")

def handler(event, context):
    # Разрешаем только POST
    if event.get("httpMethod") != "POST":
        return {"statusCode": 405, "body": "Method Not Allowed"}

    # Ожидаем путь:
    # /.netlify/functions/notify_event_participation/{eventId}/{ownerAlias}/{userAlias}/
    path_parts = event["path"].rstrip("/").split("/")
    # path_parts == ["", ".netlify", "functions", "notify_event_participation",
    #                 event_id, owner_alias, user_alias]
    if len(path_parts) != 7 \
       or path_parts[1] != ".netlify" \
       or path_parts[2] != "functions" \
       or path_parts[3] != "notify_event_participation":
        return {"statusCode": 400, "body": "Bad Request: invalid path"}

    _, _, _, _, event_id, owner_alias, user_alias = path_parts

    # Тестовый chat_id
    chat_id = "191699380"

    # Формируем текст
    text = f"👋 Пользователь @{user_alias} присоединился к событию {event_id}."

    # Шлём запрос в Telegram
    try:
        tg_resp = requests.post(
            f"https://api.telegram.org/bot{TELEGRAM_TOKEN}/sendMessage",
            data={"chat_id": chat_id, "text": text},
            timeout=5
        )
        tg_resp.raise_for_status()
    except Exception as e:
        logger.error(f"Telegram API error: {e}")
        return {"statusCode": 502, "body": "Bad Gateway: Telegram API error"}

    return {
        "statusCode": 200,
        "body": json.dumps({"status": "ok"})
    }
