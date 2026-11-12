import '/public/fonts/dm-sans.css';

import CssBaseline from '@mui/material/CssBaseline';
import { ThemeProvider } from '@mui/material/styles';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AppProps } from 'next/app';
import Head from 'next/head';
import React, { useState } from 'react';
import { SettingsProvider } from '../contexts';
import { WalletProvider } from '../contexts/wallet';
import DefaultLayout from '../layouts/DefaultLayout';
import theme from '../theme';

const SITE_NAME = 'BLNT Trade';
const SITE_URL = 'https://blnt.trade';
const ORGANIZATION_ID = `${SITE_URL}/#organization`;
const DEFAULT_TITLE = 'BLNT Trade | Lending Markets on Stellar';
const DEFAULT_DESCRIPTION =
  'Explore BLNT V3, a Blend-derived lending protocol for permissionless lending and real-world assets, alongside Blend V1, V2, and V2.1 markets on Stellar.';
const PAGE_METADATA: Record<string, { title: string; description: string }> = {
  '/': { title: DEFAULT_TITLE, description: DEFAULT_DESCRIPTION },
  '/backfill': {
    title: 'BLNT Backfill Claims | BLNT Trade',
    description:
      'Review and claim eligible BLNT backfill emissions, contributor grants, and lockup allocations through the BLNT Trade interface.',
  },
  '/termsofservice': {
    title: 'Terms of Use | BLNT Trade',
    description:
      'Read the terms governing access to the BLNT Trade web interface for BLNT V3 and supported Blend markets on Stellar.',
  },
};
const INDEXABLE_PATHS = new Set(Object.keys(PAGE_METADATA));

export default function MyApp(props: AppProps) {
  const { Component, pageProps } = props;
  const [queryClient] = useState(() => new QueryClient());
  const metadata = PAGE_METADATA[props.router.pathname] ?? {
    title: DEFAULT_TITLE,
    description: DEFAULT_DESCRIPTION,
  };
  const isIndexable = INDEXABLE_PATHS.has(props.router.pathname);
  const canonicalPath =
    props.router.pathname === '/' ? '/' : `${props.router.pathname.replace(/\/$/, '')}/`;
  const canonicalUrl = `${SITE_URL}${canonicalPath}`;
  const structuredData = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Organization',
        '@id': ORGANIZATION_ID,
        name: 'BLNT Protocol',
        url: `${SITE_URL}/`,
        sameAs: ['https://github.com/BLNT-Protocol'],
      },
      {
        '@type': 'WebSite',
        '@id': `${SITE_URL}/#website`,
        name: SITE_NAME,
        url: `${SITE_URL}/`,
        description: DEFAULT_DESCRIPTION,
        publisher: { '@id': ORGANIZATION_ID },
      },
      {
        '@type': 'WebApplication',
        '@id': `${SITE_URL}/#application`,
        name: SITE_NAME,
        url: `${SITE_URL}/`,
        applicationCategory: 'FinanceApplication',
        operatingSystem: 'Web',
        description: DEFAULT_DESCRIPTION,
        publisher: { '@id': ORGANIZATION_ID },
      },
    ],
  };

  return (
    <>
      <Head>
        <title>{metadata.title}</title>
        <meta name="description" content={metadata.description} />
        <meta name="viewport" content="initial-scale=1, width=device-width" />
        <meta name="robots" content={isIndexable ? 'index,follow' : 'noindex,follow'} />
        {isIndexable && <link rel="canonical" href={canonicalUrl} />}
        <meta property="og:type" content="website" />
        <meta property="og:locale" content="en_US" />
        <meta property="og:site_name" content={SITE_NAME} />
        <meta property="og:title" content={metadata.title} />
        <meta property="og:description" content={metadata.description} />
        <meta property="og:url" content={canonicalUrl} />
        <meta property="og:image" content={`${SITE_URL}/icon-512x512.png`} />
        <meta property="og:image:width" content="512" />
        <meta property="og:image:height" content="512" />
        <meta property="og:image:alt" content="BLNT logo" />
        <meta name="twitter:card" content="summary" />
        <meta name="twitter:title" content={metadata.title} />
        <meta name="twitter:description" content={metadata.description} />
        <meta name="twitter:image" content={`${SITE_URL}/icon-512x512.png`} />
        <link rel="icon" href="/favicon.ico" />
        <link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png" />
        <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png" />
        <link rel="icon" type="image/png" sizes="192x192" href="/icon-192x192.png" />
        <link rel="icon" type="image/png" sizes="512x512" href="/icon-512x512.png" />
        <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
        <link rel="manifest" href="/site.webmanifest" />
        <meta name="theme-color" content="#001812" />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
        />
      </Head>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider theme={theme}>
          <SettingsProvider>
            <WalletProvider>
              <CssBaseline />
              <DefaultLayout>
                <Component {...pageProps} />
              </DefaultLayout>
            </WalletProvider>
          </SettingsProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </>
  );
}
