# Workspace Name Reuse Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers-extended-cc:subagent-driven-development (if subagents available) or superpowers-extended-cc:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Réutiliser le nom du workspace source comme nom du workspace de destination lors d'une copie GTM, en réutilisant un workspace existant si le nom est déjà présent dans le container destination.

**Architecture:** Trois changements coordonnés — le frontend enrichit l'objet `source` avec `workspaceName` lors de la sélection du workspace ; le store Pinia persiste ce nom ; le backend utilise ce nom pour trouver ou créer le workspace de destination via une nouvelle fonction `resolveDestinationWorkspace`.

**Tech Stack:** Vue 3 (Composition API, Pinia), Express.js, Google Tag Manager API v2

---

## Chunk 1: Backend — `resolveDestinationWorkspace`

### Task 1: Ajouter `resolveDestinationWorkspace` dans `services/gtmService.js`

**Files:**
- Modify: `services/gtmService.js` — ajouter la fonction après `createTempWorkspace` (ligne ~1116) et mettre à jour l'appel dans `copyElements` (ligne ~1563)

**Context:**
- `createTempWorkspace` est à la ligne 1097. Elle reste inchangée comme helper privé.
- `getWorkspaces` est à la ligne 330 et est disponible dans le même scope.
- `makeRateLimitedRequest` est utilisé pour les appels d'écriture/mutation (create, update, delete). Les appels de lecture en liste (dont `getWorkspaces`) appellent l'API directement sans wrapper. `resolveDestinationWorkspace` suit ce même pattern : le `create` est wrappé dans `makeRateLimitedRequest`, l'appel à `getWorkspaces` est direct.
- `copyElements` appelle `createTempWorkspace` à la ligne ~1563. C'est cet appel qu'on remplace.
- La route `routes/gtm.js` passe `source` entier à `copyElements` (ligne 196) — `workspaceName` sera donc disponible dans `source.workspaceName` sans aucune modification de la route.

- [ ] **Étape 1 : Ajouter `resolveDestinationWorkspace` après `createTempWorkspace`**

Insérer le code suivant **après la fermeture de `createTempWorkspace`** (après la ligne `};` qui termine cette fonction, ligne ~1116) :

```js
/**
 * Resolve the destination workspace: reuse an existing one by name or create a new one.
 * Falls back to temp-copy-{timestamp} when sourceWorkspaceName is empty or "Default Workspace".
 * @param {string} googleUserId - Google user ID
 * @param {string} accountId - GTM account ID
 * @param {string} containerId - GTM container ID
 * @param {string} sourceWorkspaceName - Name of the source workspace
 * @returns {Object} - Workspace object (existing or newly created)
 */
const resolveDestinationWorkspace = async (googleUserId, accountId, containerId, sourceWorkspaceName) => {
  try {
    // Default Workspace or missing name → keep existing temp-copy-{timestamp} behavior
    if (!sourceWorkspaceName || sourceWorkspaceName === 'Default Workspace') {
      return await createTempWorkspace(googleUserId, accountId, containerId);
    }

    // Look for an existing workspace with the same name in the destination container
    const existingWorkspaces = await getWorkspaces(googleUserId, accountId, containerId);
    const existing = existingWorkspaces.find(w => w.name === sourceWorkspaceName);
    if (existing) {
      console.log(`Reusing existing workspace "${sourceWorkspaceName}" (${existing.workspaceId}) in container ${containerId}`);
      return existing;
    }

    // Create a new workspace with the source workspace name
    const tagmanager = await getTagManagerClient(googleUserId);
    const response = await makeRateLimitedRequest(
      () => tagmanager.accounts.containers.workspaces.create({
        parent: `accounts/${accountId}/containers/${containerId}`,
        requestBody: {
          name: sourceWorkspaceName,
          description: 'Workspace created by GTM Copy application'
        }
      }),
      `Create workspace "${sourceWorkspaceName}" in container ${containerId}`
    );
    console.log(`Created new workspace "${sourceWorkspaceName}" in container ${containerId}`);
    return response.data;
  } catch (error) {
    console.error('Error resolving destination workspace:', error);
    throw error;
  }
};
```

- [ ] **Étape 2 : Remplacer l'appel à `createTempWorkspace` dans `copyElements`**

Chercher la ligne dans `copyElements` qui appelle `createTempWorkspace` (ligne ~1563) :

```js
// Create temporary workspace in target container
const tempWorkspace = await createTempWorkspace(
  googleUserId,
  target.accountId,
  target.containerId
);
```

La remplacer par :

```js
// Resolve destination workspace: reuse by name or create new
const tempWorkspace = await resolveDestinationWorkspace(
  googleUserId,
  target.accountId,
  target.containerId,
  source.workspaceName
);
```

- [ ] **Étape 3 : Vérifier visuellement le fichier**

Ouvrir `services/gtmService.js` et confirmer :
1. `createTempWorkspace` existe toujours (non supprimée) — elle est appelée par `resolveDestinationWorkspace`
2. `resolveDestinationWorkspace` apparaît juste après
3. Dans `copyElements`, l'appel utilise `resolveDestinationWorkspace`

- [ ] **Étape 4 : Commit**

```bash
git add services/gtmService.js
git commit -m "feat: add resolveDestinationWorkspace to reuse workspace name from source"
```

---

## Chunk 2: Store + Frontend

### Task 2: Ajouter `workspaceName` dans le store Pinia

**Files:**
- Modify: `src/store/gtm.js` — étendre `selectedSource` avec le champ `workspaceName`

**Context:**
- `selectedSource` est défini ligne 22-26 avec `{ accountId, containerId, workspaceId }`.
- `setSelectedSource` est à la ligne 320 — elle prend le `source` entier et le persiste dans localStorage. Aucune modification nécessaire car elle accepte n'importe quel objet.
- `initializeFromLocalStorage` lit le JSON depuis localStorage et l'assigne directement. Fonctionne automatiquement avec le nouveau champ.

- [ ] **Étape 1 : Étendre `selectedSource`**

Dans `src/store/gtm.js`, localiser le bloc :

```js
const selectedSource = ref({
  accountId: null,
  containerId: null,
  workspaceId: null
});
```

Le remplacer par :

```js
const selectedSource = ref({
  accountId: null,
  containerId: null,
  workspaceId: null,
  workspaceName: null
});
```

- [ ] **Étape 2 : Vérifier `setSelectedSource`**

Confirmer que `setSelectedSource` (ligne ~320) ne destructure pas l'objet et l'assigne tel quel :

```js
function setSelectedSource(source) {
  selectedSource.value = source;
  localStorage.setItem('gtmcopy_source', JSON.stringify(source));
}
```

Si c'est bien le cas, aucune modification n'est nécessaire.

- [ ] **Étape 3 : Commit**

```bash
git add src/store/gtm.js
git commit -m "feat: add workspaceName field to selectedSource in gtm store"
```

---

### Task 3: Enrichir `handleWorkspaceChange` dans `CopyPage.vue`

**Files:**
- Modify: `src/views/CopyPage.vue` — enrichir `setSelectedSource` avec `workspaceName`

**Context:**
- `handleWorkspaceChange` est à la ligne 1017. Actuellement : `gtmStore.setSelectedSource(source.value)`.
- `gtmStore.workspaces` contient la liste des workspaces du container source sélectionné — c'est le même tableau que celui utilisé pour peupler le `<select>` workspace (ligne 98).
- Le ref local `source` dans le composant (ligne 783) n'est **pas** étendu avec `workspaceName` — c'est intentionnel. L'enrichissement circule uniquement via le store. L'affichage du nom en résumé utilise déjà `getWorkspaceName(source.workspaceId)` qui résout depuis `gtmStore.workspaces`.

- [ ] **Étape 1 : Modifier `handleWorkspaceChange`**

Localiser la fonction à la ligne ~1017 :

```js
async function handleWorkspaceChange() {
  if (!source.value.workspaceId) return;

  // Save selection to store
  gtmStore.setSelectedSource(source.value);
}
```

La remplacer par :

```js
async function handleWorkspaceChange() {
  if (!source.value.workspaceId) return;

  // Enrich source with workspace name for destination workspace resolution
  const selectedWorkspace = gtmStore.workspaces.find(w => w.workspaceId === source.value.workspaceId);
  gtmStore.setSelectedSource({
    ...source.value,
    workspaceName: selectedWorkspace?.name ?? ''
  });
}
```

Note : le mot-clé `async` est conservé pour rester cohérent avec la signature existante, même si la nouvelle version n'utilise pas `await`.

- [ ] **Étape 2 : Vérification manuelle en dev**

Démarrer le serveur dev :

```bash
npm run dev
```

1. Sélectionner un compte, container, puis un workspace **autre que "Default Workspace"** (ex: "Mon workspace")
2. Ouvrir la console navigateur et vérifier dans le store Pinia (Vue DevTools) que `selectedSource.workspaceName` vaut bien le nom du workspace sélectionné
3. Vérifier dans `localStorage` (Application > Local Storage > `gtmcopy_source`) que `workspaceName` est présent
4. Sélectionner "Default Workspace" et vérifier que `workspaceName` vaut `"Default Workspace"`

- [ ] **Étape 3 : Commit**

```bash
git add src/views/CopyPage.vue
git commit -m "feat: enrich source with workspaceName in handleWorkspaceChange"
```

---

## Chunk 3: Vérification end-to-end

### Task 4: Test end-to-end de la feature

**Context :**
- Pas de suite de tests automatisés dans le projet — vérification manuelle.
- Le flow complet : sélection workspace source → copie → workspace créé/réutilisé dans la destination avec le bon nom.

- [ ] **Étape 1 : Cas "Default Workspace"**

1. Sélectionner "Default Workspace" comme source
2. Lancer une copie vers un container de test
3. Vérifier dans GTM que le workspace créé dans la destination s'appelle `temp-copy-{timestamp}` (comportement inchangé)

- [ ] **Étape 2 : Cas workspace nommé — création**

1. Sélectionner un workspace nommé (ex: "Staging") comme source
2. S'assurer qu'il n'existe **pas** de workspace "Staging" dans le container destination
3. Lancer une copie
4. Vérifier dans GTM que le workspace créé dans la destination s'appelle "Staging"

- [ ] **Étape 3 : Cas workspace nommé — réutilisation**

1. Sélectionner le même workspace "Staging" comme source
2. Un workspace "Staging" existe maintenant dans la destination (créé à l'étape 2)
3. Noter le `workspaceId` du workspace "Staging" existant dans GTM (visible dans l'URL GTM ou les logs de l'étape 2)
4. Lancer une copie
5. Vérifier dans les logs serveur la ligne : `Reusing existing workspace "Staging" (...)`
6. Vérifier dans GTM (liste des workspaces du container destination) que le nombre de workspaces n'a pas augmenté et que le `workspaceId` du workspace "Staging" est identique à celui noté à l'étape 3

- [ ] **Étape 3b : Rechargement de page avec workspace nommé en localStorage**

1. Recharger l'app sans changer de sélection
2. Vérifier dans Vue DevTools que `selectedSource.workspaceName === "Staging"` est restauré depuis localStorage
3. Lancer une copie directement (sans resélectionner le workspace)
4. Vérifier que le workspace "Staging" est toujours réutilisé (même comportement qu'à l'étape 3)

- [ ] **Étape 4 : Cas `workspaceName` absent (rétrocompatibilité)**

1. Supprimer manuellement `workspaceName` du `localStorage` (`gtmcopy_source`) — simuler un ancien payload sans ce champ
2. Recharger l'app — `selectedSource.workspaceName` sera `undefined` (le champ est absent du JSON parsé, la valeur initiale `null` ne s'applique que si localStorage est vide)
3. Lancer une copie
4. Vérifier que le comportement fallback `temp-copy-{timestamp}` s'applique (le guard `!sourceWorkspaceName` est truthy pour `undefined` et `null`)

- [ ] **Étape 5 : Commit final**

```bash
git add -p  # vérifier qu'il n'y a rien de non intentionnel
git commit -m "chore: end-to-end verification complete for workspace name reuse"
```
