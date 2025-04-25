# IU Alumni Bot

[![Netlify Status](https://api.netlify.com/api/v1/badges/c25c89bf-defa-40c7-a868-9da02a499f24/deploy-status)](https://app.netlify.com/sites/alumap-notification-bot/deploys)

---

## 🇬🇧 English

### 1. What is IU Alumni Bot?  
IU Alumni Bot is a serverless Telegram bot deployed on Netlify Functions (Node.js). It lets your backend send RSVP-style and reminder notifications to users who have joined events, and notifies event organizers when someone signs up.

### 2. How it works  
1. **User Registration**  
   - You set your Telegram webhook to point at `/.netlify/functions/registerUser`.  
   - When a user messages the bot (e.g. sends `/start`), the `registerUser.js` function upserts their `username → chat_id` into a Neon PostgreSQL table `users(alias TEXT PRIMARY KEY, chat_id BIGINT)`.  
2. **Push Notifications**  
   - Your Python (or any) backend, upon certain triggers, sends HTTP POSTs to:
     ```
     https://<your-site>/.netlify/functions/notifyJoin/{eventName}/{ownerAlias}/{userAlias}/
     ```
   - The `notifyJoin.js` function:
     1. Parses `eventName`, `ownerAlias`, `userAlias` from the URL.
     2. Reads both chat IDs from Neon.
     3. Sends two Telegram messages:
        - **To the new participant**:  
          `You successfully joined this event: {eventName}`
        - **To the organizer**:  
          `@{userAlias} joined your event {eventName}!`

### 3. Notification Types  
- **Upcoming Event Notification**  
  A reminder sent to participants a configurable time (e.g. 3 hours) before an event starts.  
- **New Participant Notification**  
  Sent to the event author when someone clicks “Join.”  
- *…more to come…*

### 4. Prerequisites  
- Node.js & npm  
- Neon PostgreSQL (or any Postgres)  
- A Telegram Bot token  
- (Optional) External scheduler (cron-job.org, GitHub Actions, etc.) for “Upcoming Event” reminders

### 5. Setup & Deployment

1. **Clone repo & install:**  
   ```bash
   git clone https://github.com/your-org/iu-alumni-bot.git
   cd iu-alumni-bot
   npm install
   ```
2. **Configure**  
   - In `netlify.toml`:
     ```toml
     [build]
       functions = "netlify/functions"
     ```
   - Create a root `package.json` with:
     ```json
     {
       "dependencies": {
         "pg": "^8.10.0"
       }
     }
     ```
3. **Environment variables** (Netlify → Site settings → Build & deploy → Environment):
   ```
   TELEGRAM_TOKEN=<your-bot-token>
   NEON_DATABASE_URL=postgresql://<user>:<pass>@<host>/<db>?sslmode=require
   ```
4. **Push to Git** — Netlify will auto-build & deploy.

### 6. Local Development  
```bash
npm install -g netlify-cli
netlify dev
```
- `http://localhost:8888/.netlify/functions/registerUser`  
- `http://localhost:8888/.netlify/functions/notifyJoin/{event}/{owner}/{user}`  

### 7. Usage  

1. **Set Telegram webhook**  
   ```bash
   curl "https://api.telegram.org/bot${TELEGRAM_TOKEN}/setWebhook?url=https://<your-site>/.netlify/functions/registerUser"
   ```
2. **Test join notification**  
   ```bash
   curl -X POST https://<your-site>/.netlify/functions/notifyJoin/TestEvent/alice/bob/
   ```
3. **Schedule upcoming reminders**  
   Use an external cron to hit:
   ```
   POST https://<your-site>/.netlify/functions/notifyUpcoming/{eventName}/{userAlias}/
   ```
   (Implement `notifyUpcoming.js` similarly.)

---

## 🇷🇺 Русский

### 1. Что такое IU Alumni Bot?  
IU Alumni Bot — бессерверный Telegram-бот на Netlify Functions (Node.js). Он позволяет вашему бэкенду рассылать уведомления участникам о предстоящих событиях и оповещать организатора, когда кто-то записался.

### 2. Как это работает  
1. **Регистрация пользователя**  
   - Установите webhook Telegram на `/.netlify/functions/registerUser`.  
   - Функция `registerUser.js` при любом сообщении пользователя (`/start` и т. п.) сохраняет или обновляет `username → chat_id` в таблице `users(alias TEXT PRIMARY KEY, chat_id BIGINT)`.  
2. **Push-уведомления**  
   - Ваш сервер присылает POST на
     ```
     https://<ваш-домен>/.netlify/functions/notifyJoin/{eventName}/{ownerAlias}/{userAlias}/
     ```
   - Функция `notifyJoin.js`:
     1. Парсит из URL `eventName`, `ownerAlias`, `userAlias`.  
     2. Забирает их `chat_id` из Neon.  
     3. Шлёт два сообщения в Telegram:
        - **Участнику**:  
          `You successfully joined this event: {eventName}`  
        - **Организатору**:  
          `@{userAlias} joined your event {eventName}!`

### 3. Типы уведомлений  
- **Напоминание о событии**  
  Отправляется участникам за настраиваемое время (например, за 3 часа) до старта.  
- **Уведомление о новом участнике**  
  Организатор получает оповещение, когда нажали “Join”.  
- *…и другие…*

### 4. Необходимое  
- Node.js и npm  
- База PostgreSQL (Neon или любая другая)  
- Токен Telegram-бота  
- (Опционально) Сторонний планировщик (cron-job.org, GitHub Actions) для напоминаний

### 5. Установка и деплой

1. **Клонирование и зависимости:**  
   ```bash
   git clone https://github.com/your-org/iu-alumni-bot.git
   cd iu-alumni-bot
   npm install
   ```
2. **Конфигурация**  
   - `netlify.toml`:
     ```toml
     [build]
       functions = "netlify/functions"
     ```
   - В корне создайте `package.json`:
     ```json
     {
       "dependencies": {
         "pg": "^8.10.0"
       }
     }
     ```
3. **Переменные окружения** (Netlify → Site settings → Build & deploy → Environment):
   ```
   TELEGRAM_TOKEN=<ваш_токен>
   NEON_DATABASE_URL=postgresql://<user>:<pass>@<host>/<db>?sslmode=require
   ```
4. **Push в Git** — Netlify соберёт и задеплоит автоматически.

### 6. Локальная разработка  
```bash
npm install -g netlify-cli
netlify dev
```
- `http://localhost:8888/.netlify/functions/registerUser`  
- `http://localhost:8888/.netlify/functions/notifyJoin/{event}/{owner}/{user}`  

### 7. Использование  

1. **Регистрация webhook**  
   ```bash
   curl "https://api.telegram.org/bot${TELEGRAM_TOKEN}/setWebhook?url=https://<ваш-домен>/.netlify/functions/registerUser"
   ```
2. **Тест уведомления о записи**  
   ```bash
   curl -X POST https://<ваш-домен>/.netlify/functions/notifyJoin/Тест/aladdinych/aladdinych/
   ```
3. **Планирование напоминаний**  
   Используйте внешние cron-сервисы для вызова:
   ```
   POST https://<ваш-домен>/.netlify/functions/notifyUpcoming/{eventName}/{userAlias}/
   ```
   (Реализуйте аналогично `notifyUpcoming.js`.)
