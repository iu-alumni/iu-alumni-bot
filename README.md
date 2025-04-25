
# IU Alumni Bot

[![Netlify Status](https://api.netlify.com/api/v1/badges/c25c89bf-defa-40c7-a868-9da02a499f24/deploy-status)](https://app.netlify.com/sites/alumap-notification-bot/deploys)

---

## 🇬🇧 English

### 1. Overview  
IU Alumni Bot is a serverless Telegram bot on Netlify Functions (Node.js + Neon Postgres).  
- **registerUser**: registers a user (`alias → chat_id`) on first message.  
- **notifyJoin**: notifies both event owner and participant when someone joins.  
- **notifyUpcoming**: sends a reminder to a participant before the event starts.

---

### 2. Endpoints & Usage

#### 2.1 `registerUser`  
- **URL**  
  ```
  POST https://<your-site>/.netlify/functions/registerUser
  ```  
- **Description**  
  Telegram webhook endpoint. Upserts `username → chat_id` into `users` table.  
- **Request Body**  
  Raw JSON update from Telegram.  
- **Response**  
  - `200 OK` — always, to acknowledge Telegram.  
  - Body: plain text (`"OK"` or `"No username, skipping"`).  
- **Example**  
  ```bash
  curl -X POST \
    -H "Content-Type: application/json" \
    -d '@sample-telegram-update.json' \
    https://<your-site>/.netlify/functions/registerUser
  ```

#### 2.2 `notifyJoin`  
- **URL**  
  ```
  POST https://<your-site>/.netlify/functions/notifyJoin/{eventName}/{ownerAlias}/{userAlias}/
  ```  
- **Path Parameters**  
  | Name         | Description                              |
  |--------------|------------------------------------------|
  | `eventName`  | Identifier or name of the event.         |
  | `ownerAlias` | Telegram username of the event’s owner.  |
  | `userAlias`  | Telegram username of the joining user.   |
- **Action**  
  1. Reads both chat IDs from `users` table.  
  2. Sends two messages via Bot API:  
     - To **participant**:  
       ```  
       You successfully joined this event: {eventName}  
       ```  
     - To **owner**:  
       ```  
       @{userAlias} joined your event {eventName}!  
       ```  
- **Responses**  
  | Status | Body                                             | When                                     |
  |--------|--------------------------------------------------|------------------------------------------|
  | `200`  | `{"status":"ok"}`                                | Both messages sent successfully.        |
  | `404`  | `{"error":"Alias not found","missing":[…]}`      | One or both aliases missing in database.|
  | `405`  | `"Method Not Allowed"`                           | Request method ≠ POST.                  |
  | `502`  | `"Bad Gateway: …"`                               | DB or Telegram API error.               |
- **Example**  
  ```bash
  curl -X POST \
    https://<your-site>/.netlify/functions/notifyJoin/TestEvent/alice/bob/
  ```

#### 2.3 `notifyUpcoming`  
- **URL**  
  ```
  POST https://<your-site>/.netlify/functions/notifyUpcoming/{eventName}/{userAlias}/
  ```  
- **Path Parameters**  
  | Name         | Description                                |
  |--------------|--------------------------------------------|
  | `eventName`  | Identifier or name of the event.           |
  | `userAlias`  | Telegram username of the participant.      |
- **Action**  
  1. Reads `chat_id` for `userAlias`.  
  2. Sends a reminder via Bot API:  
     ```  
     ⏰ Reminder: your event "{eventName}" is starting soon!  
     ```  
- **Responses**  
  | Status | Body                                             | When                                     |
  |--------|--------------------------------------------------|------------------------------------------|
  | `200`  | `{"status":"ok"}`                                | Message sent successfully.             |
  | `404`  | `{"error":"Alias not found","missing":[…]}`      | Alias missing in database.             |
  | `405`  | `"Method Not Allowed"`                           | Non-POST request.                      |
  | `502`  | `"Bad Gateway: …"`                               | DB or Telegram API error.              |
- **Example**  
  ```bash
  curl -X POST \
    https://<your-site>/.netlify/functions/notifyUpcoming/TestEvent/bob/
  ```

---

### 3. Data Model

In Neon Postgres, a single table:

```sql
CREATE TABLE IF NOT EXISTS users (
  alias   TEXT PRIMARY KEY,
  chat_id BIGINT NOT NULL
);
```

- **Upsert** on `registerUser`  
- **Read** on notify functions

---

### 4. Setup & Deploy

1. **Clone & install**  
   ```bash
   git clone https://github.com/your-org/iu-alumni-bot.git
   cd iu-alumni-bot
   npm install
   ```
2. **Configure**  
   - `netlify.toml` in repo root:
     ```toml
     [build]
       functions = "netlify/functions"
     ```
   - `package.json` with:
     ```json
     {
       "dependencies": {
         "pg": "^8.10.0"
       }
     }
     ```
3. **Environment vars** (Netlify UI or `.env` locally):
   ```
   TELEGRAM_TOKEN=<your-bot-token>
   NEON_DATABASE_URL=postgresql://<user>:<pass>@<host>/<db>?sslmode=require
   ```
4. **Push to Git** → Netlify auto-builds & deploys.

---

### 5. Local Development

```bash
npm install -g netlify-cli
netlify dev
```

- **registerUser** → `http://localhost:8888/.netlify/functions/registerUser`  
- **notifyJoin** → `http://localhost:8888/.netlify/functions/notifyJoin/Test/alice/bob/`  
- **notifyUpcoming** → `http://localhost:8888/.netlify/functions/notifyUpcoming/Test/bob/`  

---

## 🇷🇺 Русский

### 1. Обзор  
IU Alumni Bot — бессерверный Telegram-бот на Netlify Functions (Node.js + Neon Postgres).  
- **registerUser**: сохраняет `alias → chat_id`.  
- **notifyJoin**: уведомляет организатора и участника о новом join.  
- **notifyUpcoming**: отправляет напоминание участнику перед стартом.

---

### 2. Эндпоинты и примеры

#### 2.1 `registerUser`  
- **URL**  
  ```
  POST https://<ваш-домен>/.netlify/functions/registerUser
  ```  
- **Описание**  
  Webhook для Telegram. Сохраняет или обновляет запись в таблице `users`.  
- **Тело запроса**  
  JSON-объект обновления от Telegram.  
- **Ответ**  
  - `200 OK` — всегда.  
  - Тело: текст (`"OK"` или `"No username, skipping"`).  
- **Пример**  
  ```bash
  curl -X POST \
    -H "Content-Type: application/json" \
    -d '@update.json' \
    https://<ваш-домен>/.netlify/functions/registerUser
  ```

#### 2.2 `notifyJoin`  
- **URL**  
  ```
  POST https://<ваш-домен>/.netlify/functions/notifyJoin/{eventName}/{ownerAlias}/{userAlias}/
  ```  
- **Параметры пути**  
  | Имя           | Описание                            |
  |---------------|-------------------------------------|
  | `eventName`   | Название или ID события.            |
  | `ownerAlias`  | Телеграм-имя организатора.          |
  | `userAlias`   | Телеграм-имя вступающего пользователя. |
- **Что делает**  
  1. Берёт `chat_id` из БД для обоих алиасов.  
  2. Шлёт:
     - **Участнику**:  
       `You successfully joined this event: {eventName}`  
     - **Организатору**:  
       `@{userAlias} joined your event {eventName}!`  
- **Ответы**  
  | Код   | Тело                                         | Когда                          |
  |-------|----------------------------------------------|--------------------------------|
  | `200` | `{"status":"ok"}`                            | Успешно отправлены оба сообщения. |
  | `404` | `{"error":"Alias not found","missing":[…]}`  | Хотя бы один алиас не найден.  |
  | `405` | `"Method Not Allowed"`                       | Метод ≠ POST.                 |
  | `502` | `"Bad Gateway: …"`                           | Ошибка БД или Telegram API.   |
- **Пример**  
  ```bash
  curl -X POST \
    https://<ваш-домен>/.netlify/functions/notifyJoin/Тест/organizer/johndoe/
  ```

#### 2.3 `notifyUpcoming`  
- **URL**  
  ```
  POST https://<ваш-домен>/.netlify/functions/notifyUpcoming/{eventName}/{userAlias}/
  ```  
- **Параметры пути**  
  | Имя          | Описание                            |
  |--------------|-------------------------------------|
  | `eventName`  | Название или ID события.            |
  | `userAlias`  | Телеграм-имя участника.             |
- **Что делает**  
  1. Читает `chat_id` для `userAlias`.  
  2. Шлёт напоминание:  
     `⏰ Reminder: your event "{eventName}" is starting soon!`  
- **Ответы**  
  | Код   | Тело                                         | Когда                          |
  |-------|----------------------------------------------|--------------------------------|
  | `200` | `{"status":"ok"}`                            | Сообщение отправлено.          |
  | `404` | `{"error":"Alias not found","missing":[…]}`  | Alias не найден.               |
  | `405` | `"Method Not Allowed"`                       | Метод ≠ POST.                 |
  | `502` | `"Bad Gateway: …"`                           | Ошибка БД или Telegram API.   |
- **Пример**  
  ```bash
  curl -X POST \
    https://<ваш-домен>/.netlify/functions/notifyUpcoming/Тест/bob/
  ```

---

### 3. Модель данных

```sql
CREATE TABLE IF NOT EXISTS users (
  alias   TEXT PRIMARY KEY,
  chat_id BIGINT NOT NULL
);
```
- **registerUser**: upsert  
- **notify…**: read

---

### 4. Установка и деплой

1. **Клонировать и установить**  
   ```bash
   git clone https://github.com/your-org/iu-alumni-bot.git
   cd iu-alumni-bot
   npm install
   ```
2. **Конфиг Netlify** (`netlify.toml`):
   ```toml
   [build]
     functions = "netlify/functions"
   ```
3. **package.json** (в корне):
   ```json
   {
     "dependencies": {
       "pg": "^8.10.0"
     }
   }
   ```
4. **ENV vars** (Netlify UI):  
   ```
   TELEGRAM_TOKEN=<ваш_токен>
   NEON_DATABASE_URL=postgresql://<user>:<pass>@<host>/<db>?sslmode=require
   ```
5. **Push в Git** → автоматический билд & деплой.

---

### 5. Локальная разработка

```bash
npm install -g netlify-cli
netlify dev
```
- registerUser → `http://localhost:8888/.netlify/functions/registerUser`  
- notifyJoin → `http://localhost:8888/.netlify/functions/notifyJoin/Event/Alice/Bob/`  
- notifyUpcoming → `http://localhost:8888/.netlify/functions/notifyUpcoming/Event/Bob/`  
