// netlify/functions/registerUser.js

const { Client } = require("pg");
const fetch = global.fetch || require("node-fetch");

exports.handler = async function (event) {
    if (event.httpMethod !== "POST") {
        return { statusCode: 405, body: "Method Not Allowed" };
    }

    let update;
    try {
        update = JSON.parse(event.body);
    } catch {
        return { statusCode: 400, body: "Bad Request" };
    }

    const msg = update.message;
    if (!msg?.from?.username) {
        return { statusCode: 200, body: "No username, skipping" };
    }

    const alias = msg.from.username;
    const chatId = msg.chat.id;

    const client = new Client({
        connectionString: process.env.NEON_DATABASE_URL.trim(),
        ssl: { rejectUnauthorized: false },
    });

    try {
        await client.connect();

        // Создаём таблицу, если её ещё нет
        await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        alias   TEXT    PRIMARY KEY,
        chat_id BIGINT  NOT NULL
      );
    `);

        // Upsert: вставляем или обновляем
        await client.query(
            `INSERT INTO users(alias, chat_id)
         VALUES($1, $2)
       ON CONFLICT(alias) DO UPDATE
         SET chat_id = EXCLUDED.chat_id`,
            [alias, chatId]
        );

        // 0.1) После регистрации сразу присылаем опросы
        const polls = [
            {
                question: "Насколько удобно вам пользоваться картой выпускников? 1 — совсем неудобно, 5 — супер удобно",
                options: ["1", "2", "3", "4", "5"],
            },
            {
                question: "Насколько вероятно, что вы порекомендуете приложение однокурсникам? 0 — совсем нет, 10 — крайне вероятно",
                options: ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10"],
            },
            {
                question: "Оцените скорость работы карты при первом открытии. 1 — медленно, 5 — очень быстро",
                options: ["1", "2", "3", "4", "5"],
            },
            {
                question: "Насколько полезно приложение помогает вам находить события в своём городе? 1 — совсем бесполезно, 5 — очень полезно",
                options: ["1", "2", "3", "4", "5"],
            },
            {
                question: "Как часто вы открываете приложение?",
                options: ["Ежедневно", "Раз в неделю", "Пару раз в месяц", "Реже"],
            },
            {
                question: "Где вы чаще всего узнаёте о новых встречах?",
                options: ["Чат выпускников", "Push-уведомления", "Листаю карту", "От друзей/чатов", "Другое"],
            },
        ];

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
    } catch (err) {
        console.error("DB error:", err);
        return { statusCode: 500, body: "DB error" };
    } finally {
        await client.end();
    }

    // Ответ Telegram (можно любой, тут пусто)
    return { statusCode: 200, body: "ok" };
};
