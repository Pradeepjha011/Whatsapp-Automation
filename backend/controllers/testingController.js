import { resetInboxData } from "../db/index.js";

export async function resetTestingData(_req, res) {
  await resetInboxData();
  res.json({ success: true });
}
