# Vercel Deployment

The app can deploy to Vercel as a standard Next.js project. It has no database and no required runtime services; `data/` and `Resources/` are part of the repository and must be included in the deployment artifact.

## Import the Repository

1. Push the repository to GitHub, GitLab, or Bitbucket.
2. In Vercel, create a new project and import the Git repository.
3. Select the Next.js framework preset.

## Build Settings

Use these settings:

- install command: Vercel default, or `npm install` if you need to set it explicitly;
- build command: `npm run build`;
- output directory: Vercel default for Next.js;
- development command: `npm run dev` if you need to set it explicitly.

`npm run build` runs `npm run validate:data` before `next build`, so deployment fails if any file in `data/` violates `src/shared/epd/schema.ts`.

## Environment Variables

No runtime environment variables are required for the current deployed app.

Do not add extraction secrets to Vercel unless you later create server-side features that use them at runtime. `LLM_API_KEY`, `LLM_MODEL`, `LLM_API_URL`, and `OCR_DPI` are for offline extraction or schema conversion only.

## Deployments

Vercel creates Preview Deployments for branch pushes and Production Deployments for the production branch. Use the Preview Deployment to smoke-check data and PDF routing before promoting changes.

## Post-Deploy Smoke Checks

After deployment:

1. Open the deployment URL and confirm the comparison table loads.
2. Open `/api/epds` and confirm it returns `{ "epds": [...] }`.
3. Click a reported carbon value in the UI and confirm the source drawer shows a PDF preview.
4. Confirm no reported value has lost its page and quote evidence.

## Common Issues

### Build fails during `validate:data`

Run the same command locally:

```bash
npm run validate:data
```

Fix the reported JSON file before redeploying.

### PDF preview returns `404`

Confirm the JSON `sourcePdf` value points to an existing file under `Resources/` and that the file is committed.

### PDF preview returns `400`

The PDF API only accepts `.pdf` files and rejects paths outside `Resources/`. Use a plain PDF filename or a path starting with `Resources/`.
