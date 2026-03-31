/**
 * jobQueue.js — in-memory queue for background optimisation jobs.
 *
 * Jobs are keyed by a UUID and reference the layer they belong to.
 * Completed/errored jobs are kept up to MAX_COMPLETED entries then pruned.
 *
 * Statuses:  pending → running → done | error
 */

import { v4 as uuidv4 } from 'uuid';

const MAX_COMPLETED = 50;

class JobQueue {
  constructor() {
    /** @type {Map<string, Job>} */
    this._jobs = new Map();
  }

  /**
   * Enqueue a new optimisation job.
   * @param {string} layerId — UUID of the layer being optimised
   * @param {string} type    — 'cog' | 'copc' | 'simplify' | 'decimate'
   * @returns {Job}
   */
  add(layerId, type) {
    const id = uuidv4();
    const job = {
      id,
      layerId,
      type,
      status:     'pending',
      startedAt:  null,
      finishedAt: null,
      error:      null,
    };
    this._jobs.set(id, job);
    return job;
  }

  markStarted(jobId) {
    const job = this._jobs.get(jobId);
    if (job) {
      job.status    = 'running';
      job.startedAt = new Date().toISOString();
    }
    return job ?? null;
  }

  markDone(jobId) {
    const job = this._jobs.get(jobId);
    if (job) {
      job.status     = 'done';
      job.finishedAt = new Date().toISOString();
    }
    this._pruneOld();
    return job ?? null;
  }

  markError(jobId, error) {
    const job = this._jobs.get(jobId);
    if (job) {
      job.status     = 'error';
      job.finishedAt = new Date().toISOString();
      job.error      = typeof error === 'string' ? error : (error?.message ?? 'Unknown error');
    }
    return job ?? null;
  }

  /** All active (pending/running) jobs for a layer ID. */
  getActiveForLayer(layerId) {
    return [...this._jobs.values()].filter(
      j => j.layerId === layerId && (j.status === 'pending' || j.status === 'running')
    );
  }

  /** All jobs, most-recent first. */
  getAll() {
    return [...this._jobs.values()].sort((a, b) => {
      const ta = a.startedAt ?? a.finishedAt ?? '';
      const tb = b.startedAt ?? b.finishedAt ?? '';
      return tb.localeCompare(ta);
    });
  }

  // ── private ──────────────────────────────────────────────────

  _pruneOld() {
    const done = [...this._jobs.entries()]
      .filter(([, j]) => j.status === 'done' || j.status === 'error')
      .sort(([, a], [, b]) => (b.finishedAt ?? '').localeCompare(a.finishedAt ?? ''));
    if (done.length > MAX_COMPLETED) {
      done.slice(MAX_COMPLETED).forEach(([id]) => this._jobs.delete(id));
    }
  }
}

// Singleton used throughout the server process
export const jobQueue = new JobQueue();
export default jobQueue;
