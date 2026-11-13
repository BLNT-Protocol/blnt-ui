# BLNT Trade UI

An open-source interface for BLNT V3 and supported Blend markets. BLNT V3 is
an immutable lending protocol derived from Blend and designed to support
real-world assets.

## Getting Started

The Blend UI has network specific configurations and build commands, which all export the UI to `out/`.

This interface consumes the adjacent `blnt-sdk-js` checkout. Build that SDK
before installing or running the UI:

```bash
cd ../blnt-sdk-js
npm install
npm run build
cd ../blnt-ui
npm install
```

### Local development

Run this mainnet checkout at `http://localhost:3000` by default. If another port
is explicitly requested, substitute it for 3000 in the commands below. Before
starting the UI, check whether a process is listening on the selected port:

```bash
lsof -nP -iTCP:3000 -sTCP:LISTEN
```

If the command reports a listener, terminate that exact PID gracefully and wait
for the selected port to become available:

```bash
kill -TERM <PID>
```

Then start the UI on the selected local port:

```bash
npm run dev -- -p 3000
```

Do not allow Next.js to select another port automatically when the selected
port is occupied. Use a non-default port only when explicitly requested.

#### Testnet

The testnet configuration is located at `.env.testnet`. To build the testnet version, run:

```bash
npm run build:testnet
```

#### Mainnet

The mainnet configuration is located at `.env.production`. To build the mainnet version, run:

```bash
npm run build:mainnet
```

#### Standalone

It's recommended to edit the `.env.testnet` config file for any local or custom Blend deployment, then run:

```bash
npm run build:testnet
```

## IPFS Deployment

Version tags matching `v*` build the mainnet static export, convert it to a
local IPFS DAG, and pin the directory through Pinata. The workflow retrieves an
exact CAR export of the pinned CID through an independent IPFS gateway, imports
it locally, and byte-compares every exported file with the build. The GitHub
release contains the CID, source commit, archive, verified CAR, and checksums.
The tagged commit must be reachable from `main`, and the SDK commit is pinned in
the release workflow.

Configure the repository secret `PINATA_JWT_TOKEN` with a restricted Pinata
JWT before publishing a tag. To publish the GitHub release automatically, also
configure `RELEASE_TOKEN` with a repository-scoped fine-grained token that has
`Contents: write` and `Workflows: write`; otherwise, the workflow retains the
verified release bundle as a 30-day Actions artifact for a maintainer to
publish. Releases are available from the
[BLNT Trade releases page](https://github.com/BLNT-Protocol/blnt-ui/releases).

## Adding Custom Icons

Custom token and pool icons are configured in `src/external/icon-map.json` and loaded from the `public/icons` folder. Prefer SVG files. Icons are typically rendered at 30x30px with a border radius of 50% in the UI.

For contract token icons, add the SVG to `public/icons/tokens/` and add an entry to `contractTokenIcons`:

```json
{
  "contractTokenSymbol": "SolvBTC",
  "icon": "/icons/tokens/SolvBTC.svg"
}
```

For pool icons, add the SVG to `public/icons/pools/` and add an entry to `poolIcons` using the pool contract address:

```json
{
  "poolAddress": "POOL_CONTRACT_ADDRESS",
  "icon": "/icons/pools/example.svg"
}
```

If a contract token symbol or pool address is not configured, the UI uses the default Soroban token icon or Blend pool icon.

Before submitting a PR, follow the Getting Started instructions above to view the change locally to verify the icon looks correct. Once confirmed, please create a pull request with the icons and configuration updated, including some details that maintainers can use to verify the icon is the correct one to use.

## Contributing

Contributions are welcome! If you have any ideas, suggestions, or bug fixes, please feel free to open an issue or submit a pull request.
