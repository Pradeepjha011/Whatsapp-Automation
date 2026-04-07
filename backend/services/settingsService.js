import { getDb } from "../db/index.js";

const DEFAULT_TEMPLATE_NAME_KEY = "default_template_name";
const DEFAULT_TEMPLATE_LANG_KEY = "default_template_lang";

export async function getAppSetting(key) {
  const db = await getDb();
  const row = await db.get(`SELECT key, value FROM app_settings WHERE key = ?`, [key]);
  return row?.value ?? null;
}

export async function setAppSetting(key, value) {
  const db = await getDb();
  await db.run(
    `
      INSERT INTO app_settings (key, value)
      VALUES (?, ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value
    `,
    [key, value],
  );
}

export async function getDefaultTemplateSetting() {
  const [templateName, languageCode] = await Promise.all([
    getAppSetting(DEFAULT_TEMPLATE_NAME_KEY),
    getAppSetting(DEFAULT_TEMPLATE_LANG_KEY),
  ]);

  return {
    templateName: templateName || process.env.INBOX_DEFAULT_TEMPLATE_NAME || "",
    languageCode: languageCode || process.env.INBOX_DEFAULT_TEMPLATE_LANG || "en_US",
  };
}

export async function setDefaultTemplateSetting(templateName, languageCode) {
  await Promise.all([
    setAppSetting(DEFAULT_TEMPLATE_NAME_KEY, templateName),
    setAppSetting(DEFAULT_TEMPLATE_LANG_KEY, languageCode),
  ]);

  return getDefaultTemplateSetting();
}
