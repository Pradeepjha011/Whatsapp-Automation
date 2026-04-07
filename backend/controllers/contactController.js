import { getDb } from "../db/index.js";

export async function listContacts(_req, res) {
  const db = await getDb();
  const contacts = await db.all(
    `
      SELECT *
      FROM contacts
      ORDER BY datetime(last_message_time) DESC, id DESC
    `,
  );

  res.json(contacts);
}
