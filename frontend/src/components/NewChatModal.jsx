import { useState } from "react";

export default function NewChatModal({ open, onClose, onCreate }) {
  const [phoneNumber, setPhoneNumber] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  if (!open) {
    return null;
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setLoading(true);
    setError("");

    try {
      await onCreate({ phoneNumber, name });
      setPhoneNumber("");
      setName("");
      onClose();
    } catch (submitError) {
      setError(submitError.message || "Failed to create contact");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
      <div className="w-full max-w-md rounded-3xl border border-white/10 bg-panel-bg p-6 shadow-soft">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.35em] text-accent-green">New Chat</p>
            <h2 className="mt-1 text-xl font-semibold text-white">Start conversation</h2>
          </div>
          <button type="button" onClick={onClose} className="text-sm text-muted-text hover:text-white">
            Close
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <label className="mb-2 block text-sm text-muted-text">Phone number</label>
            <input
              value={phoneNumber}
              onChange={(event) => setPhoneNumber(event.target.value)}
              placeholder="+91 98765 43210"
              className="w-full rounded-2xl border border-white/5 bg-chat-bg px-4 py-3 text-sm text-white outline-none placeholder:text-muted-text focus:border-accent-green/50"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm text-muted-text">Saved name (optional)</label>
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Dr. Rajesh"
              className="w-full rounded-2xl border border-white/5 bg-chat-bg px-4 py-3 text-sm text-white outline-none placeholder:text-muted-text focus:border-accent-green/50"
            />
          </div>

          {error ? <p className="text-sm text-red-300">{error}</p> : null}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-2xl bg-accent-green px-4 py-3 text-sm font-semibold text-[#001a12] disabled:opacity-60"
          >
            {loading ? "Creating..." : "Create chat"}
          </button>
        </form>
      </div>
    </div>
  );
}
