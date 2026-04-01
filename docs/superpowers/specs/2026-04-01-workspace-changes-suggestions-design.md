# Design — Suggestions des modifications du workspace source

**Date** : 2026-04-01
**Statut** : Approuvé

## Contexte

Lors de la copie d'éléments GTM, l'utilisateur choisit un workspace source (Step 1) puis sélectionne les éléments à copier (Step 2). Actuellement, tous les éléments sont listés sans indication de ce qui a changé depuis la dernière publication.

L'API GTM expose un endpoint `getStatus` qui retourne la liste des éléments modifiés dans un workspace par rapport à la version publiée (statuts : `added`, `updated`, `deleted`).

## Objectif

Charger automatiquement le statut du workspace source et, en Step 2, pré-cocher et mettre en évidence les éléments modifiés pour guider l'utilisateur. Inclure la propagation des suppressions vers les containers cibles.

---

## Design

### 1. Flux de données

Quand l'utilisateur clique "Suivant" depuis Step 1, la fonction `loadSourceElements` (dans `CopyPage.vue`) déclenche en parallèle :

1. **Appels existants** : chargement de tous les éléments du workspace (tags, triggers, variables, templates, clients, transformations)
2. **Nouvel appel** : `GET /api/gtm/accounts/:accountId/containers/:containerId/workspaces/:workspaceId/status`
   → appelle `accounts.containers.workspaces.getStatus` de l'API GTM v2

#### Forme de la réponse GTM

L'API retourne un tableau plat d'objets de changement :
```js
[
  { changeType: "added",   tag:      { tagId: "42",  name: "..." } },
  { changeType: "updated", trigger:  { triggerId: "7", name: "..." } },
  { changeType: "deleted", variable: { variableId: "3", name: "..." } },
  // ...
]
```

Cette réponse est normalisée côté backend en une map par type :
```js
{
  tags:            { "42": "added" },
  triggers:        { "7": "updated" },
  variables:       { "3": "deleted" },
  templates:       {},
  clients:         {},
  transformations: {}
}
```

Cette map est stockée dans le store Pinia sous `workspaceChanges`.

#### Rendu en Step 2

L'appel `getStatus` est lancé avec `Promise.allSettled` aux côtés des appels d'éléments. Step 2 s'affiche quand **tous** les appels sont terminés (succès ou échec). Les badges sont donc présents dès le premier rendu — il n'y a pas d'affichage en deux temps.

---

### 2. Interface — Step 2

Chaque élément de la liste affiche un badge coloré selon son statut :

| Statut | Badge | Couleur |
|--------|-------|---------|
| `added` | "Nouveau" | Vert |
| `updated` | "Modifié" | Bleu |
| `deleted` | "Suppression ⚠" | Rouge |

**Pré-sélection automatique** :
- `added` → pré-coché
- `updated` → pré-coché
- `deleted` → pré-coché, avec texte barré ou grisé + badge rouge pour signaler l'intention destructive

L'utilisateur reste libre de décocher n'importe quel élément.

Si le workspace n'a aucune modification, l'interface reste identique à aujourd'hui.

---

### 3. Logique de copie — suppressions

#### Transport des suppressions

`CopyPage.vue` appelle `api.gtm.copyElements` directement (il ne passe pas par l'action `performCopy` du store). La signature est étendue :

```js
// src/services/api.js
copyElements(source, targets, elementTypes, selectedElements, deletedElements, autoPublish = true)
```

`deletedElements` a la même structure que `selectedElements` :
```js
deletedElements: {
  tags: ["42"],
  triggers: [],
  variables: ["3"],
  // ...
}
```

#### Exécution dans `gtmService.js`

Pour chaque container cible :

1. Chercher l'élément par **nom exact** (case-sensitive) dans le workspace cible
   — *Note : c'est une contrainte acceptée. Les IDs différant entre containers, le nom est l'unique identifiant commun.*
2. Si trouvé → appeler l'endpoint DELETE de l'API GTM
3. Si non trouvé → skip silencieux (pas d'erreur)
4. Résultat reporté dans le résumé de copie (succès/échec) comme les autres opérations

Les éléments `deleted` sélectionnés sont **exclus** du flow `create/update` classique.

---

### 4. Gestion d'erreurs

- **Échec de `getStatus`** (timeout, permissions) : ignoré silencieusement. `workspaceChanges` reste vide. Step 2 s'affiche normalement sans suggestions. Pas de blocage.
- **Échec de suppression dans une cible** (permissions, dépendances) : reporté comme erreur dans le résumé de copie. On continue avec les autres éléments.

---

## Fichiers impactés

| Fichier | Modification |
|---------|-------------|
| `routes/gtm.js` | Nouvel endpoint `GET /accounts/:accountId/containers/:containerId/workspaces/:workspaceId/status` |
| `services/gtmService.js` | Fonction `getWorkspaceStatus()` + gestion `deletedElements` dans `copyElements()` |
| `src/services/api.js` | Nouvelle méthode `getWorkspaceStatus()` + paramètre `deletedElements` dans `copyElements()` |
| `src/store/gtm.js` | Nouveau state `workspaceChanges` + action `fetchWorkspaceStatus()` |
| `src/views/CopyPage.vue` | Appel `getStatus` en parallèle dans `loadSourceElements`, pré-sélection, badges visuels, passage de `deletedElements` à `copyElements` |

---

## Ce qui est hors scope

- Affichage du détail des champs modifiés par élément
- Comparaison entre deux workspaces
- Historique des modifications
