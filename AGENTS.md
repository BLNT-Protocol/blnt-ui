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

## IPFS releases

- Publishing to `blnt.xlm.sh` is a deliberate release process; pushes to
  `main` update GitHub Pages but do not update the IPFS endpoint.
- Before publishing, require a clean worktree, fetch `origin/main` and tags,
  and verify that local `HEAD` equals `origin/main`.
- Select the next appropriate semantic version and create a new annotated
  `vMAJOR.MINOR.PATCH` tag on that exact commit. Never move or rebuild an
  existing release tag. Pushing the tag triggers
  `.github/workflows/release_ipfs.yml`.
- Wait for the IPFS release workflow to finish successfully. Verify that its
  GitHub release records the expected source commit and contains the CID,
  archive, verified CAR, and checksums before changing the live pointer.
- Update the domain owner's `app.xlm_sh.ipfs` data entry to the verified CID
  using an authorized transaction. Decode and review the exact account, key,
  CID, and fee before submission. Never place production signing authority or
  a replacement software key in GitHub Actions.
- After submission, allow for the `xlm.sh` cache and then verify that
  `https://blnt.xlm.sh/` returns HTTP 200 and its `x-ipfs-roots` header contains
  the new CID. Keep the previous pin available unless the user explicitly
  requests its removal.
- If release publication fails after the verified artifact bundle is
  preserved, use that bundle for recovery rather than rebuilding or repinning
  the same tag.

Do not commit, push, or publish changes unless the user explicitly requests it.
