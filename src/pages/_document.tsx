import { type DocumentProps, Head, Html, Main, NextScript } from 'next/document';
import { type CSSProperties } from 'react';

const PAGE_TOPICS: Record<string, string> = {
  '/': 'Lending Markets on Stellar',
  '/404': 'Page Not Found',
  '/asset': 'Asset Market',
  '/auction': 'Lending Auctions',
  '/backfill': 'BLNT Backfill Claims',
  '/backfill-swap': 'BLND to BLNT Swap and Burn',
  '/backstop': 'Backstop Deposits',
  '/backstop-deposit': 'Backstop Deposit',
  '/backstop-q4w': 'Backstop Withdrawal Queue',
  '/backstop-token': 'Backstop Token Management',
  '/borrow': 'Borrow Assets',
  '/dashboard': 'Pool Dashboard',
  '/repay': 'Repay Borrowed Assets',
  '/settings': 'Interface Settings',
  '/supply': 'Supply Assets',
  '/termsofservice': 'Terms of Use',
  '/withdraw': 'Withdraw Supplied Assets',
};

const VISUALLY_HIDDEN: CSSProperties = {
  position: 'absolute',
  width: '1px',
  height: '1px',
  padding: 0,
  margin: '-1px',
  overflow: 'hidden',
  clip: 'rect(0, 0, 0, 0)',
  clipPath: 'inset(50%)',
  whiteSpace: 'nowrap',
  border: 0,
};

export default function Document({ __NEXT_DATA__ }: DocumentProps) {
  const pageTopic = PAGE_TOPICS[__NEXT_DATA__.page] ?? PAGE_TOPICS['/'];

  return (
    <Html lang="en-US">
      <Head />
      <body>
        <h1 style={VISUALLY_HIDDEN}>BLNT Trade: {pageTopic}</h1>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
