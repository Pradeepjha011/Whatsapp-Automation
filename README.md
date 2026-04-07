# WhatsApp Automation Workspace

This workspace contains two systems that were built in sequence:

- `whatsapp_connector/`: the original Python automation connector that handled WhatsApp Cloud API + Zoho CRM automation
- `backend/` + `frontend/`: the newer CRM inbox application that gives agents a WhatsApp-style UI and moves more logic into a Node/React stack

The inbox app is now the main operator-facing system. The Python connector still exists as the older automation bridge and as a reference for the original integration flow.

## High-Level Architecture

There are two layers in this workspace.

### 1. Legacy automation layer

The Python service in `whatsapp_connector/` does this:

- receives Meta webhook events
- sends WhatsApp text/template messages
- talks to Zoho CRM
- updates CRM fields and notes
- stores local JSON cache to avoid duplicate sends

This layer was useful for backend-only automation before the inbox UI existed.

### 2. CRM inbox layer

The Node/React application in `backend/` and `frontend/` does this:

- receives Meta webhook events
- stores conversations in SQLite
- shows contacts and messages in a WhatsApp-style UI
- lets agents send text messages
- fetches approved templates from Meta
- auto-fills template variables from CRM data
- syncs CRM leads into the inbox
- auto-sends a configured default template when a CRM lead is tagged `WA`

This is now the main human-facing messaging system.

## Main Runtime Flows

### Incoming message flow

1. A customer sends a WhatsApp message.
2. Meta calls `POST /webhook/whatsapp` on the Node backend.
3. The backend stores the message in SQLite.
4. The backend updates the matching contact row.
5. Socket.io emits a realtime event.
6. The React inbox updates without page refresh.

### Outgoing text message flow

1. An agent types a message in the inbox UI.
2. Frontend calls `POST /send-message`.
3. Backend sends the message to WhatsApp Cloud API.
4. Backend stores the outgoing message in SQLite.
5. Webhook status updates later mark it as `sent`, `delivered`, `read`.

### Outgoing template flow

1. An agent selects an approved template in the inbox UI.
2. Backend fetches the available templates from Meta.
3. Backend fills template variables from CRM contact data.
4. Backend sends the template to Meta.
5. Backend stores the rendered outgoing text in SQLite.

### CRM-triggered default outreach flow

1. A lead in Zoho gets tag `WA`.
2. The backend CRM sync loop finds that lead.
3. The lead is synced into the inbox contacts table.
4. The backend checks the saved default template.
5. If that contact has not yet received the default template, it sends it once.
6. The send is logged in the inbox and optionally reflected back into Zoho.

## Important Runtime Notes

- The frontend never receives the WhatsApp API token.
- The backend owns all WhatsApp API communication.
- SQLite is used as the current local message store.
- Zoho sync is polling-based, not push-based.
- The Meta webhook must point to the Node backend if the inbox is the active webhook receiver.

## How To Run

### Backend

From the workspace root:

```powershell
cd backend
npm install
npm run dev
```

Backend default URL:

- `http://localhost:4000`

Useful backend routes:

- `GET /`
- `GET /health`
- `GET /contacts`
- `GET /messages/:phone`
- `POST /send-message`
- `GET /templates`
- `POST /templates/send`
- `GET /settings/default-template`
- `PUT /settings/default-template`
- `GET /webhook/whatsapp`
- `POST /webhook/whatsapp`
- `POST /testing/reset`

### Frontend

From the workspace root:

```powershell
cd frontend
npm install
npm run dev
```

Frontend default URL:

- `http://localhost:5173`

### Webhook tunneling for local development

If running locally, expose the backend with ngrok:

```powershell
ngrok http 4000
```

Then use:

- `https://YOUR-NGROK-URL/webhook/whatsapp`

as the Meta callback URL.

## Hosting Shape

For production hosting, the recommended setup is:

- backend serves the built frontend
- frontend is built into static files in `frontend/dist`
- only one public process listens on the backend port
- Meta webhook points to the hosted backend URL
- Tailscale Funnel or your public HTTPS domain forwards traffic to backend port `4000`

### Production flow

1. Build the frontend:

```powershell
cd frontend
npm install
npm run build
```

2. Configure backend production env values:

- `NODE_ENV=production`
- `SERVE_FRONTEND=true`
- `CLIENT_URL=https://YOUR-PUBLIC-URL`
- `ENABLE_TESTING_ROUTES=false`

3. Start the backend:

```powershell
cd backend
npm install
npm run start
```

4. Point Meta webhook callback to:

- `https://YOUR-PUBLIC-URL/webhook/whatsapp`

### What changes in production

- the backend serves `frontend/dist`
- the Vite dev server is not needed
- `/testing/reset` is disabled unless `ENABLE_TESTING_ROUTES=true`
- the same public URL can serve both the inbox UI and the API/webhook

## Environment Variables

### `backend/.env`

This file stores live backend configuration. Important values:

- `PORT`
- `NODE_ENV`
- `CLIENT_URL`
- `DATABASE_URL`
- `SERVE_FRONTEND`
- `ENABLE_TESTING_ROUTES`
- `WHATSAPP_TOKEN`
- `PHONE_NUMBER_ID`
- `WHATSAPP_BUSINESS_ACCOUNT_ID`
- `WHATSAPP_API_VERSION`
- `WHATSAPP_VERIFY_TOKEN`
- `ZOHO_CLIENT_ID`
- `ZOHO_CLIENT_SECRET`
- `ZOHO_REFRESH_TOKEN`
- `ZOHO_ACCOUNTS_URL`
- `ZOHO_API_BASE`
- `ZOHO_MODULE`
- `INBOX_TRIGGER_TAG`
- `INBOX_CRM_SYNC_INTERVAL_MS`
- `INBOX_DEFAULT_TEMPLATE_NAME`
- `INBOX_DEFAULT_TEMPLATE_LANG`

### `frontend/.env`

This file tells the frontend where the backend lives:

- `VITE_API_BASE_URL`

## Backend File Guide

### `backend/server.js`

This is the main Node entrypoint. It:

- loads env values
- creates the Express app
- creates the Socket.io server
- mounts all backend routes
- optionally serves the built frontend from `frontend/dist`
- disables testing routes by default in production unless explicitly enabled
- initializes SQLite
- starts the CRM sync loop
- starts listening on port `4000`

### `backend/package.json`

Defines the backend package, scripts, and dependencies. Important dependencies:

- `express`
- `socket.io`
- `axios`
- `sqlite`
- `sqlite3`
- `dotenv`
- `cors`

### `backend/package-lock.json`

NPM lock file for reproducible backend dependency resolution.

### `backend/.env.example`

Template config file showing required env keys for backend setup.

### `backend/.env`

Actual local backend config file used by the running app.

### `backend/db/index.js`

This is the SQLite data layer. It is responsible for:

- creating tables
- migrating new columns when needed
- inserting messages
- upserting contacts
- storing template send markers
- reading contacts by phone
- resetting inbox data for testing

Tables managed here:

- `contacts`
- `messages`
- `app_settings`

### `backend/db/whatsapp_inbox.sqlite`

The actual SQLite database file used at runtime. It stores:

- contact records
- message history
- app settings like the saved default template

### `backend/controllers/contactController.js`

Handles `GET /contacts`. Returns all contacts sorted by recent activity.

### `backend/controllers/contactUpsertController.js`

Handles manual chat/contact creation from the inbox UI. It:

- normalizes phone numbers
- looks up a matching Zoho lead if available
- creates or updates the inbox contact record

### `backend/controllers/messageController.js`

Handles `GET /messages/:phone`. Returns full message history for one contact.

### `backend/controllers/sendMessageController.js`

Handles `POST /send-message`. It:

- validates text send input
- calls Meta Cloud API text send
- stores outgoing messages
- updates the contact preview
- emits realtime UI updates

### `backend/controllers/templateController.js`

Handles template operations. It:

- returns approved templates from Meta
- sends a selected template
- auto-fills variables from CRM contact fields
- stores the rendered text, not raw `{{1}}` placeholders

### `backend/controllers/settingsController.js`

Handles default-template settings. It:

- reads the current saved default template
- updates the saved default template from the UI

### `backend/controllers/testingController.js`

Provides the test reset action. It powers:

- `POST /testing/reset`

Used to clear messages and contacts for clean testing.

### `backend/controllers/webhookController.js`

Handles WhatsApp webhook verification and incoming webhook events. It:

- verifies the webhook using `WHATSAPP_VERIFY_TOKEN`
- processes incoming customer text messages
- processes status updates like `sent`, `delivered`, `read`
- updates the DB
- emits realtime Socket.io events

### `backend/routes/contacts.js`

Mounts the contact list API route.

### `backend/routes/contactUpsert.js`

Mounts the manual contact creation API route.

### `backend/routes/messages.js`

Mounts the message history API route.

### `backend/routes/sendMessage.js`

Mounts the plain text send API route.

### `backend/routes/settings.js`

Mounts the default-template settings API routes.

### `backend/routes/templates.js`

Mounts the template list and template send API routes.

### `backend/routes/testing.js`

Mounts the testing reset API route.

### `backend/routes/webhook.js`

Mounts WhatsApp webhook verification and receive routes.

### `backend/services/whatsappService.js`

This is the Meta API wrapper. It:

- sends plain text messages
- sends template messages
- fetches approved templates for the configured WABA

### `backend/services/zohoService.js`

This is the Zoho API wrapper. It:

- refreshes Zoho OAuth access tokens
- searches leads by phone
- searches leads by tag
- updates lead fields
- adds Zoho notes

### `backend/services/crmSyncService.js`

This is the CRM automation loop. It:

- polls Zoho for leads tagged `WA`
- syncs those leads into the inbox
- sends the configured default template once
- updates Zoho status and notes
- avoids duplicate auto-sends

### `backend/services/settingsService.js`

This service manages app-level persistent settings stored in SQLite, especially:

- default template name
- default template language

### `backend/utils/phone.js`

Normalizes phone numbers into the format expected by WhatsApp and CRM matching, including:

- stripping symbols
- auto-prefixing Indian 10-digit mobile numbers with `91`

### `backend/utils/template.js`

Renders Meta template preview text into final stored message text by replacing:

- `{{1}}`
- `{{2}}`
- and so on

with actual resolved values.

## Frontend File Guide

### `frontend/package.json`

Defines the frontend package, scripts, and dependencies:

- `react`
- `react-dom`
- `socket.io-client`
- `vite`
- `tailwindcss`

### `frontend/package-lock.json`

NPM lock file for frontend dependency resolution.

### `frontend/.env.example`

Example frontend env file.

### `frontend/.env`

Actual local frontend env file used during development.

### `frontend/index.html`

Root HTML document for the Vite app.

### `frontend/vite.config.js`

Vite development configuration.

### `frontend/postcss.config.js`

PostCSS config used by TailwindCSS.

### `frontend/tailwind.config.js`

Tailwind theme config. Contains custom colors, shadows, and background styling used by the inbox UI.

### `frontend/src/main.jsx`

Frontend bootstrap file. It mounts the React app into the DOM.

### `frontend/src/App.jsx`

Top-level React app component. Currently renders the inbox page.

### `frontend/src/index.css`

Global styling and Tailwind imports. Also defines base scrollbar and page styles.

### `frontend/src/pages/InboxPage.jsx`

Main frontend orchestration page. It:

- loads contacts
- loads templates
- loads message history per contact
- opens the Socket.io connection
- listens for realtime updates
- handles new chat creation
- handles template send
- handles default-template save

### `frontend/src/components/Sidebar.jsx`

Left sidebar layout. It:

- shows the search bar
- lists contacts
- opens the new chat modal

### `frontend/src/components/ContactItem.jsx`

Single contact row in the sidebar. Shows:

- initials
- name
- phone
- last message preview
- last activity time

### `frontend/src/components/ChatWindow.jsx`

Main conversation panel. It:

- shows the selected contact
- shows CRM-derived fields in the header
- renders the template composer
- renders message history
- renders the text input box

### `frontend/src/components/MessageBubble.jsx`

Displays one message in the chat. It handles:

- left/right alignment by direction
- bubble color
- timestamp
- delivery status label

### `frontend/src/components/MessageInput.jsx`

Text input form for normal reply messages. It:

- handles enter-to-send
- shows send errors
- disables while sending

### `frontend/src/components/NewChatModal.jsx`

Modal for creating a new conversation manually. It:

- accepts phone number
- optionally accepts a saved display name
- creates a new inbox contact

### `frontend/src/components/TemplateComposer.jsx`

Template picker and sender. It:

- lists approved templates fetched from backend
- shows the selected template preview
- auto-fills template variables from CRM fields
- lets the user send a template immediately
- lets the user set the selected template as the default CRM-trigger template

## Legacy Python Connector File Guide

The Python connector still exists in case parts of the old workflow are needed or for reference.

### `whatsapp_connector/Whatsapp connector.py`

The main Flask-based Python connector. It:

- hosts the webhook
- normalizes phone numbers
- sends WhatsApp messages and templates
- syncs Zoho leads by tag
- auto-sends a template once per contact
- stores local cache and stats

### `whatsapp_connector/config.py`

Python connector config file. Contains env-backed values and, in this workspace, previously used defaults for:

- Meta token
- phone number ID
- template name/language
- Zoho credentials

### `whatsapp_connector/requirements.txt`

Python dependencies for the legacy connector.

### `whatsapp_connector/services/cache_store.py`

Thread-safe JSON cache helper used by the Python connector.

### `whatsapp_connector/services/number_checker.py`

Caches whether a number was considered valid for sending.

### `whatsapp_connector/services/whatsapp_service.py`

Python WhatsApp API wrapper for text/template sends.

### `whatsapp_connector/services/zoho_service.py`

Python Zoho wrapper for token refresh, lead search, lead update, and notes.

### `whatsapp_connector/cache/whatsapp_sync_cache.json`

Python connector sync cache for dedupe and send-state tracking.

### `whatsapp_connector/cache/number_check_cache.json`

Python connector cache for number validation results.

### `whatsapp_connector/logs/whatsapp_sync.log`

Python connector runtime log file.

## Generated And Installed Directories

These directories/files exist in the workspace but are not hand-maintained application source:

- `backend/node_modules/`
- `frontend/node_modules/`
- `backend/package-lock.json`
- `frontend/package-lock.json`
- `whatsapp_connector/__pycache__/`
- `whatsapp_connector/services/__pycache__/`

These are generated by package managers or Python runtime and should not be treated as authored business logic files.

## Testing And Resetting

To clear inbox test data:

```powershell
Invoke-RestMethod -Method Post -Uri http://localhost:4000/testing/reset
```

This now clears:

- messages
- contacts

## Current Product Behavior Summary

- New inbound WhatsApp messages create/update contacts in the inbox.
- Agents can send normal replies from the UI.
- Agents can send approved templates from the UI.
- Template variables auto-fill from CRM contact data.
- A selected default template can be saved in the inbox.
- Zoho leads tagged `WA` are synced into the inbox.
- The saved default template is auto-sent once for a tagged CRM lead.

## Recommended Next Improvements

If this system is moving toward production outreach, the next high-value upgrades are:

- PostgreSQL instead of SQLite
- agent authentication
- better outbound policy enforcement for the 24-hour customer service window
- richer CRM mapping controls for template variables
- production secret management instead of file-based local secrets
- a settings page instead of only inline controls for operational configuration
