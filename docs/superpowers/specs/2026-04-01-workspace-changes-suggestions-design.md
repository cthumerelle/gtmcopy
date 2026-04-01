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

Dès que l'utilisateur sélectionne un workspace source, deux appels sont lancés en parallèle :

1. **Appels existants** : chargement de tous les éléments du workspace (tags, triggers, variables, templates, clients, transformations)
2. **Nouvel appel** : `GET /api/gtm/workspaces/:accountId/:containerId/:workspaceId/status`
   → appelle `accounts.containers.workspaces.getStatus` de l'API GTM v2

Le résultat du status est stocké dans le store Pinia sous `workspaceChanges` :

```js
workspaceChanges: {
  tags: { "<id>": "added" | "updated" | "deleted" },
  triggers: { ... },
  variables: { ... },
  templates: { ... },
  clients: { ... },
  transformations: { ... }
}
```

En Step 2, chaque élément est enrichi avec son `changeStatus` en faisant correspondre par ID. Les éléments sans changement n'ont pas de `changeStatus`.

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

Les éléments `deleted` sélectionnés sont transmis dans un champ séparé `deletedElements` (même structure que `selectedElements`) vers le backend.

Dans `gtmService.js`, pour chaque container cible :

1. Chercher l'élément par nom dans le workspace cible
2. Si trouvé → appeler l'endpoint DELETE de l'API GTM
3. Si non trouvé → skip silencieux (pas d'erreur)
4. Résultat reporté dans le résumé de copie (succès/échec) comme les autres opérations

Les éléments `deleted` sont **exclus** du flow `create/update` classique.

---

### 4. Gestion d'erreurs

- **Échec de `getStatus`** (timeout, permissions) : ignoré silencieusement. Step 2 s'affiche normalement sans suggestions. Pas de blocage.
- **Échec de suppression dans une cible** (permissions, dépendances) : reporté comme erreur dans le résumé de copie. On continue avec les autres éléments.

---

## Fichiers impactés

| Fichier | Modification |
|---------|-------------|
| `routes/gtm.js` | Nouvel endpoint `GET /workspaces/:accountId/:containerId/:workspaceId/status` |
| `services/gtmService.js` | Fonction `getWorkspaceStatus()` + gestion `deletedElements` dans `copyElements()` |
| `src/services/api.js` | Nouvelle méthode `getWorkspaceStatus()` |
| `src/store/gtm.js` | Nouveau state `workspaceChanges` + action `fetchWorkspaceStatus()` |
| `src/views/CopyPage.vue` | Appel parallèle du status, pré-sélection, badges visuels dans Step 2 |

---

## Ce qui est hors scope

- Affichage du détail des champs modifiés par élément
- Comparaison entre deux workspaces
- Historique des modifications
