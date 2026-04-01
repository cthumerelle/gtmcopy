import express from 'express';
import { authenticate } from '../middlewares/auth.js';
import * as gtmService from '../services/gtmService.js';

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
    const { source, targets, elementTypes, selectedElements, autoPublish = true } = req.body;
    
    // Validate required fields
    if (!source || !source.accountId || !source.containerId || !source.workspaceId) {
      return res.status(400).json({ message: 'Source information is required' });
    }
    
    if (!targets || !Array.isArray(targets) || targets.length === 0) {
      return res.status(400).json({ message: 'At least one target container is required' });
    }
    
    if (!elementTypes || !Array.isArray(elementTypes) || elementTypes.length === 0) {
      return res.status(400).json({ message: 'At least one element type is required' });
    }
    
    // Perform the copy operation
    const result = await gtmService.copyElements(
      req.user.googleUserId,
      source,
      targets,
      elementTypes,
      selectedElements, // Pass the selected element IDs
      autoPublish // Pass the auto-publish option
    );
    
    res.status(200).json({ result });
  } catch (error) {
    console.error('Error copying GTM elements:', error);
    res.status(500).json({ message: 'Failed to copy GTM elements', error: error.message });
  }
});

/**
 * @route   GET /api/gtm/history
 * @desc    Get copy history for the user
 * @access  Private
 */
router.get('/history', authenticate, async (req, res) => {
  try {
    const history = await gtmService.getCopyHistory(req.user.googleUserId);
    res.status(200).json({ history });
  } catch (error) {
    console.error('Error fetching copy history:', error);
    res.status(500).json({ message: 'Failed to fetch copy history', error: error.message });
  }
});

/**
 * @route   GET /api/gtm/history/:id
 * @desc    Get details of a specific copy operation
 * @access  Private
 */
router.get('/history/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const details = await gtmService.getCopyDetails(req.user.googleUserId, id);
    res.status(200).json({ details });
  } catch (error) {
    console.error('Error fetching copy details:', error);
    res.status(500).json({ message: 'Failed to fetch copy details', error: error.message });
  }
});

export default router;
