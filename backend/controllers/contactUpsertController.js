import { searchLeadByPhone } from "../services/zohoService.js";
import { createOrUpdateContactFromLead, upsertContact } from "../db/index.js";
import { normalizePhone } from "../utils/phone.js";

export async function createContact(req, res) {
  const { phoneNumber, name } = req.body;
  const normalized = normalizePhone(phoneNumber);

  if (!normalized) {
    return res.status(400).json({ error: "phoneNumber is required" });
  }

  try {
    const crmLead = await searchLeadByPhone(normalized);
    const contact = crmLead
      ? await createOrUpdateContactFromLead({
          phoneNumber: normalized,
          name: crmLead.First_Name || crmLead.Full_Name || name || normalized,
          firstName: crmLead.First_Name || "",
          lastName: crmLead.Last_Name || "",
          crmLeadId: crmLead.id,
          crmCompany: crmLead.Company || "",
          crmCity: crmLead.City || "",
          crmSpecialty: crmLead.Speciality || crmLead.Specialty || "",
          crmPayload: JSON.stringify(crmLead),
          tags: JSON.stringify(crmLead.Tag || []),
        })
      : await upsertContact({
          phoneNumber: normalized,
          name: name || normalized,
          lastMessage: "",
          lastMessageTime: new Date().toISOString(),
        });

    req.app.get("io").emit("contact:updated", contact);
    return res.status(201).json(contact);
  } catch (error) {
    return res.status(500).json({
      error: "create_contact_failed",
      details: error.response?.data || error.message,
    });
  }
}
