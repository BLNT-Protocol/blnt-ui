import {
  BackstopAssetV3,
  BackstopPoolV3,
  BackstopTierV3,
  Version,
} from '@blend-capital/blend-sdk';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import { Box, IconButton, Typography, useTheme } from '@mui/material';
import type { NextPage } from 'next';
import { useRouter } from 'next/router';
import { Asset } from '@stellar/stellar-sdk';
import { BackstopExitAnvil } from '../components/backstop/BackstopExitAnvil';
import { BackstopJoinAnvil } from '../components/backstop/BackstopJoinAnvil';
import { Divider } from '../components/common/Divider';
import { GoBackButton } from '../components/common/GoBackButton';
import { Icon } from '../components/common/Icon';
import { Row } from '../components/common/Row';
import { Section, SectionSize } from '../components/common/Section';
import { Skeleton } from '../components/common/Skeleton';
import { StackedText } from '../components/common/StackedText';
import { ToggleButton } from '../components/common/ToggleButton';
import { ViewType, useSettings } from '../contexts';
import {
  useHorizonAccount,
  useBackstopPool,
  useManagedBackstopToken,
  usePoolMeta,
  useTokenBalance,
} from '../hooks/api';
import { getTierIcon } from '../utils/backstop';
import { toBalance } from '../utils/formatter';
import { BLND_ASSET, BLNT_ASSET, USDC_ASSET, V3_USDC_ASSET } from '../utils/token_display';

const BackstopToken: NextPage = () => {
  const theme = useTheme();
  const router = useRouter();
  const { showJoinPool, setShowJoinPool, viewType } = useSettings();
  const requestedTier = typeof router.query.tier === 'string' ? router.query.tier : undefined;
  const tier = Object.values(BackstopTierV3).includes(requestedTier as BackstopTierV3)
    ? (requestedTier as BackstopTierV3)
    : undefined;
  const version = router.query.version === Version.V2 ? Version.V2 : Version.V1;
  const poolId = typeof router.query.poolId === 'string' ? router.query.poolId : undefined;
  const {
    data: poolMeta,
    isError: isPoolMetaError,
  } = usePoolMeta(poolId ?? '', tier !== undefined);
  const {
    data: loadedBackstopPool,
    isError: isBackstopPoolError,
  } = useBackstopPool(poolMeta, tier !== undefined && poolMeta?.version === Version.V3);
  const v3Pool = loadedBackstopPool instanceof BackstopPoolV3 ? loadedBackstopPool : undefined;
  const configuredTier = tier === undefined ? undefined : v3Pool?.tiers[tier];
  const isManageableTier =
    configuredTier?.data.asset === BackstopAssetV3.BlntXlm ||
    configuredTier?.data.asset === BackstopAssetV3.BlntUsdc;
  const invalidTier = requestedTier !== undefined && tier === undefined;
  const tierLoadError = tier !== undefined && (isPoolMetaError || isBackstopPoolError);
  const tierRouteLoading =
    tier !== undefined &&
    poolId !== undefined &&
    !isPoolMetaError &&
    !isBackstopPoolError &&
    (poolMeta === undefined || (poolMeta.version === Version.V3 && v3Pool === undefined));
  const unconfiguredTier =
    tier !== undefined &&
    !tierLoadError &&
    !tierRouteLoading &&
    (poolId === undefined || poolMeta?.version !== Version.V3 || configuredTier === undefined);
  const plainAssetTier = configuredTier !== undefined && !isManageableTier;
  const { blndTokenId, cometPoolId, lpSymbol, pairSymbol, pairTokenId } = useManagedBackstopToken(
    tier,
    version,
    poolMeta
  );
  const isV3 = poolMeta?.version === Version.V3;
  const primaryAsset = isV3 ? BLNT_ASSET : BLND_ASSET;
  const primarySymbol = primaryAsset.code;
  const pairAsset =
    pairSymbol === 'XLM' ? Asset.native() : isV3 ? V3_USDC_ASSET : USDC_ASSET;
  const { data: horizonAccount } = useHorizonAccount();
  const { data: blndBalanceRes } = useTokenBalance(blndTokenId, primaryAsset, horizonAccount);
  const { data: usdcBalanceRes } = useTokenBalance(pairTokenId, pairAsset, horizonAccount);
  const { data: lpBalanceRes } = useTokenBalance(cometPoolId, undefined, horizonAccount);

  const blndBalance = blndBalanceRes ?? BigInt(0);
  const usdcBalance = usdcBalanceRes ?? BigInt(0);
  const lpBalance = lpBalanceRes ?? BigInt(0);

  const handleJoinPoolClick = () => {
    if (!showJoinPool) {
      setShowJoinPool(true);
    }
  };

  const handleExitPoolClick = () => {
    if (showJoinPool) {
      setShowJoinPool(false);
    }
  };

  const title =
    viewType === ViewType.MOBILE ? lpSymbol : `80:20 ${lpSymbol.replace(' LP', '')} Liquidity Pool`;
  const headerIcon =
    tier === undefined ? '/icons/pageicons/blnd_usdc_pair.svg' : getTierIcon(tier, cometPoolId);
  const lpIcon =
    tier === undefined ? '/icons/tokens/blndusdclp.svg' : getTierIcon(tier, cometPoolId);

  if (!router.isReady || tierRouteLoading) return <Skeleton />;

  if (invalidTier || tierLoadError || unconfiguredTier || plainAssetTier) {
    const title = tierLoadError
      ? 'Unable to load this backstop tier.'
      : invalidTier
      ? 'This backstop tier is not supported.'
      : unconfiguredTier
      ? 'This tier is not configured for this pool.'
      : 'This backstop tier is not an LP token.';
    const detail = tierLoadError
      ? 'Return to the pool backstop and try again.'
      : plainAssetTier
      ? 'Plain assets can be deposited directly and do not have Comet liquidity to manage.'
      : 'Return to the pool backstop and select one of its configured LP tiers.';
    return (
      <Row>
        <Section width={SectionSize.FULL} sx={{ padding: '12px' }}>
          <GoBackButton />
          <Box>
            <Typography variant="h4">{title}</Typography>
            <Typography variant="body2" color={theme.palette.text.secondary}>
              {detail}
            </Typography>
          </Box>
        </Section>
      </Row>
    );
  }

  return (
    <>
      <Row sx={{ margin: '12px', justifyContent: 'flex-start', alignItems: 'center' }}>
        <GoBackButton sx={{ backgroundColor: theme.palette.background.paper, margin: '12px' }} />
        <Icon
          src={headerIcon}
          alt={lpSymbol}
          isCircle={false}
          height={'30px'}
          width={'45px'}
          sx={{ marginRight: '12px' }}
        />
        <Typography variant="h2">{title}</Typography>
        <IconButton
          onClick={() =>
            window.open(
              `${process.env.NEXT_PUBLIC_STELLAR_EXPERT_URL}/contract/${cometPoolId}`,
              '_blank'
            )
          }
          size="small"
          sx={{
            marginLeft: '6px',
            color: theme.palette.text.secondary,
          }}
        >
          <OpenInNewIcon fontSize="inherit" />
        </IconButton>
      </Row>
      <Divider />
      <Row>
        <Section width={SectionSize.FULL} sx={{ padding: '0px' }}>
          <ToggleButton
            active={showJoinPool}
            palette={theme.palette.backstop}
            sx={{ width: '50%', padding: '12px' }}
            onClick={handleJoinPoolClick}
          >
            Join Pool
          </ToggleButton>
          <ToggleButton
            active={!showJoinPool}
            palette={theme.palette.backstop}
            sx={{ width: '50%', padding: '12px' }}
            onClick={handleExitPoolClick}
          >
            Exit Pool
          </ToggleButton>
        </Section>
      </Row>
      {viewType !== ViewType.REGULAR && (
        <Row>
          <Section
            width={SectionSize.FULL}
            sx={{ alignItems: 'center', justifyContent: 'flex-start', padding: '12px' }}
          >
            <Icon src={lpIcon} alt={`lp token icon`} sx={{ marginRight: '12px' }} />
            <StackedText
              title="Your LP Balance"
              titleColor="inherit"
              text={toBalance(lpBalance, 7)}
              textColor="inherit"
              type="large"
            />
          </Section>
        </Row>
      )}
      <Row>
        {viewType === ViewType.REGULAR && (
          <Section
            width={SectionSize.THIRD}
            sx={{ alignItems: 'center', justifyContent: 'flex-start', padding: '12px' }}
          >
            <Icon src={lpIcon} alt={`lp token icon`} sx={{ marginRight: '12px' }} />
            <StackedText
              title="Your LP Token Balance"
              titleColor="inherit"
              text={toBalance(lpBalance, 7)}
              textColor="inherit"
              type="large"
            />
          </Section>
        )}
        <Section
          width={viewType === ViewType.REGULAR ? SectionSize.THIRD : SectionSize.TILE}
          sx={{ alignItems: 'center', justifyContent: 'flex-start', padding: '12px' }}
        >
          <Icon
            src={isV3 ? '/icons/tokens/blnd-yellow.svg' : '/icons/tokens/blnd.svg'}
            alt={`${primarySymbol.toLowerCase()} icon`}
            sx={{ marginRight: '12px' }}
          />
          <StackedText
            title={`Your ${primarySymbol} Balance`}
            titleColor="inherit"
            text={toBalance(blndBalance, 7)}
            textColor="inherit"
            type="large"
          />
        </Section>
        <Section
          width={viewType === ViewType.REGULAR ? SectionSize.THIRD : SectionSize.TILE}
          sx={{ alignItems: 'center', justifyContent: 'flex-start', padding: '12px' }}
        >
          <Icon
            src={
              pairSymbol === 'XLM'
                ? '/icons/tokens/xlm.svg'
                : 'https://www.centre.io/images/usdc/usdc-icon-86074d9d49.png'
            }
            alt={`${pairSymbol.toLowerCase()} icon`}
            sx={{ marginRight: '12px' }}
          />
          <StackedText
            title={`Your ${pairSymbol} Balance`}
            titleColor="inherit"
            text={toBalance(usdcBalance, 7)}
            textColor="inherit"
            type="large"
          />
        </Section>
      </Row>

      {showJoinPool ? (
        <BackstopJoinAnvil key={tier ?? version} tier={tier} version={version} poolMeta={poolMeta} />
      ) : (
        <BackstopExitAnvil key={tier ?? version} tier={tier} version={version} poolMeta={poolMeta} />
      )}
    </>
  );
};

export default BackstopToken;
