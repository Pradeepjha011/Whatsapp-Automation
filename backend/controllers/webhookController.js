import { insertMessage, updateMessageStatus, upsertContact } from "../db/index.js";
import { normalizePhone } from "../utils/phone.js";

function extractIncomingMessage(payload) {
  const entries = payload?.entry || [];

  for (const entry of entries) {
    for (const change of entry.changes || []) {
      const value = change.value || {};
      const messages = value.messages || [];
      if (!messages.length) {
        continue;
      }

      const message = messages[0];
      const contact = value.contacts?.[0];
      const phoneNumber = normalizePhone(message.from || contact?.wa_id);
      const profileName = contact?.profile?.name || null;

      if (message.type === "text") {
        return {
          phoneNumber,
          name: profileName,
          messageId: message.id,
          messageText: message.text?.body || "",
          timestamp: message.timestamp ? new Date(Number(message.timestamp) * 1000).toISOString() : new Date().toISOString(),
        };
      }
    }
  }

  return null;
}

function extractStatusUpdate(payload) {
  const entries = payload?.entry || [];

  for (const entry of entries) {
    for (const change of entry.changes || []) {
      const statuses = change.value?.statuses || [];
      if (!statuses.length) {
        continue;
      }

      return {
        waMessageId: statuses[0].id,
        status: statuses[0].status,
        phoneNumber: normalizePhone(statuses[0].recipient_id),
        statusTimestamp: statuses[0].timestamp
          ? new Date(Number(statuses[0].timestamp) * 1000).toISOString()
          : new Date().toISOString(),
      };
    }
  }

  return null;
}

export async function verifyWebhook(req, res) {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode === "subscribe" && token === process.env.WHATSAPP_VERIFY_TOKEN) {
    console.log("✅ Webhook verification succeeded");
    return res.status(200).send(challenge);
  }

  console.warn("❌ Webhook verification failed");
  return res.status(403).json({ error: "verification_failed" });
}

export async function receiveWebhook(req, res) {
  console.log("📩 Webhook received");
  const incomingMessage = extractIncomingMessage(req.body);
  const statusUpdate = extractStatusUpdate(req.body);

  if (incomingMessage) {
    const storedMessage = await insertMessage({
      waMessageId: incomingMessage.messageId,
      phoneNumber: incomingMessage.phoneNumber,
      messageText: incomingMessage.messageText,
      direction: "incoming",
      timestamp: incomingMessage.timestamp,
      messageStatus: "received",
      messageType: "text",
    });

    const contact = await upsertContact({
      phoneNumber: incomingMessage.phoneNumber,
      name: incomingMessage.name,
      lastMessage: incomingMessage.messageText,
      lastMessageTime: incomingMessage.timestamp,
    });

    req.app.get("io").emit("message:new", storedMessage);
    req.app.get("io").emit("contact:updated", contact);
    console.log(`✅ Incoming message stored for ${incomingMessage.phoneNumber}`);
    return res.json({ success: true, type: "incoming_message" });
  }

  if (statusUpdate?.waMessageId) {
    const updatedMessage = await updateMessageStatus(
      statusUpdate.waMessageId,
      statusUpdate.status,
      statusUpdate.statusTimestamp,
    );
    if (updatedMessage) {
      req.app.get("io").emit("message:status", updatedMessage);
      console.log(`✅ Message status updated: ${statusUpdate.status} for ${statusUpdate.phoneNumber || "unknown"}`);
    }
    return res.json({ success: true, type: "status_update" });
  }

  console.log("ℹ️ Webhook ignored: no message or status payload");
  return res.json({ success: true, type: "ignored" });
}
