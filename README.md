# iu-alumni-bot

[![Netlify Status](https://api.netlify.com/api/v1/badges/c25c89bf-defa-40c7-a868-9da02a499f24/deploy-status)](https://app.netlify.com/sites/alumap-notification-bot/deploys)

1) Планировщик на Netlify (бесплатный тариф)
К сожалению, на бесплатном тарифе Netlify нет встроенного Cron-триггера для функций. Функции запускаются только по HTTP-запросу или Webhook’у; возможности задать расписание (как в AWS EventBridge или Google Cloud Scheduler) в бесплатном профиле нет.

2) Как организовать отправку уведомлений архитектурно

Push-архитектура

основной Python-сервер (где хранятся алиасы и уведомления) сразу после создания/появления нового уведомления делает HTTP-запрос (POST) на Netlify Function, передавая параметры eventId, ownerAlias, userAlias, etc.

Netlify Function получает этот запрос, резолвит через API Python-сервера chat_id владельца (по переданному ownerAlias), и шлёт сообщение в Telegram.