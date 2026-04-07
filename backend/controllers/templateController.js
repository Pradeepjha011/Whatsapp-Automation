import { fetchApprovedTemplates, sendTemplateMessage } from "../services/whatsappService.js";
import { getContactByPhone, insertMessage, markTemplateSent } from "../db/index.js";
import { renderTemplateText } from "../utils/template.js";

function buildTemplateParameters(contact, template, providedParameters = []) {
  if (providedParameters.length) {
    return providedParameters.map((parameter, index) => normalizeResolvedParameter(parameter, template, index));
  }

  return buildMappedParameters(contact, template);
}

export async function listTemplates(_req, res) {
  try {
    const templates = await fetchApprovedTemplates();
    return res.json(templates);
  } catch (error) {
    return res.status(500).json({
      error: "fetch_templates_failed",
      details: error.response?.data || error.message,
    });
  }
}

export async function sendTemplate(req, res) {
  const { to, templateName, languageCode, parameters = [] } = req.body;

  if (!to || !templateName || !languageCode) {
    return res.status(400).json({ error: "to, templateName, and languageCode are required" });
  }

  try {
    const templates = await fetchApprovedTemplates();
    const template = templates.find((item) => item.name === templateName && item.language === languageCode);
    if (!template) {
      return res.status(404).json({ error: "template_not_found" });
    }

    const contact = await getContactByPhone(to);
    const resolvedParameters = buildTemplateParameters(contact, template, parameters);
    const response = await sendTemplateMessage({
      to,
      templateName,
      languageCode,
      parameters: resolvedParameters,
    });

    const timestamp = new Date().toISOString();
    const waMessageId = response.data?.messages?.[0]?.id || null;
    const renderedText = renderTemplateText(
      template.preview || `Template: ${template.name}`,
      resolvedParameters,
      template.variableNames || [],
    );
    const storedMessage = await insertMessage({
      waMessageId,
      phoneNumber: to,
      messageText: renderedText,
      direction: "outgoing",
      timestamp,
      messageStatus: "queued",
      statusTimestamp: timestamp,
      messageType: "template",
      templateName,
      templateLanguage: languageCode,
      metadata: JSON.stringify({ parameters: resolvedParameters }),
    });

    const updatedContact = await markTemplateSent(to, templateName, renderedText, timestamp);

    req.app.get("io").emit("message:new", storedMessage);
    req.app.get("io").emit("contact:updated", updatedContact);

    return res.json({
      success: true,
      message: storedMessage,
      parameters: resolvedParameters,
    });
  } catch (error) {
    const status = error.response?.status || 500;
    return res.status(status).json({
      error: "send_template_failed",
      details: error.response?.data || error.message,
    });
  }
}

function buildMappedParameters(contact, template) {
  const variableNames = template.variableNames || [];
  const fallbackValues = [
    contact?.first_name || contact?.name || "",
    contact?.last_name || "",
    contact?.crm_company || "",
    contact?.crm_city || "",
    contact?.crm_specialty || "",
  ];

  if (variableNames.length) {
    return variableNames.map((name, index) => ({
      name,
      value: resolveNamedValue(contact, name, fallbackValues[index] || ""),
    }));
  }

  return fallbackValues.slice(0, template.variableCount).map((value, index) => ({
    name: String(index + 1),
    value,
  }));
}

function normalizeResolvedParameter(parameter, template, index) {
  if (parameter && typeof parameter === "object" && !Array.isArray(parameter)) {
    return {
      name: parameter.name || template.variableNames?.[index] || String(index + 1),
      value: String(parameter.value ?? ""),
    };
  }

  return {
    name: template.variableNames?.[index] || String(index + 1),
    value: String(parameter ?? ""),
  };
}

function resolveNamedValue(contact, variableName, fallbackValue) {
  const key = String(variableName || "").trim().toLowerCase();
  const mapping = {
    first_name: contact?.first_name || contact?.name || "",
    firstname: contact?.first_name || contact?.name || "",
    last_name: contact?.last_name || "",
    lastname: contact?.last_name || "",
    full_name: contact?.name || "",
    company: contact?.crm_company || "",
    crm_company: contact?.crm_company || "",
    city: contact?.crm_city || "",
    crm_city: contact?.crm_city || "",
    specialty: contact?.crm_specialty || "",
    speciality: contact?.crm_specialty || "",
    crm_specialty: contact?.crm_specialty || "",
    phone: contact?.phone_number || "",
    mobile: contact?.phone_number || "",
  };

  return mapping[key] || fallbackValue || "";
}
