import express from 'express';
import { authenticate } from '../middlewares/auth.js';
import * as gtmService from '../services/gtmService.js';
import { createJob, getJob, finishJob, runInJob } from '../services/copyJobs.js';

const router = express.Router();

/**
 * @route   GET /api/gtm/accounts
 * @desc    Get all GTM accounts accessible by the user
 * @access  Private
 */
router.get('/accounts', authenticate, async (req, res) => {
  try {
    const accounts = await gtmService.getAccounts(req.user.googleUserId);
    res.status(200).json({ accounts });
  } catch (error) {
    console.error('Error fetching GTM accounts:', error);
    res.status(500).json({ message: 'Failed to fetch GTM accounts', error: error.message });
  }
});

/**
 * @route   GET /api/gtm/accounts/:accountId/containers
 * @desc    Get all containers within a GTM account
 * @access  Private
 */
router.get('/accounts/:accountId/containers', authenticate, async (req, res) => {
  try {
    const { accountId } = req.params;
    const containers = await gtmService.getContainers(req.user.googleUserId, accountId);
    res.status(200).json({ containers });
  } catch (error) {
    console.error('Error fetching GTM containers:', error);
    res.status(500).json({ message: 'Failed to fetch GTM containers', error: error.message });
  }
});

/**
 * @route   GET /api/gtm/accounts/:accountId/containers/:containerId/workspaces
 * @desc    Get all workspaces within a GTM container
 * @access  Private
 */
router.get('/accounts/:accountId/containers/:containerId/workspaces', authenticate, async (req, res) => {
  try {
    const { accountId, containerId } = req.params;
    const workspaces = await gtmService.getWorkspaces(req.user.googleUserId, accountId, containerId);
    res.status(200).json({ workspaces });
  } catch (error) {
    console.error('Error fetching GTM workspaces:', error);
    res.status(500).json({ message: 'Failed to fetch GTM workspaces', error: error.message });
  }
});

/**
 * @route   GET /api/gtm/accounts/:accountId/containers/:containerId/workspaces/:workspaceId/status
 * @desc    Get workspace changes vs published version
 * @access  Private
 */
router.get('/accounts/:accountId/containers/:containerId/workspaces/:workspaceId/status', authenticate, async (req, res) => {
  try {
    const { accountId, containerId, workspaceId } = req.params;
    const status = await gtmService.getWorkspaceStatus(req.user.googleUserId, accountId, containerId, workspaceId);
    res.status(200).json({ status });
  } catch (error) {
    console.error('Error fetching workspace status:', error);
    res.status(500).json({ message: 'Failed to fetch workspace status', error: error.message });
  }
});

/**
 * @route   GET /api/gtm/accounts/:accountId/containers/:containerId/workspaces/:workspaceId/templates
 * @desc    Get all custom templates in a workspace
 * @access  Private
 */
router.get('/accounts/:accountId/containers/:containerId/workspaces/:workspaceId/templates', authenticate, async (req, res) => {
  try {
    const { accountId, containerId, workspaceId } = req.params;
    const templates = await gtmService.getCustomTemplates(req.user.googleUserId, accountId, containerId, workspaceId);
    res.status(200).json({ templates });
  } catch (error) {
    console.error('Error fetching custom templates:', error);
    res.status(500).json({ message: 'Failed to fetch custom templates', error: error.message });
  }
});

/**
 * @route   GET /api/gtm/accounts/:accountId/containers/:containerId/workspaces/:workspaceId/tags
 * @desc    Get all tags in a workspace
 * @access  Private
 */
router.get('/accounts/:accountId/containers/:containerId/workspaces/:workspaceId/tags', authenticate, async (req, res) => {
  try {
    const { accountId, containerId, workspaceId } = req.params;
    const tags = await gtmService.getTags(req.user.googleUserId, accountId, containerId, workspaceId);
    res.status(200).json({ tags });
  } catch (error) {
    console.error('Error fetching tags:', error);
    res.status(500).json({ message: 'Failed to fetch tags', error: error.message });
  }
});

/**
 * @route   GET /api/gtm/accounts/:accountId/containers/:containerId/workspaces/:workspaceId/triggers
 * @desc    Get all triggers in a workspace
 * @access  Private
 */
router.get('/accounts/:accountId/containers/:containerId/workspaces/:workspaceId/triggers', authenticate, async (req, res) => {
  try {
    const { accountId, containerId, workspaceId } = req.params;
    const triggers = await gtmService.getTriggers(req.user.googleUserId, accountId, containerId, workspaceId);
    res.status(200).json({ triggers });
  } catch (error) {
    console.error('Error fetching triggers:', error);
    res.status(500).json({ message: 'Failed to fetch triggers', error: error.message });
  }
});

/**
 * @route   GET /api/gtm/accounts/:accountId/containers/:containerId/workspaces/:workspaceId/variables
 * @desc    Get all variables in a workspace
 * @access  Private
 */
router.get('/accounts/:accountId/containers/:containerId/workspaces/:workspaceId/variables', authenticate, async (req, res) => {
  try {
    const { accountId, containerId, workspaceId } = req.params;
    const variables = await gtmService.getVariables(req.user.googleUserId, accountId, containerId, workspaceId);
    res.status(200).json({ variables });
  } catch (error) {
    console.error('Error fetching variables:', error);
    res.status(500).json({ message: 'Failed to fetch variables', error: error.message });
  }
});

/**
 * @route   GET /api/gtm/accounts/:accountId/containers/:containerId/workspaces/:workspaceId/clients
 * @desc    Get all clients in a workspace (server-side containers only)
 * @access  Private
 */
router.get('/accounts/:accountId/containers/:containerId/workspaces/:workspaceId/clients', authenticate, async (req, res) => {
  try {
    const { accountId, containerId, workspaceId } = req.params;
    const clients = await gtmService.getClients(req.user.googleUserId, accountId, containerId, workspaceId);
    res.status(200).json({ clients });
  } catch (error) {
    console.error('Error fetching clients:', error);
    res.status(500).json({ message: 'Failed to fetch clients', error: error.message });
  }
});

/**
 * @route   GET /api/gtm/accounts/:accountId/containers/:containerId/workspaces/:workspaceId/transformations
 * @desc    Get all transformations in a workspace
 * @access  Private
 */
router.get('/accounts/:accountId/containers/:containerId/workspaces/:workspaceId/transformations', authenticate, async (req, res) => {
  try {
    const { accountId, containerId, workspaceId } = req.params;
    const transformations = await gtmService.getTransformations(req.user.googleUserId, accountId, containerId, workspaceId);
    res.status(200).json({ transformations });
  } catch (error) {
    console.error('Error fetching transformations:', error);
    res.status(500).json({ message: 'Failed to fetch transformations', error: error.message });
  }
});

/**
 * @route   POST /api/gtm/copy
 * @desc    Copy selected elements from one workspace to multiple targets
 * @access  Private
 */
router.post('/copy', authenticate, async (req, res) => {
  try {
    const { source, targets, elementTypes, selectedElements, deletedElementNames, autoPublish = true } = req.body;
    
    // Validate required fields
    if (!source || !source.accountId || !source.containerId || !source.workspaceId) {
      return res.status(400).json({ message: 'Source information is required' });
    }
    
    if (!targets || !Array.isArray(targets) || targets.length === 0) {
      return res.status(400).json({ message: 'At least one target container is required' });
    }

    if (targets.some(target => target.accountId === source.accountId && target.containerId === source.containerId)) {
      return res.status(400).json({ code: 'TARGET_IS_SOURCE_CONTAINER', containerId: source.containerId });
    }
    
    const hasElementTypes = elementTypes && Array.isArray(elementTypes) && elementTypes.length > 0;
    const hasDeletions = deletedElementNames
      && typeof deletedElementNames === 'object'
      && !Array.isArray(deletedElementNames)
      && Object.values(deletedElementNames).some(arr => Array.isArray(arr) && arr.length > 0);
    if (!hasElementTypes && !hasDeletions) {
      return res.status(400).json({ message: 'At least one element to copy or delete is required' });
    }
    
    const job = createJob(req.user.googleUserId);
    runInJob(job, () => gtmService.copyElements(
      req.user.googleUserId,
      source,
      targets,
      elementTypes,
      selectedElements,
      deletedElementNames,
      autoPublish
    ))
      .then(result => finishJob(job, 'done', 'JOB_DONE', { result }))
      .catch(error => {
        console.error('Error copying GTM elements:', error);
        finishJob(job, 'failed', 'JOB_FAILED', { apiMessage: error.message });
      });

    res.status(202).json({ jobId: job.id });
  } catch (error) {
    console.error('Error starting GTM copy:', error);
    res.status(500).json({ message: 'Failed to start GTM copy', error: error.message });
  }
});

/**
 * @route   GET /api/gtm/copy/:jobId/events
 * @desc    Stream copy progress events (Server-Sent Events)
 * @access  Private
 */
router.get('/copy/:jobId/events', authenticate, (req, res) => {
  const job = getJob(req.params.jobId);
  if (!job || job.googleUserId !== req.user.googleUserId) {
    return res.status(404).json({ code: 'COPY_JOB_NOT_FOUND' });
  }

  res.set({
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no'
  });
  res.flushHeaders();

  const send = event => res.write(`id: ${event.id}\nevent: progress\ndata: ${JSON.stringify(event)}\n\n`);
  const lastEventId = Number(req.get('Last-Event-ID')) || Number(req.query.after) || 0;
  job.events.filter(event => event.id > lastEventId).forEach(send);

  if (job.status !== 'running') {
    return res.end();
  }

  const heartbeat = setInterval(() => res.write(': ping\n\n'), 15000);
  const listener = event => {
    send(event);
    if (event.type === 'JOB_DONE' || event.type === 'JOB_FAILED') {
      clearInterval(heartbeat);
      res.end();
    }
  };
  job.listeners.add(listener);

  req.on('close', () => {
    clearInterval(heartbeat);
    job.listeners.delete(listener);
  });
});

export default router;
