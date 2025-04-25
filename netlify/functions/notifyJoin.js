const axios = require("axios");

exports.handler = async function (event) {
    if (event.httpMethod !== "POST") {
        return { statusCode: 405, body: "Method Not Allowed" };
    }

    // Берём последние три сегмента пути
    const parts = event.path.replace(/\/$/, "").split("/");
    const [eventId, ownerAlias, userAlias] = parts.slice(-3);

    const chatId = "191699380"; // тестовый chat_id
    const text = `👋 Пользователь @${userAlias} присоединился к событию ${eventId}.`;

    try {
        await axios.post(
            `https://api.telegram.org/bot${process.env.TELEGRAM_TOKEN}/sendMessage`,
            { chat_id: chatId, text }
        );
    } catch (err) {
        console.error("Telegram API error", err);
        return { statusCode: 502, body: "Bad Gateway: Telegram API error" };
    }

    return { statusCode: 200, body: JSON.stringify({ status: "ok" }) };
};
