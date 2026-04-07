import { getDb } from "../db/index.js";

export async function listMessages(req, res) {
  const db = await getDb();
  const { phone } = req.params;

  const messages = await db.all(
    `
      SELECT id, wa_message_id, phone_number, message_text, direction, timestamp, message_status
      , message_type, template_name, template_language, metadata
      FROM messages
      WHERE phone_number = ?
      ORDER BY datetime(timestamp) ASC, id ASC
    `,
    [phone],
  );

  res.json(messages);
}
