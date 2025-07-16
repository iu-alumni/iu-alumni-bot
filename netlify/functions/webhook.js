// netlify/functions/webhook.js

const { Client } = require("pg");
const fetch = global.fetch || require("node-fetch");

// HTTP-код 405
const METHOD_NOT_ALLOWED = { statusCode: 405, body: "Method Not Allowed" };

// Вспомогательная функция: отправляет все опросы, сохраняет их в БД polls
async function sendFeedbackPolls(chatId) {
    const polls = [
        {
            question: "How relevant and valuable do you find our innovative approach?\n1 — not valuable at all, 5 — very valuable\n\n"
                + "Насколько актуальным и ценным вы считаете наш инновационный подход?\n1 — совсем не ценно, 5 — очень ценно",
            options: ["1", "2", "3", "4", "5"],
        },
        {
            question: "How intuitive does the app seem for creating and joining events?\n1 — not intuitive at all, 5 — completely clear\n\n"
                + "Насколько интуитивным кажется приложение для создания и присоединения к событиям?\n1 — совсем не интуитивно, 5 — абсолютно понятно",
            options: ["1", "2", "3", "4", "5"],
        },
        {
            question: "How likely are you to recommend the app to your classmates?\n1 — not likely at all, 5 — extremely likely\n\n"
                + "Насколько вероятно, что вы порекомендуете приложение своим однокурсникам?\n1 — совсем не вероятно, 5 — крайне вероятно",
            options: ["1", "2", "3", "4", "5"],
        },
    ];

    const client = new Client({
        connectionString: process.env.NEON_DATABASE_URL.trim(),
        ssl: { rejectUnauthorized: false },
    });
    await client.connect();
    // Создаем таблицу polls, если не существует
    await client.query(`
    CREATE TABLE IF NOT EXISTS polls (
      poll_id   TEXT   PRIMARY KEY,
      question  TEXT   NOT NULL,
      options   TEXT[] NOT NULL,
      created_at TIMESTAMPTZ DEFAULT now()
    );
  `);

    for (const { question, options } of polls) {
        const resp = await fetch(
            `https://api.telegram.org/bot${process.env.TELEGRAM_TOKEN}/sendPoll`,
            {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    chat_id: chatId,
                    question,
                    options,
                    is_anonymous: false,
                    allows_multiple_answers: false,
                    type: "regular",
                }),
            }
        );
        const body = await resp.json();
        if (body.ok && body.result.poll) {
            const poll = body.result.poll;
            // Сохраняем poll в БД (если не было)
            await client.query(
                `INSERT INTO polls(poll_id, question, options)
           VALUES($1, $2, $3)
         ON CONFLICT (poll_id) DO NOTHING`,
                [poll.id, poll.question, poll.options.map(o => o.text)]
            );
        }
    }
    await client.end();
}

exports.handler = async function (event) {
    if (event.httpMethod !== "POST") {
        return METHOD_NOT_ALLOWED;
    }

    let update;
    try {
        update = JSON.parse(event.body);
    } catch {
        return { statusCode: 400, body: "Bad Request" };
    }

    // 1) Обработка poll_answer (сабмит фидбека)
    if (update.poll_answer) {
        const answer = update.poll_answer;
        const pollId = answer.poll_id;
        const optionIds = answer.option_ids;  // [0,2,...]
        const alias = answer.user.username || null;
        const chatId = answer.user.id;

        const client = new Client({
            connectionString: process.env.NEON_DATABASE_URL.trim(),
            ssl: { rejectUnauthorized: false },
        });
        try {
            await client.connect();
            // Убедимся что таблица polls есть
            await client.query(`
        CREATE TABLE IF NOT EXISTS polls (
          poll_id   TEXT   PRIMARY KEY,
          question  TEXT   NOT NULL,
          options   TEXT[] NOT NULL,
          created_at TIMESTAMPTZ DEFAULT now()
        );
      `);
            // Получаем вопрос и варианты
            const res = await client.query(
                `SELECT question, options FROM polls WHERE poll_id = $1`,
                [pollId]
            );
            if (res.rowCount === 0) {
                // Таймаут или неизвестный poll_id
                await fetch(
                    `https://api.telegram.org/bot${process.env.TELEGRAM_TOKEN}/sendMessage`,
                    {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                            chat_id: chatId,
                            text: "⏰ Feedback session timed out. Please re-submit your feedback below.",
                        }),
                    }
                );
                // Отправляем опросы заново
                await client.end();
                await sendFeedbackPolls(chatId);
                return { statusCode: 200, body: JSON.stringify({ status: "timeout" }) };
            }

            const { question, options } = res.rows[0];
            // Формируем текст ответа
            const answers = optionIds.map(i => options[i]).join(", ");

            // Удаляем запись из polls (чтобы не повторять)
            await client.query(`DELETE FROM polls WHERE poll_id = $1`, [pollId]);

            // Создаем feedback таблицу если нет
            await client.query(`
        CREATE TABLE IF NOT EXISTS feedback (
          id         SERIAL PRIMARY KEY,
          alias      TEXT,
          chat_id    BIGINT NOT NULL,
          question   TEXT   NOT NULL,
          answer     TEXT   NOT NULL,
          created_at TIMESTAMPTZ DEFAULT now()
        );
      `);
            // Сохраняем в feedback
            await client.query(
                `INSERT INTO feedback(alias, chat_id, question, answer)
         VALUES($1, $2, $3, $4)`,
                [alias, chatId, question, answers]
            );
            // Опционально пуш
            if (process.env.FEEDBACK_WEBHOOK_URL) {
                await fetch(process.env.FEEDBACK_WEBHOOK_URL, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ alias, chat_id: chatId, question, answer: answers }),
                });
            }

            await client.end();
            return { statusCode: 200, body: JSON.stringify({ status: "ok" }) };
        } catch (err) {
            console.error("Feedback handler error:", err);
            await client.end();
            return { statusCode: 502, body: "Bad Gateway: " + err.message };
        }
    }

    // 2) Обработка новых сообщений (greeting и фидбек-формы)
    if (update.message) {
        const msg = update.message;
        if (!msg.from?.username) {
            return { statusCode: 200, body: "No username, skipping" };
        }

        const alias = msg.from.username;
        const chatId = msg.chat.id;

        // если команда /start — отправляем приветствие и регистрируем пользователя
        if (msg.text === "/start" || msg.text === "/help") {
            const client = new Client({
                connectionString: process.env.NEON_DATABASE_URL.trim(),
                ssl: { rejectUnauthorized: false },
            });

            try {
                await client.connect();
                // создаём таблицу users
                await client.query(`
          CREATE TABLE IF NOT EXISTS users (
            alias   TEXT   PRIMARY KEY,
            chat_id BIGINT NOT NULL
          );
        `);
                // вставляем или обновляем
                const insertQ = `
          INSERT INTO users(alias, chat_id)
          VALUES($1,$2)
          ON CONFLICT(alias) DO UPDATE SET chat_id = EXCLUDED.chat_id
        `;
                await client.query(insertQ, [alias, chatId]);
            } catch (err) {
                console.error("DB error in registration:", err);
            } finally {
                await client.end();
            }

            // отправляем приветственное сообщение
            await fetch(
                `https://api.telegram.org/bot${process.env.TELEGRAM_TOKEN}/sendMessage`,
                {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        chat_id: chatId,
                        parse_mode: "HTML",
                        text: `👋 Hello, ${alias}
🎓 Welcome to IU Alumap — we’re glad to have you here!
🔔 You will receive your app notifications through this bot

Here’s what you can do:
➡️ <b>Launch Mini App:</b> /launch_app
💬 <b>Leave feedback:</b> /leave_feedback

🛡️ When you create an event, please wait for <b>admin verification</b> before it becomes visible to others

📲 To contact the app team, send a message to our project manager: @dudos_nikitos

- - - - - -

👋 Привет, ${alias}
🎓 Добро пожаловать в IU Alumap — рады тебя видеть!
🔔 Уведомления от приложения будут приходить в этот бот

Вот что можно сделать:
➡️ <b>Запустить Mini App:</b> /launch_app
💬 <b>Дать обратную связь:</b> /leave_feedback

🛡️ После создания события, пожалуйста, подожди <b>подтверждения от администратора</b> перед тем, как оно станет доступным для других пользователей

📲 Чтобы связаться с командой приложения, напишите нашему менеджеру проекта: @dudos_nikitos`,
                    }),
                }
            );
            return { statusCode: 200, body: "ok" };
        }

        // если команда /leave_feedback — отправляем формы для фидбека и сохраняем в DB
        if (msg.text === "/leave_feedback") {
            await sendFeedbackPolls(chatId);
            return { statusCode: 200, body: "ok" };
        }

        // 3) Обработка команды /launch_app
        if (msg.text === "/launch_app") {
            const webAppUrl = "https://iualumni.netlify.app/";
            await fetch(
                `https://api.telegram.org/bot${process.env.TELEGRAM_TOKEN}/sendMessage`,
                {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        chat_id: chatId,
                        text: "📱 Кнопка для перехода к Mini App:",
                        reply_markup: {
                            inline_keyboard: [[{ text: "Перейти", web_app: { url: webAppUrl } }]]
                        }
                    }),
                }
            );
            return { statusCode: 200, body: "ok" };
        }

        // всё остальное не обрабатываем
        return { statusCode: 200, body: "Not a recognized command, skipping" };
    }

    return { statusCode: 200, body: "No handler for this update type" };
};
