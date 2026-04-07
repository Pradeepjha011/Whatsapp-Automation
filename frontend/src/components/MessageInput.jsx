import { useState } from "react";

export default function MessageInput({ onSend }) {
  const [value, setValue] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event) {
    event.preventDefault();
    const trimmed = value.trim();
    if (!trimmed || sending) {
      return;
    }

    setSending(true);
    setError("");

    try {
      await onSend(trimmed);
      setValue("");
    } catch (submitError) {
      setError(submitError.message || "Failed to send message");
    } finally {
      setSending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="border-t border-white/5 bg-panel-soft px-4 py-4 md:px-6">
      {error ? <p className="mb-2 text-sm text-red-300">{error}</p> : null}
      <div className="flex items-end gap-3">
        <textarea
          rows={1}
          value={value}
          onChange={(event) => setValue(event.target.value)}
          placeholder="Type a message"
          className="max-h-32 min-h-[52px] flex-1 resize-none rounded-2xl border border-white/5 bg-chat-bg px-4 py-3 text-sm text-white outline-none placeholder:text-muted-text focus:border-accent-green/50"
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              handleSubmit(event);
            }
          }}
        />
        <button
          type="submit"
          disabled={sending}
          className="rounded-2xl bg-accent-green px-6 py-3 text-sm font-semibold text-[#001a12] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {sending ? "Sending..." : "Send"}
        </button>
      </div>
    </form>
  );
}
