import api from './api';
import { saveReport } from './copyHistory';
import { summarizeCopy } from '../utils/copyReport';

const SAVE_DELAY_MS = 500;
const TERMINAL_EVENTS = ['JOB_DONE', 'JOB_FAILED'];

const followed = new Map();

export const createReport = ({ jobId, source, targets, containerNames, selection, deletions, autoPublish }) => ({
  id: jobId,
  createdAt: new Date().toISOString(),
  finishedAt: null,
  status: 'running',
  source,
  targets,
  containerNames,
  selection,
  deletions,
  autoPublish,
  events: []
});

export const followCopyJob = (report) => {
  if (followed.has(report.id)) return followed.get(report.id).done;

  const done = new Promise(resolve => {
    let saveTimer = null;
    let finished = false;

    const persist = async () => {
      clearTimeout(saveTimer);
      saveTimer = null;
      try {
        await saveReport(report);
      } catch (error) {
        console.error('Failed to save copy report:', error);
      }
    };

    const schedulePersist = () => {
      if (!saveTimer) saveTimer = setTimeout(persist, SAVE_DELAY_MS);
    };

    const lastEventId = report.events.length ? report.events[report.events.length - 1].id : 0;
    const source = new EventSource(api.gtm.copyEventsUrl(report.id, lastEventId), { withCredentials: true });

    const finish = async (streamLost) => {
      if (finished) return;
      finished = true;
      source.close();
      const summary = summarizeCopy(report.events, { streamLost });
      report.status = summary.status;
      report.finishedAt = new Date(summary.finishedAt || Date.now()).toISOString();
      report.reconnecting = false;
      await persist();
      followed.delete(report.id);
      resolve(report);
    };

    source.addEventListener('progress', message => {
      const event = JSON.parse(message.data);
      const last = report.events[report.events.length - 1];
      if (last && event.id <= last.id) return;
      report.events.push(event);
      report.reconnecting = false;
      if (TERMINAL_EVENTS.includes(event.type)) {
        finish(false);
      } else {
        schedulePersist();
      }
    });

    source.onerror = () => {
      if (source.readyState === EventSource.CLOSED) {
        finish(true);
      } else {
        report.reconnecting = true;
      }
    };
  });

  followed.set(report.id, { report, done });
  return done;
};

export const getFollowedReport = (reportId) => followed.get(reportId)?.report || null;
