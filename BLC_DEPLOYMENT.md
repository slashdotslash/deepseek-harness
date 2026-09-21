# BLC.AI browser deployment

This fork presents the editor as BLC Harness and retains the upstream MIT license. The gateway replaces the product name in browser assets and the page title. `apps/web/public/blc-brand.css` applies the BLC.AI logo to the full sidebar, collapsed rail and welcome screen, keeps the mark square and hides the upstream Preview badge; `blc-logo.svg` is the original BLC.AI logo.

The production integration runs the official dsh profile on loopback inside a dedicated container. A local gateway serves the branded frontend and forwards API traffic. The external reverse proxy authenticates every request against the BLC.AI main-administrator session. Do not expose the unprotected dsh listener or mount the Docker socket, host SSH credentials, application secrets, or other projects.

The working copy contains BLC.AI source only. Changes are exported for review and go through staging and an explicit administrator promotion; the container has no production deployment credentials.

The gateway exchanges the upstream one-time launch token for an internal authentication cookie and keeps it in memory. It redacts launch tokens from logs, never forwards browser credentials to the editor, and never sends the internal cookie to the browser. BLC main-admin authorization remains mandatory on every public request.
