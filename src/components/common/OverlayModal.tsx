import { Box } from '@mui/material';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import { useSettings } from '../../contexts';
import { TxStatus, TxType, useWallet } from '../../contexts/wallet';
import { OverlayModalFail } from './OverlayModalFail';
import { OverlayModalSuccess } from './OverlayModalSuccess';
import { OverlayModalText } from './OverlayModalText';

export interface CloseableOverlayProps {
  handleCloseOverlay: () => void;
}

const DelayedOverlayModalText: React.FC<{
  message: string;
  handleCloseOverlay: () => void;
}> = ({ message, handleCloseOverlay }) => {
  const [allowReturn, setAllowReturn] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setAllowReturn(true), 6000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <OverlayModalText
      message={message}
      allowReturn={allowReturn}
      handleCloseOverlay={handleCloseOverlay}
    />
  );
};

export const OverlayModal: React.FC = () => {
  const router = useRouter();
  const { lastPool } = useSettings();
  const { txStatus, txType, clearLastTx } = useWallet();

  const display = txStatus !== TxStatus.NONE ? 'flex' : 'none';

  const { poolId } = router.query;

  const lastPoolId = lastPool ? lastPool.id : poolId;

  const handleReturn = () => {
    const returnToHomePage = txStatus != TxStatus.FAIL;
    clearLastTx();

    if (returnToHomePage && txType != TxType.PREREQ) {
      if (router.route == '/') {
        router.push({ pathname: '/' });
      } else if (router.route === '/backfill' || router.route === '/backfill-swap') {
        router.push({ pathname: '/backfill' });
      } else if (router.route.includes('backstop')) {
        router.push({
          pathname: `/backstop`,
          query: { poolId: lastPoolId },
        });
      } else if (router.route.includes('auction')) {
        router.push({
          pathname: `/auction`,
          query: { poolId: lastPoolId },
        });
      } else {
        router.push({
          pathname: `/dashboard`,
          query: { poolId: lastPoolId },
        });
      }
    }
  };

  if (txStatus === TxStatus.NONE) {
    return <></>;
  }

  return (
    <Box
      sx={{
        width: '100%',
        height: '100%',
        top: '0',
        left: '0',
        display: display,
        position: 'fixed',
        justifyContent: 'top',
        alignItems: 'center',
        zIndex: '10',
        flexWrap: 'wrap',
        flexDirection: 'column',
        backgroundColor: 'rgba(25, 27, 31, 0.9)',
      }}
    >
      {txStatus === TxStatus.BUILDING && (
        <DelayedOverlayModalText
          key={TxStatus.BUILDING}
          message="Preparing your transaction..."
          handleCloseOverlay={handleReturn}
        />
      )}
      {txStatus === TxStatus.SIGNING && (
        <DelayedOverlayModalText
          key={TxStatus.SIGNING}
          message="Please confirm the transaction in your wallet."
          handleCloseOverlay={handleReturn}
        />
      )}
      {txStatus === TxStatus.SUBMITTING && (
        <OverlayModalText
          message="Submitting your transaction..."
          allowReturn={false}
          handleCloseOverlay={() => {}}
        />
      )}
      {txStatus === TxStatus.SUCCESS && <OverlayModalSuccess handleCloseOverlay={handleReturn} />}
      {txStatus === TxStatus.FAIL && <OverlayModalFail handleCloseOverlay={handleReturn} />}
    </Box>
  );
};
