## 🇬🇧 English

# IU Alumni Bot

[![Netlify Status](https://api.netlify.com/api/v1/badges/c25c89bf-defa-40c7-a868-9da02a499f24/deploy-status)](https://app.netlify.com/sites/alumap-notification-bot/deploys)

---

### 1. Overview

IU Alumni Bot is a serverless Telegram bot built on Netlify Functions (Node.js + Neon Postgres). It now comprises four distinct functions:

* **`webhook`**

  * Handles `/start` → registers or updates a user and sends a greeting (EN/RU).
  * Handles `/leave_feedback` → sends a sequence of non-anonymous polls.
  * Handles `poll_answer` callbacks → writes feedback into the `feedback` table and (optionally) forwards it to an external webhook.
* **`notifyJoin`**
  Notifies both the event owner and the new participant when someone joins.
* **`notifyUpcoming`**
  Sends a reminder to a participant shortly before their event begins.
* **`notifyAdmins`**
  Sends an arbitrary message to a hard-coded admins’ Telegram group when you POST a JSON payload `{ "s": "<your text>" }`.

---

### 2. Endpoints & Usage

#### 2.1 `webhook`

* **URL**

  ```
  POST https://<your-site>/.netlify/functions/webhook
  ```
* **Description**
  Central Telegram webhook.

  1. **/start**

     * Stores `username → chat_id` in `users`.
     * Replies with a bilingual greeting, plus commands and feedback prompt.
  2. **/leave\_feedback**

     * Sends three regular polls to the user.
  3. **poll\_answer**

     * Persists answers to `feedback(alias, chat_id, poll_id, option_ids)`
     * Optionally forwards to `FEEDBACK_WEBHOOK_URL`.
* **Request Body**
  Raw Telegram update JSON.
* **Responses**

  * `200 OK` — to acknowledge Telegram.
  * Plain text or JSON status, depending on branch.
* **Example**

  ```bash
  curl -X POST \
    -H "Content-Type: application/json" \
    -d '@sample-update.json' \
    https://<your-site>/.netlify/functions/webhook
  ```

#### 2.2 `notifyJoin`

* **URL**

  ```
  POST https://<your-site>/.netlify/functions/notifyJoin/{eventName}/{ownerAlias}/{userAlias}/
  ```
* **Path Parameters**

  | Name         | Description                             |
  | ------------ | --------------------------------------- |
  | `eventName`  | Identifier or name of the event.        |
  | `ownerAlias` | Telegram username of the event’s owner. |
  | `userAlias`  | Telegram username of the joining user.  |
* **Action**

  1. Lookup both aliases in `users`.
  2. Send two messages via Bot API:

     * **Participant**:

       ```
       You successfully joined this event: {eventName}
       ```
     * **Owner**:

       ```
       @{userAlias} joined your event {eventName}!
       ```
* **Responses**

  | Status | Body                                        | When                             |
  | ------ | ------------------------------------------- | -------------------------------- |
  | `200`  | `{"status":"ok"}`                           | Both messages sent successfully. |
  | `404`  | `{"error":"Alias not found","missing":[…]}` | One or both aliases missing.     |
  | `405`  | `"Method Not Allowed"`                      | Request method ≠ POST.           |
  | `502`  | `"Bad Gateway: …"`                          | DB or Telegram API error.        |
* **Example**

  ```bash
  curl -X POST \
    https://<your-site>/.netlify/functions/notifyJoin/TestEvent/alice/bob/
  ```

#### 2.3 `notifyUpcoming`

* **URL**

  ```
  POST https://<your-site>/.netlify/functions/notifyUpcoming/{eventName}/{userAlias}/
  ```
* **Path Parameters**

  | Name        | Description                           |
  | ----------- | ------------------------------------- |
  | `eventName` | Identifier or name of the event.      |
  | `userAlias` | Telegram username of the participant. |
* **Action**

  1. Lookup `chat_id` for `userAlias`.
  2. Send reminder via Bot API:

     ```
     ⏰ Reminder: your event "{eventName}" is starting soon!
     ```
* **Responses**

  | Status | Body                                        | When                       |
  | ------ | ------------------------------------------- | -------------------------- |
  | `200`  | `{"status":"ok"}`                           | Message sent successfully. |
  | `404`  | `{"error":"Alias not found","missing":[…]}` | Alias missing in database. |
  | `405`  | `"Method Not Allowed"`                      | Non-POST request.          |
  | `502`  | `"Bad Gateway: …"`                          | DB or Telegram API error.  |
* **Example**

  ```bash
  curl -X POST \
    https://<your-site>/.netlify/functions/notifyUpcoming/TestEvent/bob/
  ```

#### 2.4 `notifyAdmins`

* **URL**

  ```
  POST https://<your-site>/.netlify/functions/notifyAdmins
  ```
* **Description**
  Send a custom text message to the admins’ group (`chat_id = -4725261280`).
* **Request Body**

  ```json
  {
    "s": "Your admin notification text here"
  }
  ```
* **Responses**

  | Status | Body                                          | When                           |
  | ------ | --------------------------------------------- | ------------------------------ |
  | `200`  | `{"status":"ok"}`                             | Message delivered to admins.   |
  | `400`  | `"Bad Request: missing or invalid 's' field"` | Missing or invalid JSON field. |
  | `405`  | `"Method Not Allowed"`                        | Method ≠ POST.                 |
  | `502`  | `"Bad Gateway: …"`                            | Telegram API or network error. |
* **Example**

  ```bash
  curl -X POST \
    -H "Content-Type: application/json" \
    -d '{"s":"Server health is OK"}' \
    https://<your-site>/.netlify/functions/notifyAdmins
  ```

---

### 3. Data Model

```sql
-- Registered users:
CREATE TABLE IF NOT EXISTS users (
  alias   TEXT PRIMARY KEY,
  chat_id BIGINT NOT NULL
);

-- Collected feedback:
CREATE TABLE IF NOT EXISTS feedback (
  id          SERIAL PRIMARY KEY,
  alias       TEXT,
  chat_id     BIGINT NOT NULL,
  poll_id     TEXT   NOT NULL,
  option_ids  TEXT[] NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT now()
);
```

---

### 4. Setup & Deploy

1. **Clone & install**

   ```bash
   git clone https://github.com/your-org/iu-alumni-bot.git
   cd iu-alumni-bot
   npm install
   ```
2. **Configure**

   * **netlify.toml**:

     ```toml
     [build]
       functions = "netlify/functions"
     ```
   * **package.json** dependencies:

     ```json
     {
       "dependencies": {
         "pg": "^8.10.0",
         "node-fetch": "^2.6.7"
       }
     }
     ```
3. **Environment Variables** (in Netlify UI or `.env` locally):

   ```
   TELEGRAM_TOKEN=<your-bot-token>
   NEON_DATABASE_URL=postgresql://<user>:<pass>@<host>/<db>?sslmode=require
   FEEDBACK_WEBHOOK_URL=<optional external feedback endpoint>
   ```
4. **Push to Git** → Netlify auto-build & deploy.

---

### 5. Local Development

```bash
npm install -g netlify-cli
netlify dev
```

* **Webhook:**
  `http://localhost:8888/.netlify/functions/webhook`
* **notifyJoin:**
  `http://localhost:8888/.netlify/functions/notifyJoin/Test/alice/bob/`
* **notifyUpcoming:**
  `http://localhost:8888/.netlify/functions/notifyUpcoming/Test/bob/`
* **notifyAdmins:**

  ```bash
  curl -X POST \
    -H "Content-Type: application/json" \
    -d '{"s":"Hello admins"}' \
    http://localhost:8888/.netlify/functions/notifyAdmins
  ```

---

## 🇷🇺 Русский

# IU Alumni Bot

[![Netlify Status](https://api.netlify.com/api/v1/badges/c25c89bf-defa-40c7-a868-9da02a499f24/deploy-status)](https://app.netlify.com/sites/alumap-notification-bot/deploys)

---

### 1. Обзор

IU Alumni Bot — бессерверный Telegram-бот на Netlify Functions (Node.js + Neon Postgres). Состоит из четырёх функций:

* **`webhook`**

  * `/start` → сохраняет или обновляет `alias → chat_id` и шлёт приветствие (EN/RU).
  * `/leave_feedback` → рассылает три опроса.
  * `poll_answer` → записывает ответы в таблицу `feedback` и (опционально) форвардит их на внешний вебхук.
* **`notifyJoin`**
  Уведомляет организатора и участника при новом вступлении.
* **`notifyUpcoming`**
  Напоминает участнику перед запуском события.
* **`notifyAdmins`**
  Принимает POST с `{ "s": "текст" }` и шлёт его в группу админов (`chat_id = -4725261280`).

---

### 2. Эндпоинты и примеры

#### 2.1 `webhook`

* **URL**

  ```
  POST https://<ваш-домен>/.netlify/functions/webhook
  ```
* **Описание**
  Главный вебхук для Telegram.

  1. **/start**

     * Upsert в `users(alias, chat_id)`.
     * Шлёт приветствие с командами.
  2. **/leave\_feedback**

     * Рассылает последовательность опросов.
  3. **poll\_answer**

     * Пишет в `feedback`.
     * Форвардит на `FEEDBACK_WEBHOOK_URL`.
* **Тело запроса**
  JSON-объект обновления от Telegram.
* **Ответы**

  * `200 OK` — всегда.
  * Текст или JSON, в зависимости от ветки.
* **Пример**

  ```bash
  curl -X POST \
    -H "Content-Type: application/json" \
    -d '@update.json' \
    https://<ваш-домен>/.netlify/functions/webhook
  ```

#### 2.2 `notifyJoin`

* **URL**

  ```
  POST https://<ваш-домен>/.netlify/functions/notifyJoin/{eventName}/{ownerAlias}/{userAlias}/
  ```
* **Параметры пути**

  | Имя          | Описание                        |
  | ------------ | ------------------------------- |
  | `eventName`  | ID или название события.        |
  | `ownerAlias` | Телеграм-имя организатора.      |
  | `userAlias`  | Телеграм-имя присоединившегося. |
* **Действие**

  1. Берёт `chat_id` из `users`.
  2. Шлёт:

     * **Участнику**:
       `You successfully joined this event: {eventName}`
     * **Организатору**:
       `@{userAlias} joined your event {eventName}!`
* **Ответы**

  | Код   | Тело                                        | Когда                       |
  | ----- | ------------------------------------------- | --------------------------- |
  | `200` | `{"status":"ok"}`                           | Оба сообщения ушли успешно. |
  | `404` | `{"error":"Alias not found","missing":[…]}` | Не найден один из алиасов.  |
  | `405` | `"Method Not Allowed"`                      | Метод ≠ POST.               |
  | `502` | `"Bad Gateway: …"`                          | Ошибка БД или Telegram API. |
* **Пример**

  ```bash
  curl -X POST \
    https://<ваш-домен>/.netlify/functions/notifyJoin/Тест/organizer/johndoe/
  ```

#### 2.3 `notifyUpcoming`

* **URL**

  ```
  POST https://<ваш-домен>/.netlify/functions/notifyUpcoming/{eventName}/{userAlias}/
  ```
* **Параметры пути**

  | Имя         | Описание                 |
  | ----------- | ------------------------ |
  | `eventName` | ID или название события. |
  | `userAlias` | Телеграм-имя участника.  |
* **Действие**

  1. Берёт `chat_id`.
  2. Шлёт напоминание:
     `⏰ Reminder: your event "{eventName}" is starting soon!`
* **Ответы**

  | Код   | Тело                                        | Когда                           |
  | ----- | ------------------------------------------- | ------------------------------- |
  | `200` | `{"status":"ok"}`                           | Сообщение отправлено.           |
  | `404` | `{"error":"Alias not found","missing":[…]}` | Alias не найден.                |
  | `405` | `"Method Not Allowed"`                      | Метод ≠ POST.                   |
  | `502` | `"Bad Gateway: …"`                          | Проблема с БД или Telegram API. |
* **Пример**

  ```bash
  curl -X POST \
    https://<ваш-домен>/.netlify/functions/notifyUpcoming/Тест/bob/
  ```

#### 2.4 `notifyAdmins`

* **URL**

  ```
  POST https://<ваш-домен>/.netlify/functions/notifyAdmins
  ```
* **Описание**
  Шлёт любой текст в чат админов (`-4725261280`).
* **Тело запроса**

  ```json
  {
    "s": "Текст уведомления для админов"
  }
  ```
* **Ответы**

  | Код   | Тело                                          | Когда                            |
  | ----- | --------------------------------------------- | -------------------------------- |
  | `200` | `{"status":"ok"}`                             | Уведомление доставлено.          |
  | `400` | `"Bad Request: missing or invalid 's' field"` | Поле `s` отсутствует/не валидно. |
  | `405` | `"Method Not Allowed"`                        | Метод ≠ POST.                    |
  | `502` | `"Bad Gateway: …"`                            | Ошибка Telegram API или сеть.    |
* **Пример**

  ```bash
  curl -X POST \
    -H "Content-Type: application/json" \
    -d '{"s":"Тестовое сообщение"}' \
    https://<ваш-домен>/.netlify/functions/notifyAdmins
  ```

---

### 3. Модель данных

```sql
CREATE TABLE IF NOT EXISTS users (
  alias   TEXT PRIMARY KEY,
  chat_id BIGINT NOT NULL
);

CREATE TABLE IF NOT EXISTS feedback (
  id          SERIAL PRIMARY KEY,
  alias       TEXT,
  chat_id     BIGINT NOT NULL,
  poll_id     TEXT   NOT NULL,
  option_ids  TEXT[] NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT now()
);
```

---

### 4. Установка и деплой

1. **Клонировать & установить**

   ```bash
   git clone https://github.com/your-org/iu-alumni-bot.git
   cd iu-alumni-bot
   npm install
   ```
2. **Конфигурация**

   * **netlify.toml**:

     ```toml
     [build]
       functions = "netlify/functions"
     ```
   * **package.json** dependencies:

     ```json
     {
       "dependencies": {
         "pg": "^8.10.0",
         "node-fetch": "^2.6.7"
       }
     }
     ```
3. **Переменные окружения**:

   ```
   TELEGRAM_TOKEN=<ваш_токен>
   NEON_DATABASE_URL=postgresql://<user>:<pass>@<host>/<db>?sslmode=require
   FEEDBACK_WEBHOOK_URL=<опционально>
   ```
4. **Git push** → Netlify автоматически билдит и деплоит.

---

### 5. Локальная разработка

```bash
npm install -g netlify-cli
netlify dev
```

* **webhook** → `http://localhost:8888/.netlify/functions/webhook`
* **notifyJoin** → `http://localhost:8888/.netlify/functions/notifyJoin/Event/Alice/Bob/`
* **notifyUpcoming** → `http://localhost:8888/.netlify/functions/notifyUpcoming/Event/Bob/`
* **notifyAdmins**:

  ```bash
  curl -X POST \
    -H "Content-Type: application/json" \
    -d '{"s":"Привет, админы"}' \
    http://localhost:8888/.netlify/functions/notifyAdmins
  ```
