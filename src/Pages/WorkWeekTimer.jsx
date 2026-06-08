import React from "react";
import {
  Container,
  Segment,
  Card,
  Header,
  Icon,
  Button,
  Divider,
} from "semantic-ui-react";
import "semantic-ui-css/semantic.min.css";
import "./workWeekTimerElements.css";
import JiraResultsTable from "./components/JiraResultsTable";
import TaskManagerHeaderPanel from "./components/TaskManagerHeaderPanel";
import { STATUS_OPTIONS, useTaskManagerJira } from "./hooks/useTaskManagerJira";

const TEN_MINUTES_MS = 10 * 60 * 1000;
const JOKE_TICKER_ITEMS = [
  "Manager mode: turning coffee into completed tickets.",
  "I don't procrastinate, I run backlog grooming drills.",
  "My favorite cardio is sprint planning.",
  "Task juggling level: circus-grade project management.",
  "Current KPI: fewer tabs, more done.",
];

const getCalendarCells = (date) => {
  const year = date.getFullYear();
  const month = date.getMonth();
  const firstDayIndex = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells = [];

  for (let i = 0; i < firstDayIndex; i += 1) {
    cells.push(null);
  }

  for (let day = 1; day <= daysInMonth; day += 1) {
    cells.push(day);
  }

  while (cells.length % 7 !== 0) {
    cells.push(null);
  }

  return cells;
};

const WorkWeekTimer = () => {
  const {
    jiraState,
    jiraApiMeta,
    jqlCount,
    jqlInputs,
    jqlLabels,
    jqlLoading,
    jqlRuns,
    jqlError,
    jqlMaxResults,
    jiraNotes,
    jiraRowPriorities,
    selectedForPush,
    pushState,
    saveState,
    statusDrafts,
    assigneeDrafts,
    rowUpdateState,
    isClosedLikeStatus,
    clampPriority,
    getPriorityClass,
    getPriorityRowClass,
    formatDate,
    setJqlCount,
    setJqlMaxResults,
    handleJiraTest,
    handleJqlChange,
    handleJqlLabelChange,
    handleResetSavedQueries,
    handleRunJql,
    handlePushSelected,
    handleSaveMetadata,
    handleSelectAll,
    handleStatusDraftChange,
    handleStatusUpdate,
    handleAssigneeDraftChange,
    handleAssigneeUpdate,
    handleRowPriorityChange,
    handleNoteChange,
    handleSelectForPush,
    handlePushNote,
  } = useTaskManagerJira();

  const [jokeIndex, setJokeIndex] = React.useState(0);
  const [dadJoke, setDadJoke] = React.useState("");

  const today = React.useMemo(() => new Date(), []);
  const todayDay = today.getDate();
  const monthLabel = today.toLocaleDateString(undefined, { month: "long", year: "numeric" });
  const fullDateLabel = today.toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
  const calendarCells = React.useMemo(() => getCalendarCells(today), [today]);
  const tickerJokes = React.useMemo(() => {
    if (!dadJoke) {
      return JOKE_TICKER_ITEMS;
    }

    return [dadJoke, ...JOKE_TICKER_ITEMS];
  }, [dadJoke]);

  const fetchDadJoke = React.useCallback(async () => {
    try {
      const response = await fetch("https://icanhazdadjoke.com/", {
        headers: {
          Accept: "application/json",
        },
      });

      if (!response.ok) {
        return;
      }

      const data = await response.json();
      const nextJoke = String(data?.joke || "").trim();

      if (nextJoke) {
        setDadJoke(`Dad Joke: ${nextJoke}`);
      }
    } catch {
      // Keep static jokes when API is unavailable.
    }
  }, []);

  React.useEffect(() => {
    fetchDadJoke();
  }, [fetchDadJoke]);

  React.useEffect(() => {
    const jokeRefreshId = window.setInterval(fetchDadJoke, TEN_MINUTES_MS);

    return () => {
      window.clearInterval(jokeRefreshId);
    };
  }, [fetchDadJoke]);

  React.useEffect(() => {
    const intervalId = window.setInterval(() => {
      setJokeIndex((prev) => (prev + 1) % tickerJokes.length);
    }, TEN_MINUTES_MS);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [tickerJokes.length]);

  React.useEffect(() => {
    setJokeIndex((prev) => (prev >= tickerJokes.length ? 0 : prev));
  }, [tickerJokes.length]);

  return (
    <>
      <Container fluid className="work-week-page">
        <TaskManagerHeaderPanel
          tickerJokes={tickerJokes}
          jokeIndex={jokeIndex}
          fullDateLabel={fullDateLabel}
          monthLabel={monthLabel}
          calendarCells={calendarCells}
          todayDay={todayDay}
        />

        <Segment raised className="ww-segment">
                <Card.Content>
                  <Header as="h2">
                    <Icon name="tasks" />
                    <Header.Content>Task Manager</Header.Content>
                  </Header>
                  <p className="ww-copy">Run saved JQL queries and manage Jira tasks.</p>
                </Card.Content>
                <Card.Content extra>
                  <p className="ww-copy">Update status, assignee, priority, and notes.</p>
                </Card.Content>
                <Card.Content extra>
                  <Button
                    primary
                    onClick={handleJiraTest}
                    loading={jiraState.loading}
                    disabled={jiraState.loading}
                  >
                    Test Jira Connection
                  </Button>
                  <p
                    className={`ww-jira-status ${
                      jiraState.success === false ? "ww-jira-error" : ""
                    }`}
                  >
                    {jiraState.message}
                  </p>
                  {jiraApiMeta ? <p className="ww-jira-meta">{jiraApiMeta}</p> : null}
                </Card.Content>
                <Card.Content extra>
                  <div className="ww-jql-controls">
                    <label htmlFor="jql-count">JQL count:</label>
                    <select
                      id="jql-count"
                      value={jqlCount}
                      onChange={(event) => setJqlCount(Number(event.target.value))}
                    >
                      <option value={1}>1</option>
                      <option value={2}>2</option>
                      <option value={3}>3</option>
                    </select>
                  </div>

                  {Array.from({ length: jqlCount }).map((_, index) => (
                    <div key={`jql-input-${index}`} className="ww-jql-input-wrap">
                      <div className="ww-jql-row-head">
                        <label htmlFor={`jql-label-${index}`}>Label {index + 1}</label>
                      </div>
                      <div className="ww-jql-row-inline">
                        <input
                          id={`jql-label-${index}`}
                          type="text"
                          value={jqlLabels[index]}
                          onChange={(event) => handleJqlLabelChange(index, event.target.value)}
                          placeholder={`Label for JQL ${index + 1}`}
                        />
                      </div>

                      <input
                        id={`jql-${index}`}
                        type="text"
                        value={jqlInputs[index]}
                        onChange={(event) => handleJqlChange(index, event.target.value)}
                        placeholder="project = ABC ORDER BY updated DESC"
                      />
                    </div>
                  ))}

                  <div className="ww-jql-maxresults">
                    <label htmlFor="jql-max-results">Max results:</label>
                    <input
                      id="jql-max-results"
                      type="number"
                      min={1}
                      max={1000}
                      value={jqlMaxResults}
                      onChange={(event) =>
                        setJqlMaxResults(Math.max(1, Number(event.target.value) || 200))
                      }
                    />
                  </div>
                  <Button secondary onClick={handleRunJql} loading={jqlLoading} disabled={jqlLoading}>
                    Run JQL
                  </Button>
                  <Button className="ww-reset-btn" onClick={handleResetSavedQueries} disabled={jqlLoading}>
                    Reset Saved Queries
                  </Button>

                  {jqlError ? <p className="ww-jira-status ww-jira-error">{jqlError}</p> : null}
                </Card.Content>
        </Segment>

        <JiraResultsTable
          jqlRuns={jqlRuns}
          selectedForPush={selectedForPush}
          pushState={pushState}
          saveState={saveState}
          rowUpdateState={rowUpdateState}
          statusDrafts={statusDrafts}
          assigneeDrafts={assigneeDrafts}
          jiraRowPriorities={jiraRowPriorities}
          jiraNotes={jiraNotes}
          statusOptions={STATUS_OPTIONS}
          isClosedLikeStatus={isClosedLikeStatus}
          clampPriority={clampPriority}
          getPriorityClass={getPriorityClass}
          getPriorityRowClass={getPriorityRowClass}
          formatDate={formatDate}
          handlePushSelected={handlePushSelected}
          handleSaveMetadata={handleSaveMetadata}
          handleSelectAll={handleSelectAll}
          handleStatusDraftChange={handleStatusDraftChange}
          handleStatusUpdate={handleStatusUpdate}
          handleAssigneeDraftChange={handleAssigneeDraftChange}
          handleAssigneeUpdate={handleAssigneeUpdate}
          handleRowPriorityChange={handleRowPriorityChange}
          handleNoteChange={handleNoteChange}
          handleSelectForPush={handleSelectForPush}
          handlePushNote={handlePushNote}
        />
      </Container>
      <Divider />
    </>
  );
};

export default WorkWeekTimer;
