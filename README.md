# Blend UI

An open source UI for interacting with the Blend Protocol.

## Getting Started

The Blend UI has network specific configurations and build commands, which all export the UI to `out/`.

This candidate consumes the adjacent `blend-sdk-js` checkout. Build that SDK
before installing or running the UI:

```bash
cd ../blend-sdk-js
npm install
npm run build
cd ../blend-ui
npm install
```

To run the testnet UI as a development server, run:

```bash
npm run dev:testnet
```

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

Each release gets deployed to IPFS automatically. To get the latest release, please see the [Releases page](https://github.com/blend-capital/blend-ui/releases).

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
