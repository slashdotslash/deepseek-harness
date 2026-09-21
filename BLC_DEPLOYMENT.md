# BLC.AI browser deployment

This fork customizes the Web shell favicon and sidebar wordmark for BLC.AI. It retains the upstream DeepSeek Harness name and MIT license. `apps/web/public/blc-brand.css` applies the deployment branding; `blc-logo.svg` is the BLC.AI logo.

The production integration runs the official dsh profile on loopback inside a dedicated container. A local gateway serves the branded frontend and forwards API traffic. The external reverse proxy authenticates every request against the BLC.AI main-administrator session. Do not expose the unprotected dsh listener or mount the Docker socket, host SSH credentials, application secrets, or other projects.

The working copy contains BLC.AI source only. Changes are exported for review and go through staging and an explicit administrator promotion; the container has no production deployment credentials.
