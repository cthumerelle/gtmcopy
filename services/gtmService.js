import { google } from 'googleapis';
import * as googleAuth from './googleAuth.js';
import { getCopyHistory, addCopyHistory, getCopyDetail } from './storageService.js';

/**
 * Get Tag Manager API client for a user
 * @param {string} googleUserId - Google user ID
 * @returns {Object} - Authenticated TagManager client
 */
const getTagManagerClient = async (googleUserId) => {
  try {
    const authClient = await googleAuth.getAuthenticatedClient(googleUserId);
    return google.tagmanager({ version: 'v2', auth: authClient });
  } catch (error) {
    console.error('Error getting Tag Manager client:', error);
    throw error;
  }
};

/**
 * Get all GTM accounts accessible by the user
 * @param {string} googleUserId - Google user ID
 * @returns {Array} - List of GTM accounts
 */
const getAccounts = async (googleUserId) => {
  try {
    const tagmanager = await getTagManagerClient(googleUserId);
    const response = await tagmanager.accounts.list();
    return response.data.account || [];
  } catch (error) {
    console.error('Error fetching GTM accounts:', error);
    throw error;
  }
};

/**
 * Get all containers within a GTM account
 * @param {string} googleUserId - Google user ID
 * @param {string} accountId - GTM account ID
 * @returns {Array} - List of containers
 */
const getContainers = async (googleUserId, accountId) => {
  try {
    const tagmanager = await getTagManagerClient(googleUserId);
    const response = await tagmanager.accounts.containers.list({
      parent: `accounts/${accountId}`
    });
    return response.data.container || [];
  } catch (error) {
    console.error('Error fetching GTM containers:', error);
    throw error;
  }
};

/**
 * Get all workspaces within a GTM container
 * @param {string} googleUserId - Google user ID
 * @param {string} accountId - GTM account ID
 * @param {string} containerId - GTM container ID
 * @returns {Array} - List of workspaces
 */
const getWorkspaces = async (googleUserId, accountId, containerId) => {
  try {
    const tagmanager = await getTagManagerClient(googleUserId);
    const response = await tagmanager.accounts.containers.workspaces.list({
      parent: `accounts/${accountId}/containers/${containerId}`
    });
    return response.data.workspace || [];
  } catch (error) {
    console.error('Error fetching GTM workspaces:', error);
    throw error;
  }
};

/**
 * Get all custom templates in a workspace
 * @param {string} googleUserId - Google user ID
 * @param {string} accountId - GTM account ID
 * @param {string} containerId - GTM container ID
 * @param {string} workspaceId - GTM workspace ID
 * @returns {Array} - List of custom templates
 */
const getCustomTemplates = async (googleUserId, accountId, containerId, workspaceId) => {
  try {
    const tagmanager = await getTagManagerClient(googleUserId);
    const response = await tagmanager.accounts.containers.workspaces.templates.list({
      parent: `accounts/${accountId}/containers/${containerId}/workspaces/${workspaceId}`
    });
    return response.data.template || [];
  } catch (error) {
    console.error('Error fetching custom templates:', error);
    throw error;
  }
};

/**
 * Get all tags in a workspace
 * @param {string} googleUserId - Google user ID
 * @param {string} accountId - GTM account ID
 * @param {string} containerId - GTM container ID
 * @param {string} workspaceId - GTM workspace ID
 * @returns {Array} - List of tags
 */
const getTags = async (googleUserId, accountId, containerId, workspaceId) => {
  try {
    const tagmanager = await getTagManagerClient(googleUserId);
    const response = await tagmanager.accounts.containers.workspaces.tags.list({
      parent: `accounts/${accountId}/containers/${containerId}/workspaces/${workspaceId}`
    });
    return response.data.tag || [];
  } catch (error) {
    console.error('Error fetching tags:', error);
    throw error;
  }
};

/**
 * Get all triggers in a workspace
 * @param {string} googleUserId - Google user ID
 * @param {string} accountId - GTM account ID
 * @param {string} containerId - GTM container ID
 * @param {string} workspaceId - GTM workspace ID
 * @returns {Array} - List of triggers
 */
const getTriggers = async (googleUserId, accountId, containerId, workspaceId) => {
  try {
    const tagmanager = await getTagManagerClient(googleUserId);
    const response = await tagmanager.accounts.containers.workspaces.triggers.list({
      parent: `accounts/${accountId}/containers/${containerId}/workspaces/${workspaceId}`
    });
    return response.data.trigger || [];
  } catch (error) {
    console.error('Error fetching triggers:', error);
    throw error;
  }
};

/**
 * Get all variables in a workspace
 * @param {string} googleUserId - Google user ID
 * @param {string} accountId - GTM account ID
 * @param {string} containerId - GTM container ID
 * @param {string} workspaceId - GTM workspace ID
 * @returns {Array} - List of variables
 */
const getVariables = async (googleUserId, accountId, containerId, workspaceId) => {
  try {
    const tagmanager = await getTagManagerClient(googleUserId);
    const response = await tagmanager.accounts.containers.workspaces.variables.list({
      parent: `accounts/${accountId}/containers/${containerId}/workspaces/${workspaceId}`
    });
    return response.data.variable || [];
  } catch (error) {
    console.error('Error fetching variables:', error);
    throw error;
  }
};

/**
 * Get copy history for a user
 * @param {string} googleUserId - Google user ID
 * @returns {Array} - Copy history
 */
const getHistory = async (googleUserId) => {
  try {
    // Get history from local storage
    return getCopyHistory(googleUserId);
  } catch (error) {
    console.error('Error fetching copy history:', error);
    throw error;
  }
};

/**
 * Get details for a specific copy operation
 * @param {string} googleUserId - Google user ID
 * @param {string} copyId - Copy history ID
 * @returns {Object} - Detailed information about the copy operation
 */
const getDetails = async (googleUserId, copyId) => {
  try {
    // Get the copy record from local storage
    const copyRecord = getCopyDetail(googleUserId, copyId);
    
    if (!copyRecord) {
      throw new Error('Copy record not found or access denied');
    }

    // Extract details from the message field if it exists
    let errors = [];
    if (copyRecord.message) {
      try {
        errors = typeof copyRecord.message === 'string' 
          ? JSON.parse(copyRecord.message) 
          : copyRecord.message;
      } catch (e) {
        console.error('Error parsing copy message:', e);
        errors = [{ type: 'unknown', error: copyRecord.message }];
      }
    }
    
    // Get element types that were copied
    let elementTypes = [];
    try {
      elementTypes = typeof copyRecord.elementTypes === 'string'
        ? JSON.parse(copyRecord.elementTypes)
        : copyRecord.elementTypes;
    } catch (e) {
      console.error('Error parsing element types:', e);
      elementTypes = copyRecord.elementTypes.split(',');
    }
    
    // For successful or partial operations, fetch the elements that were copied
    // This would typically come from the temporary workspace before it was deleted
    // Since we don't store the actual copied elements in the database, 
    // we'll provide summary information based on what we have
    
    const copiedItemsSummary = {
      successful: copyRecord.elementCount,
      failed: errors.length,
      elementTypes: elementTypes,
      // We can provide a breakdown by type based on the error messages
      byType: elementTypes.map(type => {
        const typeErrors = errors.filter(e => e.type === type);
        return {
          type,
          total: 0, // We don't know the actual count per type
          failed: typeErrors.length,
          // We can list the failed items by name if available
          failedItems: typeErrors.map(e => e.name).filter(Boolean)
        };
      })
    };
    
    return {
      id: copyRecord.id,
      date: copyRecord.createdAt,
      source: {
        accountId: copyRecord.sourceAccount,
        containerId: copyRecord.sourceContainer,
        workspaceId: copyRecord.sourceWorkspace
      },
      destination: {
        containerId: copyRecord.destContainer
      },
      status: copyRecord.status,
      elements: copiedItemsSummary,
      errors: errors.length > 0 ? errors : null
    };
  } catch (error) {
    console.error('Error fetching copy details:', error);
    throw error;
  }
};

/**
 * Publish a workspace to production
 * @param {string} googleUserId - Google user ID
 * @param {string} accountId - GTM account ID
 * @param {string} containerId - GTM container ID
 * @param {string} workspaceId - GTM workspace ID
 * @returns {Object} - Publish result
 */
const publishWorkspace = async (googleUserId, accountId, containerId, workspaceId) => {
  try {
    const tagmanager = await getTagManagerClient(googleUserId);
    
    // Log detailed information about the publish attempt for debugging
    console.log(`Attempting to publish workspace - Account: ${accountId}, Container: ${containerId}, Workspace: ${workspaceId}`);
    
    // Create a version which effectively publishes the workspace
    const response = await tagmanager.accounts.containers.workspaces.create_version({
      path: `accounts/${accountId}/containers/${containerId}/workspaces/${workspaceId}`,
      requestBody: {
        name: `GTM Copy Publish ${new Date().toISOString()}`,
        notes: 'Published by GTM Copy application'
      }
    });
    
    console.log('Publish success using create_version:', response.data);
    return response.data;
  } catch (error) {
    console.error('Error publishing workspace:', error);
    
    // Add more detailed error information for publishing errors
    let errorMessage = error.message;
    
    // Check for permission issues
    if (error.response && error.response.status === 403) {
      errorMessage = "403 Forbidden: You don't have permission to publish this workspace. The elements have been successfully copied but you'll need to publish manually through the GTM interface.";
      console.error(errorMessage);
    } else if (error.message.includes("permission") || error.message.includes("Permission")) {
      errorMessage = "Insufficient permission to publish changes. The elements have been successfully copied but the workspace needs to be published manually.";
      console.error(errorMessage);
    }
    
    // Add instructions for manual publishing
    console.log("Manual publishing instructions: Navigate to the GTM interface, select the target container and workspace, and click the 'Submit' button to publish changes.");
    
    // Rethrow with enhanced message
    const enhancedError = new Error(errorMessage);
    enhancedError.originalError = error;
    throw enhancedError;
  }
};

/**
 * Copy template to target workspace with duplicate checking
 */
const copyTemplate = async (googleUserId, template, targetPath) => {
  try {
    const tagmanager = await getTagManagerClient(googleUserId);
    
    // First, check for existing template with same name
    const existingTemplatesResponse = await tagmanager.accounts.containers.workspaces.templates.list({
      parent: targetPath
    });
    
    const existingTemplates = existingTemplatesResponse.data.template || [];
    const existingTemplate = existingTemplates.find(t => t.name === template.name);
    
    // Make a clean copy of just essential fields to prevent ID conflicts
    const templateCopy = {
      name: template.name,
      templateData: template.templateData,
      galleryReference: template.galleryReference,
    };
    
    // Include other non-ID-related fields if they exist
    if (template.description) templateCopy.description = template.description;
    
    let response;
    
    if (existingTemplate) {
      // Update existing template
      console.log(`Template with name "${template.name}" already exists. Updating.`);
      // We need to include the fingerprint of the existing template for updates
      templateCopy.fingerprint = existingTemplate.fingerprint;
      
      response = await tagmanager.accounts.containers.workspaces.templates.update({
        path: `${targetPath}/templates/${existingTemplate.templateId}`,
        requestBody: templateCopy
      });
      console.log(`Updated template "${template.name}"`);
    } else {
      // Create a new template without any ID fields that might conflict
      response = await tagmanager.accounts.containers.workspaces.templates.create({
        parent: targetPath,
        requestBody: templateCopy
      });
      console.log(`Created new template "${template.name}"`);
    }
    
    return response.data;
  } catch (error) {
    console.error('Error copying template:', error);
    throw error;
  }
};

/**
 * Create a temporary workspace for copying elements
 * @param {string} googleUserId - Google user ID
 * @param {string} accountId - GTM account ID
 * @param {string} containerId - GTM container ID
 * @returns {Object} - Created workspace
 */
const createTempWorkspace = async (googleUserId, accountId, containerId) => {
  try {
    const tagmanager = await getTagManagerClient(googleUserId);
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const response = await tagmanager.accounts.containers.workspaces.create({
      parent: `accounts/${accountId}/containers/${containerId}`,
      requestBody: {
        name: `temp-copy-${timestamp}`,
        description: 'Temporary workspace for GTM Copy application'
      }
    });
    return response.data;
  } catch (error) {
    console.error('Error creating temporary workspace:', error);
    throw error;
  }
};

/**
 * Copy a trigger to a target workspace
 * @param {string} googleUserId - Google user ID
 * @param {Object} trigger - Trigger to copy
 * @param {string} targetPath - Target workspace path
 * @returns {Object} - Created or updated trigger
 */
const copyTrigger = async (googleUserId, trigger, targetPath) => {
  try {
    const tagmanager = await getTagManagerClient(googleUserId);
    
    // First, get all triggers in the target workspace to check for duplicates
    const existingTriggersResponse = await tagmanager.accounts.containers.workspaces.triggers.list({
      parent: targetPath
    });
    
    const existingTriggers = existingTriggersResponse.data.trigger || [];
    const existingTrigger = existingTriggers.find(t => t.name === trigger.name);
    
    // Create a clean copy with only the essential fields to avoid ID conflicts
    const triggerCopy = {
      name: trigger.name,
      type: trigger.type
    };
    
    // Include other important fields that don't have ID conflicts
    if (trigger.parameter) triggerCopy.parameter = trigger.parameter;
    if (trigger.filter) triggerCopy.filter = trigger.filter;
    if (trigger.autoEventFilter) triggerCopy.autoEventFilter = trigger.autoEventFilter;
    if (trigger.customEventFilter) triggerCopy.customEventFilter = trigger.customEventFilter;
    if (trigger.waitForTags) triggerCopy.waitForTags = trigger.waitForTags;
    if (trigger.checkValidation) triggerCopy.checkValidation = trigger.checkValidation;
    if (trigger.waitForTagsTimeout) triggerCopy.waitForTagsTimeout = trigger.waitForTagsTimeout;
    if (trigger.notes) triggerCopy.notes = trigger.notes;
    
    let response;
    
    if (existingTrigger) {
      // Trigger with this name already exists, update it instead
      console.log(`Trigger with name "${trigger.name}" already exists. Updating.`);
      
      // Keep the existing trigger's ID and fingerprint
      const triggerPath = `${targetPath}/triggers/${existingTrigger.triggerId}`;
      triggerCopy.fingerprint = existingTrigger.fingerprint;
      
      response = await tagmanager.accounts.containers.workspaces.triggers.update({
        path: triggerPath,
        requestBody: triggerCopy
      });
      console.log(`Updated trigger "${trigger.name}"`);
    } else {
      // Create a new trigger
      response = await tagmanager.accounts.containers.workspaces.triggers.create({
        parent: targetPath,
        requestBody: triggerCopy
      });
      console.log(`Created new trigger "${trigger.name}"`);
    }
    
    return response.data;
  } catch (error) {
    console.error('Error copying trigger:', error);
    throw error;
  }
};

/**
 * Copy a tag to a target workspace
 * @param {string} googleUserId - Google user ID
 * @param {Object} tag - Tag to copy
 * @param {string} targetPath - Target workspace path
 * @returns {Object} - Created or updated tag
 */
const copyTag = async (googleUserId, tag, targetPath) => {
  try {
    const tagmanager = await getTagManagerClient(googleUserId);
    
    // First, get all tags in the target workspace to check for duplicates
    const existingTagsResponse = await tagmanager.accounts.containers.workspaces.tags.list({
      parent: targetPath
    });
    
    const existingTags = existingTagsResponse.data.tag || [];
    const existingTag = existingTags.find(t => t.name === tag.name);
    
    // Create a clean copy with only the required fields to avoid ID conflicts
    const tagCopy = {
      name: tag.name,
      type: tag.type
    };
    
    // Include other important fields that don't have ID conflicts
    if (tag.parameter) tagCopy.parameter = tag.parameter;
    if (tag.firingRuleId) tagCopy.firingRuleId = tag.firingRuleId;
    if (tag.blockingRuleId) tagCopy.blockingRuleId = tag.blockingRuleId;
    if (tag.firingTriggerId) tagCopy.firingTriggerId = tag.firingTriggerId;
    if (tag.blockingTriggerId) tagCopy.blockingTriggerId = tag.blockingTriggerId;
    if (tag.tagFiringOption) tagCopy.tagFiringOption = tag.tagFiringOption;
    if (tag.scheduleStartMs) tagCopy.scheduleStartMs = tag.scheduleStartMs;
    if (tag.scheduleEndMs) tagCopy.scheduleEndMs = tag.scheduleEndMs;
    if (tag.notes) tagCopy.notes = tag.notes;
    if (tag.priority) tagCopy.priority = tag.priority;
    if (tag.paused) tagCopy.paused = tag.paused;
    
    let response;
    
    if (existingTag) {
      // Tag with this name already exists, update it instead
      console.log(`Tag with name "${tag.name}" already exists. Updating.`);
      
      // Keep the existing tag's ID and fingerprint
      const tagPath = `${targetPath}/tags/${existingTag.tagId}`;
      tagCopy.fingerprint = existingTag.fingerprint;
      
      response = await tagmanager.accounts.containers.workspaces.tags.update({
        path: tagPath,
        requestBody: tagCopy
      });
      console.log(`Updated tag "${tag.name}"`);
    } else {
      // Create a new tag
      response = await tagmanager.accounts.containers.workspaces.tags.create({
        parent: targetPath,
        requestBody: tagCopy
      });
      console.log(`Created new tag "${tag.name}"`);
    }
    
    return response.data;
  } catch (error) {
    console.error('Error copying tag:', error);
    throw error;
  }
};

/**
 * Copy a variable to a target workspace
 * @param {string} googleUserId - Google user ID
 * @param {Object} variable - Variable to copy
 * @param {string} targetPath - Target workspace path
 * @returns {Object} - Created or updated variable
 */
const copyVariable = async (googleUserId, variable, targetPath) => {
  try {
    const tagmanager = await getTagManagerClient(googleUserId);
    
    // First, get all variables in the target workspace to check for duplicates
    const existingVariablesResponse = await tagmanager.accounts.containers.workspaces.variables.list({
      parent: targetPath
    });
    
    const existingVariables = existingVariablesResponse.data.variable || [];
    const existingVariable = existingVariables.find(v => v.name === variable.name);
    
    // Create a clean copy with only the essential fields to avoid ID conflicts
    const variableCopy = {
      name: variable.name,
      type: variable.type
    };
    
    // Include other important fields that don't have ID conflicts
    if (variable.parameter) variableCopy.parameter = variable.parameter;
    if (variable.formatValue) variableCopy.formatValue = variable.formatValue;
    if (variable.enablingCondition) variableCopy.enablingCondition = variable.enablingCondition;
    if (variable.notes) variableCopy.notes = variable.notes;
    if (variable.parentFolderId) variableCopy.parentFolderId = variable.parentFolderId;
    if (variable.scheduleStartMs) variableCopy.scheduleStartMs = variable.scheduleStartMs;
    if (variable.scheduleEndMs) variableCopy.scheduleEndMs = variable.scheduleEndMs;
    
    let response;
    
    if (existingVariable) {
      // Variable with this name already exists, update it instead
      console.log(`Variable with name "${variable.name}" already exists. Updating.`);
      
      // Keep the existing variable's ID and fingerprint
      const variablePath = `${targetPath}/variables/${existingVariable.variableId}`;
      variableCopy.fingerprint = existingVariable.fingerprint;
      
      response = await tagmanager.accounts.containers.workspaces.variables.update({
        path: variablePath,
        requestBody: variableCopy
      });
      console.log(`Updated variable "${variable.name}"`);
    } else {
      // Create a new variable
      response = await tagmanager.accounts.containers.workspaces.variables.create({
        parent: targetPath,
        requestBody: variableCopy
      });
      console.log(`Created new variable "${variable.name}"`);
    }
    
    return response.data;
  } catch (error) {
    console.error('Error copying variable:', error);
    throw error;
  }
};

/**
 * Delete a workspace
 * @param {string} googleUserId - Google user ID
 * @param {string} accountId - GTM account ID
 * @param {string} containerId - GTM container ID
 * @param {string} workspaceId - GTM workspace ID
 */
const deleteWorkspace = async (googleUserId, accountId, containerId, workspaceId) => {
  try {
    const tagmanager = await getTagManagerClient(googleUserId);
    await tagmanager.accounts.containers.workspaces.delete({
      path: `accounts/${accountId}/containers/${containerId}/workspaces/${workspaceId}`
    });
    return true;
  } catch (error) {
    console.error('Error deleting workspace:', error);
    throw error;
  }
};

/**
 * Copy selected elements from one workspace to another and publish
 * @param {string} googleUserId - Google user ID
 * @param {Object} source - Source container and workspace
 * @param {Array} targets - Target containers
 * @param {Array} elementTypes - Types of elements to copy (templates, tags, triggers, variables)
 * @param {Object} selectedElements - Object containing arrays of selected element IDs by type
 * @returns {Object} - Copy results
 */
const copyElements = async (
  googleUserId, 
  source, 
  targets, 
  elementTypes,
  selectedElements = null
) => {
  const results = [];
  let sourceElements = [];
  
  console.log('Starting copy operation with the following parameters:');
  console.log('Source:', source);
  console.log('Targets:', targets);
  console.log('Element types:', elementTypes);
  console.log('Selected elements:', selectedElements);
  
  // Get elements from source workspace
  if (elementTypes.includes('templates')) {
    const templates = await getCustomTemplates(
      googleUserId, 
      source.accountId, 
      source.containerId, 
      source.workspaceId
    );
    
    // Filter templates if specific selections were provided
    let selectedTemplates = templates;
    if (selectedElements && selectedElements.templates && selectedElements.templates.length > 0) {
      selectedTemplates = templates.filter(template => 
        selectedElements.templates.includes(template.templateId));
    }
    
    sourceElements = [...sourceElements, ...selectedTemplates.map(el => ({ ...el, type: 'template' }))];
  }
  
  if (elementTypes.includes('tags')) {
    const tags = await getTags(
      googleUserId, 
      source.accountId, 
      source.containerId, 
      source.workspaceId
    );
    
    // Filter tags if specific selections were provided
    let selectedTags = tags;
    if (selectedElements && selectedElements.tags && selectedElements.tags.length > 0) {
      selectedTags = tags.filter(tag => 
        selectedElements.tags.includes(tag.tagId));
    }
    
    sourceElements = [...sourceElements, ...selectedTags.map(el => ({ ...el, elementType: 'tag' }))];
  }
  
  if (elementTypes.includes('triggers')) {
    const triggers = await getTriggers(
      googleUserId, 
      source.accountId, 
      source.containerId, 
      source.workspaceId
    );
    
    // Filter triggers if specific selections were provided
    let selectedTriggers = triggers;
    if (selectedElements && selectedElements.triggers && selectedElements.triggers.length > 0) {
      selectedTriggers = triggers.filter(trigger => 
        selectedElements.triggers.includes(trigger.triggerId));
    }
    
    sourceElements = [...sourceElements, ...selectedTriggers.map(el => ({ ...el, elementType: 'trigger' }))];
  }
  
  if (elementTypes.includes('variables')) {
    const variables = await getVariables(
      googleUserId, 
      source.accountId, 
      source.containerId, 
      source.workspaceId
    );
    
    // Filter variables if specific selections were provided
    let selectedVariables = variables;
    if (selectedElements && selectedElements.variables && selectedElements.variables.length > 0) {
      selectedVariables = variables.filter(variable => 
        selectedElements.variables.includes(variable.variableId));
    }
    
    sourceElements = [...sourceElements, ...selectedVariables.map(el => ({ ...el, elementType: 'variable' }))];
  }

  console.log(`Total elements to copy: ${sourceElements.length}`);

  // Process each target container
  for (const target of targets) {
    try {
      console.log(`Starting copy to target container: ${target.containerId}`);
      
      // Create temporary workspace in target container
      const tempWorkspace = await createTempWorkspace(
        googleUserId, 
        target.accountId, 
        target.containerId
      );
      
      const targetPath = `accounts/${target.accountId}/containers/${target.containerId}/workspaces/${tempWorkspace.workspaceId}`;
      const copiedElements = [];
      let errors = [];

      // Sort elements to copy in the right dependency order:
      // 1. templates (needed by tags, triggers, and variables)
      // 2. variables (may be needed by triggers and tags)
      // 3. triggers (needed by tags)
      // 4. tags (dependent on the above)
      const orderedElements = [
        ...sourceElements.filter(el => el.elementType === 'template'),
        ...sourceElements.filter(el => el.elementType === 'variable'),
        ...sourceElements.filter(el => el.elementType === 'trigger'),
        ...sourceElements.filter(el => el.elementType === 'tag')
      ];

      console.log(`Copying elements in dependency order. Total elements: ${orderedElements.length}`);
      
      // Copy elements
      for (const element of orderedElements) {
        try {
          console.log(`Copying ${element.elementType}: ${element.name}`);
          let result;
          
          // Update or create elements based on their type
          if (element.elementType === 'template') {
            result = await copyTemplate(googleUserId, element, targetPath);
          } else if (element.elementType === 'tag') {
            result = await copyTag(googleUserId, element, targetPath);
          } else if (element.elementType === 'trigger') {
            result = await copyTrigger(googleUserId, element, targetPath);
          } else if (element.elementType === 'variable') {
            result = await copyVariable(googleUserId, element, targetPath);
          }
          
          if (result) {
            copiedElements.push({
              type: element.elementType,
              name: element.name,
              status: 'success'
            });
          }
        } catch (error) {
          console.error(`Error copying ${element.elementType} ${element.name}:`, error);
          
          // Provide clearer error messages for common issues
          let errorMessage = error.message;
          if (error.message.includes("duplicate")) {
            errorMessage = "Found entity with duplicate name. Skipping.";
          } else if (error.message.includes("Unknown entity type")) {
            errorMessage = "Missing template dependency. Ensure all required templates are selected.";
          } else if (error.message.includes("unknown trigger")) {
            errorMessage = "Missing trigger dependency. Ensure all required triggers are selected.";
          }
          
          errors.push({
            type: element.elementType,
            name: element.name,
            error: errorMessage
          });
        }
      }

      // Determine if copying succeeded overall
      const copySucceeded = copiedElements.length > 0;
      
      // Try to publish changes only if copying succeeded, but make it optional
      let publishResult = null;
      if (copySucceeded) {
        try {
          console.log("Attempting to publish workspace changes...");
          console.log(`Publishing path: accounts/${target.accountId}/containers/${target.containerId}/workspaces/${tempWorkspace.workspaceId}`);
          
          publishResult = await publishWorkspace(
            googleUserId, 
            target.accountId, 
            target.containerId, 
            tempWorkspace.workspaceId
          );
          console.log("Publish success:", !!publishResult);
        } catch (error) {
          console.error('Error publishing changes:', error);
          
          // Provide a clearer error message for permission issues
          let errorMessage = error.message;
          if (error.response && error.response.status === 403) {
            errorMessage = "403 Forbidden: You don't have permission to publish this workspace. This typically means you have 'Edit' access but not 'Publish' access to this container. The elements were copied but you'll need to publish manually through the GTM interface.";
          } else if (error.message.includes("permission") || error.message.includes("Permission")) {
            errorMessage = "Insufficient permission to publish changes. You may need to re-authenticate with expanded permissions. The elements were copied but not published.";
          }
          
          errors.push({
            type: 'publish',
            error: errorMessage
          });
        }
      } else {
        console.log("Skipping publish step as no elements were copied successfully");
      }

      // Record the operation as successful if elements were copied, even if publishing failed
      const operationStatus = copySucceeded ? (errors.length > 0 ? 'partial' : 'success') : 'failed';
      
      // Skip cleanup if publishing was successful - publishing a workspace automatically deletes it
      if (!publishResult) {
        console.log("Publication didn't succeed. Checking if we need to clean up the temporary workspace...");
        
        try {
          console.log("Cleaning up temporary workspace...");
          await deleteWorkspace(
            googleUserId, 
            target.accountId, 
            target.containerId, 
            tempWorkspace.workspaceId
          );
          console.log("Workspace cleaned up successfully");
        } catch (deleteError) {
          console.error('Error deleting workspace:', deleteError);
          
          // Provide a clearer error message for permission issues
          let errorMessage = deleteError.message;
          if (deleteError.response && deleteError.response.status === 403) {
            errorMessage = "403 Forbidden: You don't have permission to delete this workspace. This workspace will need to be deleted manually through the GTM interface. URL path: " + 
              `https://tagmanager.google.com/#/container/${target.containerId}/workspaces`;
          } else if (deleteError.message.includes("permission") || deleteError.message.includes("Permission")) {
            errorMessage = "Insufficient permission to delete temporary workspace. You may need to re-authenticate with expanded permissions. The workspace will need to be cleaned up manually in the Google Tag Manager interface.";
          }
          
          // Add to warnings but don't let it affect the operation status
          errors.push({
            type: 'cleanup',
            error: errorMessage
          });
        }
      } else {
        console.log("Publication was successful. Workspace was automatically deleted by GTM.");
      }

      // Save copy history to local storage
      addCopyHistory(googleUserId, {
        sourceAccount: source.accountId,
        sourceContainer: source.containerId,
        sourceWorkspace: source.workspaceId,
        destContainer: target.containerId,
        elementTypes: elementTypes,
        elementCount: copiedElements.length,
        status: operationStatus,
        message: errors.length > 0 ? errors : null
      });

      // Add result for this target
      results.push({
        targetContainer: {
          accountId: target.accountId,
          containerId: target.containerId
        },
        workspace: tempWorkspace,
        published: publishResult !== null,
        elements: {
          total: sourceElements.length,
          copied: copiedElements.length,
          failed: errors.length
        },
        errors: errors.length > 0 ? errors : null
      });
    } catch (error) {
      console.error('Error processing target container:', error);
      results.push({
        targetContainer: {
          accountId: target.accountId,
          containerId: target.containerId
        },
        error: error.message,
        status: 'failed'
      });

      // Save failed history to local storage
      addCopyHistory(googleUserId, {
        sourceAccount: source.accountId,
        sourceContainer: source.containerId,
        sourceWorkspace: source.workspaceId,
        destContainer: target.containerId,
        elementTypes: elementTypes,
        elementCount: 0,
        status: 'failed',
        message: [{ type: 'error', error: error.message }]
      });
    }
  }

  return {
    source: {
      accountId: source.accountId,
      containerId: source.containerId,
      workspaceId: source.workspaceId
    },
    elementTypes,
    targets: results
  };
};

export {
  getAccounts,
  getContainers,
  getWorkspaces,
  getCustomTemplates,
  getTags,
  getTriggers,
  getVariables,
  copyElements,
  getHistory as getCopyHistory,
  getDetails as getCopyDetails,
  publishWorkspace
};
