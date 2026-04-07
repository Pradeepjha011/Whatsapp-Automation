import axios from "axios";

import { normalizePhone } from "../utils/phone.js";

function getHeaders() {
  return {
    Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`,
    "Content-Type": "application/json",
  };
}

function getMessagesEndpoint() {
  return `https://graph.facebook.com/${process.env.WHATSAPP_API_VERSION || "v19.0"}/${process.env.PHONE_NUMBER_ID}/messages`;
}

export async function sendTextMessage(to, message) {
  const phoneNumber = normalizePhone(to);
  const payload = {
    messaging_product: "whatsapp",
    to: phoneNumber,
    type: "text",
    text: {
      body: message,
    },
  };

  const response = await axios.post(getMessagesEndpoint(), payload, {
    headers: getHeaders(),
  });

  return {
    phoneNumber,
    data: response.data,
  };
}

export async function sendTemplateMessage({ to, templateName, languageCode, parameters = [] }) {
  const phoneNumber = normalizePhone(to);
  const payload = {
    messaging_product: "whatsapp",
    to: phoneNumber,
    type: "template",
    template: {
      name: templateName,
      language: { code: languageCode },
    },
  };

  if (parameters.length) {
    payload.template.components = [
      {
        type: "body",
        parameters: parameters.map((parameter) => {
          const normalized = normalizeTemplateParameter(parameter);
          return {
            type: "text",
            text: normalized.value,
            ...(normalized.name && !isNumericPlaceholder(normalized.name)
              ? { parameter_name: normalized.name }
              : {}),
          };
        }),
      },
    ];
  }

  const response = await axios.post(getMessagesEndpoint(), payload, {
    headers: getHeaders(),
  });

  return {
    phoneNumber,
    data: response.data,
  };
}

export async function fetchApprovedTemplates() {
  const wabaId = process.env.WHATSAPP_BUSINESS_ACCOUNT_ID;
  if (!wabaId) {
    throw new Error("WHATSAPP_BUSINESS_ACCOUNT_ID is required to fetch templates");
  }

  const response = await axios.get(`https://graph.facebook.com/${process.env.WHATSAPP_API_VERSION || "v19.0"}/${wabaId}/message_templates`, {
    headers: {
      Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`,
    },
    params: {
      fields: "id,name,status,language,category,components",
      limit: 200,
    },
  });

  return (response.data?.data || [])
    .filter((template) => template.status === "APPROVED" || template.status === "ACTIVE_QUALITY_PENDING")
    .map((template) => {
      const bodyComponent = (template.components || []).find((component) => component.type === "BODY");
      const exampleBody = bodyComponent?.example?.body_text?.[0] || [];
      const previewText = bodyComponent?.text || "";
      return {
        id: template.id,
        name: template.name,
        language: template.language,
        status: template.status,
        category: template.category,
        variableCount: Math.max(exampleBody.length, inferVariableCount(previewText)),
        variableNames: inferVariableNames(previewText),
        preview: previewText,
      };
    });
}

function inferVariableCount(text) {
  const names = inferVariableNames(text);
  if (!names.length) {
    return 0;
  }

  const numericMatches = names
    .map((name) => Number(name))
    .filter((value) => Number.isFinite(value) && value > 0);

  if (numericMatches.length) {
    return numericMatches.reduce((highest, current) => (current > highest ? current : highest), 0);
  }

  return names.length;
}

function inferVariableNames(text) {
  const matches = Array.from(text.matchAll(/\{\{\s*([a-z0-9_]+)\s*\}\}/gi));
  const orderedNames = [];
  const seen = new Set();

  for (const match of matches) {
    const name = String(match[1] || "").trim();
    if (!name || seen.has(name)) {
      continue;
    }

    seen.add(name);
    orderedNames.push(name);
  }

  return orderedNames;
}

function normalizeTemplateParameter(parameter) {
  if (parameter && typeof parameter === "object" && !Array.isArray(parameter)) {
    return {
      name: parameter.name || "",
      value: String(parameter.value ?? ""),
    };
  }

  return {
    name: "",
    value: String(parameter ?? ""),
  };
}

function isNumericPlaceholder(name) {
  return /^\d+$/.test(String(name || "").trim());
}
