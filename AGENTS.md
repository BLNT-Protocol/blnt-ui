# Repository Instructions

## Deployment identity

- This repository is the source for the BLNT Trade mainnet UI at
  `https://blnt.trade`.
- The `main` branch is automatically deployed to `https://blnt.trade`.
- Use this local checkout to inspect the mainnet site's source. Do not fetch or
  scrape the live site merely to determine what the repository deploys.
- The corresponding testnet UI is the sibling checkout at `../blnt-ui-testnet`;
  its `main` branch is automatically deployed to `https://blent.trade`.
- Keep shared branding, legal terms, and common UI behavior aligned between the
  two repositories while preserving intentional network-specific configuration,
  warnings, titles, and banners. Do not confuse `blnt.trade` (mainnet) with
  `blent.trade` (testnet).

## Local development server

- Use `http://localhost:3000` by default unless the user explicitly requests a
  different port.
- Before starting or restarting the UI, check for a listener on the selected
  TCP port, whether it is the default or an explicit override. If a process
  owns the port, terminate that exact process gracefully and wait for the port
  to become available.
- Start the default server with `npm run dev -- -p 3000`. Do not accept
  Next.js's automatic fallback to a different port; only use another port when
  the user explicitly overrides the default, and pass that port with `-p`.

Do not commit, push, or publish changes unless the user explicitly requests it.
