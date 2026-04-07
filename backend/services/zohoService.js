import axios from "axios";

import { normalizePhone } from "../utils/phone.js";

let accessToken = null;

function getAccountsUrl() {
  return process.env.ZOHO_ACCOUNTS_URL || "https://accounts.zoho.in";
}

function getApiBase() {
  return process.env.ZOHO_API_BASE || "https://www.zohoapis.in";
}

function getModule() {
  return process.env.ZOHO_MODULE || "Leads";
}

async function refreshAccessToken() {
  const response = await axios.post(
    `${getAccountsUrl()}/oauth/v2/token`,
    new URLSearchParams({
      refresh_token: process.env.ZOHO_REFRESH_TOKEN || "",
      client_id: process.env.ZOHO_CLIENT_ID || "",
      client_secret: process.env.ZOHO_CLIENT_SECRET || "",
      grant_type: "refresh_token",
    }),
    {
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
    },
  );

  if (!response.data?.access_token) {
    throw new Error(`Zoho token refresh failed: ${JSON.stringify(response.data)}`);
  }

  accessToken = response.data.access_token;
  return accessToken;
}

async function request(method, url, options = {}) {
  if (!accessToken) {
    await refreshAccessToken();
  }

  try {
    return await axios({
      method,
      url,
      ...options,
      headers: {
        Authorization: `Zoho-oauthtoken ${accessToken}`,
        ...(options.headers || {}),
      },
    });
  } catch (error) {
    if (error.response?.status === 401) {
      await refreshAccessToken();
      return axios({
        method,
        url,
        ...options,
        headers: {
          Authorization: `Zoho-oauthtoken ${accessToken}`,
          ...(options.headers || {}),
        },
      });
    }
    throw error;
  }
}

export async function searchLeadByPhone(phoneNumber) {
  const fields = ["Phone", "Mobile", "WhatsApp_Number"];
  const normalized = normalizePhone(phoneNumber);

  for (const field of fields) {
    try {
      const response = await request(
        "get",
        `${getApiBase()}/crm/v2/${getModule()}/search`,
        {
          params: {
            criteria: `(${field}:equals:${normalized})`,
          },
        },
      );

      if (response.data?.data?.length) {
        return response.data.data[0];
      }
    } catch (error) {
      if ([400, 404].includes(error.response?.status)) {
        continue;
      }
      throw error;
    }
  }

  return null;
}

export async function searchLeadsByTag(tagName, page = 1) {
  try {
    const response = await request(
      "get",
      `${getApiBase()}/crm/v2/${getModule()}/search`,
      {
        params: {
          criteria: `(Tag:equals:${tagName})`,
          page,
          per_page: 200,
        },
      },
    );

    return response.data?.data || [];
  } catch (error) {
    if ([400, 404].includes(error.response?.status)) {
      return [];
    }
    const body =
      typeof error.response?.data === "string"
        ? error.response.data
        : JSON.stringify(error.response?.data || {});
    const status = error.response?.status || "no_status";
    const reason = body === "{}" ? error.message || "empty_error_response" : body;
    throw new Error(`Zoho tag search failed [${status}]: ${reason}`);
  }
}

export async function updateLeadFields(leadId, fields) {
  await request("put", `${getApiBase()}/crm/v2/${getModule()}`, {
    data: {
      data: [
        {
          id: leadId,
          ...fields,
        },
      ],
    },
    headers: {
      "Content-Type": "application/json",
    },
  });
}

export async function addLeadNote(leadId, note) {
  await request("post", `${getApiBase()}/crm/v2/Notes`, {
    data: {
      data: [
        {
          Parent_Id: { id: leadId },
          Note_Title: "WhatsApp Inbox",
          Note_Content: note,
          $se_module: getModule(),
        },
      ],
    },
    headers: {
      "Content-Type": "application/json",
    },
  });
}
