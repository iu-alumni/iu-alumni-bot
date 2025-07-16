// netlify/functions/webhook.js

const { Client } = require("pg");
const fetch = global.fetch || require("node-fetch");

// Простое кэширование в памяти для хранения вопросов и опций по poll_id
const inMemoryCache = {};  // { [pollId]: { question: string, options: string[] } }

// HTTP-код 405
const METHOD_NOT_ALLOWED = { statusCode: 405, body: "Method Not Allowed" };

// Вспомогательная функция: отправляет все опросы и заполняет inMemoryCache
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
            // сохраняем в RAM: текст вопроса и варианты
            inMemoryCache[poll.id] = {
                question: poll.question,
                options: poll.options.map(o => o.text),
            };
        }
    }
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
        const { poll_id: pollId, option_ids: optionIds, user } = update.poll_answer;
        const alias = user.username || null;
        const chatId = user.id;

        // получаем из RAM
        const pollData = inMemoryCache[pollId];
        if (!pollData) {
            // таймаут: перезапускаем опросы
            await fetch(
                `https://api.telegram.org/bot${process.env.TELEGRAM_TOKEN}/sendMessage`,
                {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ chat_id: chatId, text: "⏰ Feedback session timed out. Please re-submit your feedback." }),
                }
            );
            await sendFeedbackPolls(chatId);
            return { statusCode: 200, body: JSON.stringify({ status: "timeout" }) };
        }

        const question = pollData.question;
        const answer = optionIds.map(i => pollData.options[i]).join(", ");
        // удаляем из RAM
        delete inMemoryCache[pollId];

        // сохраняем в БД только ответ
        const client = new Client({ connectionString: process.env.NEON_DATABASE_URL.trim(), ssl: { rejectUnauthorized: false } });
        try {
            await client.connect();
            await client.query(`
        CREATE TABLE IF NOT EXISTS feedback (
          id          SERIAL PRIMARY KEY,
          alias       TEXT,
          question    TEXT   NOT NULL,
          answer      TEXT   NOT NULL,
          created_at  TIMESTAMPTZ DEFAULT now()
        );
      `);
            await client.query(
                `INSERT INTO feedback(alias, question, answer) VALUES($1, $2, $3)`,
                [alias, question, answer]
            );
            if (process.env.FEEDBACK_WEBHOOK_URL) {
                await fetch(process.env.FEEDBACK_WEBHOOK_URL, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ alias, question, answer }),
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

    // 2) Обработка новых сообщений
    if (update.message) {
        const msg = update.message;
        if (!msg.from?.username) {
            return { statusCode: 200, body: "No username, skipping" };
        }
        const alias = msg.from.username;
        const chatId = msg.chat.id;

        // /start, /help
        if (msg.text === "/start" || msg.text === "/help") {
            const client = new Client({ connectionString: process.env.NEON_DATABASE_URL.trim(), ssl: { rejectUnauthorized: false } });
            try {
                await client.connect();
                await client.query(`CREATE TABLE IF NOT EXISTS users (alias TEXT PRIMARY KEY, chat_id BIGINT NOT NULL);`);
                await client.query(
                    `INSERT INTO users(alias, chat_id) VALUES($1, $2) ON CONFLICT(alias) DO UPDATE SET chat_id = EXCLUDED.chat_id`,
                    [alias, chatId]
                );
            } catch (err) {
                console.error("DB error in registration:", err);
            } finally {
                await client.end();
            }
            await fetch(
                `https://api.telegram.org/bot${process.env.TELEGRAM_TOKEN}/sendMessage`,
                {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        chat_id: chatId,
                        parse_mode: "HTML",
                        text: `👋 Hello, ${alias}\n🎓 Welcome to IU Alumap...`,
                    }),
                }
            );
            return { statusCode: 200, body: "ok" };
        }

        // /leave_feedback
        if (msg.text === "/leave_feedback") {
            await sendFeedbackPolls(chatId);
            return { statusCode: 200, body: "ok" };
        }

        // /launch_app
        if (msg.text === "/launch_app") {
            const webAppUrl = "https://iualumni.netlify.app/";
            await fetch(
                `https://api.telegram.org/bot${process.env.TELEGRAM_TOKEN}/sendMessage`,
                {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ chat_id: chatId, text: "📱 Кнопка для перехода к Mini App:", reply_markup: { inline_keyboard: [[{ text: "Перейти", web_app: { url: webAppUrl } }]] } }),
                }
            );
            return { statusCode: 200, body: "ok" };
        }

        return { statusCode: 200, body: "Not a recognized command, skipping" };
    }

    return { statusCode: 200, body: "No handler for this update type" };
};
