import type { Version as SdkVersion } from '@blend-capital/blend-sdk';

/**
 * Blend deployments supported by the UI. V2.1 runs the same contracts as V2 with its own
 * backstop and BLND-USDC LP pool, while V3 uses the candidate contracts and BLNT.
 */
export enum Version {
  V1 = 'V1',
  V2 = 'V2',
  V2_1 = 'V2.1',
  V3 = 'V3',
}

export type VersionLike = Version | SdkVersion;

/**
 * The backstop contract for each deployment. A deployment without a configured backstop is
 * omitted from the UI.
 */
export const BACKSTOP_IDS: Record<Version, string> = {
  [Version.V1]: process.env.NEXT_PUBLIC_BACKSTOP || '',
  [Version.V2]: process.env.NEXT_PUBLIC_BACKSTOP_V2 || '',
  [Version.V2_1]: process.env.NEXT_PUBLIC_BACKSTOP_V2_1 || '',
  [Version.V3]: process.env.NEXT_PUBLIC_BACKSTOP_V3 || '',
};

/** The configured deployments, in selector order. */
export const ENABLED_VERSIONS: Version[] = Object.values(Version).filter(
  (version) => BACKSTOP_IDS[version] !== ''
);

/** The newest configured deployment. */
export const LATEST_VERSION: Version = ENABLED_VERSIONS[ENABLED_VERSIONS.length - 1] ?? Version.V1;

/** Whether a deployment runs the V2 contracts. */
export function isV2Contracts(version: Version | undefined): boolean {
  return version === Version.V2 || version === Version.V2_1;
}

/** Normalize SDK pool versions and UI deployment versions for configuration lookup. */
export function normalizeVersion(version: VersionLike | undefined): Version {
  switch (version as string | undefined) {
    case Version.V2_1:
      return Version.V2_1;
    case Version.V2:
      return Version.V2;
    case Version.V3:
      return Version.V3;
    default:
      return Version.V1;
  }
}

/** Resolve the deployment for an SDK pool without changing its contract-version semantics. */
export function getPoolDeploymentVersion(pool: {
  version: VersionLike;
  metadata: { backstop: string };
}): Version {
  if (pool.metadata.backstop === BACKSTOP_IDS[Version.V2_1]) return Version.V2_1;
  if (pool.metadata.backstop === BACKSTOP_IDS[Version.V3]) return Version.V3;
  return normalizeVersion(pool.version);
}
