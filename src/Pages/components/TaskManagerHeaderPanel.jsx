import React from "react";
import { Grid, Segment } from "semantic-ui-react";

const TaskManagerHeaderPanel = ({ tickerJokes, jokeIndex, fullDateLabel, monthLabel, calendarCells, todayDay }) => {
  return (
    <>
      <div className="ww-joke-ticker" role="status" aria-live="polite">
        <span className="ww-joke-prefix">Office Joke Ticker:</span>
        <span className="ww-joke-text">{tickerJokes[jokeIndex % tickerJokes.length]}</span>
      </div>

      <Grid columns={1} stackable>
        <Grid.Row>
          <Grid.Column>
            <Segment className="ww-date-calendar-segment">
              <div className="ww-date-block">
                <p className="ww-date-label">Today</p>
                <p className="ww-date-value">{fullDateLabel}</p>
              </div>
              <div className="ww-calendar-block">
                <p className="ww-calendar-month">{monthLabel}</p>
                <div className="ww-calendar-weekdays">
                  {["S", "M", "T", "W", "T", "F", "S"].map((letter, idx) => (
                    <span key={`weekday-${letter}-${idx}`}>{letter}</span>
                  ))}
                </div>
                <div className="ww-calendar-grid">
                  {calendarCells.map((day, idx) => {
                    const isToday = day === todayDay;
                    return (
                      <span
                        key={`calendar-day-${idx}`}
                        className={`ww-calendar-cell ${isToday ? "ww-calendar-today" : ""}`}
                      >
                        {day || ""}
                      </span>
                    );
                  })}
                </div>
              </div>
            </Segment>
          </Grid.Column>
        </Grid.Row>
      </Grid>
    </>
  );
};

export default TaskManagerHeaderPanel;
