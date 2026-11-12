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

Do not commit, push, or publish changes unless the user explicitly requests it.
