import MessageBubble from "./MessageBubble";
import MessageInput from "./MessageInput";
import TemplateComposer from "./TemplateComposer";

export default function ChatWindow({
  contact,
  messages,
  templates,
  onSendMessage,
  onSendTemplate,
  onSetDefaultTemplate,
  isSendingTemplate,
  currentDefaultTemplateKey,
  savingDefaultTemplate,
}) {
  if (!contact) {
    return (
      <section className="flex h-screen flex-1 items-center justify-center bg-chat-bg bg-chat-pattern bg-[size:22px_22px]">
        <div className="max-w-md text-center text-muted-text">
          <p className="text-lg text-white">No conversation selected</p>
          <p className="mt-2 text-sm">Pick a contact from the sidebar to view messages and send replies.</p>
        </div>
      </section>
    );
  }

  return (
    <section className="flex h-screen flex-1 flex-col bg-chat-bg bg-chat-pattern bg-[size:22px_22px]">
      <header className="border-b border-white/5 bg-panel-soft px-6 py-4">
        <p className="text-lg font-semibold text-white">{contact.name || contact.phone_number}</p>
        <p className="text-sm text-muted-text">{contact.phone_number}</p>
        <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-text">
          {contact.first_name ? <span className="rounded-full bg-white/5 px-3 py-1">First: {contact.first_name}</span> : null}
          {contact.last_name ? <span className="rounded-full bg-white/5 px-3 py-1">Last: {contact.last_name}</span> : null}
          {contact.crm_company ? <span className="rounded-full bg-white/5 px-3 py-1">{contact.crm_company}</span> : null}
          {contact.crm_city ? <span className="rounded-full bg-white/5 px-3 py-1">{contact.crm_city}</span> : null}
          {contact.crm_specialty ? <span className="rounded-full bg-white/5 px-3 py-1">{contact.crm_specialty}</span> : null}
        </div>
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-6 md:px-8">
        <div className="mx-auto flex max-w-4xl flex-col gap-4">
          <TemplateComposer
            templates={templates}
            contact={contact}
            onSendTemplate={onSendTemplate}
            onSetDefaultTemplate={onSetDefaultTemplate}
            loading={isSendingTemplate}
            currentDefaultTemplateKey={currentDefaultTemplateKey}
            savingDefault={savingDefaultTemplate}
          />

          {buildTimeline(messages).map((item) =>
            item.type === "date" ? (
              <div key={item.key} className="flex justify-center py-2">
                <span className="rounded-full bg-panel-soft px-4 py-2 text-xs font-medium text-muted-text">
                  {item.label}
                </span>
              </div>
            ) : (
              <MessageBubble key={item.message.id} message={item.message} />
            ),
          )}

          {!messages.length && (
            <p className="text-center text-sm text-muted-text">No messages for this contact yet.</p>
          )}
        </div>
      </div>

      <MessageInput onSend={onSendMessage} />
    </section>
  );
}

function buildTimeline(messages) {
  const timeline = [];
  let lastDateKey = "";

  for (const message of messages) {
    const dateKey = new Date(message.timestamp).toDateString();
    if (dateKey !== lastDateKey) {
      timeline.push({
        type: "date",
        key: `date-${dateKey}`,
        label: formatDateLabel(message.timestamp),
      });
      lastDateKey = dateKey;
    }

    timeline.push({
      type: "message",
      key: `message-${message.id}`,
      message,
    });
  }

  return timeline;
}

function formatDateLabel(value) {
  const date = new Date(value);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  if (date.toDateString() === today.toDateString()) {
    return "Today";
  }

  if (date.toDateString() === yesterday.toDateString()) {
    return "Yesterday";
  }

  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}
