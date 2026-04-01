import { google } from 'googleapis';
import * as googleAuth from './googleAuth.js';
import { getCopyHistory, addCopyHistory, getCopyDetail } from './storageService.js';
import rateLimiter from './rateLimiter.js';

/**
 * Simple cache for templates to avoid redundant API calls
 */
const templateCache = new Map();
const CACHE_EXPIRY = 5 * 60 * 1000; // 5 minutes

const getCacheKey = (accountId, containerId, workspaceId) => {
  return `${accountId}_${containerId}_${workspaceId}`;
};

const isCacheValid = (cacheEntry) => {
  return cacheEntry && (Date.now() - cacheEntry.timestamp) < CACHE_EXPIRY;
};

const invalidateTemplateCache = (accountId, containerId, workspaceId) => {
  const cacheKey = getCacheKey(accountId, containerId, workspaceId);
  templateCache.delete(cacheKey);
  console.log(`Invalidated template cache for container ${containerId}`);
};

/**
 * Template mapping utility functions
 */

/**
 * Check if a type is a custom template type
 * @param {string} type - Element type to check
 * @returns {boolean} - True if it's a custom template type
 */
const isCustomTemplateType = (type) => {
  return type && type.startsWith('cvt_');
};

/**
 * Extract template ID from a custom template type
 * @param {string} cvtType - Type like "cvt_204700869_8"
 * @returns {string|null} - Template ID like "8" or null if not a cvt type
 */
const getTemplateIdFromType = (cvtType) => {
  if (!isCustomTemplateType(cvtType)) return null;
  const parts = cvtType.split('_');
  return parts.length >= 3 ? parts[2] : null;
};

/**
 * Get template name from template ID using a template list
 * @param {string} templateId - Template ID
 * @param {Array} templateList - List of templates with templateId and name
 * @returns {string|null} - Template name or null if not found
 */
const getTemplateNameFromId = (templateId, templateList) => {
  const template = templateList.find(t => t.templateId === templateId);
  return template ? template.name : null;
};

/**
 * Build template mapping from source templates to destination templates
 * @param {Array} sourceTemplates - Source templates
 * @param {Array} destTemplates - Destination templates  
 * @returns {Object} - Map of template name to destination template ID
 */
const buildTemplateMap = (sourceTemplates, destTemplates) => {
  const templateMap = {};
  
  sourceTemplates.forEach(sourceTemplate => {
    const destTemplate = destTemplates.find(dest => dest.name === sourceTemplate.name);
    if (destTemplate) {
      templateMap[sourceTemplate.name] = destTemplate.templateId;
    }
  });
  
  return templateMap;
};

/**
 * Map a custom template type from source to destination
 * @param {string} oldType - Original type like "cvt_204700869_8"
 * @param {Object} templateMap - Map of template name to new template ID
 * @param {Array} sourceTemplates - Source templates for name lookup
 * @param {string} containerId - Destination container ID
 * @returns {string} - Mapped type like "cvt_204699265_12" or original type
 */
const mapTemplateType = (oldType, templateMap, sourceTemplates, containerId) => {
  if (!isCustomTemplateType(oldType)) return oldType;
  
  const templateId = getTemplateIdFromType(oldType);
  if (!templateId) return oldType;
  
  const templateName = getTemplateNameFromId(templateId, sourceTemplates);
  if (!templateName) return oldType;
  
  const newTemplateId = templateMap[templateName];
  if (!newTemplateId) {
    throw new Error(`Template "${templateName}" not found in destination container. Please include this template in your copy operation.`);
  }
  
  return `cvt_${containerId}_${newTemplateId}`;
};

/**
 * Detect template dependencies in a list of elements
 * @param {Array} elements - List of elements to analyze
 * @param {Array} sourceTemplates - Source templates for name lookup
 * @returns {Array} - List of required template names
 */
const detectTemplateDependencies = (elements, sourceTemplates) => {
  const requiredTemplates = new Set();
  
  elements.forEach(element => {
    if (isCustomTemplateType(element.type)) {
      const templateId = getTemplateIdFromType(element.type);
      const templateName = getTemplateNameFromId(templateId, sourceTemplates);
      if (templateName) {
        requiredTemplates.add(templateName);
      }
    }
  });
  
  return Array.from(requiredTemplates);
};

/**
 * Trigger mapping utility functions
 */

/**
 * Build trigger mapping from source triggers to destination triggers
 * @param {Array} sourceTriggers - Source triggers
 * @param {Array} destTriggers - Destination triggers  
 * @returns {Object} - Map of trigger name to destination trigger ID
 */
const buildTriggerMap = (sourceTriggers, destTriggers) => {
  const triggerMap = {};
  
  sourceTriggers.forEach(sourceTrigger => {
    const destTrigger = destTriggers.find(dest => dest.name === sourceTrigger.name);
    if (destTrigger) {
      triggerMap[sourceTrigger.name] = destTrigger.triggerId;
    }
  });
  
  return triggerMap;
};

/**
 * Build tag mapping from source tags to destination tags
 * @param {Array} sourceTags - Source tags
 * @param {Array} destTags - Destination tags  
 * @returns {Object} - Map of tag name to destination tag ID
 */
const buildTagMap = (sourceTags, destTags) => {
  const tagMap = {};
  
  sourceTags.forEach(sourceTag => {
    const destTag = destTags.find(dest => dest.name === sourceTag.name);
    if (destTag) {
      tagMap[sourceTag.name] = destTag.tagId;
    }
  });
  
  return tagMap;
};

/**
 * Get trigger name from trigger ID using a trigger list
 * @param {string} triggerId - Trigger ID
 * @param {Array} triggerList - List of triggers with triggerId and name
 * @returns {string|null} - Trigger name or null if not found
 */
const getTriggerNameFromId = (triggerId, triggerList) => {
  const trigger = triggerList.find(t => t.triggerId == triggerId); // Use == instead of === for type coercion
  return trigger ? trigger.name : null;
};

/**
 * Map a trigger ID from source to destination
 * @param {string} oldTriggerId - Original trigger ID
 * @param {Object} triggerMap - Map of trigger name to new trigger ID
 * @param {Array} sourceTriggers - Source triggers for name lookup
 * @returns {string|null} - Mapped trigger ID or null if not found
 */
const mapTriggerId = (oldTriggerId, triggerMap, sourceTriggers) => {
  if (!oldTriggerId) return null;
  
  const triggerName = getTriggerNameFromId(oldTriggerId, sourceTriggers);
  if (!triggerName) {
    console.warn(`Trigger with ID ${oldTriggerId} not found in source triggers`);
    return null;
  }
  
  const newTriggerId = triggerMap[triggerName];
  if (!newTriggerId) {
    console.warn(`Trigger "${triggerName}" not found in destination container`);
    return null;
  }
  
  return newTriggerId;
};

/**
 * Map trigger references in a tag object
 * @param {Object} tagCopy - Tag object to modify
 * @param {Object} triggerMap - Map of trigger name to destination trigger ID
 * @param {Array} sourceTriggers - Source triggers for name lookup
 */
const mapTriggerReferences = (tagCopy, triggerMap, sourceTriggers) => {
  // Map enabling triggers
  if (tagCopy.enablingTriggerId && Array.isArray(tagCopy.enablingTriggerId)) {
    tagCopy.enablingTriggerId = tagCopy.enablingTriggerId.map(triggerId => {
      const mappedId = mapTriggerId(triggerId, triggerMap, sourceTriggers);
      if (mappedId) {
        const triggerName = getTriggerNameFromId(triggerId, sourceTriggers);
        console.log(`Mapped enabling trigger "${triggerName}" from ${triggerId} to ${mappedId}`);
        return mappedId;
      }
      return null; // Will be filtered out
    }).filter(id => id !== null);
  }
  
  // Map disabling triggers
  if (tagCopy.disablingTriggerId && Array.isArray(tagCopy.disablingTriggerId)) {
    tagCopy.disablingTriggerId = tagCopy.disablingTriggerId.map(triggerId => {
      const mappedId = mapTriggerId(triggerId, triggerMap, sourceTriggers);
      if (mappedId) {
        const triggerName = getTriggerNameFromId(triggerId, sourceTriggers);
        console.log(`Mapped disabling trigger "${triggerName}" from ${triggerId} to ${mappedId}`);
        return mappedId;
      }
      return null; // Will be filtered out
    }).filter(id => id !== null);
  }
  
  // Map legacy firing triggers (single ID)
  if (tagCopy.firingTriggerId) {
    const mappedId = mapTriggerId(tagCopy.firingTriggerId, triggerMap, sourceTriggers);
    if (mappedId) {
      const triggerName = getTriggerNameFromId(tagCopy.firingTriggerId, sourceTriggers);
      console.log(`Mapped firing trigger "${triggerName}" from ${tagCopy.firingTriggerId} to ${mappedId}`);
      tagCopy.firingTriggerId = mappedId;
    } else {
      delete tagCopy.firingTriggerId; // Remove invalid reference
    }
  }
  
  // Map legacy blocking triggers (single ID)
  if (tagCopy.blockingTriggerId) {
    const mappedId = mapTriggerId(tagCopy.blockingTriggerId, triggerMap, sourceTriggers);
    if (mappedId) {
      const triggerName = getTriggerNameFromId(tagCopy.blockingTriggerId, sourceTriggers);
      console.log(`Mapped blocking trigger "${triggerName}" from ${tagCopy.blockingTriggerId} to ${mappedId}`);
      tagCopy.blockingTriggerId = mappedId;
    } else {
      delete tagCopy.blockingTriggerId; // Remove invalid reference
    }
  }
};

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
 * Make a rate-limited GTM API request
 * @param {Function} requestFunction - Function that makes the API request
 * @param {string} description - Description of the request for logging
 * @returns {Promise} - Promise that resolves with the request result
 */
const makeRateLimitedRequest = async (requestFunction, description) => {
  return await rateLimiter.enqueue(requestFunction, description);
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
 * Get workspace status (changes vs published version)
 * @param {string} googleUserId
 * @param {string} accountId
 * @param {string} containerId
 * @param {string} workspaceId
 * @returns {Object} - Normalized map: { tags: { id: changeType }, ... }
 */
const getWorkspaceStatus = async (googleUserId, accountId, containerId, workspaceId) => {
  try {
    const tagmanager = await getTagManagerClient(googleUserId);
    const response = await makeRateLimitedRequest(
      () => tagmanager.accounts.containers.workspaces.getStatus({
        path: `accounts/${accountId}/containers/${containerId}/workspaces/${workspaceId}`
      }),
      `Get status for workspace ${workspaceId}`
    );

    const changes = response.data.workspaceChange || [];
    const result = {
      tags: {},
      triggers: {},
      variables: {},
      templates: {},
      clients: {},
      transformations: {}
    };

    const typeMap = {
      tag:            { key: 'tags',            idField: 'tagId' },
      trigger:        { key: 'triggers',         idField: 'triggerId' },
      variable:       { key: 'variables',        idField: 'variableId' },
      customTemplate: { key: 'templates',        idField: 'templateId' },
      client:         { key: 'clients',          idField: 'clientId' },
      transformation: { key: 'transformations',  idField: 'transformationId' }
    };

    for (const change of changes) {
      for (const [apiKey, { key, idField }] of Object.entries(typeMap)) {
        if (change[apiKey]) {
          const id = change[apiKey][idField];
          if (id) result[key][id] = change.changeType;
          break;
        }
      }
    }

    return result;
  } catch (error) {
    console.error('Error fetching workspace status:', error);
    throw error;
  }
};

/**
 * Find an element by name in a workspace and delete it.
 * Returns null silently if the element is not found.
 * @param {Object} tagmanager - authenticated tagmanager client
 * @param {string} targetPath - e.g. "accounts/X/containers/Y/workspaces/Z"
 * @param {string} elementType - one of: tags, triggers, variables, templates, clients, transformations
 * @param {string} elementName - exact element name (case-sensitive)
 * @returns {Object|null}
 */
const deleteElementFromWorkspace = async (tagmanager, targetPath, elementType, elementName) => {
  const typeConfig = {
    tags:            { listKey: 'tag',            idField: 'tagId',            resource: tagmanager.accounts.containers.workspaces.tags },
    triggers:        { listKey: 'trigger',        idField: 'triggerId',        resource: tagmanager.accounts.containers.workspaces.triggers },
    variables:       { listKey: 'variable',       idField: 'variableId',       resource: tagmanager.accounts.containers.workspaces.variables },
    templates:       { listKey: 'template',       idField: 'templateId',       resource: tagmanager.accounts.containers.workspaces.templates },
    clients:         { listKey: 'client',         idField: 'clientId',         resource: tagmanager.accounts.containers.workspaces.clients },
    transformations: { listKey: 'transformation', idField: 'transformationId', resource: tagmanager.accounts.containers.workspaces.transformations },
  };

  const config = typeConfig[elementType];
  if (!config) return null;

  const listResponse = await makeRateLimitedRequest(
    () => config.resource.list({ parent: targetPath }),
    `List ${elementType} for deletion`
  );
  const elements = listResponse.data[config.listKey] || [];
  const match = elements.find(el => el.name === elementName);
  if (!match) return null;

  await makeRateLimitedRequest(
    () => config.resource.delete({ path: match.path }),
    `Delete ${elementType} "${elementName}"`
  );

  return { type: elementType, name: elementName, status: 'deleted' };
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
    // Check cache first
    const cacheKey = getCacheKey(accountId, containerId, workspaceId);
    const cachedEntry = templateCache.get(cacheKey);
    
    if (isCacheValid(cachedEntry)) {
      console.log(`Using cached templates for container ${containerId}`);
      return cachedEntry.data;
    }
    
    // Cache miss or expired, fetch from API
    const tagmanager = await getTagManagerClient(googleUserId);
    const response = await makeRateLimitedRequest(
      () => tagmanager.accounts.containers.workspaces.templates.list({
        parent: `accounts/${accountId}/containers/${containerId}/workspaces/${workspaceId}`
      }),
      `Get templates for container ${containerId}`
    );
    
    const templates = response.data.template || [];
    
    // Cache the result
    templateCache.set(cacheKey, {
      data: templates,
      timestamp: Date.now()
    });
    
    return templates;
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
    const response = await makeRateLimitedRequest(
      () => tagmanager.accounts.containers.workspaces.tags.list({
        parent: `accounts/${accountId}/containers/${containerId}/workspaces/${workspaceId}`
      }),
      `Get tags for container ${containerId}`
    );
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
    const response = await makeRateLimitedRequest(
      () => tagmanager.accounts.containers.workspaces.triggers.list({
        parent: `accounts/${accountId}/containers/${containerId}/workspaces/${workspaceId}`
      }),
      `Get triggers for container ${containerId}`
    );
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
    const response = await makeRateLimitedRequest(
      () => tagmanager.accounts.containers.workspaces.variables.list({
        parent: `accounts/${accountId}/containers/${containerId}/workspaces/${workspaceId}`
      }),
      `Get variables for container ${containerId}`
    );
    return response.data.variable || [];
  } catch (error) {
    console.error('Error fetching variables:', error);
    throw error;
  }
};

/**
 * Get all clients in a workspace (server-side containers only)
 * @param {string} googleUserId - Google user ID
 * @param {string} accountId - GTM account ID
 * @param {string} containerId - GTM container ID
 * @param {string} workspaceId - GTM workspace ID
 * @returns {Array} - List of clients
 */
const getClients = async (googleUserId, accountId, containerId, workspaceId) => {
  try {
    const tagmanager = await getTagManagerClient(googleUserId);
    const response = await makeRateLimitedRequest(
      () => tagmanager.accounts.containers.workspaces.clients.list({
        parent: `accounts/${accountId}/containers/${containerId}/workspaces/${workspaceId}`
      }),
      `Get clients for container ${containerId}`
    );
    return response.data.client || [];
  } catch (error) {
    // Clients are only available in server-side containers; silently return empty for web containers
    if (error.code === 400 || (error.response && error.response.status === 400)) {
      console.log(`Clients not available for container ${containerId} (likely a web container)`);
      return [];
    }
    console.error('Error fetching clients:', error);
    throw error;
  }
};

/**
 * Get all transformations in a workspace
 * @param {string} googleUserId - Google user ID
 * @param {string} accountId - GTM account ID
 * @param {string} containerId - GTM container ID
 * @param {string} workspaceId - GTM workspace ID
 * @returns {Array} - List of transformations
 */
const getTransformations = async (googleUserId, accountId, containerId, workspaceId) => {
  try {
    const tagmanager = await getTagManagerClient(googleUserId);
    const response = await makeRateLimitedRequest(
      () => tagmanager.accounts.containers.workspaces.transformations.list({
        parent: `accounts/${accountId}/containers/${containerId}/workspaces/${workspaceId}`
      }),
      `Get transformations for container ${containerId}`
    );
    return response.data.transformation || [];
  } catch (error) {
    console.error('Error fetching transformations:', error);
    throw error;
  }
};

/**
 * Map tag and template references in transformation parameters
 * @param {Array} parameters - Transformation parameters
 * @param {Object} tagMap - Map of tag names to destination tag IDs
 * @param {Array} sourceTags - Source tags for name lookup
 * @param {Object} templateMap - Map of template names to destination template IDs
 * @param {Array} sourceTemplates - Source templates for name lookup
 * @param {string} containerId - Destination container ID
 * @returns {Array} - Updated parameters with mapped references
 */
const mapTransformationTagReferences = (parameters, tagMap, sourceTags, templateMap = {}, sourceTemplates = [], containerId = null) => {
  if (!parameters || !Array.isArray(parameters)) {
    return parameters;
  }

  return parameters.map(param => {
    const updatedParam = { ...param };
    
    // Map affectedTagTypes parameter (contains CVT references)
    if (param.key === 'affectedTagTypes' && param.list && param.list.length > 0) {
      updatedParam.list = param.list.map(listItem => {
        if (listItem.type === 'map' && listItem.map) {
          const updatedMap = listItem.map.map(mapItem => {
            // Map CVT template references in tagType
            if (mapItem.key === 'tagType' && mapItem.value && isCustomTemplateType(mapItem.value)) {
              try {
                const mappedType = mapTemplateType(mapItem.value, templateMap, sourceTemplates, containerId);
                console.log(`Mapped transformation tagType from ${mapItem.value} to ${mappedType}`);
                return {
                  ...mapItem,
                  value: mappedType
                };
              } catch (error) {
                console.error(`Error mapping transformation tagType ${mapItem.value}:`, error);
                return mapItem;
              }
            }
            return mapItem;
          });
          
          return {
            ...listItem,
            map: updatedMap
          };
        }
        return listItem;
      });
    }
    
    // Map affectedTags parameter (might contain tag references)
    if (param.key === 'affectedTags' && param.list && param.list.length > 0) {
      updatedParam.list = param.list.map(listItem => {
        if (listItem.type === 'tag_reference' && listItem.value) {
          // For tag_reference, the value is the tag name, no mapping needed
          // Names should be the same between source and destination
          console.log(`Preserving tag reference: ${listItem.value}`);
          return listItem;
        }
        return listItem;
      });
    }
    
    return updatedParam;
  });
};

/**
 * Copy a transformation to a target workspace
 * @param {string} googleUserId - Google user ID
 * @param {Object} transformation - Transformation to copy
 * @param {string} targetPath - Target workspace path
 * @param {Object} tagMap - Map of tag names to destination tag IDs
 * @param {Array} sourceTags - Source tags for name lookup
 * @param {Object} templateMap - Map of template names to destination template IDs
 * @param {Array} sourceTemplates - Source templates for name lookup
 * @param {string} containerId - Destination container ID
 * @returns {Object} - Created or updated transformation
 */
const copyTransformation = async (googleUserId, transformation, targetPath, tagMap = {}, sourceTags = [], templateMap = {}, sourceTemplates = [], containerId = null) => {
  try {
    const tagmanager = await getTagManagerClient(googleUserId);
    
    // First, get all transformations in the target workspace to check for duplicates
    const existingTransformationsResponse = await tagmanager.accounts.containers.workspaces.transformations.list({
      parent: targetPath
    });
    
    const existingTransformations = existingTransformationsResponse.data.transformation || [];
    const existingTransformation = existingTransformations.find(t => t.name === transformation.name);
    
    // Create a clean copy with only the essential fields to avoid ID conflicts
    const transformationCopy = {
      name: transformation.name,
      type: transformation.type
    };
    
    // Include other important fields that don't have ID conflicts
    if (transformation.parameter) {
      // Map tag and template references in parameters before copying
      transformationCopy.parameter = mapTransformationTagReferences(
        transformation.parameter, 
        tagMap, 
        sourceTags,
        templateMap,
        sourceTemplates,
        containerId
      );
    }
    if (transformation.notes) transformationCopy.notes = transformation.notes;
    if (transformation.parentFolderId) transformationCopy.parentFolderId = transformation.parentFolderId;
    
    let response;
    
    if (existingTransformation) {
      // Transformation with this name already exists, update it instead
      console.log(`Transformation with name "${transformation.name}" already exists. Updating.`);
      
      // Keep the existing transformation's ID and fingerprint
      const transformationPath = `${targetPath}/transformations/${existingTransformation.transformationId}`;
      transformationCopy.fingerprint = existingTransformation.fingerprint;
      
      response = await makeRateLimitedRequest(
        () => tagmanager.accounts.containers.workspaces.transformations.update({
          path: transformationPath,
          requestBody: transformationCopy
        }),
        `Update transformation "${transformation.name}"`
      );
      console.log(`Updated transformation "${transformation.name}"`);
    } else {
      // Create a new transformation
      response = await makeRateLimitedRequest(
        () => tagmanager.accounts.containers.workspaces.transformations.create({
          parent: targetPath,
          requestBody: transformationCopy
        }),
        `Create transformation "${transformation.name}"`
      );
      console.log(`Created new transformation "${transformation.name}"`);
    }
    
    return response.data;
  } catch (error) {
    console.error('Error copying transformation:', error);
    throw error;
  }
};

/**
 * Copy a client to a target workspace (server-side containers only)
 * @param {string} googleUserId - Google user ID
 * @param {Object} client - Client to copy
 * @param {string} targetPath - Target workspace path
 * @param {Object} templateMap - Map of template names to destination template IDs
 * @param {Array} sourceTemplates - Source templates for name lookup
 * @param {string} containerId - Destination container ID
 * @returns {Object} - Created or updated client
 */
const copyClient = async (googleUserId, client, targetPath, templateMap = {}, sourceTemplates = [], containerId = null) => {
  try {
    const tagmanager = await getTagManagerClient(googleUserId);

    // Get existing clients in the target workspace to check for duplicates
    const existingClientsResponse = await makeRateLimitedRequest(
      () => tagmanager.accounts.containers.workspaces.clients.list({
        parent: targetPath
      }),
      `List clients in ${targetPath}`
    );

    const existingClients = existingClientsResponse.data.client || [];
    const existingClient = existingClients.find(c => c.name === client.name);

    // Map template type if the client uses a custom template type
    let mappedType = client.type;
    if (isCustomTemplateType(client.type) && templateMap && sourceTemplates && containerId) {
      try {
        mappedType = mapTemplateType(client.type, templateMap, sourceTemplates, containerId);
        console.log(`Mapped client type from ${client.type} to ${mappedType}`);
      } catch (error) {
        console.error(`Error mapping template type for client ${client.name}:`, error);
        throw error;
      }
    }

    // Create a clean copy with only the essential fields to avoid ID conflicts
    const clientCopy = {
      name: client.name,
      type: mappedType
    };

    if (client.parameter) clientCopy.parameter = client.parameter;
    if (client.priority) clientCopy.priority = client.priority;
    if (client.notes) clientCopy.notes = client.notes;
    if (client.parentFolderId) clientCopy.parentFolderId = client.parentFolderId;

    let response;

    if (existingClient) {
      console.log(`Client with name "${client.name}" already exists. Updating.`);
      const clientPath = `${targetPath}/clients/${existingClient.clientId}`;
      clientCopy.fingerprint = existingClient.fingerprint;

      response = await makeRateLimitedRequest(
        () => tagmanager.accounts.containers.workspaces.clients.update({
          path: clientPath,
          requestBody: clientCopy
        }),
        `Update client "${client.name}"`
      );
      console.log(`Updated client "${client.name}"`);
    } else {
      response = await makeRateLimitedRequest(
        () => tagmanager.accounts.containers.workspaces.clients.create({
          parent: targetPath,
          requestBody: clientCopy
        }),
        `Create client "${client.name}"`
      );
      console.log(`Created new client "${client.name}"`);
    }

    return response.data;
  } catch (error) {
    console.error('Error copying client:', error);
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
    
    // Step 1: Create a version from the workspace
    const versionResponse = await makeRateLimitedRequest(
      () => tagmanager.accounts.containers.workspaces.create_version({
        path: `accounts/${accountId}/containers/${containerId}/workspaces/${workspaceId}`,
        requestBody: {
          name: `GTM Copy Publish ${new Date().toISOString()}`,
          notes: 'Published by GTM Copy application'
        }
      }),
      `Create version in container ${containerId}`
    );
    
    console.log('Version created successfully:', {
      versionId: versionResponse.data?.containerVersion?.containerVersionId,
      name: versionResponse.data?.containerVersion?.name,
      compilerError: versionResponse.data?.compilerError
    });
    
    // Check for compiler errors
    if (versionResponse.data?.compilerError) {
      console.error('Version creation failed due to compiler errors');
      console.error('This usually means missing dependencies (variables, triggers, templates, etc.)');
      console.error('The version was created but contains compilation errors and cannot be published to production.');
      
      const error = new Error('Version creation failed due to compiler errors');
      error.compilerError = true;
      error.responseData = versionResponse.data;
      throw error;
    }
    
    // Step 2: Publish the created version to production
    const versionId = versionResponse.data?.containerVersion?.containerVersionId;
    if (!versionId) {
      throw new Error('No version ID returned from create_version');
    }
    
    console.log(`Publishing version ${versionId} to production...`);
    const publishResponse = await makeRateLimitedRequest(
      () => tagmanager.accounts.containers.versions.publish({
        path: `accounts/${accountId}/containers/${containerId}/versions/${versionId}`
      }),
      `Publish version ${versionId} to production`
    );
    
    console.log('Version published to production successfully');
    
    // Return both responses for full information
    return {
      version: versionResponse.data,
      publish: publishResponse.data,
      published: true
    };
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
      
      response = await makeRateLimitedRequest(
        () => tagmanager.accounts.containers.workspaces.templates.update({
          path: `${targetPath}/templates/${existingTemplate.templateId}`,
          requestBody: templateCopy
        }),
        `Update template "${template.name}"`
      );
      console.log(`Updated template "${template.name}"`);
    } else {
      // Create a new template without any ID fields that might conflict
      response = await makeRateLimitedRequest(
        () => tagmanager.accounts.containers.workspaces.templates.create({
          parent: targetPath,
          requestBody: templateCopy
        }),
        `Create template "${template.name}"`
      );
      console.log(`Created new template "${template.name}"`);
    }
    
    // Invalidate template cache since we've modified templates
    const pathParts = targetPath.split('/');
    if (pathParts.length >= 6) {
      const accountId = pathParts[1];
      const containerId = pathParts[3];
      const workspaceId = pathParts[5];
      invalidateTemplateCache(accountId, containerId, workspaceId);
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
    const response = await makeRateLimitedRequest(
      () => tagmanager.accounts.containers.workspaces.create({
        parent: `accounts/${accountId}/containers/${containerId}`,
        requestBody: {
          name: `temp-copy-${timestamp}`,
          description: 'Temporary workspace for GTM Copy application'
        }
      }),
      `Create temp workspace in container ${containerId}`
    );
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
 * @param {Object} templateMap - Map of template names to destination template IDs
 * @param {Array} sourceTemplates - Source templates for name lookup
 * @param {string} containerId - Destination container ID
 * @param {Object} triggerMap - Map of trigger names to destination trigger IDs
 * @param {Array} sourceTriggers - Source triggers for name lookup
 * @returns {Object} - Created or updated tag
 */
const copyTag = async (googleUserId, tag, targetPath, templateMap = {}, sourceTemplates = [], containerId = null, triggerMap = {}, sourceTriggers = []) => {
  try {
    const tagmanager = await getTagManagerClient(googleUserId);
    
    // First, get all tags in the target workspace to check for duplicates
    const existingTagsResponse = await tagmanager.accounts.containers.workspaces.tags.list({
      parent: targetPath
    });
    
    const existingTags = existingTagsResponse.data.tag || [];
    const existingTag = existingTags.find(t => t.name === tag.name);
    
    // Map template type if it's a custom template type
    let mappedType = tag.type;
    if (isCustomTemplateType(tag.type) && templateMap && sourceTemplates && containerId) {
      try {
        mappedType = mapTemplateType(tag.type, templateMap, sourceTemplates, containerId);
        console.log(`Mapped tag type from ${tag.type} to ${mappedType}`);
      } catch (error) {
        console.error(`Error mapping template type for tag ${tag.name}:`, error);
        throw error;
      }
    }
    
    // Create a clean copy with only the required fields to avoid ID conflicts
    const tagCopy = {
      name: tag.name,
      type: mappedType
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
    
    // Map trigger references to destination trigger IDs
    if (triggerMap && sourceTriggers && sourceTriggers.length > 0) {
      mapTriggerReferences(tagCopy, triggerMap, sourceTriggers);
    }
    
    let response;
    
    if (existingTag) {
      // Tag with this name already exists, update it instead
      console.log(`Tag with name "${tag.name}" already exists. Updating.`);
      
      // Keep the existing tag's ID and fingerprint
      const tagPath = `${targetPath}/tags/${existingTag.tagId}`;
      tagCopy.fingerprint = existingTag.fingerprint;
      
      response = await makeRateLimitedRequest(
        () => tagmanager.accounts.containers.workspaces.tags.update({
          path: tagPath,
          requestBody: tagCopy
        }),
        `Update tag "${tag.name}"`
      );
      console.log(`Updated tag "${tag.name}"`);
    } else {
      // Create a new tag
      response = await makeRateLimitedRequest(
        () => tagmanager.accounts.containers.workspaces.tags.create({
          parent: targetPath,
          requestBody: tagCopy
        }),
        `Create tag "${tag.name}"`
      );
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
 * @param {Object} templateMap - Map of template names to destination template IDs
 * @param {Array} sourceTemplates - Source templates for name lookup
 * @param {string} containerId - Destination container ID
 * @returns {Object} - Created or updated variable
 */
const copyVariable = async (googleUserId, variable, targetPath, templateMap = {}, sourceTemplates = [], containerId = null) => {
  try {
    const tagmanager = await getTagManagerClient(googleUserId);
    
    // First, get all variables in the target workspace to check for duplicates
    const existingVariablesResponse = await tagmanager.accounts.containers.workspaces.variables.list({
      parent: targetPath
    });
    
    const existingVariables = existingVariablesResponse.data.variable || [];
    const existingVariable = existingVariables.find(v => v.name === variable.name);
    
    // Map template type if it's a custom template type
    let mappedType = variable.type;
    if (isCustomTemplateType(variable.type) && templateMap && sourceTemplates && containerId) {
      try {
        mappedType = mapTemplateType(variable.type, templateMap, sourceTemplates, containerId);
        console.log(`Mapped variable type from ${variable.type} to ${mappedType}`);
      } catch (error) {
        console.error(`Error mapping template type for variable ${variable.name}:`, error);
        throw error;
      }
    }
    
    // Create a clean copy with only the essential fields to avoid ID conflicts
    const variableCopy = {
      name: variable.name,
      type: mappedType
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
      
      response = await makeRateLimitedRequest(
        () => tagmanager.accounts.containers.workspaces.variables.update({
          path: variablePath,
          requestBody: variableCopy
        }),
        `Update variable "${variable.name}"`
      );
      console.log(`Updated variable "${variable.name}"`);
    } else {
      // Create a new variable
      response = await makeRateLimitedRequest(
        () => tagmanager.accounts.containers.workspaces.variables.create({
          parent: targetPath,
          requestBody: variableCopy
        }),
        `Create variable "${variable.name}"`
      );
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
 * Copy selected elements from one workspace to another and optionally publish
 * @param {string} googleUserId - Google user ID
 * @param {Object} source - Source container and workspace
 * @param {Array} targets - Target containers
 * @param {Array} elementTypes - Types of elements to copy (templates, tags, triggers, variables)
 * @param {Object} selectedElements - Object containing arrays of selected element IDs by type
 * @param {Object|null} deletedElementNames - Object containing arrays of element names to delete by type
 * @param {boolean} autoPublish - Whether to automatically publish the workspace after copying
 * @returns {Object} - Copy results
 */
const copyElements = async (
  googleUserId,
  source,
  targets,
  elementTypes,
  selectedElements = null,
  deletedElementNames = null,   // ← add this parameter
  autoPublish = true
) => {
  const results = [];
  let sourceElements = [];
  
  console.log('Starting copy operation with the following parameters:');
  console.log('Source:', source);
  console.log('Targets:', targets);
  console.log('Element types:', elementTypes);
  console.log('Selected elements:', selectedElements);
  
  // Always get triggers from source workspace for mapping purposes (even if not copying them)
  const allSourceTriggers = await getTriggers(
    googleUserId, 
    source.accountId, 
    source.containerId, 
    source.workspaceId
  );
  
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
    
    sourceElements = [...sourceElements, ...selectedTemplates.map(el => ({ ...el, elementType: 'template' }))];
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
    // Filter triggers if specific selections were provided (using already fetched triggers)
    let selectedTriggers = allSourceTriggers;
    if (selectedElements && selectedElements.triggers && selectedElements.triggers.length > 0) {
      selectedTriggers = allSourceTriggers.filter(trigger => 
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
  
  if (elementTypes.includes('clients')) {
    const clients = await getClients(
      googleUserId,
      source.accountId,
      source.containerId,
      source.workspaceId
    );

    // Filter clients if specific selections were provided
    let selectedClients = clients;
    if (selectedElements && selectedElements.clients && selectedElements.clients.length > 0) {
      selectedClients = clients.filter(client =>
        selectedElements.clients.includes(client.clientId));
    }

    sourceElements = [...sourceElements, ...selectedClients.map(el => ({ ...el, elementType: 'client' }))];
  }

  if (elementTypes.includes('transformations')) {
    const transformations = await getTransformations(
      googleUserId,
      source.accountId,
      source.containerId,
      source.workspaceId
    );

    // Filter transformations if specific selections were provided
    let selectedTransformations = transformations;
    if (selectedElements && selectedElements.transformations && selectedElements.transformations.length > 0) {
      selectedTransformations = transformations.filter(transformation =>
        selectedElements.transformations.includes(transformation.transformationId));
    }

    sourceElements = [...sourceElements, ...selectedTransformations.map(el => ({ ...el, elementType: 'transformation' }))];
  }

  console.log(`Total elements to copy: ${sourceElements.length}`);
  
  // Calculate estimated time and show progress information
  const estimatedRequestsPerTarget = sourceElements.length + 10; // Elements + workspace creation, templates fetch, etc.
  const totalEstimatedRequests = estimatedRequestsPerTarget * targets.length;
  const estimatedTimeMs = rateLimiter.estimateTime(totalEstimatedRequests);
  const estimatedMinutes = Math.ceil(estimatedTimeMs / 60000);
  
  console.log(`Estimated ${totalEstimatedRequests} API requests for ${targets.length} targets`);
  console.log(`Estimated completion time: ~${estimatedMinutes} minutes`);
  
  const rateLimiterStatus = rateLimiter.getStatus();
  console.log('Rate limiter status:', {
    queueLength: rateLimiterStatus.queueLength,
    requestsInLastMinute: rateLimiterStatus.requestsInLastMinute,
    canMakeRequest: rateLimiterStatus.canMakeRequest
  });

  // Hoist tag manager client for deletion phase (avoid repeated auth per target)
  let tagmanager = null;
  if (deletedElementNames) {
    tagmanager = await getTagManagerClient(googleUserId);
  }

  // Process each target container
  for (let i = 0; i < targets.length; i++) {
    const target = targets[i];
    try {
      console.log(`[${i + 1}/${targets.length}] Starting copy to target container: ${target.containerId}`);
      
      // Show current rate limiter status
      const currentStatus = rateLimiter.getStatus();
      if (currentStatus.queueLength > 0) {
        console.log(`Rate limiter queue: ${currentStatus.queueLength} requests pending`);
      }
      
      // Create temporary workspace in target container
      const tempWorkspace = await createTempWorkspace(
        googleUserId, 
        target.accountId, 
        target.containerId
      );
      
      const targetPath = `accounts/${target.accountId}/containers/${target.containerId}/workspaces/${tempWorkspace.workspaceId}`;
      const copiedElements = [];
      let errors = [];

      // Template mapping phase - get source and destination templates
      const sourceTemplates = await getCustomTemplates(
        googleUserId,
        source.accountId,
        source.containerId,
        source.workspaceId
      );
      
      const destTemplates = await getCustomTemplates(
        googleUserId,
        target.accountId,
        target.containerId,
        tempWorkspace.workspaceId
      );
      
      // Build initial template mapping
      let templateMap = buildTemplateMap(sourceTemplates, destTemplates);
      console.log(`Template mapping for container ${target.containerId}:`, templateMap);
      
      // Detect template dependencies in elements to copy
      const requiredTemplates = detectTemplateDependencies(sourceElements, sourceTemplates);
      console.log(`Required templates:`, requiredTemplates);
      
      // Find missing templates that need to be copied first
      const missingTemplates = requiredTemplates.filter(templateName => !templateMap[templateName]);
      if (missingTemplates.length > 0) {
        console.log(`Missing templates to be copied:`, missingTemplates);
        
        // Copy missing templates first
        for (const templateName of missingTemplates) {
          const sourceTemplate = sourceTemplates.find(t => t.name === templateName);
          if (sourceTemplate) {
            try {
              console.log(`Copying required template: ${templateName}`);
              const result = await copyTemplate(googleUserId, { ...sourceTemplate, elementType: 'template' }, targetPath);
              
              // Update template map with newly created template
              if (result && result.templateId) {
                templateMap[templateName] = result.templateId;
                console.log(`Template "${templateName}" copied with new ID: ${result.templateId}`);
              }
            } catch (error) {
              console.error(`Error copying required template ${templateName}:`, error);
              errors.push({
                type: 'template',
                name: templateName,
                error: `Failed to copy required template: ${error.message}`
              });
            }
          }
        }
      }

      // Trigger mapping phase - get destination triggers (source already fetched)
      const destTriggers = await getTriggers(
        googleUserId,
        target.accountId,
        target.containerId,
        tempWorkspace.workspaceId
      );
      
      // Build initial trigger mapping using pre-fetched source triggers
      let triggerMap = buildTriggerMap(allSourceTriggers, destTriggers);
      console.log(`Trigger mapping for container ${target.containerId}:`, triggerMap);

      // Pre-build tag mapping for transformations (will be updated as tags are copied)
      const allSourceTags = sourceElements.filter(el => el.elementType === 'tag');
      let tagMap = {};

      // Sort elements to copy in the right dependency order:
      // 1. templates (needed by clients, variables, tags, triggers)
      // 2. clients (server-side request processors, use templates, independent of other types)
      // 3. variables (may be needed by triggers and tags)
      // 4. triggers (needed by tags)
      // 5. tags (dependent on the above)
      // 6. transformations (can reference tags, so must be copied after tags)
      const orderedElements = [
        ...sourceElements.filter(el => el.elementType === 'template'),
        ...sourceElements.filter(el => el.elementType === 'client'),
        ...sourceElements.filter(el => el.elementType === 'variable'),
        ...sourceElements.filter(el => el.elementType === 'trigger'),
        ...sourceElements.filter(el => el.elementType === 'tag'),
        ...sourceElements.filter(el => el.elementType === 'transformation')
      ];

      console.log(`Copying elements in dependency order. Total elements: ${orderedElements.length}`);
      
      // Copy elements
      for (let j = 0; j < orderedElements.length; j++) {
        const element = orderedElements[j];
        try {
          console.log(`[${i + 1}/${targets.length}] [${j + 1}/${orderedElements.length}] Copying ${element.elementType}: ${element.name}`);
          
          // Show rate limiter queue status for long operations
          const queueStatus = rateLimiter.getStatus();
          if (queueStatus.queueLength > 5) {
            console.log(`Rate limiter queue: ${queueStatus.queueLength} requests pending, estimated wait: ${Math.ceil(queueStatus.estimatedWaitTime/1000)}s`);
          }
          
          let result;
          
          // Update or create elements based on their type
          if (element.elementType === 'template') {
            result = await copyTemplate(googleUserId, element, targetPath);
          } else if (element.elementType === 'variable') {
            result = await copyVariable(googleUserId, element, targetPath, templateMap, sourceTemplates, target.containerId);
          } else if (element.elementType === 'trigger') {
            result = await copyTrigger(googleUserId, element, targetPath);
            
            // Update trigger map with newly created/updated trigger
            if (result && result.triggerId && result.name) {
              triggerMap[result.name] = result.triggerId;
              console.log(`Updated trigger map: "${result.name}" -> ${result.triggerId}`);
            }
          } else if (element.elementType === 'tag') {
            result = await copyTag(googleUserId, element, targetPath, templateMap, sourceTemplates, target.containerId, triggerMap, allSourceTriggers);
            
            // Update tag map with newly created/updated tag
            if (result && result.tagId && result.name) {
              tagMap[result.name] = result.tagId;
              console.log(`Updated tag map: "${result.name}" -> ${result.tagId}`);
            }
          } else if (element.elementType === 'client') {
            result = await copyClient(googleUserId, element, targetPath, templateMap, sourceTemplates, target.containerId);
          } else if (element.elementType === 'transformation') {
            result = await copyTransformation(googleUserId, element, targetPath, tagMap, allSourceTags, templateMap, sourceTemplates, target.containerId);
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

      // Handle deletions
      if (deletedElementNames) {
        const typesToDelete = ['templates', 'tags', 'triggers', 'variables', 'clients', 'transformations'];

        for (const type of typesToDelete) {
          const names = deletedElementNames[type] || [];
          for (const name of names) {
            try {
              const result = await deleteElementFromWorkspace(tagmanager, targetPath, type, name);
              if (result) {
                copiedElements.push(result);
                console.log(`Deleted ${type} "${name}" from ${target.containerId}`);
              } else {
                console.log(`${type} "${name}" not found in target ${target.containerId}, skipping`);
              }
            } catch (err) {
              console.error(`Error deleting ${type} "${name}":`, err);
              errors.push({ type, name, error: `Failed to delete: ${err.message}` });
            }
          }
        }
      }

      // Determine if copying succeeded overall
      const copySucceeded = copiedElements.length > 0;
      
      // Try to publish changes only if copying succeeded and autoPublish is enabled
      let publishResult = null;
      if (copySucceeded && autoPublish) {
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
          
          // Provide specific error messages based on error type
          let errorMessage = error.message;
          
          if (error.compilerError) {
            errorMessage = "Version created but contains compiler errors (missing dependencies: variables, triggers, templates, etc.). Version not published to production.";
          } else if (error.message.includes("No version ID returned")) {
            errorMessage = "Failed to create version from workspace. Check workspace content and permissions.";
          } else if (error.message.includes("Publish version")) {
            errorMessage = "Version created successfully but failed to publish to production. Check publish permissions.";
          }
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
      } else if (copySucceeded && !autoPublish) {
        console.log("Skipping publish step as autoPublish is disabled");
      } else {
        console.log("Skipping publish step as no elements were copied successfully");
      }

      // Record the operation as successful if elements were copied, even if publishing failed
      const operationStatus = copySucceeded ? (errors.length > 0 ? 'partial' : 'success') : 'failed';
      
      // Skip cleanup if publishing was successful - publishing a workspace automatically deletes it
      // Also skip cleanup if autoPublish is disabled and elements were copied successfully
      if (!publishResult && !(copySucceeded && !autoPublish)) {
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
      } else if (publishResult) {
        console.log("Publication was successful. Workspace was automatically deleted by GTM.");
      } else if (copySucceeded && !autoPublish) {
        console.log("Workspace preserved for manual review since autoPublish is disabled.");
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
        workspacePreserved: copySucceeded && !autoPublish,
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

/**
 * Get rate limiter status for UI progress indicators
 * @returns {Object} - Rate limiter status and progress information
 */
const getRateLimiterStatus = () => {
  return rateLimiter.getStatus();
};

/**
 * Estimate time for a copy operation
 * @param {number} elementsCount - Number of elements to copy
 * @param {number} targetsCount - Number of target containers
 * @returns {Object} - Time estimation information
 */
const estimateCopyTime = (elementsCount, targetsCount) => {
  const requestsPerTarget = elementsCount + 10; // Elements + overhead
  const totalRequests = requestsPerTarget * targetsCount;
  const estimatedMs = rateLimiter.estimateTime(totalRequests);
  
  return {
    totalRequests,
    estimatedMs,
    estimatedMinutes: Math.ceil(estimatedMs / 60000),
    requestsPerTarget
  };
};

export {
  getAccounts,
  getContainers,
  getWorkspaces,
  getWorkspaceStatus,
  getCustomTemplates,
  getTags,
  getTriggers,
  getVariables,
  getClients,
  getTransformations,
  copyElements,
  getHistory as getCopyHistory,
  getDetails as getCopyDetails,
  publishWorkspace,
  getRateLimiterStatus,
  estimateCopyTime
};
