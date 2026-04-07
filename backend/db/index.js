import fs from "fs";
import path from "path";
import sqlite3 from "sqlite3";
import { open } from "sqlite";

let db;

const schema = `
CREATE TABLE IF NOT EXISTS contacts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  phone_number TEXT NOT NULL UNIQUE,
  name TEXT,
  first_name TEXT,
  last_name TEXT,
  crm_lead_id TEXT,
  crm_company TEXT,
  crm_city TEXT,
  crm_specialty TEXT,
  crm_payload TEXT,
  tags TEXT,
  last_template_name TEXT,
  default_template_name TEXT,
  default_template_sent_at TEXT,
  last_message TEXT,
  last_message_time TEXT
);

CREATE TABLE IF NOT EXISTS messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  wa_message_id TEXT,
  phone_number TEXT NOT NULL,
  message_text TEXT,
  direction TEXT NOT NULL CHECK(direction IN ('incoming', 'outgoing')),
  message_type TEXT NOT NULL DEFAULT 'text',
  template_name TEXT,
  template_language TEXT,
  metadata TEXT,
  timestamp TEXT NOT NULL,
  message_status TEXT,
  status_timestamp TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_messages_phone_number ON messages(phone_number);
CREATE INDEX IF NOT EXISTS idx_messages_timestamp ON messages(timestamp);

CREATE TABLE IF NOT EXISTS app_settings (
  key TEXT PRIMARY KEY,
  value TEXT
);
`;

export async function initializeDatabase() {
  if (db) {
    return db;
  }

  const databasePath = process.env.DATABASE_URL || "./db/whatsapp_inbox.sqlite";
  const absolutePath = path.resolve(databasePath);
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });

  db = await open({
    filename: absolutePath,
    driver: sqlite3.Database,
  });

  await db.exec(schema);
  await db.exec(`ALTER TABLE contacts ADD COLUMN first_name TEXT`).catch(() => {});
  await db.exec(`ALTER TABLE contacts ADD COLUMN last_name TEXT`).catch(() => {});
  await db.exec(`ALTER TABLE contacts ADD COLUMN crm_lead_id TEXT`).catch(() => {});
  await db.exec(`ALTER TABLE contacts ADD COLUMN crm_company TEXT`).catch(() => {});
  await db.exec(`ALTER TABLE contacts ADD COLUMN crm_city TEXT`).catch(() => {});
  await db.exec(`ALTER TABLE contacts ADD COLUMN crm_specialty TEXT`).catch(() => {});
  await db.exec(`ALTER TABLE contacts ADD COLUMN crm_payload TEXT`).catch(() => {});
  await db.exec(`ALTER TABLE contacts ADD COLUMN tags TEXT`).catch(() => {});
  await db.exec(`ALTER TABLE contacts ADD COLUMN last_template_name TEXT`).catch(() => {});
  await db.exec(`ALTER TABLE contacts ADD COLUMN default_template_name TEXT`).catch(() => {});
  await db.exec(`ALTER TABLE contacts ADD COLUMN default_template_sent_at TEXT`).catch(() => {});
  await db.exec(`ALTER TABLE messages ADD COLUMN message_type TEXT NOT NULL DEFAULT 'text'`).catch(() => {});
  await db.exec(`ALTER TABLE messages ADD COLUMN template_name TEXT`).catch(() => {});
  await db.exec(`ALTER TABLE messages ADD COLUMN template_language TEXT`).catch(() => {});
  await db.exec(`ALTER TABLE messages ADD COLUMN metadata TEXT`).catch(() => {});
  await db.exec(`ALTER TABLE messages ADD COLUMN status_timestamp TEXT`).catch(() => {});
  return db;
}

export async function getDb() {
  if (!db) {
    await initializeDatabase();
  }
  return db;
}

export async function upsertContact({ phoneNumber, name, lastMessage, lastMessageTime }) {
  const database = await getDb();
  await database.run(
    `
      INSERT INTO contacts (phone_number, name, last_message, last_message_time)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(phone_number) DO UPDATE SET
        name = COALESCE(excluded.name, contacts.name),
        last_message = excluded.last_message,
        last_message_time = excluded.last_message_time
    `,
    [phoneNumber, name || null, lastMessage || null, lastMessageTime || new Date().toISOString()],
  );

  return database.get(
    `SELECT * FROM contacts WHERE phone_number = ?`,
    [phoneNumber],
  );
}

export async function createOrUpdateContactFromLead({
  phoneNumber,
  name,
  firstName,
  lastName,
  crmLeadId,
  crmCompany,
  crmCity,
  crmSpecialty,
  crmPayload,
  tags,
}) {
  const database = await getDb();
  await database.run(
    `
      INSERT INTO contacts (
        phone_number, name, first_name, last_name, crm_lead_id, crm_company, crm_city, crm_specialty, crm_payload, tags
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(phone_number) DO UPDATE SET
        name = excluded.name,
        first_name = excluded.first_name,
        last_name = excluded.last_name,
        crm_lead_id = excluded.crm_lead_id,
        crm_company = excluded.crm_company,
        crm_city = excluded.crm_city,
        crm_specialty = excluded.crm_specialty,
        crm_payload = excluded.crm_payload,
        tags = excluded.tags
    `,
    [phoneNumber, name, firstName || null, lastName || null, crmLeadId || null, crmCompany || null, crmCity || null, crmSpecialty || null, crmPayload || null, tags || null],
  );

  return database.get(`SELECT * FROM contacts WHERE phone_number = ?`, [phoneNumber]);
}

export async function insertMessage({
  waMessageId,
  phoneNumber,
  messageText,
  direction,
  timestamp,
  messageStatus,
  messageType,
  templateName,
  templateLanguage,
  metadata,
  statusTimestamp,
}) {
  const database = await getDb();
  const result = await database.run(
    `
      INSERT INTO messages (
        wa_message_id, phone_number, message_text, direction, message_type, template_name, template_language, metadata, timestamp, message_status, status_timestamp
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      waMessageId || null,
      phoneNumber,
      messageText || "",
      direction,
      messageType || "text",
      templateName || null,
      templateLanguage || null,
      metadata || null,
      timestamp || new Date().toISOString(),
      messageStatus || null,
      statusTimestamp || null,
    ],
  );

  return database.get(
    `
      SELECT id, wa_message_id, phone_number, message_text, direction, message_type, template_name, template_language, metadata, timestamp, message_status, status_timestamp
      FROM messages
      WHERE id = ?
    `,
    [result.lastID],
  );
}

export async function updateMessageStatus(waMessageId, status, statusTimestamp) {
  const database = await getDb();
  const currentMessage = await database.get(
    `
      SELECT id, wa_message_id, phone_number, message_text, direction, message_type, template_name, template_language, metadata, timestamp, message_status, status_timestamp
      FROM messages
      WHERE wa_message_id = ?
      ORDER BY id DESC
      LIMIT 1
    `,
    [waMessageId],
  );

  if (!currentMessage) {
    return null;
  }

  const nextStatus = resolveNextStatus(currentMessage.message_status, status);
  const nextStatusTimestamp = selectStatusTimestamp(currentMessage.status_timestamp, statusTimestamp);

  await database.run(
    `UPDATE messages SET message_status = ?, status_timestamp = ? WHERE wa_message_id = ?`,
    [nextStatus, nextStatusTimestamp, waMessageId],
  );

  return database.get(
    `
      SELECT id, wa_message_id, phone_number, message_text, direction, message_type, template_name, template_language, metadata, timestamp, message_status, status_timestamp
      FROM messages
      WHERE wa_message_id = ?
      ORDER BY id DESC
      LIMIT 1
    `,
    [waMessageId],
  );
}

export async function getContactByPhone(phoneNumber) {
  const database = await getDb();
  return database.get(`SELECT * FROM contacts WHERE phone_number = ?`, [phoneNumber]);
}

export async function markTemplateSent(phoneNumber, templateName, lastMessage, timestamp) {
  const database = await getDb();
  await database.run(
    `
      UPDATE contacts
      SET last_template_name = ?, last_message = ?, last_message_time = ?
      WHERE phone_number = ?
    `,
    [templateName, lastMessage, timestamp, phoneNumber],
  );

  return database.get(`SELECT * FROM contacts WHERE phone_number = ?`, [phoneNumber]);
}

export async function markDefaultTemplateSent(phoneNumber, templateName, lastMessage, timestamp) {
  const database = await getDb();
  await database.run(
    `
      UPDATE contacts
      SET
        last_template_name = ?,
        default_template_name = ?,
        default_template_sent_at = ?,
        last_message = ?,
        last_message_time = ?
      WHERE phone_number = ?
    `,
    [templateName, templateName, timestamp, lastMessage, timestamp, phoneNumber],
  );

  return database.get(`SELECT * FROM contacts WHERE phone_number = ?`, [phoneNumber]);
}

export async function resetInboxData() {
  const database = await getDb();
  await database.run(`DELETE FROM messages`);
  await database.run(`DELETE FROM contacts`);
}

function resolveNextStatus(currentStatus, incomingStatus) {
  const currentRank = getStatusRank(currentStatus);
  const incomingRank = getStatusRank(incomingStatus);
  return incomingRank >= currentRank ? incomingStatus : currentStatus;
}

function selectStatusTimestamp(currentTimestamp, incomingTimestamp) {
  if (!incomingTimestamp) {
    return currentTimestamp || null;
  }

  if (!currentTimestamp) {
    return incomingTimestamp;
  }

  return new Date(incomingTimestamp).getTime() >= new Date(currentTimestamp).getTime()
    ? incomingTimestamp
    : currentTimestamp;
}

function getStatusRank(status) {
  switch ((status || "").toLowerCase()) {
    case "queued":
      return 0;
    case "failed":
      return 0.5;
    case "sent":
      return 1;
    case "delivered":
      return 2;
    case "read":
      return 3;
    default:
      return -1;
  }
}
