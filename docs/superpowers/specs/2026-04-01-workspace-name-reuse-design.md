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

Renommer `createTempWorkspace` en `resolveDestinationWorkspace` et ajouter le paramètre `sourceWorkspaceName` :

```js
const resolveDestinationWorkspace = async (googleUserId, accountId, containerId, sourceWorkspaceName) => {
  // Default Workspace → comportement actuel
  if (!sourceWorkspaceName || sourceWorkspaceName === 'Default Workspace') {
    return createTempWorkspace(googleUserId, accountId, containerId);
  }

  // Chercher un workspace existant avec ce nom
  const existingWorkspaces = await getWorkspaces(googleUserId, accountId, containerId);
  const existing = existingWorkspaces.find(w => w.name === sourceWorkspaceName);
  if (existing) {
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

## Cas limites

| Cas | Comportement |
|-----|-------------|
| Source = "Default Workspace" | `temp-copy-{timestamp}` (inchangé) |
| Workspace existant dans destination | Réutilisation, copie dans l'existant |
| Workspace inexistant dans destination | Création avec le nom source |
| `workspaceName` absent / null | Fallback vers comportement actuel |

## Fichiers modifiés

- `src/views/CopyPage.vue` — enrichissement de `source` dans `handleWorkspaceChange`
- `src/store/gtm.js` — ajout de `workspaceName` dans `selectedSource`
- `services/gtmService.js` — nouvelle fonction `resolveDestinationWorkspace`, mise à jour de l'appel dans `copyElements`
