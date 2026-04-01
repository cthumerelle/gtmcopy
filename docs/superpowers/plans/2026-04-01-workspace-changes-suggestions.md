# Workspace Changes Suggestions Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers-extended-cc:subagent-driven-development (if subagents available) or superpowers-extended-cc:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Automatically detect workspace changes (vs published version) and pre-check modified elements in Step 2, plus propagate deletions to target containers.

**Architecture:** New `getWorkspaceStatus` backend function calls `tagmanager.accounts.containers.workspaces.getStatus`, normalizes the response into a per-type map, and stores it in Pinia. Step 2 reads this map to pre-check and badge changed elements. Deleted elements are extracted from selections, passed as names in `deletedElementNames`, and applied via a new `deleteElementFromWorkspace` helper per target.

**Tech Stack:** Node.js/Express backend, Vue 3 + Pinia frontend, Google Tag Manager API v2 (`googleapis`)

---

## Chunk 1: Backend

### Task 1: Add `getWorkspaceStatus` to `services/gtmService.js`

**Files:**
- Modify: `services/gtmService.js`

- [ ] **Step 1: Add the function** — insert after `getWorkspaces` (around line 337):

```js
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
```

- [ ] **Step 2: Export the function** — add `getWorkspaceStatus` to the `export {}` block at the bottom of the file (around line 1808):

```js
export {
  getAccounts,
  getContainers,
  getWorkspaces,
  getWorkspaceStatus,   // ← add this line
  getCustomTemplates,
  // ... rest unchanged
};
```

- [ ] **Step 3: Verify the server starts without errors**

```bash
npm run dev
```

Expected: Server starts, no import/syntax errors.

- [ ] **Step 4: Commit**

```bash
git add services/gtmService.js
git commit -m "feat: add getWorkspaceStatus to gtmService"
```

---

### Task 2: Add status route to `routes/gtm.js`

**Files:**
- Modify: `routes/gtm.js`

- [ ] **Step 1: Add the route** — insert after the workspaces route (after line 52):

```js
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
```

- [ ] **Step 2: Test the endpoint manually**

With a valid session cookie, call:
```
GET /api/gtm/accounts/{accountId}/containers/{containerId}/workspaces/{workspaceId}/status
```

Expected: `{ status: { tags: {...}, triggers: {...}, variables: {...}, templates: {...}, clients: {...}, transformations: {...} } }`

- [ ] **Step 3: Commit**

```bash
git add routes/gtm.js
git commit -m "feat: add workspace status route"
```

---

### Task 3: Add deletion support to `services/gtmService.js` and update `routes/gtm.js`

**Files:**
- Modify: `services/gtmService.js`
- Modify: `routes/gtm.js`

This task adds a `deleteElementFromWorkspace` helper and integrates `deletedElementNames` into the per-target copy loop.

- [ ] **Step 1: Add `deleteElementFromWorkspace` helper** — insert after `getWorkspaceStatus` in `services/gtmService.js`:

```js
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
```

- [ ] **Step 2: Update `copyElements` signature** — change the function signature at line ~1305:

```js
const copyElements = async (
  googleUserId,
  source,
  targets,
  elementTypes,
  selectedElements = null,
  deletedElementNames = null,   // ← add this parameter
  autoPublish = true
) => {
```

- [ ] **Step 3: Add deletion phase inside the per-target loop** — inside the `for (let i = 0; i < targets.length; i++)` loop, after `copiedElements` is populated (after line ~1627, before the "Determine if copying succeeded" block):

```js
      // Handle deletions
      if (deletedElementNames) {
        const tagmanager = await getTagManagerClient(googleUserId);
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
```

- [ ] **Step 4: Update `copySucceeded` to also account for deletions** — find the line:

```js
      const copySucceeded = copiedElements.length > 0;
```

Change to:

```js
      const copySucceeded = copiedElements.length > 0;
```

This already handles deletions correctly: successful deletions push `{ status: 'deleted' }` entries into `copiedElements` (see Step 3), so `copiedElements.length > 0` is true if any deletion actually succeeded. No change to the logic — the existing condition is sufficient.

- [ ] **Step 5: Extract and forward `deletedElementNames` in the copy route** — in `routes/gtm.js`, update the destructuring and `copyElements` call in `router.post('/copy', ...)`:

```js
// Change:
const { source, targets, elementTypes, selectedElements, autoPublish = true } = req.body;
// To:
const { source, targets, elementTypes, selectedElements, deletedElementNames, autoPublish = true } = req.body;
```

```js
// Change the gtmService.copyElements call:
const result = await gtmService.copyElements(
  req.user.googleUserId,
  source,
  targets,
  elementTypes,
  selectedElements,
  deletedElementNames,   // ← add this
  autoPublish
);
```

- [ ] **Step 6: Relax `elementTypes` validation for deletions-only requests** — still in `routes/gtm.js`, find the existing validation block:

```js
if (!elementTypes || !Array.isArray(elementTypes) || elementTypes.length === 0) {
  return res.status(400).json({ message: 'At least one element type is required' });
}
```

Replace with:

```js
const hasElementTypes = elementTypes && Array.isArray(elementTypes) && elementTypes.length > 0;
const hasDeletions = deletedElementNames && Object.values(deletedElementNames).some(arr => arr.length > 0);
if (!hasElementTypes && !hasDeletions) {
  return res.status(400).json({ message: 'At least one element to copy or delete is required' });
}
```

- [ ] **Step 7: Verify the server starts without errors**

```bash
npm run dev
```

Expected: No errors.

- [ ] **Step 8: Commit**

```bash
git add services/gtmService.js routes/gtm.js
git commit -m "feat: add deletion propagation to copyElements"
```

---

## Chunk 2: Frontend

### Task 4: Update `src/services/api.js`

**Files:**
- Modify: `src/services/api.js`

- [ ] **Step 1: Add `getWorkspaceStatus` method** — add after `getTransformations` (around line 101):

```js
    // Workspace status (changes vs published version)
    getWorkspaceStatus(accountId, containerId, workspaceId) {
      return api.get(`/api/gtm/accounts/${accountId}/containers/${containerId}/workspaces/${workspaceId}/status`);
    },
```

- [ ] **Step 2: Update `copyElements` signature** — change line ~104:

```js
    copyElements(source, targets, elementTypes, selectedElements = null, deletedElementNames = null, autoPublish = true) {
      return api.post('/api/gtm/copy', { source, targets, elementTypes, selectedElements, deletedElementNames, autoPublish });
    },
```

- [ ] **Step 3: Commit**

```bash
git add src/services/api.js
git commit -m "feat: add getWorkspaceStatus and deletedElementNames to api service"
```

---

### Task 5: Update `src/store/gtm.js`

**Files:**
- Modify: `src/store/gtm.js`

- [ ] **Step 1: Add `workspaceChanges` state** — add after the `copyStatus` ref (around line 36):

```js
  const workspaceChanges = ref({
    tags: {},
    triggers: {},
    variables: {},
    templates: {},
    clients: {},
    transformations: {}
  });
```

- [ ] **Step 2: Add `fetchWorkspaceStatus` action** — add after `fetchSourceElements` (around line 292):

```js
  async function fetchWorkspaceStatus(accountId, containerId, workspaceId) {
    try {
      const response = await api.gtm.getWorkspaceStatus(accountId, containerId, workspaceId);
      workspaceChanges.value = response.data.status;
    } catch (err) {
      console.warn('Could not fetch workspace status, suggestions disabled:', err);
      workspaceChanges.value = { tags: {}, triggers: {}, variables: {}, templates: {}, clients: {}, transformations: {} };
    }
  }
```

- [ ] **Step 3: Update `fetchSourceElements` to call status in parallel** — replace the existing function body:

```js
  async function fetchSourceElements() {
    if (!selectedSource.value.accountId ||
        !selectedSource.value.containerId ||
        !selectedSource.value.workspaceId) {
      return;
    }

    const { accountId, containerId, workspaceId } = selectedSource.value;

    // fetchWorkspaceStatus catches its own errors and never rejects — safe to include in Promise.all
    await Promise.all([
      fetchTemplates(accountId, containerId, workspaceId),
      fetchTags(accountId, containerId, workspaceId),
      fetchTriggers(accountId, containerId, workspaceId),
      fetchVariables(accountId, containerId, workspaceId),
      fetchClients(accountId, containerId, workspaceId),
      fetchTransformations(accountId, containerId, workspaceId),
      fetchWorkspaceStatus(accountId, containerId, workspaceId)
    ]);
  }
```

- [ ] **Step 4: Expose `workspaceChanges` and `fetchWorkspaceStatus` in the return object** — add to the `return {}` at the bottom of the store:

```js
    workspaceChanges,
    fetchWorkspaceStatus,
```

- [ ] **Step 5: Commit**

```bash
git add src/store/gtm.js
git commit -m "feat: add workspaceChanges state and fetchWorkspaceStatus to gtm store"
```

---

### Task 6: Update `src/views/CopyPage.vue` — badges, pre-check, deletion propagation

**Files:**
- Modify: `src/views/CopyPage.vue`

This is the largest change. We add helper functions, update `loadSourceElements` to pre-check changed elements, add badges to the element lists, and update `performCopy` to pass `deletedElementNames`.

- [ ] **Step 1: Add helper functions** — add after the `deselectAllOfType` function (around line 826):

```js
// Returns the changeStatus ('added', 'updated', 'deleted') for an element, or null
function getChangeStatus(type, id) {
  return gtmStore.workspaceChanges?.[type]?.[id] || null;
}

function changeBadgeClass(status) {
  const map = {
    added:   'bg-green-100 text-green-800',
    updated: 'bg-blue-100 text-blue-800',
    deleted: 'bg-red-100 text-red-800',
  };
  return map[status] || '';
}

function changeBadgeLabel(status) {
  const map = {
    added:   'Nouveau',
    updated: 'Modifié',
    deleted: 'Suppression ⚠',
  };
  return map[status] || '';
}
```

- [ ] **Step 2: Add `preSelectChangedElements` function** — add after the helper functions above:

```js
// Pre-selects elements that have changes in the workspace.
// Called after loadSourceElements resolves.
function preSelectChangedElements() {
  const wc = gtmStore.workspaceChanges;
  if (!wc) return;
  const hasChanges = Object.values(wc).some(map => Object.keys(map).length > 0);
  if (!hasChanges) return;

  const idFields = {
    templates: 'templateId',
    tags: 'tagId',
    triggers: 'triggerId',
    variables: 'variableId',
    clients: 'clientId',
    transformations: 'transformationId',
  };

  const storeList = {
    templates: gtmStore.templates,
    tags: gtmStore.tags,
    triggers: gtmStore.triggers,
    variables: gtmStore.variables,
    clients: gtmStore.clients,
    transformations: gtmStore.transformations,
  };

  for (const [type, idField] of Object.entries(idFields)) {
    selectedElements.value[type] = storeList[type]
      .filter(el => wc[type][el[idField]])
      .map(el => el[idField]);
  }
}
```

- [ ] **Step 3: Call `preSelectChangedElements` in `loadSourceElements`** — update the function:

```js
async function loadSourceElements() {
  loading.value = true;
  error.value = null;

  try {
    await gtmStore.fetchSourceElements();
    preSelectChangedElements();
    currentStep.value += 1;
  } catch(err) {
    error.value = `Failed to load source elements: ${err.message}`;
  } finally {
    loading.value = false;
  }
}
```

Note: add the `finally` block if not already present to ensure `loading` is always reset.

- [ ] **Step 4: Add badges to the Templates section** — find the template item row (around line 167):

```html
<!-- BEFORE -->
<div v-for="template in gtmStore.templates" :key="template.templateId" class="flex items-center mb-2 last:mb-0">
  <input
    :id="`template-${template.templateId}`"
    type="checkbox"
    v-model="selectedElements.templates"
    :value="template.templateId"
    class="checkbox"
  />
  <label :for="`template-${template.templateId}`" class="ml-2 text-sm text-gray-700">
    {{ template.name }}
  </label>
</div>

<!-- AFTER -->
<div v-for="template in gtmStore.templates" :key="template.templateId" class="flex items-center mb-2 last:mb-0">
  <input
    :id="`template-${template.templateId}`"
    type="checkbox"
    v-model="selectedElements.templates"
    :value="template.templateId"
    class="checkbox"
  />
  <label
    :for="`template-${template.templateId}`"
    class="ml-2 text-sm"
    :class="getChangeStatus('templates', template.templateId) === 'deleted' ? 'line-through text-gray-400' : 'text-gray-700'"
  >
    {{ template.name }}
  </label>
  <span
    v-if="getChangeStatus('templates', template.templateId)"
    class="ml-2 text-xs px-1.5 py-0.5 rounded font-medium"
    :class="changeBadgeClass(getChangeStatus('templates', template.templateId))"
  >
    {{ changeBadgeLabel(getChangeStatus('templates', template.templateId)) }}
  </span>
</div>
```

- [ ] **Step 5: Add badges to Tags, Triggers, Variables, Clients, Transformations sections** — apply the same pattern to each element type (replace type/idField accordingly):

| Section | type string | idField |
|---------|-------------|---------|
| Tags | `'tags'` | `tag.tagId` |
| Triggers | `'triggers'` | `trigger.triggerId` |
| Variables | `'variables'` | `variable.variableId` |
| Clients | `'clients'` | `client.clientId` |
| Transformations | `'transformations'` | `transformation.transformationId` |

For each, apply the same label and badge pattern as in Step 4, substituting the correct type and idField.

- [ ] **Step 6: Update `performCopy` to extract `deletedElementNames` and filter them from `selectedElements`** — at the top of the `performCopy` function, after existing setup, add:

```js
  // Separate deleted elements from create/update elements
  const wc = gtmStore.workspaceChanges;
  const idFields = {
    templates: { list: gtmStore.templates, id: 'templateId' },
    tags:      { list: gtmStore.tags,      id: 'tagId' },
    triggers:  { list: gtmStore.triggers,  id: 'triggerId' },
    variables: { list: gtmStore.variables, id: 'variableId' },
    clients:   { list: gtmStore.clients,   id: 'clientId' },
    transformations: { list: gtmStore.transformations, id: 'transformationId' },
  };

  const filteredSelectedElements = {};
  const deletedElementNames = {};

  for (const [type, { list, id }] of Object.entries(idFields)) {
    const deletedIds = Object.entries(wc[type] || {})
      .filter(([, s]) => s === 'deleted')
      .map(([elId]) => elId);

    // Keep only non-deleted in selectedElements
    filteredSelectedElements[type] = (selectedElements.value[type] || [])
      .filter(elId => !deletedIds.includes(elId));

    // Gather names of selected deleted elements
    const selectedDeletedIds = (selectedElements.value[type] || [])
      .filter(elId => deletedIds.includes(elId));
    deletedElementNames[type] = selectedDeletedIds
      .map(elId => list.find(el => el[id] === elId)?.name)
      .filter(Boolean);
  }
```

- [ ] **Step 7: Update the `api.gtm.copyElements` call in `performCopy`** — find the existing call (around line 1012) and update to pass the new values:

```js
    const response = await api.gtm.copyElements(
      gtmStore.selectedSource,
      gtmStore.selectedTargets,
      activeElementTypes,
      filteredSelectedElements,   // ← was: selectedElements.value
      deletedElementNames,        // ← new
      autoPublish.value
    );
```

Also update `activeElementTypes` calculation to use `filteredSelectedElements` instead of `selectedElements.value`:

```js
    const activeElementTypes = [];
    if (filteredSelectedElements.templates?.length > 0) activeElementTypes.push('templates');
    if (filteredSelectedElements.tags?.length > 0) activeElementTypes.push('tags');
    if (filteredSelectedElements.triggers?.length > 0) activeElementTypes.push('triggers');
    if (filteredSelectedElements.variables?.length > 0) activeElementTypes.push('variables');
    if (filteredSelectedElements.clients?.length > 0) activeElementTypes.push('clients');
    if (filteredSelectedElements.transformations?.length > 0) activeElementTypes.push('transformations');
```

> **Note:** The `elementTypes` validation in `routes/gtm.js` was already updated in Task 3 Step 6 to allow empty `elementTypes` when `deletedElementNames` is non-empty. No change needed here.

> **Known limitation:** The Step 4 review panel (lines ~620-637 in `CopyPage.vue`) displays element counts from `selectedElements.value`, which still includes deleted element IDs at that point. For example, "4 tags sélectionnés" when 1 will be deleted and 3 will be copied. The actual operation is correct. Improving the display (e.g., "3 tags copiés + 1 à supprimer") is left as a future enhancement.

- [ ] **Step 8: Test the full flow in the browser**

1. Select a source workspace that has modifications (at least one added, updated, or deleted element)
2. Click "Next: Select Elements" — verify that:
   - Modified elements are pre-checked
   - Badges appear (green "Nouveau", blue "Modifié", red "Suppression ⚠")
   - Deleted elements have strikethrough label
3. Leave selections as-is and proceed through the wizard
4. Start the copy — verify in GTM UI that:
   - Added/updated elements were copied to the target
   - Deleted elements were removed from the target workspace (before publish)

- [ ] **Step 9: Commit**

```bash
git add src/views/CopyPage.vue
git commit -m "feat: pre-check changed elements and add change badges in Step 2"
```

---

## Summary of Changes

| File | What changed |
|------|-------------|
| `services/gtmService.js` | Added `getWorkspaceStatus`, `deleteElementFromWorkspace`; updated `copyElements` signature and loop |
| `routes/gtm.js` | Added status route; updated copy route to pass `deletedElementNames` and relax elementTypes validation |
| `src/services/api.js` | Added `getWorkspaceStatus`; updated `copyElements` signature |
| `src/store/gtm.js` | Added `workspaceChanges` state, `fetchWorkspaceStatus` action; updated `fetchSourceElements` |
| `src/views/CopyPage.vue` | Added helpers, `preSelectChangedElements`, badges on all element rows, `deletedElementNames` extraction in `performCopy` |
