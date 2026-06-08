import express from "express";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import path from "path";
import fs from "fs";
import Database from "better-sqlite3";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../.env") });

const app = express();
const port = Number(process.env.API_PORT || 8787);

app.use(express.json());

const requiredEnv = ["JIRA_BASE_URL", "JIRA_EMAIL", "JIRA_API_TOKEN"];
const JIRA_SEARCH_JQL_PATH = "/rest/api/3/search/jql";
const PROXY_VERSION = "2026-06-07-search-jql-metadata-db";

const dbDir = path.resolve(__dirname, "../data");
fs.mkdirSync(dbDir, { recursive: true });
const dbPath = path.resolve(dbDir, "workweek.sqlite");
const db = new Database(dbPath);

db.pragma("journal_mode = WAL");
db.exec(`
  CREATE TABLE IF NOT EXISTS issue_metadata (
    issue_key TEXT PRIMARY KEY,
    note TEXT NOT NULL DEFAULT '',
    priority INTEGER NOT NULL DEFAULT 0,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )
`);

const selectIssueMetadataStmt = db.prepare(
  "SELECT issue_key, note, priority FROM issue_metadata WHERE issue_key = ?"
);
const upsertIssueMetadataStmt = db.prepare(`
  INSERT INTO issue_metadata (issue_key, note, priority, updated_at)
  VALUES (@issueKey, @note, @priority, CURRENT_TIMESTAMP)
  ON CONFLICT(issue_key) DO UPDATE SET
    note = excluded.note,
    priority = excluded.priority,
    updated_at = CURRENT_TIMESTAMP
`);

const clampDbPriority = (value) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return 0;
  }

  return Math.max(0, Math.min(10, Math.round(numeric)));
};

const getMissingEnv = () =>
  requiredEnv.filter((name) => !process.env[name] || String(process.env[name]).trim() === "");

const getAuthHeader = () => {
  const email = process.env.JIRA_EMAIL;
  const token = process.env.JIRA_API_TOKEN;
  const basic = Buffer.from(`${email}:${token}`).toString("base64");
  return `Basic ${basic}`;
};

const ensureEnvOrRespond = (res) => {
  const missing = getMissingEnv();
  if (missing.length > 0) {
    res.status(500).json({
      error: "Missing required Jira environment variables",
      missing,
    });
    return false;
  }

  return true;
};

const normalizeJiraErrorPayload = ({ status, pathWithQuery, data }) => {
  const errorMessages = Array.isArray(data?.errorMessages)
    ? data.errorMessages.filter((m) => typeof m === "string")
    : [];
  const joined = errorMessages.join(" ");
  const msgField = typeof data?.message === "string" ? data.message : "";

  const is410Deprecation =
    status === 410 &&
    (joined.includes("/rest/api/3/search/jql") ||
      joined.includes("CHANGE-2046") ||
      joined.includes("API 已被移除") ||
      joined.includes("API has been removed") ||
      msgField.includes("API 已被移除") ||
      msgField.includes("API has been removed") ||
      msgField.includes("CHANGE-2046"));

  // Jira Cloud CHANGE-2046 deprecation message may come localized.
  if (is410Deprecation) {
    return {
      error: "Jira search API endpoint has been removed",
      message:
        "Jira removed the legacy search API. This app uses /rest/api/3/search/jql. If you still see this, restart API/UI to clear stale processes.",
      errorMessages: [
        "Jira removed the legacy search API. Please migrate to /rest/api/3/search/jql (CHANGE-2046).",
      ],
      status,
      path: pathWithQuery,
      raw: data,
    };
  }

  if (errorMessages.length > 0) {
    return {
      ...data,
      status,
      path: pathWithQuery,
      raw: data,
    };
  }

  return {
    ...data,
    status,
    path: pathWithQuery,
    raw: data,
  };
};

const jiraRequest = async ({ method = "GET", pathWithQuery, body }) => {
  const baseUrl = process.env.JIRA_BASE_URL;
  const target = `${baseUrl}${pathWithQuery}`;

  const response = await fetch(target, {
    method,
    headers: {
      Accept: "application/json",
      "Accept-Language": "en-US,en;q=0.9",
      Authorization: getAuthHeader(),
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });

  const text = await response.text();

  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    // Jira returned non-JSON (HTML/plain-text). Normalize before returning.
    console.error(`[jira] ${method} ${target} → ${response.status} (non-JSON): ${text.slice(0, 200)}`);
    const plainData = { message: text.slice(0, 500) };
    return {
      ok: false,
      status: response.status,
      data: normalizeJiraErrorPayload({
        status: response.status,
        pathWithQuery,
        data: plainData,
      }),
    };
  }

  if (!response.ok) {
    console.error(`[jira] ${method} ${target} → ${response.status}:`, JSON.stringify(data));
    return {
      ok: false,
      status: response.status,
      data: normalizeJiraErrorPayload({
        status: response.status,
        pathWithQuery,
        data,
      }),
    };
  }

  return {
    ok: true,
    status: response.status,
    data,
  };
};

app.get("/api/health", (_req, res) => {
  const missing = getMissingEnv();

  res.json({
    ok: missing.length === 0,
    service: "jira-proxy",
    version: PROXY_VERSION,
    searchEndpoint: JIRA_SEARCH_JQL_PATH,
    missingEnv: missing,
  });
});

app.get("/api/jira/myself", async (_req, res) => {
  if (!ensureEnvOrRespond(res)) {
    return;
  }

  try {
    const result = await jiraRequest({ pathWithQuery: "/rest/api/3/myself" });
    if (!result.ok) {
      return res.status(result.status).json(result.data);
    }
    return res.json(result.data);
  } catch (error) {
    return res.status(500).json({
      error: "Failed to call Jira",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// Shared handler — used by both GET (query string) and POST (JSON body).
const handleJiraSearch = async (jql, maxResults, res) => {
  if (!ensureEnvOrRespond(res)) {
    return;
  }

  if (!jql) {
    return res.status(400).json({ error: "Missing required field: jql" });
  }

  try {
    const result = await jiraRequest({
      method: "POST",
      pathWithQuery: JIRA_SEARCH_JQL_PATH,
      body: {
        jql,
        maxResults,
        fields: ["summary", "issuetype", "status", "assignee", "updated"],
      },
    });
    if (!result.ok) {
      return res.status(result.status).json({
        ...(result.data || {}),
        endpoint: JIRA_SEARCH_JQL_PATH,
      });
    }
    return res.json(result.data);
  } catch (error) {
    return res.status(500).json({
      error: "Failed to call Jira search",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

// POST /api/jira/search — preferred: JQL in JSON body avoids URL-encoding issues.
app.post("/api/jira/search", async (req, res) => {
  const jql = String(req.body?.jql || "").trim();
  const maxResults = Number(req.body?.maxResults || 5);
  return handleJiraSearch(jql, maxResults, res);
});

// GET /api/jira/search — kept for curl/testing convenience.
app.get("/api/jira/search", async (req, res) => {
  if (!ensureEnvOrRespond(res)) {
    return;
  }

  const jql = String(req.query.jql || "").trim();
  const maxResults = Number(req.query.maxResults || 10);
  return handleJiraSearch(jql, maxResults, res);
});

app.post("/api/jira/issues/:issueKey/comment", async (req, res) => {
  if (!ensureEnvOrRespond(res)) {
    return;
  }

  const issueKey = String(req.params.issueKey || "").trim();
  const note = String(req.body?.note || "").trim();

  if (!issueKey) {
    return res.status(400).json({ error: "Missing issue key" });
  }

  if (!note) {
    return res.status(400).json({ error: "Missing note" });
  }

  const body = {
    body: {
      type: "doc",
      version: 1,
      content: [
        {
          type: "paragraph",
          content: [
            {
              type: "text",
              text: note,
            },
          ],
        },
      ],
    },
  };

  try {
    const result = await jiraRequest({
      method: "POST",
      pathWithQuery: `/rest/api/3/issue/${encodeURIComponent(issueKey)}/comment`,
      body,
    });

    if (!result.ok) {
      return res.status(result.status).json(result.data);
    }

    return res.json(result.data);
  } catch (error) {
    return res.status(500).json({
      error: "Failed to push comment to Jira",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

app.post("/api/jira/issues/:issueKey/status", async (req, res) => {
  if (!ensureEnvOrRespond(res)) {
    return;
  }

  const issueKey = String(req.params.issueKey || "").trim();
  const targetStatus = String(req.body?.targetStatus || "").trim();

  if (!issueKey) {
    return res.status(400).json({ error: "Missing issue key" });
  }

  if (!targetStatus) {
    return res.status(400).json({ error: "Missing target status" });
  }

  try {
    const transitionsResult = await jiraRequest({
      pathWithQuery: `/rest/api/3/issue/${encodeURIComponent(issueKey)}/transitions`,
    });

    if (!transitionsResult.ok) {
      return res.status(transitionsResult.status).json(transitionsResult.data);
    }

    const transitions = Array.isArray(transitionsResult.data?.transitions)
      ? transitionsResult.data.transitions
      : [];

    const desired = targetStatus.toLowerCase();
    const matchingTransition = transitions.find(
      (item) => String(item?.to?.name || "").toLowerCase() === desired
    );

    if (!matchingTransition?.id) {
      const available = transitions
        .map((item) => item?.to?.name)
        .filter((name) => typeof name === "string" && name.trim().length > 0);

      return res.status(400).json({
        error: `Status '${targetStatus}' is not an available transition for ${issueKey}`,
        availableTransitions: available,
      });
    }

    const transitionResult = await jiraRequest({
      method: "POST",
      pathWithQuery: `/rest/api/3/issue/${encodeURIComponent(issueKey)}/transitions`,
      body: {
        transition: {
          id: matchingTransition.id,
        },
      },
    });

    if (!transitionResult.ok) {
      return res.status(transitionResult.status).json(transitionResult.data);
    }

    return res.json({
      ok: true,
      issueKey,
      previousStatus: null,
      newStatus: targetStatus,
      transitionId: matchingTransition.id,
    });
  } catch (error) {
    return res.status(500).json({
      error: "Failed to update Jira status",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

app.post("/api/jira/issues/:issueKey/assignee", async (req, res) => {
  if (!ensureEnvOrRespond(res)) {
    return;
  }

  const issueKey = String(req.params.issueKey || "").trim();
  const assigneeRaw = String(req.body?.assignee || "").trim();

  if (!issueKey) {
    return res.status(400).json({ error: "Missing issue key" });
  }

  if (!assigneeRaw) {
    return res.status(400).json({ error: "Missing assignee value" });
  }

  try {
    let accountId = "";
    let resolvedAssignee = assigneeRaw;

    const looksLikeAccountId = assigneeRaw.includes(":") || assigneeRaw.length > 20;
    if (looksLikeAccountId) {
      accountId = assigneeRaw;
    } else {
      const searchResult = await jiraRequest({
        pathWithQuery: `/rest/api/3/user/search?query=${encodeURIComponent(assigneeRaw)}&maxResults=20`,
      });

      if (!searchResult.ok) {
        return res.status(searchResult.status).json(searchResult.data);
      }

      const users = Array.isArray(searchResult.data) ? searchResult.data : [];
      const exact = users.find((user) => {
        const displayName = String(user?.displayName || "").toLowerCase();
        const email = String(user?.emailAddress || "").toLowerCase();
        const query = assigneeRaw.toLowerCase();
        return displayName === query || email === query;
      });

      const selectedUser = exact || users[0];
      accountId = String(selectedUser?.accountId || "").trim();
      resolvedAssignee =
        String(selectedUser?.displayName || selectedUser?.emailAddress || assigneeRaw).trim() ||
        assigneeRaw;
    }

    if (!accountId) {
      return res.status(404).json({
        error: `No Jira user found for '${assigneeRaw}'`,
      });
    }

    const updateResult = await jiraRequest({
      method: "PUT",
      pathWithQuery: `/rest/api/3/issue/${encodeURIComponent(issueKey)}/assignee`,
      body: {
        accountId,
      },
    });

    if (!updateResult.ok) {
      return res.status(updateResult.status).json(updateResult.data);
    }

    return res.json({
      ok: true,
      issueKey,
      accountId,
      resolvedAssignee,
    });
  } catch (error) {
    return res.status(500).json({
      error: "Failed to update Jira assignee",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

app.post("/api/jira/issue-metadata/bulk", (req, res) => {
  const issueKeys = Array.isArray(req.body?.issueKeys)
    ? req.body.issueKeys
        .map((key) => String(key || "").trim())
        .filter((key) => key.length > 0)
    : [];

  if (issueKeys.length === 0) {
    return res.json({ items: {} });
  }

  const placeholders = issueKeys.map(() => "?").join(",");
  const rows = db
    .prepare(
      `SELECT issue_key, note, priority FROM issue_metadata WHERE issue_key IN (${placeholders})`
    )
    .all(...issueKeys);

  const items = rows.reduce((acc, row) => {
    acc[row.issue_key] = {
      note: String(row.note || ""),
      priority: clampDbPriority(row.priority),
    };
    return acc;
  }, {});

  return res.json({ items });
});

app.put("/api/jira/issue-metadata/:issueKey", (req, res) => {
  const issueKey = String(req.params.issueKey || "").trim();
  if (!issueKey) {
    return res.status(400).json({ error: "Missing issue key" });
  }

  const current = selectIssueMetadataStmt.get(issueKey) || {};
  const hasNote = typeof req.body?.note === "string";
  const hasPriority = req.body?.priority !== undefined;

  if (!hasNote && !hasPriority) {
    return res.status(400).json({ error: "Provide note or priority" });
  }

  const nextNote = hasNote ? String(req.body.note) : String(current.note || "");
  const nextPriority = hasPriority ? clampDbPriority(req.body.priority) : clampDbPriority(current.priority);

  upsertIssueMetadataStmt.run({
    issueKey,
    note: nextNote,
    priority: nextPriority,
  });

  return res.json({
    ok: true,
    issueKey,
    note: nextNote,
    priority: nextPriority,
  });
});

app.listen(port, () => {
  console.log(`Jira proxy listening on http://localhost:${port}`);
});
