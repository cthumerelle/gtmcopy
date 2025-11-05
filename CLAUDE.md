# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build Commands
- `npm run dev` - Starts the combined server (API + frontend)
- `npm run client` - Starts Vite dev server only
- `npm run build` - Builds the frontend for production
- `npm run preview` - Previews the built app

## Code Style Guidelines
- **Formatting**: Use 2 spaces for indentation
- **Imports**: Group imports by type (Vue, external libraries, local files)
- **Components**: Use composition API with `<script setup>` in Vue components
- **State Management**: Use Pinia stores for global state
- **Error Handling**: Use try/catch blocks and console.error for errors
- **Naming Conventions**:
  - camelCase for variables and functions
  - PascalCase for components
  - kebab-case for file names
- **API Services**: Use modular services for API calls
- **Type Safety**: Use JSDoc comments for type documentation
- **Auth**: Handle authentication via centralized auth store

## Project Structure
- Frontend: Vue 3 with Vue Router and Pinia
- Backend: Express.js with Google OAuth
- Authentication: JWT tokens in cookies
- Storage: Local storage for development