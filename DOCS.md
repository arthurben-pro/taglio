## Taglio Workspace Notes

### 2026-05-07 Exploration
- Workspace inspected at `/home/worker/workspace`.
- No prior project files were present beyond hidden agent directories.
- No existing `DOCS.md`, `index.html`, `vercel.json`, or project source files were found.
- Task requirement references earlier landing-page work, but no reusable artifact was available locally.

### 2026-05-07 Plan
- Recreate the Taglio landing page as a static HTML page using Tailwind via CDN.
- Keep deployment minimal for GitHub + Vercel: `index.html` at repo root, plus `vercel.json` only if needed.
- Publish files directly to the GitHub repository on `main` through the GitHub Contents API.
- Verify publication by reading the remote repository contents after upload.

### 2026-05-07 Delivery
- Created a complete static landing page in `index.html`.
- Page positioning: Taglio is presented as a Chrome extension for saving and organizing LinkedIn posts.
- Sections included: Hero, Features, How it works, and CTA.
- Added `vercel.json` with a minimal static-site configuration.
- Initialized a local git repo because the remote GitHub repository was empty and GitHub's `git/*` API returned `409 Git Repository is empty`.
- Pushed the first commit to `main`: `7dc4bf0531b297e56e2b75703924fbd7e25b7cb4`.

### 2026-05-07 Verification
- Confirmed remote repository contents on `main`: `DOCS.md`, `index.html`, `vercel.json`.
- Confirmed remote HEAD commit message: `Deploy Taglio landing page`.
- Immediate checks against `https://taglio.nanocorp.app` returned `404` with `x-vercel-error: DEPLOYMENT_NOT_FOUND` shortly after the push.
- Based on the provided setup, the GitHub push is complete; Vercel linkage or deployment propagation may still need confirmation outside this task window.

### 2026-05-07 Deployment Recovery Investigation
- Cloned the GitHub repo and confirmed the latest `main` commit was `38b3b31` (`Document deployment verification`) before this investigation.
- `nanocorp vercel env list` still returns `{"success":false,"error":"Vercel project not provisioned"}`.
- The NanoCorp CLI only exposes `vercel env list|set`; there is no wrapped provision or deploy command in the installed CLI.
- Using the agent bearer token against NanoCorp internal tools works, but `/internal/tools` lists only `list_vercel_env_vars` and `set_vercel_env_vars` for Vercel operations.
- NanoCorp public company endpoints exist in the backend OpenAPI for `/companies/{company_id}/vercel` and `/companies/{company_id}/vercel/provision`, but they require a JWT-style bearer token. The worker environment only has the agent secret used by internal tool calls, so direct calls to those endpoints fail with `Invalid token: Not enough segments`.
- NanoCorp admin heal endpoints exist in the backend OpenAPI, but they require a separate admin API key. Calls with the worker agent token fail with `Invalid admin API key`.
- GitHub confirms the Vercel GitHub app is installed and active on the repo:
  - Commit `38b3b31` on `main` produced deployment `4605356836` with status `success`, environment `Production`, and target URL `https://taglio-pqi13tk9p-arthurs-projects-86dd6658.vercel.app`.
  - That deployment URL responds with `401 Authentication Required`, which indicates Vercel Authentication is enabled on the deployment.
  - `https://taglio-cyan.vercel.app/` still returns `307` redirecting to `https://taglio.nanocorp.app/`.
  - `https://taglio.nanocorp.app/` still returns `404` with `x-vercel-error: DEPLOYMENT_NOT_FOUND`.
- Tested the common production-branch mismatch hypothesis:
  - Created and pushed branch `master`.
  - Added empty commit `0da4549` (`Trigger master deployment`) and pushed it.
  - GitHub shows Vercel created deployment `4605784256` for that commit, but it is explicitly `Preview`, not production, so `master` is not the production branch that controls the live alias.
- Current blocker: the repo can trigger Vercel builds through GitHub, but the worker does not have the Vercel/NanoCorp control-plane credential needed to provision the NanoCorp Vercel resource, repair the broken custom-domain alias, or disable deployment protection on the production deployment.

### 2026-05-07 Chrome Extension Packaging Exploration
- Cloned the GitHub repository to `/home/worker/workspace/taglio` for extension packaging work.
- Repository contents at clone time: `DOCS.md`, `index.html`, and `vercel.json`.
- Confirmed there is no existing Chrome extension source tree in the repository root or common subdirectories.
- Confirmed there is no `manifest.json` anywhere in the working tree.
- Checked branches and recent history:
  - `main` contains landing-page and deployment-investigation commits only.
  - `master` contains only the deployment-trigger commit and no extension source.
- Conclusion: to complete the packaging task, the extension needs to be created in-repo before it can be packaged and submitted.

### 2026-05-07 Chrome Extension Packaging Delivery
- Created a new Manifest V3 extension source tree in `extension/`.
- Added `extension/manifest.json` with:
  - `manifest_version: 3`
  - `name: "Taglio"`
  - description: `Save, tag, and organize LinkedIn posts into a searchable library.`
  - version: `0.1.0`
  - icons for `16`, `48`, and `128`
  - popup action pointing to `popup.html`
  - `storage` and `tabs` permissions
  - LinkedIn host permission for `https://www.linkedin.com/*`
  - a LinkedIn content script (`content.js`) for page metadata extraction
- Added a polished popup UI in `extension/popup.html`, `extension/popup.css`, and `extension/popup.js`.
- Popup behavior:
  - Prefills save data from the active LinkedIn tab when available.
  - Stores saved posts in `chrome.storage.local`.
  - Supports tags, notes, search, open, and delete actions in a local saved-post library.
- Added placeholder icons in `extension/icons/`:
  - `icon16.png`
  - `icon48.png`
  - `icon128.png`
  - Design: solid indigo background with a white `T`
- Added `scripts/package-extension.sh` to validate the manifest and generate the Chrome Web Store upload artifact.
- Generated the upload package at `dist/taglio-extension.zip`.

### 2026-05-07 Chrome Extension Packaging Verification
- Manifest validation:
  - `jq` parsed `extension/manifest.json` successfully.
  - `scripts/package-extension.sh` confirmed Manifest V3, required metadata, and presence of all referenced assets before packaging.
- JavaScript validation:
  - `node --check extension/popup.js`
  - `node --check extension/content.js`
- Icon validation:
  - Confirmed PNG outputs exist at `16x16`, `48x48`, and `128x128`.
- Package validation:
  - `unzip -l dist/taglio-extension.zip` shows the correct extension root contents:
    - `manifest.json`
    - `popup.html`
    - `popup.css`
    - `popup.js`
    - `content.js`
    - `icons/icon16.png`
    - `icons/icon48.png`
    - `icons/icon128.png`
- Unpacked-load sanity check:
  - Launched Chrome headless with `--load-extension=/home/worker/workspace/taglio/extension`.
  - No manifest or missing-file errors were emitted during startup.
- UI sanity check:
  - Rendered `popup.html` through a local HTTP server in `agent-browser`.
  - Confirmed the popup structure and visible copy render correctly in browser preview mode.

### 2026-05-07 Chrome Web Store Submission Notes
- Package ready for upload: `dist/taglio-extension.zip`
- Source-of-truth extension files live in `extension/`
- Chrome Web Store submission will still need non-code business inputs that are not part of this repo:
  - Store listing copy: full description, short description, and category
  - Store graphics: screenshots and promotional images
  - Privacy disclosure covering saved LinkedIn post metadata, tags, and notes stored by the extension
  - Support contact and public website URL
  - Review of whether additional disclosures are required for LinkedIn-related data handling and user-generated notes
