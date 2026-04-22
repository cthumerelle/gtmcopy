# Documentation Agent - GTM Copy

Ce fichier sert de point de référence et de contexte global pour les assistants IA travaillant sur le projet **GTM Copy**. Il résume le but de l'application, l'architecture, la stack technique et les règles d'évolution.

## 🎯 Objectif du Projet
**GTM Copy** est une application web (PWA) conçue pour automatiser et faciliter la copie d'éléments (Balises, Déclencheurs, Variables, Modèles) entre différents comptes et conteneurs **Google Tag Manager** (GTM). Elle permet à un utilisateur de se connecter avec Google et d'opérer des migrations de configuration en quelques clics.

## 🏗️ Stack Technique et Architecture
Le projet combine le backend et le frontend au sein d'une même arborescence, gérée par un seul processus node lors du développement :
- **Frontend** : Vue.js 3 (Composition API), Vite, TailwindCSS, Pinia pour la gestion d'état, et Vue Router. Le code source est dans le dossier `src/`.
- **Backend** : Node.js avec Express (`server.js`, `routes/`, `middlewares/`, `services/`). Il gère l'authentification OAuth2 et communique avec l'API Google Tag Manager.
- **Serveur de Dev** : `server.js` lance à la fois l'API et le serveur de développement Vite (middleware mode) pour un flux de travail unifié (`npm run dev`).

## 🛡️ Contexte de Sécurité et GDPR (Important)
Pour des raisons de conformité au RGPD et de sécurité, le projet a évolué vers une approche **"zéro base de données serveur"** :
- **Pas de BDD** : Prisma et SQLite ont été retirés.
- **Sessions** : Les tokens OAuth et sessions sont gérés temporairement en mémoire via `express-session` et des cookies HTTP-Only sécurisés.
- **Client-Side Storage** : L'historique des copies et les préférences de l'utilisateur doivent être stockés uniquement côté navigateur (via `localStorage`), garantissant que le serveur ne conserve aucune donnée personnelle persistante.

## 🚀 Directives pour les Évolutions Futures
Pour travailler efficacement ensemble sur de nouvelles fonctionnalités, voici les principes que l'agent doit respecter :
1. **Zéro persistance serveur** : Toute nouvelle fonctionnalité nécessitant de la persistance de données utilisateur doit être implémentée via le `localStorage` côté client (Vue/Pinia).
2. **Impact Full-Stack** : Les ajouts de fonctionnalités GTM se font souvent en deux temps : ajout de la logique métier dans `services/gtm.js` et `routes/gtm.js` (backend), puis intégration dans l'interface Vue (frontend).
3. **Style de code** : 
   - Utiliser `<script setup>` pour tous les nouveaux composants Vue.
   - Les appels API côté frontend doivent être encapsulés proprement.
   - Gérer systématiquement les erreurs (try/catch) car l'API GTM peut renvoyer des erreurs de permission ou de quota.
4. **Complémentarité** : Le fichier `CLAUDE.md` détaille les commandes NPM et les conventions de nommage à suivre impérativement.

*Ce fichier a pour but d'accélérer l'intégration de tout agent sur le projet et de s'assurer que les choix architecturaux forts (comme l'absence de base de données) sont maintenus.*
