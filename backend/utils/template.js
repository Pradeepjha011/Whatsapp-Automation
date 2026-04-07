export function renderTemplateText(templateText, parameters = [], variableNames = []) {
  if (!templateText) {
    return "";
  }

  const parameterMap = buildParameterMap(parameters, variableNames);

  return String(templateText).replace(/\{\{\s*([a-z0-9_]+)\s*\}\}/gi, (_match, rawKey) => {
    const key = String(rawKey || "").trim();
    return parameterMap.get(key) ?? "";
  });
}

function buildParameterMap(parameters, variableNames) {
  const map = new Map();

  parameters.forEach((parameter, index) => {
    if (parameter && typeof parameter === "object" && !Array.isArray(parameter)) {
      const name = String(parameter.name || variableNames[index] || index + 1);
      map.set(name, String(parameter.value ?? ""));
      return;
    }

    const fallbackName = String(variableNames[index] || index + 1);
    map.set(fallbackName, String(parameter ?? ""));
  });

  return map;
}
