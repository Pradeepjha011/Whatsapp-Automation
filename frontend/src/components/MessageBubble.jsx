export default function MessageBubble({ message }) {
  const isOutgoing = message.direction === "outgoing";
  const timestamp = new Intl.DateTimeFormat("en-IN", {
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(message.timestamp));
  const statusLabel = formatStatus(message.message_status);

  return (
    <div className={`flex ${isOutgoing ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[80%] rounded-2xl px-4 py-3 shadow-sm ${
          isOutgoing ? "bg-outgoing-bubble text-white" : "bg-incoming-bubble text-white"
        }`}
      >
        <p className="whitespace-pre-wrap break-words text-sm leading-6">{message.message_text}</p>
        <div className="mt-2 flex items-center justify-end gap-2 text-[11px] text-white/60">
          <span>{timestamp}</span>
          {isOutgoing && statusLabel ? <span>{statusLabel}</span> : null}
        </div>
      </div>
    </div>
  );
}

function formatStatus(status) {
  switch ((status || "").toLowerCase()) {
    case "queued":
      return "Queued";
    case "sent":
      return "Sent";
    case "delivered":
      return "Delivered";
    case "read":
      return "Seen";
    case "failed":
      return "Failed";
    default:
      return status || "";
  }
}
