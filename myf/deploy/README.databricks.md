# Databricks Deployment (Lakehouse Apps)

## Prerequisites
- Databricks workspace URL and a personal access token.
- Databricks CLI installed and configured on your machine.
- Lakehouse Apps enabled in your workspace.

## Build and Deploy
1. Install dependencies (one-time):
   - npm install
2. Build the frontend (generates dist/):
   - npm run build
3. Deploy to Databricks Workspace using the provided script:
   - powershell ./deploy/databricks-deploy.ps1 -Host https://<your-instance> -Token <your-token> -WorkspacePath /Workspace/Users/<you>/apps/Beacon-PBI/myf -AppName Beacon-PBI-myf

The script stages app.yaml, server.js, and dist/ and imports them to the Workspace path. If the CLI has Lakehouse Apps support, it will create/update the app pointing to that path.

## Lakehouse App Settings
- Command: node server.js
- Environment variables:
  - STATIC_ROOT=dist
  - PORT=8000 (Databricks will proxy externally)

## Workspace Folder Structure
Recommended minimal structure in Databricks Workspace:
- /Workspace/Users/<you>/apps/Beacon-PBI/myf/
  - app.yaml
  - server.js
  - dist/ (built static assets)

If you prefer keeping full source, you can import the entire repo, but the app should reference the minimal folder above for runtime.

## Job-Based Fallback
Jobs do not expose a web UI. Use Lakehouse Apps for UI hosting. If you must use a Job, you can run a task that does npm run build and node server.js, but it will not be accessible from the Databricks UI.

## Local Preview
- npm run dev for Vite dev server.
- Or after build: node server.js and open http://localhost:8000.
