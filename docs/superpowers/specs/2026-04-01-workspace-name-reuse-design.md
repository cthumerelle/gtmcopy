# Design — Réutilisation du nom de workspace source en destination

**Date:** 2026-04-01
**Status:** Approved

## Contexte

Lors d'une copie d'éléments GTM, l'application crée toujours un workspace temporaire nommé `temp-copy-{timestamp}` dans chaque container destination. Cette feature change ce comportement pour réutiliser le nom du workspace source comme nom du workspace de destination, sauf quand la source est "Default Workspace".

## Objectif

- Si la source est le workspace **"Default Workspace"** → comportement actuel inchangé (`temp-copy-{timestamp}`)
- Si la source est un autre workspace (ex: "Mon workspace") :
  - Chercher un workspace portant ce nom dans le container destination
  - S'il existe → copier les éléments dans ce workspace existant (écrasement / mise à jour par nom, comme déjà implémenté)
  - S'il n'existe pas → créer un workspace avec ce nom

## Changements

### 1. Frontend — `CopyPage.vue`

Dans `handleWorkspaceChange`, récupérer le nom du workspace sélectionné depuis `gtmStore.workspaces` et l'inclure dans l'objet `source` passé à `setSelectedSource` :

```js
const selectedWorkspace = gtmStore.workspaces.find(w => w.workspaceId === source.value.workspaceId);
gtmStore.setSelectedSource({
  ...source.value,
  workspaceName: selectedWorkspace?.name ?? ''
});
```

Note : le ref local `source` dans le composant n'est intentionnellement **pas** étendu avec `workspaceName`. L'enrichissement ne circule que via le store. L'affichage du nom utilise déjà `getWorkspaceName(source.workspaceId)` qui résout depuis `gtmStore.workspaces`, donc aucune régression UI.

### 2. Store — `src/store/gtm.js`

`selectedSource` est étendu avec un champ `workspaceName` :

```js
const selectedSource = ref({
  accountId: null,
  containerId: null,
  workspaceId: null,
  workspaceName: null
});
```

### 3. Backend — `services/gtmService.js`

`createTempWorkspace` est **conservée** comme helper privé (inchangée). Une nouvelle fonction `resolveDestinationWorkspace` est ajoutée qui la délègue pour le cas "Default Workspace", et implémente la logique de recherche/création sinon.

`resolveDestinationWorkspace` suit la même convention de gestion d'erreurs que les autres fonctions du service (try/catch + console.error + re-throw) :

```js
const resolveDestinationWorkspace = async (googleUserId, accountId, containerId, sourceWorkspaceName) => {
  try {
    // Default Workspace ou workspaceName vide → comportement actuel
    if (!sourceWorkspaceName || sourceWorkspaceName === 'Default Workspace') {
      return await createTempWorkspace(googleUserId, accountId, containerId);
    }

    // Chercher un workspace existant avec ce nom
    const existingWorkspaces = await getWorkspaces(googleUserId, accountId, containerId);
    const existing = existingWorkspaces.find(w => w.name === sourceWorkspaceName);
    if (existing) {
      console.log(`Reusing existing workspace "${sourceWorkspaceName}" (${existing.workspaceId})`);
      return existing;
    }

    // Créer un nouveau workspace avec le nom source
    const tagmanager = await getTagManagerClient(googleUserId);
    const response = await makeRateLimitedRequest(
      () => tagmanager.accounts.containers.workspaces.create({
        parent: `accounts/${accountId}/containers/${containerId}`,
        requestBody: {
          name: sourceWorkspaceName,
          description: 'Workspace créé par GTM Copy'
        }
      }),
      `Create workspace "${sourceWorkspaceName}" in container ${containerId}`
    );
    return response.data;
  } catch (error) {
    console.error('Error resolving destination workspace:', error);
    throw error;
  }
};
```

Dans `copyElements`, remplacer l'appel à `createTempWorkspace` par :

```js
const tempWorkspace = await resolveDestinationWorkspace(
  googleUserId,
  target.accountId,
  target.containerId,
  source.workspaceName
);
```

### 4. Route API — `routes/gtm.js`

Aucune modification. `source.workspaceName` est transmis via le corps de la requête POST `/copy` et disponible dans l'objet `source` passé au service.

## Contrat de données

**Avant :**
```json
{ "source": { "accountId": "...", "containerId": "...", "workspaceId": "..." } }
```

**Après :**
```json
{ "source": { "accountId": "...", "containerId": "...", "workspaceId": "...", "workspaceName": "Mon workspace" } }
```

Le champ `workspaceName` est optionnel côté backend : son absence ou une valeur vide (`""`) déclenche le fallback `temp-copy-{timestamp}`, ce qui garantit la rétrocompatibilité avec d'éventuels anciens clients.

## Cas limites

| Cas | Comportement |
|-----|-------------|
| Source = "Default Workspace" | `temp-copy-{timestamp}` (inchangé) |
| Workspace existant dans destination | Réutilisation, copie dans l'existant |
| Workspace inexistant dans destination | Création avec le nom source |
| `workspaceName` absent / null / vide | Fallback vers comportement actuel |
| `workspaceId` localStorage invalide (workspace supprimé) | `selectedWorkspace` → undefined → `workspaceName: ''` → fallback `temp-copy-{timestamp}` |
| `workspaceName` localStorage réfère un workspace supprimé depuis | `getWorkspaces` ne le trouve pas → création d'un nouveau workspace avec ce nom |
| Erreur API lors de `getWorkspaces` ou création | Exception loggée et re-throwée, la copie échoue proprement |

## Fichiers modifiés

- `src/views/CopyPage.vue` — enrichissement de `source` dans `handleWorkspaceChange`
- `src/store/gtm.js` — ajout de `workspaceName` dans `selectedSource`
- `services/gtmService.js` — nouvelle fonction `resolveDestinationWorkspace` (helper `createTempWorkspace` conservé), mise à jour de l'appel dans `copyElements`
