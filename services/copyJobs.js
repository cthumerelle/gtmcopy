import { AsyncLocalStorage } from 'node:async_hooks';
import { randomUUID } from 'node:crypto';

const JOB_TTL_MS = 30 * 60 * 1000;

const jobs = new Map();
const jobContext = new AsyncLocalStorage();

/**
 * @typedef {Object} CopyJob
 * @property {string} id
 * @property {string} googleUserId
 * @property {'running'|'done'|'failed'} status
 * @property {Array<{id: number, type: string, at: number, payload: Object}>} events
 * @property {Set<Function>} listeners
 */

/**
 * @param {string} googleUserId
 * @returns {CopyJob}
 */
const createJob = (googleUserId) => {
  const job = {
    id: randomUUID(),
    googleUserId,
    status: 'running',
    events: [],
    listeners: new Set()
  };
  jobs.set(job.id, job);
  return job;
};

/**
 * @param {string} jobId
 * @returns {CopyJob|undefined}
 */
const getJob = (jobId) => jobs.get(jobId);

/**
 * @param {CopyJob} job
 * @param {string} type
 * @param {Object} [payload]
 */
const emitToJob = (job, type, payload = {}) => {
  const event = { id: job.events.length + 1, type, at: Date.now(), payload };
  job.events.push(event);
  job.listeners.forEach(listener => listener(event));
};

/**
 * @param {CopyJob} job
 * @param {'done'|'failed'} status
 * @param {string} type
 * @param {Object} payload
 */
const finishJob = (job, status, type, payload) => {
  job.status = status;
  emitToJob(job, type, payload);
  job.listeners.clear();
  setTimeout(() => jobs.delete(job.id), JOB_TTL_MS).unref();
};

/**
 * @param {CopyJob} job
 * @param {Function} fn
 * @returns {Promise<*>}
 */
const runInJob = (job, fn) => jobContext.run(job, fn);

/**
 * @returns {(type: string, payload?: Object) => void}
 */
const currentEmitter = () => {
  const job = jobContext.getStore();
  return job ? (type, payload) => emitToJob(job, type, payload) : () => {};
};

/**
 * @param {string} type
 * @param {Object} [payload]
 */
const emitProgress = (type, payload) => currentEmitter()(type, payload);

export { createJob, getJob, finishJob, runInJob, currentEmitter, emitProgress };
