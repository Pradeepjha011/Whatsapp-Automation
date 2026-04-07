import ContactItem from "./ContactItem";
import NewChatModal from "./NewChatModal";

export default function Sidebar({
  contacts,
  searchQuery,
  selectedPhone,
  onSearchChange,
  onSelectContact,
  onCreateChat,
  isNewChatOpen,
  onOpenNewChat,
  onCloseNewChat,
}) {
  return (
    <>
      <aside className="flex h-screen w-full flex-col border-b border-white/5 bg-panel-bg lg:w-[380px] lg:border-b-0 lg:border-r">
        <div className="border-b border-white/5 bg-panel-soft px-5 py-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm uppercase tracking-[0.35em] text-accent-green">CRM Inbox</p>
              <h1 className="mt-1 text-2xl font-semibold text-white">WhatsApp Conversations</h1>
            </div>
            <button
              type="button"
              onClick={onOpenNewChat}
              className="rounded-2xl border border-accent-green/30 bg-accent-green/10 px-4 py-2 text-sm font-semibold text-accent-green"
            >
              New chat
            </button>
          </div>
        </div>

        <div className="border-b border-white/5 p-4">
          <input
            value={searchQuery}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="Search name, phone, or message"
            className="w-full rounded-2xl border border-white/5 bg-chat-bg px-4 py-3 text-sm text-white outline-none placeholder:text-muted-text focus:border-accent-green/50"
          />
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {contacts.map((contact) => (
            <ContactItem
              key={contact.phone_number}
              contact={contact}
              isActive={selectedPhone === contact.phone_number}
              onClick={() => onSelectContact(contact.phone_number)}
            />
          ))}

          {!contacts.length && (
            <div className="p-6 text-sm text-muted-text">No conversations yet. Incoming webhook messages will appear here.</div>
          )}
        </div>
      </aside>

      <NewChatModal open={isNewChatOpen} onClose={onCloseNewChat} onCreate={onCreateChat} />
    </>
  );
}
