// netlify/functions/webhook.js

const { Client } = require("pg");
const fetch = global.fetch || require("node-fetch");

// HTTP-код 405
const METHOD_NOT_ALLOWED = { statusCode: 405, body: "Method Not Allowed" };

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

    // ────────────────────────────────────────────────
    // 1) Обработка poll_answer (сабмит фидбека)
    // ────────────────────────────────────────────────
    if (update.poll_answer) {
        const answer = update.poll_answer;
        const pollId = answer.poll_id;
        const optionIds = answer.option_ids;             // [0,2,...]
        const alias = answer.user.username || null;
        const chatId = answer.user.id;

        const client = new Client({
            connectionString: process.env.NEON_DATABASE_URL.trim(),
            ssl: { rejectUnauthorized: false },
        });

        try {
            await client.connect();

            // создаём таблицу, если её ещё нет
            await client.query(`
        CREATE TABLE IF NOT EXISTS feedback (
          id          SERIAL PRIMARY KEY,
          alias       TEXT,
          chat_id     BIGINT NOT NULL,
          poll_id     TEXT   NOT NULL,
          option_ids  TEXT[] NOT NULL,
          created_at  TIMESTAMPTZ DEFAULT now()
        );
      `);

            // вставляем ответ
            await client.query(
                `INSERT INTO feedback(alias, chat_id, poll_id, option_ids)
         VALUES($1, $2, $3, $4)`,
                [alias, chatId, pollId, optionIds.map(String)]
            );

            // опционально: пушим на внешний вебхук
            if (process.env.FEEDBACK_WEBHOOK_URL) {
                await fetch(process.env.FEEDBACK_WEBHOOK_URL, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ alias, chat_id: chatId, poll_id: pollId, selected_options: optionIds }),
                });
            }

            return { statusCode: 200, body: JSON.stringify({ status: "ok" }) };
        } catch (err) {
            console.error("Feedback handler error:", err);
            return { statusCode: 502, body: "Bad Gateway: " + err.message };
        } finally {
            await client.end();
        }
    }

    // ────────────────────────────────────────────────
    // 2) Обработка новых сообщений (гreeting и фидбек-формы)
    // ────────────────────────────────────────────────
    if (update.message) {
        const msg = update.message;
        // пропускаем, если нет username
        if (!msg.from?.username) {
            return { statusCode: 200, body: "No username, skipping" };
        }

        const alias = msg.from.username;
        const chatId = msg.chat.id;

        // если команда /start — отправляем приветствие и регистрируем пользователя
        if (msg.text === "/start") {
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

                // пробуем вставить; если уже был — обновляем chat_id
                const insertQ = `
            INSERT INTO users(alias, chat_id)
            VALUES($1,$2)
            ON CONFLICT(alias) DO UPDATE SET chat_id = EXCLUDED.chat_id
          `;
                await client.query(insertQ, [alias, chatId]);
            } catch (err) {
                console.error("DB error in registration:", err);
                // даже если ошибка, продолжаем и отправляем приветствие
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
                        text: `Hello, ${alias}! 👋\n\nNow you will receive your app notifications through this bot. 🔔\n\nThanks for using IU Alumni! 🎓\n\nWould you like to leave feedback? /leave_feedback 💬\n\nFor more information type /help ℹ️\n\nTo contact the app team, text our project manager: @dudos_nikitos 📲`
                    }),
                }
            );

            return { statusCode: 200, body: "ok" };
        }

        // если команда /leave_feedback — отправляем формы для фидбека (опросы)
        if (msg.text === "/leave_feedback") {
            // массив опросов
            const polls = [
                {
                    question: "Насколько актуальным и ценным вы считаете наш инновационный подход? 1 — совсем не ценно, 5 — очень ценно",
                    options: ["1", "2", "3", "4", "5"],
                },
                {
                    question: "Насколько интуитивным кажется приложение для создания и присоединения к событиям? 1 — совсем не интуитивно, 5 — абсолютно понятно",
                    options: ["1", "2", "3", "4", "5"],
                },
                {
                    question: "Насколько вероятно, что вы порекомендуете приложение своим однокурсникам? 0 — совсем не вероятно, 5 — крайне вероятно",
                    options: ["1", "2", "3", "4", "5"],
                },
            ];

            // шлём все опросы подряд
            for (const { question, options } of polls) {
                await fetch(
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
            }

            return { statusCode: 200, body: "ok" };
        }

        // всё остальное не обрабатываем
        return { statusCode: 200, body: "Not a recognized command, skipping" };
    }

    // всё остальное не обрабатываем
    return { statusCode: 200, body: "No handler for this update type" };
};
