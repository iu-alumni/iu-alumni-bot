// netlify/functions/submitFeedback.js

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

    // Telegram шлёт poll_answer при каждом ответе
    const answer = update.poll_answer;
    if (!answer) {
        return { statusCode: 200, body: "No poll_answer, skipping" };
    }

    const pollId = answer.poll_id;
    const optionIds = answer.option_ids; // array of выбранных индексов
    const alias = answer.user.username || null;
    const chatId = answer.user.id;

    const client = new Client({
        connectionString: process.env.NEON_DATABASE_URL.trim(),
        ssl: { rejectUnauthorized: false },
    });

    try {
        await client.connect();

        // Создаём таблицу для фидбека, если нужно
        await client.query(`
      CREATE TABLE IF NOT EXISTS feedback (
        id          SERIAL PRIMARY KEY,
        alias       TEXT,
        chat_id     BIGINT NOT NULL,
        poll_id     TEXT NOT NULL,
        option_ids  TEXT[] NOT NULL,
        created_at  TIMESTAMPTZ DEFAULT now()
      );
    `);

        // Вставляем ответ
        await client.query(
            `INSERT INTO feedback(alias, chat_id, poll_id, option_ids)
       VALUES($1, $2, $3, $4)`,
            [alias, chatId, pollId, optionIds.map(String)]
        );

        // Пересылаем результаты на внешний вебхук (если задан)
        if (process.env.FEEDBACK_WEBHOOK_URL) {
            await fetch(process.env.FEEDBACK_WEBHOOK_URL, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    alias,
                    chat_id: chatId,
                    poll_id: pollId,
                    selected_options: optionIds,
                }),
            });
        }
    } catch (err) {
        console.error("Feedback handler error:", err);
        return { statusCode: 502, body: "Bad Gateway: " + err.message };
    } finally {
        await client.end();
    }

    return { statusCode: 200, body: JSON.stringify({ status: "ok" }) };
};
