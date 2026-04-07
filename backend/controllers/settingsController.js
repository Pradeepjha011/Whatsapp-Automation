import { getDefaultTemplateSetting, setDefaultTemplateSetting } from "../services/settingsService.js";

export async function getDefaultTemplate(_req, res) {
  const setting = await getDefaultTemplateSetting();
  res.json(setting);
}

export async function updateDefaultTemplate(req, res) {
  const { templateName, languageCode } = req.body;

  if (!templateName || !languageCode) {
    return res.status(400).json({ error: "templateName and languageCode are required" });
  }

  const setting = await setDefaultTemplateSetting(templateName, languageCode);
  return res.json(setting);
}
