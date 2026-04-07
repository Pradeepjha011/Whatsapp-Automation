import axios from "axios";

import { insertMessage, upsertContact } from "../db/index.js";
import { normalizePhone } from "../utils/phone.js";

export async function sendMessage(req, res) {
  const { to, message } = req.body;
  const phoneNumber = normalizePhone(to);

  if (!phoneNumber || !message) {
    return res.status(400).json({ error: "to and message are required" });
  }

  const endpoint = `https://graph.facebook.com/${process.env.WHATSAPP_API_VERSION || "v19.0"}/${process.env.PHONE_NUMBER_ID}/messages`;
  const payload = {
    messaging_product: "whatsapp",
    to: phoneNumber,
    type: "text",
    text: {
      body: message,
    },
  };

  try {
    const response = await axios.post(endpoint, payload, {
      headers: {
        Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`,
        "Content-Type": "application/json",
      },
    });

    const waMessageId = response.data?.messages?.[0]?.id || null;
    const timestamp = new Date().toISOString();

    const storedMessage = await insertMessage({
      waMessageId,
      phoneNumber,
      messageText: message,
      direction: "outgoing",
      timestamp,
      messageStatus: "queued",
      statusTimestamp: timestamp,
      messageType: "text",
    });

    const contact = await upsertContact({
      phoneNumber,
      lastMessage: message,
      lastMessageTime: timestamp,
    });

    req.app.get("io").emit("message:new", storedMessage);
    req.app.get("io").emit("contact:updated", contact);

    return res.json({ success: true, message: storedMessage, meta: response.data });
  } catch (error) {
    const status = error.response?.status || 500;
    return res.status(status).json({
      error: "send_message_failed",
      details: error.response?.data || error.message,
    });
  }
}
