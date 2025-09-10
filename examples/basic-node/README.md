# dotenv-guard example: Basic Node app

This is a minimal Node.js example showing how to use dotenv-guard to generate a schema and validate env vars before start.

## Setup

```bash
npm install
```

## Generate schema from .env

```bash
npm run env:gen
```

This will create `.env.schema.json` and `.env.example` in this folder.

## Run the app (validates first)

```bash
npm start
```

The `prestart` script runs `dotenv-guard validate --quiet` to ensure env vars are correct.

Open http://localhost:3000 to see the running app.


