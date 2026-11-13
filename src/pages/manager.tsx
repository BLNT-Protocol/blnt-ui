import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import { Box, Input, MenuItem, Select, Tooltip, Typography, useTheme } from '@mui/material';
import { Asset, rpc, scValToNative, xdr } from '@stellar/stellar-sdk';
import type { NextPage } from 'next';
import { useRouter } from 'next/router';
import { ReactNode, useEffect, useState } from 'react';
import { Divider } from '../components/common/Divider';
import { OpaqueButton } from '../components/common/OpaqueButton';
import { Row } from '../components/common/Row';
import { Section, SectionSize } from '../components/common/Section';
import { Skeleton } from '../components/common/Skeleton';
import { useSettings, ViewType } from '../contexts';
import { useWallet } from '../contexts/wallet';
import { useSimulateOperation } from '../hooks/api';
import {
  useBackstopManager,
  useSavedBackstopManagers,
  useWalletNativeReserve,
  useWalletTokenBalances,
} from '../hooks/backstopManager';
import {
  ACTION_SCOPE,
  ASSET_LABEL,
  BackstopManagerRestoreRequiredError,
  BackstopManagerState,
  canPerform,
  defaultDeposit,
  defaultQueueShares,
  joinMaxAmountsIn,
  lessSlippage,
  ManagerAction,
  managerOps,
  ManagerPosition,
  maturedShares,
  maxJoinOut,
  positionEarnings,
  positionValue,
  queuedShares,
  SCOPE_NAMES,
} from '../utils/backstop_manager';
import { toBalance, toCompactAddress } from '../utils/formatter';
import { bigintToInput, scaleInputToBigInt } from '../utils/scval';

const DECIMALS = 7;
const SLIPPAGE_BPS = BigInt(100);
const EXPERT_URL = process.env.NEXT_PUBLIC_STELLAR_EXPERT_URL;

const fmt = (amount: bigint) => toBalance(amount, DECIMALS);
const fmtExact = (amount: bigint) => bigintToInput(amount, DECIMALS);
const isContractId = (id: string) => /^C[A-Z2-7]{55}$/.test(id);

/** Parse a token amount; empty means the default. Returns undefined when invalid. */
function parseAmount(input: string, fallback: bigint): bigint | undefined {
  if (input.trim() === '') return fallback;
  if (!/^\d*\.?\d{0,7}$/.test(input) || input === '.') return undefined;
  return scaleInputToBigInt(input, DECIMALS);
}

const ExplorerLink: React.FC<{ id: string; kind?: 'contract' | 'account' }> = ({ id, kind }) => (
  <a
    href={`${EXPERT_URL}/${kind ?? (id.startsWith('C') ? 'contract' : 'account')}/${id}`}
    target="_blank"
    rel="noreferrer"
    style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: 'inherit' }}
  >
    <Tooltip title={id}>
      <Typography variant="body1" component="span">
        {toCompactAddress(id)}
      </Typography>
    </Tooltip>
    <OpenInNewIcon fontSize="inherit" />
  </a>
);

const Stat: React.FC<{ label: string; tooltip?: string; children: ReactNode }> = ({
  label,
  tooltip,
  children,
}) => {
  const theme = useTheme();
  return (
    <>
      <Tooltip title={tooltip ?? ''} placement="top-start">
        <Typography variant="body2" sx={{ color: theme.palette.text.secondary }}>
          {label}
        </Typography>
      </Tooltip>
      <Box>{children}</Box>
    </>
  );
};

const AmountInput: React.FC<{
  value: string;
  onChange: (value: string) => void;
  placeholder: bigint;
  symbol: string;
}> = ({ value, onChange, placeholder, symbol }) => {
  const theme = useTheme();
  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        padding: '3px 12px',
        borderRadius: '5px',
        backgroundColor: theme.palette.accent.main,
        flexGrow: 1,
        minWidth: '180px',
      }}
    >
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/[^0-9.]/g, ''))}
        placeholder={fmtExact(placeholder)}
        disableUnderline
        sx={{ flexGrow: 1 }}
      />
      <Typography variant="h5" sx={{ color: theme.palette.text.secondary, marginLeft: '8px' }}>
        {symbol}
      </Typography>
    </Box>
  );
};

/** One operation: what it does, who may do it, an optional input and a submit button. */
const ActionRow: React.FC<{
  action: ManagerAction;
  title: string;
  description: ReactNode;
  allowed: boolean;
  disabled: boolean;
  button: string;
  onSubmit: () => Promise<void>;
  children?: ReactNode;
}> = ({ action, title, description, allowed, disabled, button, onSubmit, children }) => {
  const theme = useTheme();
  const { viewType } = useSettings();
  const { connected } = useWallet();
  const [busy, setBusy] = useState(false);
  const scope = ACTION_SCOPE[action];
  const scopeLabel = scope === undefined ? 'Anyone' : `${SCOPE_NAMES[scope]} scope`;

  return (
    <Box
      sx={{ padding: '12px', borderRadius: '5px', background: theme.palette.background.default }}
    >
      <Row sx={{ justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '4px' }}>
        <Typography variant="h3">{title}</Typography>
        <Typography
          variant="body2"
          sx={{ color: allowed ? theme.palette.backstop.main : theme.palette.text.secondary }}
        >
          {scopeLabel}
        </Typography>
      </Row>
      <Typography variant="body2" sx={{ color: theme.palette.text.secondary, marginBottom: '8px' }}>
        {description}
      </Typography>
      <Box
        sx={{
          display: 'flex',
          flexDirection: viewType === ViewType.REGULAR ? 'row' : 'column',
          gap: '8px',
          alignItems: viewType === ViewType.REGULAR ? 'center' : 'stretch',
        }}
      >
        {children}
        <OpaqueButton
          palette={theme.palette.backstop}
          disabled={!allowed || disabled || busy}
          onClick={async () => {
            setBusy(true);
            try {
              await onSubmit();
            } finally {
              setBusy(false);
            }
          }}
          sx={{ minWidth: '140px', padding: '8px' }}
        >
          {allowed ? button : connected ? 'Not permitted' : 'Connect wallet'}
        </OpaqueButton>
      </Box>
    </Box>
  );
};

const PositionCard: React.FC<{ state: BackstopManagerState; position: ManagerPosition }> = ({
  state,
  position: p,
}) => {
  const theme = useTheme();
  const { viewType, network } = useSettings();
  const { walletAddress, connected, backstopManagerInvoke } = useWallet();
  const can = (action: ManagerAction) => connected && canPerform(state, walletAddress, action);
  const lp = p.lpToken;
  const now = Math.floor(Date.now() / 1000);

  const [fundToken, setFundToken] = useState(0);
  const [fundAmount, setFundAmount] = useState('');
  const [joinAmount, setJoinAmount] = useState('');
  const [depositAmount, setDepositAmount] = useState('');
  const [queueAmount, setQueueAmount] = useState('');
  const [withdrawAmount, setWithdrawAmount] = useState('');

  const send = async (op: xdr.Operation, clear?: () => void) => {
    await backstopManagerInvoke(op, false, p.pool);
    clear?.();
  };

  // Fund: the LP token or one of its underlying tokens, from the wallet
  const fundTokens = [lp, ...p.underlying];
  const { data: walletBalances } = useWalletTokenBalances(
    fundTokens.map((t) => t.id),
    connected
  );
  const nativeTokenId = Asset.native().contractId(network.passphrase);
  const fundHeld = walletBalances?.[fundToken] ?? BigInt(0);
  const fundIsXlm = fundTokens[fundToken].id === nativeTokenId;
  const { data: nativeReserve } = useWalletNativeReserve(connected && fundIsXlm);
  const fundMax = fundIsXlm
    ? nativeReserve !== undefined && fundHeld > nativeReserve
      ? fundHeld - nativeReserve
      : BigInt(0)
    : fundHeld;
  const fundDefault = fundMax;
  const fund = parseAmount(fundAmount, fundDefault);

  // Join
  const joinMax = maxJoinOut(p);
  const joinDefault = lessSlippage(joinMax, SLIPPAGE_BPS);
  const join = parseAmount(joinAmount, joinDefault);
  const joinMaxIn =
    join !== undefined && join > BigInt(0) ? joinMaxAmountsIn(p, join, SLIPPAGE_BPS) : [];

  // Deposit
  const depositDefaultAmount = defaultDeposit(p);
  const deposit = parseAmount(depositAmount, depositDefaultAmount);

  // Claim: simulate with no minimum to see what it would mint
  const claimSimOp = can('claim')
    ? managerOps.claim(state.id, walletAddress, p, BigInt(0)).toXDR('base64')
    : '';
  const { data: claimSim, isLoading: claimLoading } = useSimulateOperation(
    claimSimOp,
    claimSimOp !== ''
  );
  const claimEstimate =
    claimSim !== undefined &&
    rpc.Api.isSimulationSuccess(claimSim) &&
    claimSim.result?.retval !== undefined
      ? BigInt(scValToNative(claimSim.result.retval))
      : undefined;

  // Queue
  const queued = queuedShares(p);
  const queueDefault = defaultQueueShares(p);
  const queue = parseAmount(queueAmount, queueDefault);

  // Withdraw
  const matured = maturedShares(p, now);
  const withdraw = parseAmount(withdrawAmount, matured);

  // Harvest
  const harvestPay = p.harvestable < lp.contractBalance ? p.harvestable : lp.contractBalance;

  const value = positionValue(p);
  const earnings = positionEarnings(p);
  const regular = viewType === ViewType.REGULAR;

  return (
    <Section
      width={SectionSize.FULL}
      sx={{ flexDirection: 'column', padding: '12px', gap: '12px' }}
    >
      <Row sx={{ justifyContent: 'space-between', alignItems: 'baseline' }}>
        <Typography variant="h2">
          {p.tier} · {ASSET_LABEL[p.asset]}
        </Typography>
        <Typography variant="body2" sx={{ color: theme.palette.text.secondary }}>
          pool <ExplorerLink id={p.pool} /> · backstop <ExplorerLink id={p.backstop} />
        </Typography>
      </Row>

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: regular ? '180px auto 180px auto' : '140px auto',
          columnGap: '18px',
          rowGap: '6px',
          alignItems: 'center',
        }}
      >
        <Stat
          label="Position value"
          tooltip="LP tokens the contract's shares (queued included) are worth"
        >
          <Typography>{fmt(value)} LP</Typography>
        </Stat>
        <Stat label="Principal" tooltip="LP tokens deposited, as tracked by the contract">
          <Typography>{fmt(p.principal)} LP</Typography>
        </Stat>
        <Stat label="Earnings" tooltip="Position value above principal">
          <Typography sx={{ color: theme.palette.primary.main }}>{fmt(earnings)} LP</Typography>
        </Stat>
        <Stat
          label="Harvestable"
          tooltip="Realized earnings owed to the manager, held by the contract"
        >
          <Typography>{fmt(p.harvestable)} LP</Typography>
        </Stat>
        <Stat label="Shares">
          <Typography>{fmt(p.shares)}</Typography>
        </Stat>
        <Stat label="Queued shares">
          <Typography>{fmt(queued)}</Typography>
        </Stat>
        <Stat
          label="Contract LP balance"
          tooltip="LP tokens held by the contract, not in the backstop"
        >
          <Typography>{fmt(lp.contractBalance)} LP</Typography>
        </Stat>
        {p.underlying.length > 0 && (
          <Stat label="Contract underlying" tooltip="Tokens for join, held by the contract">
            <Typography>
              {p.underlying.map((t) => `${fmt(t.contractBalance)} ${t.symbol}`).join(', ')}
            </Typography>
          </Stat>
        )}
      </Box>
      {p.q4w.length > 0 && (
        <Box>
          {p.q4w.map((q, i) => (
            <Typography key={i} variant="body2" sx={{ color: theme.palette.text.secondary }}>
              {fmt(q.amount)} shares queued:{' '}
              {q.exp <= BigInt(now)
                ? 'ready to withdraw'
                : `ready ${new Date(Number(q.exp) * 1000).toLocaleString()}`}
            </Typography>
          ))}
        </Box>
      )}

      <Divider />

      <ActionRow
        action="fund"
        title="Fund"
        description="Send LP tokens, or the tokens the LP is made of, from your wallet to the contract. Then deposit (LP) or join (underlying)."
        allowed={connected}
        disabled={fund === undefined || fund <= BigInt(0) || fund > fundMax}
        button="Send"
        onSubmit={() =>
          send(managerOps.fund(state.id, fundTokens[fundToken].id, walletAddress, fund!), () =>
            setFundAmount('')
          )
        }
      >
        <Select
          size="small"
          value={fundToken}
          onChange={(e) => {
            setFundToken(Number(e.target.value));
            setFundAmount('');
          }}
          sx={{ minWidth: '170px' }}
        >
          {fundTokens.map((t, i) => (
            <MenuItem key={t.id} value={i}>
              {i === 0 ? ASSET_LABEL[p.asset] : t.symbol} ({fmt(walletBalances?.[i] ?? BigInt(0))})
            </MenuItem>
          ))}
        </Select>
        <AmountInput
          value={fundAmount}
          onChange={setFundAmount}
          placeholder={fundDefault}
          symbol={fundToken === 0 ? 'LP' : fundTokens[fundToken].symbol}
        />
      </ActionRow>

      {p.underlying.length > 0 && (
        <ActionRow
          action="join"
          title="Join"
          description={
            <>
              Mint LP tokens from the underlying tokens the contract holds. Most possible:{' '}
              {fmt(joinMax)} LP; default is 1% less.
              {joinMaxIn.length > 0 &&
                ` Max in: ${joinMaxIn
                  .map((v, i) => `${fmt(v)} ${p.underlying[i].symbol}`)
                  .join(', ')}.`}
            </>
          }
          allowed={can('join')}
          disabled={join === undefined || join <= BigInt(0) || join > joinMax}
          button="Join"
          onSubmit={() =>
            send(managerOps.join(state.id, walletAddress, p, join!, joinMaxIn), () =>
              setJoinAmount('')
            )
          }
        >
          <AmountInput
            value={joinAmount}
            onChange={setJoinAmount}
            placeholder={joinDefault}
            symbol="LP"
          />
        </ActionRow>
      )}

      <ActionRow
        action="deposit"
        title="Deposit"
        description="Deposit the contract's LP tokens into the backstop. The default leaves out the harvestable tokens, which would otherwise become principal."
        allowed={can('deposit')}
        disabled={deposit === undefined || deposit <= BigInt(0) || deposit > lp.contractBalance}
        button="Deposit"
        onSubmit={() =>
          send(managerOps.deposit(state.id, walletAddress, p, deposit!), () => setDepositAmount(''))
        }
      >
        <AmountInput
          value={depositAmount}
          onChange={setDepositAmount}
          placeholder={depositDefaultAmount}
          symbol="LP"
        />
      </ActionRow>

      <ActionRow
        action="claim"
        title="Claim emissions"
        description={
          <>
            Claim BLNT emissions; they are converted to LP and deposited back into the backstop
            (adding shares, not principal).{' '}
            {claimEstimate !== undefined
              ? `Claiming now mints about ${fmt(claimEstimate)} LP (minimum accepted ${fmt(
                  lessSlippage(claimEstimate, SLIPPAGE_BPS)
                )}).`
              : can('claim') && !claimLoading
              ? 'Could not simulate the claim.'
              : ''}
          </>
        }
        allowed={can('claim')}
        disabled={claimEstimate === undefined || claimEstimate <= BigInt(0)}
        button="Claim"
        onSubmit={() =>
          send(
            managerOps.claim(
              state.id,
              walletAddress,
              p,
              lessSlippage(claimEstimate ?? BigInt(0), SLIPPAGE_BPS)
            )
          )
        }
      />

      <ActionRow
        action="queue"
        title="Queue for withdrawal"
        description="Queue backstop shares for withdrawal (17 day wait). The default is the shares worth the earnings, less shares already queued."
        allowed={can('queue')}
        disabled={queue === undefined || queue <= BigInt(0) || queue > p.shares}
        button="Queue"
        onSubmit={() =>
          send(managerOps.queue(state.id, walletAddress, p, queue!), () => setQueueAmount(''))
        }
      >
        <AmountInput
          value={queueAmount}
          onChange={setQueueAmount}
          placeholder={queueDefault}
          symbol="shares"
        />
      </ActionRow>

      <ActionRow
        action="withdraw"
        title="Withdraw"
        description={`Withdraw queued shares whose wait has ended. LP tokens return to the contract; earnings among them become harvestable. Ready now: ${fmt(
          matured
        )} shares.`}
        allowed={can('withdraw')}
        disabled={withdraw === undefined || withdraw <= BigInt(0) || withdraw > matured}
        button="Withdraw"
        onSubmit={() =>
          send(managerOps.withdraw(state.id, walletAddress, p, withdraw!), () =>
            setWithdrawAmount('')
          )
        }
      >
        <AmountInput
          value={withdrawAmount}
          onChange={setWithdrawAmount}
          placeholder={matured}
          symbol="shares"
        />
      </ActionRow>

      <ActionRow
        action="harvest"
        title="Harvest"
        description={`Pay the manager its harvestable LP tokens: ${fmt(
          harvestPay
        )} LP now. Always pays the manager's address, whoever submits it.`}
        allowed={can('harvest')}
        disabled={harvestPay <= BigInt(0)}
        button="Harvest"
        onSubmit={() => send(managerOps.harvest(state.id, walletAddress, lp.id))}
      />
    </Section>
  );
};

const ManagerPage: NextPage = () => {
  const router = useRouter();
  const theme = useTheme();
  const { walletAddress, connected, restore } = useWallet();
  const queryId = typeof router.query.id === 'string' ? router.query.id : '';
  const { savedManagers, saveManager, forgetManager } = useSavedBackstopManagers();
  const managerId = queryId !== '' ? queryId : savedManagers[0] ?? '';
  const [idInput, setIdInput] = useState(managerId);
  useEffect(() => setIdInput(managerId), [managerId]);

  const {
    data: state,
    isLoading,
    error,
    refetch,
  } = useBackstopManager(managerId, isContractId(managerId));
  const [restoring, setRestoring] = useState(false);

  // Remember a contract in this browser once it loads as a backstop manager
  useEffect(() => {
    if (state !== undefined && state.id === managerId) saveManager(managerId);
  }, [state, managerId]);

  const role =
    !connected || state === undefined
      ? undefined
      : walletAddress === state.owner
      ? 'Owner'
      : walletAddress === state.manager.id
      ? `Manager (${SCOPE_NAMES[state.manager.scope]} scope)`
      : 'Not owner or manager: you can fund the contract only';

  const selectId = (id: string) => router.push({ pathname: '/manager', query: { id } });
  const forgetCurrent = () => {
    forgetManager(managerId);
    const next = savedManagers.find((id) => id !== managerId);
    router.push({ pathname: '/manager', query: next ? { id: next } : {} });
  };

  return (
    <>
      <Row sx={{ margin: '12px', padding: '12px' }}>
        <Typography variant="h1">Backstop Manager</Typography>
      </Row>
      <Divider />
      <Row sx={{ padding: '6px', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
        {savedManagers.length > 0 && (
          <Select
            size="small"
            value={savedManagers.includes(managerId) ? managerId : ''}
            displayEmpty
            onChange={(e) => e.target.value && selectId(String(e.target.value))}
            sx={{ minWidth: '200px' }}
          >
            <MenuItem value="" disabled>
              Other contract
            </MenuItem>
            {savedManagers.map((id) => (
              <MenuItem key={id} value={id}>
                {toCompactAddress(id)}
              </MenuItem>
            ))}
          </Select>
        )}
        <Box
          component="form"
          onSubmit={(e: React.FormEvent<HTMLFormElement>) => {
            e.preventDefault();
            if (isContractId(idInput.trim())) selectId(idInput.trim());
          }}
          sx={{
            display: 'flex',
            flexGrow: 1,
            padding: '3px 12px',
            borderRadius: '5px',
            backgroundColor: theme.palette.accent.main,
          }}
        >
          <Input
            value={idInput}
            onChange={(e) => setIdInput(e.target.value)}
            placeholder="Paste your backstop manager contract ID (C...) and press Enter"
            disableUnderline
            fullWidth
          />
        </Box>
        {savedManagers.includes(managerId) && (
          <Tooltip title="Remove this contract from the list saved in this browser">
            <OpaqueButton
              palette={theme.palette.error}
              onClick={forgetCurrent}
              sx={{ padding: '6px 12px' }}
            >
              Forget
            </OpaqueButton>
          </Tooltip>
        )}
      </Row>

      {!isContractId(managerId) ? (
        <Row sx={{ padding: '12px' }}>
          <Typography>
            Paste your backstop manager contract ID above. It is saved in this browser only.
          </Typography>
        </Row>
      ) : error instanceof BackstopManagerRestoreRequiredError ? (
        <Row sx={{ padding: '12px', gap: '12px', alignItems: 'center' }}>
          <Typography>
            Archived contract data must be restored before this manager can load.
          </Typography>
          <OpaqueButton
            palette={theme.palette.backstop}
            disabled={!connected || restoring}
            onClick={async () => {
              setRestoring(true);
              try {
                await restore(error.simulation);
                await refetch();
              } finally {
                setRestoring(false);
              }
            }}
            sx={{ padding: '6px 12px' }}
          >
            {connected ? (restoring ? 'Restoring…' : 'Restore') : 'Connect wallet to restore'}
          </OpaqueButton>
        </Row>
      ) : error ? (
        <Row sx={{ padding: '12px' }}>
          <Typography sx={{ color: theme.palette.error.main }}>
            Could not load {managerId} as a backstop manager.
          </Typography>
        </Row>
      ) : isLoading || state === undefined ? (
        <Skeleton />
      ) : (
        <>
          <Section width={SectionSize.FULL} sx={{ flexDirection: 'column', padding: '12px' }}>
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: '160px auto',
                columnGap: '18px',
                rowGap: '6px',
                alignItems: 'center',
              }}
            >
              <Stat label="Contract">
                <ExplorerLink id={state.id} />
              </Stat>
              <Stat label="Owner" tooltip="Owns the funds; can do every operation">
                <ExplorerLink id={state.owner} />
              </Stat>
              <Stat label="Manager">
                <span>
                  <ExplorerLink id={state.manager.id} /> · {SCOPE_NAMES[state.manager.scope]} scope
                </span>
              </Stat>
              <Stat
                label="Manager earnings share"
                tooltip="Share of earnings realized by withdraw that becomes harvestable by the manager"
              >
                <Typography>{(state.harvestBps / 100).toFixed(2)}%</Typography>
              </Stat>
              <Stat label="You">
                <Typography sx={{ color: theme.palette.backstop.main }}>
                  {role ?? 'Connect a wallet to operate this contract'}
                </Typography>
              </Stat>
            </Box>
            <Typography
              variant="body2"
              sx={{ color: theme.palette.text.secondary, marginTop: '8px' }}
            >
              To collect earnings: queue, wait 17 days, withdraw, then harvest. Only the earnings
              become harvestable; the principal stays in the contract.
            </Typography>
          </Section>
          {state.positions.length === 0 && (
            <Row sx={{ padding: '12px' }}>
              <Typography>This contract has no allowed backstop and pool.</Typography>
            </Row>
          )}
          {state.positions.map((p) => (
            <PositionCard key={`${p.backstop}-${p.pool}-${p.tier}`} state={state} position={p} />
          ))}
        </>
      )}
    </>
  );
};

export default ManagerPage;
