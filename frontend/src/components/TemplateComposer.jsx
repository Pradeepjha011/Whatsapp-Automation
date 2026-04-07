import { useEffect, useMemo, useState } from "react";

export default function TemplateComposer({
  templates,
  contact,
  onSendTemplate,
  onSetDefaultTemplate,
  loading,
  currentDefaultTemplateKey,
  savingDefault,
}) {
  const [selectedKey, setSelectedKey] = useState("");
  const [parameters, setParameters] = useState([]);
  const [error, setError] = useState("");

  const selectedTemplate = useMemo(
    () => templates.find((item) => `${item.name}:${item.language}` === selectedKey) || null,
    [selectedKey, templates],
  );

  useEffect(() => {
    if (!selectedTemplate) {
      setParameters([]);
      return;
    }

    const variableNames = selectedTemplate.variableNames || [];
    if (variableNames.length) {
      setParameters(
        variableNames.map((name) => ({
          name,
          value: resolveNamedValue(contact, name),
        })),
      );
      return;
    }

    const defaults = [
      contact?.first_name || contact?.name || "",
      contact?.last_name || "",
      contact?.crm_company || "",
      contact?.crm_city || "",
      contact?.crm_specialty || "",
    ];

    setParameters(
      defaults.slice(0, selectedTemplate.variableCount).map((value, index) => ({
        name: String(index + 1),
        value,
      })),
    );
  }, [selectedTemplate, contact]);

  async function handleSend() {
    if (!selectedTemplate) {
      setError("Select a template first");
      return;
    }

    setError("");
    try {
      await onSendTemplate({
        templateName: selectedTemplate.name,
        languageCode: selectedTemplate.language,
        parameters,
      });
    } catch (submitError) {
      setError(submitError.message || "Failed to send template");
    }
  }

  return (
    <div className="rounded-3xl border border-white/5 bg-panel-soft p-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-white">Approved template</p>
          <select
            value={selectedKey}
            onChange={(event) => setSelectedKey(event.target.value)}
            className="mt-2 w-full rounded-2xl border border-white/5 bg-chat-bg px-4 py-3 text-sm text-white outline-none focus:border-accent-green/50"
          >
            <option value="">Select template</option>
            {templates.map((template) => (
              <option key={`${template.name}:${template.language}`} value={`${template.name}:${template.language}`}>
                {template.name} - {template.language}
              </option>
            ))}
          </select>

          {selectedTemplate ? (
            <div className="mt-3 rounded-2xl bg-chat-bg/80 p-3 text-sm text-muted-text">
              <p className="font-medium text-white">{selectedTemplate.name}</p>
              <p className="mt-1 whitespace-pre-wrap">{selectedTemplate.preview || "No preview available"}</p>
            </div>
          ) : null}
        </div>

        {selectedTemplate?.variableCount ? (
          <div className="flex min-w-[280px] flex-col gap-2">
            <p className="text-sm font-medium text-white">Template variables</p>
            {parameters.map((value, index) => (
              <input
                key={`${value.name}-${index + 1}`}
                value={value.value}
                onChange={(event) =>
                  setParameters((current) =>
                    current.map((item, itemIndex) =>
                      itemIndex === index ? { ...item, value: event.target.value } : item,
                    ),
                  )
                }
                placeholder={value.name || `Variable ${index + 1}`}
                className="rounded-2xl border border-white/5 bg-chat-bg px-4 py-3 text-sm text-white outline-none placeholder:text-muted-text focus:border-accent-green/50"
              />
            ))}
          </div>
        ) : null}
      </div>

      {error ? <p className="mt-3 text-sm text-red-300">{error}</p> : null}

      <div className="mt-4 flex flex-wrap justify-end gap-3">
        <button
          type="button"
          onClick={async () => {
            if (!selectedTemplate) {
              setError("Select a template first");
              return;
            }

            setError("");
            try {
              await onSetDefaultTemplate({
                templateName: selectedTemplate.name,
                languageCode: selectedTemplate.language,
              });
            } catch (submitError) {
              setError(submitError.message || "Failed to set default template");
            }
          }}
          disabled={savingDefault || !selectedTemplate}
          className="rounded-2xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-semibold text-white disabled:opacity-50"
        >
          {savingDefault
            ? "Saving default..."
            : currentDefaultTemplateKey && currentDefaultTemplateKey === selectedKey
              ? "Default template"
              : "Set as default"}
        </button>
        <button
          type="button"
          onClick={handleSend}
          disabled={loading || !selectedTemplate}
          className="rounded-2xl border border-accent-green/30 bg-accent-green/10 px-5 py-3 text-sm font-semibold text-accent-green disabled:opacity-50"
        >
          {loading ? "Sending template..." : "Send template"}
        </button>
      </div>
    </div>
  );
}

function resolveNamedValue(contact, variableName) {
  const key = String(variableName || "").trim().toLowerCase();
  const mapping = {
    first_name: contact?.first_name || contact?.name || "",
    firstname: contact?.first_name || contact?.name || "",
    last_name: contact?.last_name || "",
    lastname: contact?.last_name || "",
    full_name: contact?.name || "",
    company: contact?.crm_company || "",
    crm_company: contact?.crm_company || "",
    city: contact?.crm_city || "",
    crm_city: contact?.crm_city || "",
    specialty: contact?.crm_specialty || "",
    speciality: contact?.crm_specialty || "",
    crm_specialty: contact?.crm_specialty || "",
    phone: contact?.phone_number || "",
    mobile: contact?.phone_number || "",
  };

  return mapping[key] || "";
}
