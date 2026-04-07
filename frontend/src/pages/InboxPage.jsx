import { useEffect, useMemo, useRef, useState } from "react";
import { io } from "socket.io-client";

import ChatWindow from "../components/ChatWindow";
import Sidebar from "../components/Sidebar";

const apiBaseUrl = resolveApiBaseUrl();

export default function InboxPage() {
  const [contacts, setContacts] = useState([]);
  const [selectedPhone, setSelectedPhone] = useState("");
  const [messagesByPhone, setMessagesByPhone] = useState({});
  const [searchQuery, setSearchQuery] = useState("");
  const [templates, setTemplates] = useState([]);
  const [isNewChatOpen, setIsNewChatOpen] = useState(false);
  const [isSendingTemplate, setIsSendingTemplate] = useState(false);
  const [defaultTemplate, setDefaultTemplate] = useState({ templateName: "", languageCode: "" });
  const [savingDefaultTemplate, setSavingDefaultTemplate] = useState(false);
  const selectedPhoneRef = useRef("");

  useEffect(() => {
    selectedPhoneRef.current = selectedPhone;
  }, [selectedPhone]);

  useEffect(() => {
    async function loadContacts() {
      const response = await fetch(`${apiBaseUrl}/contacts`);
      const data = await response.json();
      setContacts(data);
      if (!selectedPhone && data.length) {
        setSelectedPhone(data[0].phone_number);
      }
    }

    loadContacts();
  }, [selectedPhone]);

  useEffect(() => {
    async function loadTemplates() {
      const response = await fetch(`${apiBaseUrl}/templates`);
      const data = await response.json();
      setTemplates(Array.isArray(data) ? data : []);
    }

    loadTemplates();
  }, []);

  useEffect(() => {
    async function loadDefaultTemplate() {
      const response = await fetch(`${apiBaseUrl}/settings/default-template`);
      const data = await response.json();
      if (response.ok) {
        setDefaultTemplate(data);
      }
    }

    loadDefaultTemplate();
  }, []);

  useEffect(() => {
    if (!selectedPhone || messagesByPhone[selectedPhone]) {
      return;
    }

    async function loadMessages() {
      const response = await fetch(`${apiBaseUrl}/messages/${selectedPhone}`);
      const data = await response.json();
      setMessagesByPhone((current) => ({ ...current, [selectedPhone]: data }));
    }

    loadMessages();
  }, [messagesByPhone, selectedPhone]);

  useEffect(() => {
    const socket = io(apiBaseUrl, {
      withCredentials: true,
      transports: ["polling", "websocket"],
      upgrade: true,
      rememberUpgrade: false,
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    });

    socket.on("message:new", (message) => {
      setMessagesByPhone((current) => ({
        ...current,
        [message.phone_number]: [...(current[message.phone_number] || []), message],
      }));

      setContacts((current) => {
        const next = upsertContactPreview(current, {
          phone_number: message.phone_number,
          last_message: message.message_text,
          last_message_time: message.timestamp,
        });
        return sortContacts(next);
      });

      if (!selectedPhoneRef.current) {
        setSelectedPhone(message.phone_number);
      }
    });

    socket.on("contact:updated", (contact) => {
      setContacts((current) => sortContacts(upsertContactPreview(current, contact)));
    });

    socket.on("message:status", (message) => {
      setMessagesByPhone((current) => ({
        ...current,
        [message.phone_number]: (current[message.phone_number] || []).map((item) =>
          item.wa_message_id === message.wa_message_id ? { ...item, message_status: message.message_status } : item,
        ),
      }));
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  const filteredContacts = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) {
      return contacts;
    }

    return contacts.filter((contact) => {
      const name = (contact.name || "").toLowerCase();
      const phone = (contact.phone_number || "").toLowerCase();
      const preview = (contact.last_message || "").toLowerCase();
      return name.includes(query) || phone.includes(query) || preview.includes(query);
    });
  }, [contacts, searchQuery]);

  const selectedContact =
    contacts.find((contact) => contact.phone_number === selectedPhone) || filteredContacts[0] || null;

  const selectedMessages = selectedContact ? messagesByPhone[selectedContact.phone_number] || [] : [];

  async function handleSendMessage(text) {
    if (!selectedContact) {
      return;
    }

    const response = await fetch(`${apiBaseUrl}/send-message`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        to: selectedContact.phone_number,
        message: text,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.details?.error?.message || error.error || "Failed to send message");
    }
  }

  async function handleCreateChat({ phoneNumber, name }) {
    const response = await fetch(`${apiBaseUrl}/contact`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ phoneNumber, name }),
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.details?.error?.message || data.error || "Failed to create chat");
    }

    setContacts((current) => sortContacts(upsertContactPreview(current, data)));
    setSelectedPhone(data.phone_number);
  }

  async function handleSendTemplate({ templateName, languageCode, parameters }) {
    if (!selectedContact) {
      return;
    }

    setIsSendingTemplate(true);
    try {
      const response = await fetch(`${apiBaseUrl}/templates/send`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          to: selectedContact.phone_number,
          templateName,
          languageCode,
          parameters,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.details?.error?.message || data.error || "Failed to send template");
      }
    } finally {
      setIsSendingTemplate(false);
    }
  }

  async function handleSetDefaultTemplate({ templateName, languageCode }) {
    setSavingDefaultTemplate(true);
    try {
      const response = await fetch(`${apiBaseUrl}/settings/default-template`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ templateName, languageCode }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to save default template");
      }

      setDefaultTemplate(data);
    } finally {
      setSavingDefaultTemplate(false);
    }
  }

  return (
    <div className="min-h-screen bg-app-bg text-white">
      <div className="mx-auto flex min-h-screen max-w-[1600px] flex-col overflow-hidden bg-panel-bg shadow-soft lg:flex-row">
        <Sidebar
          contacts={filteredContacts}
          searchQuery={searchQuery}
          selectedPhone={selectedContact?.phone_number || ""}
          onSearchChange={setSearchQuery}
          onSelectContact={setSelectedPhone}
          onCreateChat={handleCreateChat}
          isNewChatOpen={isNewChatOpen}
          onOpenNewChat={() => setIsNewChatOpen(true)}
          onCloseNewChat={() => setIsNewChatOpen(false)}
        />
        <ChatWindow
          contact={selectedContact}
          messages={selectedMessages}
          templates={templates}
          onSendMessage={handleSendMessage}
          onSendTemplate={handleSendTemplate}
          onSetDefaultTemplate={handleSetDefaultTemplate}
          isSendingTemplate={isSendingTemplate}
          currentDefaultTemplateKey={
            defaultTemplate.templateName && defaultTemplate.languageCode
              ? `${defaultTemplate.templateName}:${defaultTemplate.languageCode}`
              : ""
          }
          savingDefaultTemplate={savingDefaultTemplate}
        />
      </div>
    </div>
  );
}

function upsertContactPreview(contacts, partialContact) {
  const existing = contacts.find((contact) => contact.phone_number === partialContact.phone_number);

  if (!existing) {
    return [
      {
        id: partialContact.id || partialContact.phone_number,
        name: partialContact.name || partialContact.phone_number,
        phone_number: partialContact.phone_number,
        last_message: partialContact.last_message || "",
        last_message_time: partialContact.last_message_time || new Date().toISOString(),
      },
      ...contacts,
    ];
  }

  return contacts.map((contact) =>
    contact.phone_number === partialContact.phone_number
      ? {
          ...contact,
          ...partialContact,
          name: partialContact.name || contact.name,
        }
      : contact,
  );
}

function sortContacts(contacts) {
  return [...contacts].sort((left, right) => {
    const leftTime = new Date(left.last_message_time || 0).getTime();
    const rightTime = new Date(right.last_message_time || 0).getTime();
    return rightTime - leftTime;
  });
}

function resolveApiBaseUrl() {
  const configuredBaseUrl = (import.meta.env.VITE_API_BASE_URL || "").trim();
  if (configuredBaseUrl) {
    return configuredBaseUrl.replace(/\/+$/, "");
  }

  if (typeof window !== "undefined" && window.location?.origin) {
    return window.location.origin;
  }

  return "";
}
