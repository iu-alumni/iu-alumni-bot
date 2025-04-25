import os
import json
import logging
import requests

logger = logging.getLogger()
logger.setLevel(logging.INFO)

# Токен вашего Telegram-бота хранится в переменной окружения
TELEGRAM_TOKEN = os.getenv("TELEGRAM_TOKEN")
# Для теста используем фиксированный chat_id
TEST_CHAT_ID = os.getenv("TEST_CHAT_ID", "191699380")

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

    # Шаг 1: используем тестовый chat_id
    chat_id = TEST_CHAT_ID

    # Формируем текст сообщения
    text = f"👋 Пользователь @{user_alias} присоединился к событию {event_id}."

    # Шаг 2: отправка в Telegram
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
