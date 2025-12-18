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

### Quick Setup

1. **Clone the repository**
   ```bash
   git clone https://github.com/cthumerelle/gtmcopy.git
   cd gtmcopy
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure environment variables**
   ```bash
   cp .env.example .env
   ```
   Then edit `.env` with your Google OAuth credentials (see configuration section below).

4. **Start the development server**
   ```bash
   npm run dev
   ```

The application will be available at `http://localhost:3000`.

### Configuration

#### Google OAuth Setup

1. Go to the [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable the **Google Tag Manager API**
4. Go to **Credentials** > **Create credentials** > **OAuth 2.0 Client ID**
5. Set application type to **Web application**
6. Add authorized redirect URI: `http://localhost:3000/api/auth/google/callback`
7. Copy the Client ID and Client Secret to your `.env` file

#### Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `PORT` | Server port (default: 3000) | No |
| `NODE_ENV` | Environment (development/production) | No |
| `JWT_SECRET` | Secret for JWT tokens (change in production!) | Yes |
| `GOOGLE_CLIENT_ID` | Google OAuth Client ID | Yes |
| `GOOGLE_CLIENT_SECRET` | Google OAuth Client Secret | Yes |
| `GOOGLE_REDIRECT_URI` | OAuth redirect URI | Yes |

See [Installation Guide](docs/installation.md) for detailed setup instructions.

## Deployment

See [Deployment Guide](docs/deployment.md) for deployment options.

## License

MIT
