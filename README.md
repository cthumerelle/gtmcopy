# GTM Copy - Google Tag Manager Copy Tool

A Progressive Web Application (PWA) that allows users to copy Google Tag Manager elements (tags, triggers, variables, templates) between containers.

## Features

- **Google Authentication**: Secure OAuth2 authentication with Google
- **Multi-User Support**: Each user can access their own GTM accounts
- **Element Selection**: Copy selected elements (templates, tags, triggers, variables)
- **Multiple Destinations**: Copy to multiple target containers in one operation
- **Auto-Publishing**: Automatically publish changes to target containers
- **History Tracking**: View past copy operations and results
- **Local Storage**: Remember recent selections for faster workflows
- **Responsive Design**: Works on desktop and mobile devices

## Technology Stack

### Frontend
- Vue.js 3 (Composition API)
- TailwindCSS for styling
- Vite for build and development
- Progressive Web App (PWA) support

### Backend
- Node.js with Express
- Google APIs for Tag Manager integration
- OAuth2 authentication flow
- JWT for session management

### Database
- SQLite via Prisma ORM
- Stores OAuth tokens and copy history

## Project Structure

```
gtmcopy/
├── backend/             # Node.js Express backend
│   ├── middlewares/     # Express middlewares
│   ├── prisma/          # Prisma schema and migrations
│   ├── routes/          # API routes
│   ├── services/        # Business logic services
│   └── server.js        # Entry point
│
├── frontend/            # Vue.js frontend
│   ├── public/          # Static assets
│   └── src/
│       ├── assets/      # CSS and other assets
│       ├── components/  # Vue components
│       ├── services/    # API services
│       ├── store/       # Pinia stores
│       ├── views/       # Vue views/pages
│       └── main.js      # Entry point
│
└── docs/                # Documentation
    ├── installation.md  # Installation guide
    └── deployment.md    # Deployment guide
```

## Installation

See [Installation Guide](docs/installation.md) for detailed setup instructions.

## Deployment

See [Deployment Guide](docs/deployment.md) for deployment options.

## License

MIT
