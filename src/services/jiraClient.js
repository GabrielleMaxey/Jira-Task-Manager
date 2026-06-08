const extractJiraErrorMessage = (data, status) => {
  if (Array.isArray(data?.errorMessages) && data.errorMessages.length > 0) {
    return data.errorMessages.join(" ");
  }

  return data?.error || data?.message || `Jira request failed with status ${status}`;
};

const requestJson = async (url, options = {}) => {
  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
      ...(options.headers || {}),
    },
    ...options,
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(extractJiraErrorMessage(data, response.status));
  }

  return data;
};

export const fetchJiraMyself = async () => {
  return requestJson("/api/jira/myself");
};

export const fetchJiraHealth = async () => {
  return requestJson("/api/health");
};

// Send JQL as POST JSON body — avoids URL-encoding issues with complex JQL
// and matches Aware's request pattern (POST body to /rest/api/3/search/jql).
export const fetchJiraSearch = async ({ jql, maxResults = 5 }) => {
  return requestJson("/api/jira/search", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ jql, maxResults }),
  });
};

export const pushJiraIssueNote = async ({ issueKey, note }) => {
  return requestJson(`/api/jira/issues/${encodeURIComponent(issueKey)}/comment`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ note }),
  });
};

export const updateJiraIssueStatus = async ({ issueKey, targetStatus }) => {
  return requestJson(`/api/jira/issues/${encodeURIComponent(issueKey)}/status`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ targetStatus }),
  });
};

export const updateJiraIssueAssignee = async ({ issueKey, assignee }) => {
  return requestJson(`/api/jira/issues/${encodeURIComponent(issueKey)}/assignee`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ assignee }),
  });
};

export const fetchIssueMetadataBulk = async (issueKeys) => {
  const data = await requestJson("/api/jira/issue-metadata/bulk", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ issueKeys }),
  });

  return data?.items || {};
};

export const saveIssueMetadata = async ({ issueKey, note, priority }) => {
  const body = {};
  if (typeof note === "string") {
    body.note = note;
  }
  if (priority !== undefined) {
    body.priority = priority;
  }

  return requestJson(`/api/jira/issue-metadata/${encodeURIComponent(issueKey)}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
};
