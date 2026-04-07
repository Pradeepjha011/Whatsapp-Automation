export default function ContactItem({ contact, isActive, onClick }) {
  const initial = (contact.name || contact.phone_number || "?").trim()[0]?.toUpperCase() || "?";
  const timeLabel = formatTime(contact.last_message_time);

  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-start gap-3 border-b border-white/5 px-4 py-4 text-left transition ${
        isActive ? "bg-white/10" : "hover:bg-white/5"
      }`}
    >
      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-accent-green/20 text-lg font-semibold text-accent-green">
        {initial}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-3">
          <p className="truncate font-medium text-white">{contact.name || contact.phone_number}</p>
          <span className="shrink-0 text-xs text-muted-text">{timeLabel}</span>
        </div>
        <p className="truncate text-sm text-muted-text">{contact.last_message || contact.phone_number}</p>
        <p className="mt-1 text-xs text-muted-text">{contact.phone_number}</p>
      </div>
    </button>
  );
}

function formatTime(value) {
  if (!value) {
    return "";
  }

  const date = new Date(value);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  if (date.toDateString() === today.toDateString()) {
    return new Intl.DateTimeFormat("en-IN", {
      hour: "numeric",
      minute: "2-digit",
    }).format(date);
  }

  if (date.toDateString() === yesterday.toDateString()) {
    return "Yesterday";
  }

  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
  }).format(date);
}
