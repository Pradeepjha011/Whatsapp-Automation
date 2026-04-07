import { createOrUpdateContactFromLead, getContactByPhone, insertMessage, markDefaultTemplateSent } from "../db/index.js";
import { sendTemplateMessage, fetchApprovedTemplates } from "./whatsappService.js";
import { addLeadNote, searchLeadsByTag, updateLeadFields } from "./zohoService.js";
import { normalizePhone } from "../utils/phone.js";
import { renderTemplateText } from "../utils/template.js";
import { getDefaultTemplateSetting } from "./settingsService.js";

function extractLeadPhone(lead) {
  return normalizePhone(lead.Mobile || lead.Phone || lead.WhatsApp_Number || "");
}

function contactNameFromLead(lead) {
  return lead.First_Name || lead.Full_Name || lead.Last_Name || lead.Company || extractLeadPhone(lead);
}

function resolveTemplateParameters(contact, template) {
  const values = [];
  const variableNames = template.variableNames || [];
  const positionalMapping = {
    1: contact.first_name || contact.name || "",
    2: contact.last_name || "",
    3: contact.crm_company || "",
    4: contact.crm_city || "",
    5: contact.crm_specialty || "",
  };

  if (variableNames.length) {
    for (const name of variableNames) {
      values.push({
        name,
        value: resolveNamedValue(contact, name),
      });
    }

    return values;
  }

  for (let index = 1; index <= template.variableCount; index += 1) {
    values.push({
      name: String(index),
      value: positionalMapping[index] || "",
    });
  }

  return values;
}

function describeError(error) {
  if (error.response?.data) {
    return typeof error.response.data === "string"
      ? error.response.data
      : JSON.stringify(error.response.data);
  }

  return error.message || String(error);
}

async function syncLeadIntoInbox(lead, io) {
  const phoneNumber = extractLeadPhone(lead);
  if (!phoneNumber) {
    return;
  }

  const contact = await createOrUpdateContactFromLead({
    phoneNumber,
    name: contactNameFromLead(lead),
    firstName: lead.First_Name || "",
    lastName: lead.Last_Name || "",
    crmLeadId: lead.id,
    crmCompany: lead.Company || "",
    crmCity: lead.City || "",
    crmSpecialty: lead.Speciality || lead.Specialty || "",
    crmPayload: JSON.stringify(lead),
    tags: JSON.stringify(lead.Tag || []),
  });

  io.emit("contact:updated", contact);
}

async function sendInitialTemplateIfNeeded(lead, io) {
  const phoneNumber = extractLeadPhone(lead);
  const defaultTemplate = await getDefaultTemplateSetting();
  if (!phoneNumber || !defaultTemplate.templateName) {
    return;
  }

  const contact = await getContactByPhone(phoneNumber);
  if (
    !contact ||
    (contact.default_template_name === defaultTemplate.templateName &&
      contact.default_template_sent_at)
  ) {
    return;
  }

  const templates = await fetchApprovedTemplates();
  const template = templates.find(
    (item) =>
      item.name === defaultTemplate.templateName &&
      item.language === defaultTemplate.languageCode,
  );

  if (!template) {
    return;
  }

  const parameters = resolveTemplateParameters(contact, template);
  const response = await sendTemplateMessage({
    to: phoneNumber,
    templateName: template.name,
    languageCode: template.language,
    parameters,
  });

  const messageId = response.data?.messages?.[0]?.id || null;
  const timestamp = new Date().toISOString();
  const renderedPreview = renderTemplateText(
    template.preview || `Template: ${template.name}`,
    parameters,
    template.variableNames || [],
  );

  const storedMessage = await insertMessage({
    waMessageId: messageId,
    phoneNumber,
    messageText: renderedPreview,
    direction: "outgoing",
    timestamp,
    messageStatus: "queued",
    messageType: "template",
    templateName: template.name,
    templateLanguage: template.language,
    metadata: JSON.stringify({ parameters }),
  });

  const updatedContact = await markDefaultTemplateSent(phoneNumber, template.name, renderedPreview, timestamp);

  io.emit("message:new", storedMessage);
  io.emit("contact:updated", updatedContact);

  if (lead.id) {
    await updateLeadFields(lead.id, {
      WhatsApp_Status: "Sent",
      WhatsApp_Last_Update: timestamp,
    });
    await addLeadNote(lead.id, `Inbox auto-sent template ${template.name} to ${phoneNumber}`);
  }
}

export function startCrmSync(io) {
  const tagName = process.env.INBOX_TRIGGER_TAG || "WA";
  const intervalMs = Number(process.env.INBOX_CRM_SYNC_INTERVAL_MS || 30000);
  let isRunning = false;

  async function run() {
    if (isRunning) {
      return;
    }

    isRunning = true;
    try {
      let page = 1;
      while (true) {
        const leads = await searchLeadsByTag(tagName, page);
        if (!leads.length) {
          break;
        }

        for (const lead of leads) {
          try {
            await syncLeadIntoInbox(lead, io);
            await sendInitialTemplateIfNeeded(lead, io);
          } catch (error) {
            console.error(
              `CRM sync failed for lead ${lead.id || "unknown"} (${extractLeadPhone(lead) || "no-phone"}): ${describeError(error)}`,
            );
          }
        }

        if (leads.length < 200) {
          break;
        }
        page += 1;
      }
    } catch (error) {
      console.error(`CRM sync failed: ${describeError(error)}`);
    } finally {
      isRunning = false;
    }
  }

  run();
  return setInterval(run, Math.max(intervalMs, 10000));
}

function resolveNamedValue(contact, variableName) {
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

  return mapping[key] || "";
}
