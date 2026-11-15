import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import { Box, Link, Typography, useTheme } from '@mui/material';
import type { NextPage } from 'next';
import { Row } from '../components/common/Row';
import { SectionBase } from '../components/common/SectionBase';

const EXPLORER_URL =
  process.env.NEXT_PUBLIC_STELLAR_EXPERT_URL ?? 'https://stellar.expert/explorer/public';

interface AddressEntry {
  name: string;
  address: string;
  href: string;
}

const BLNT_ISSUER = 'GAP2ACGH3O6TRFAERGM4USJ6XWU3U2BFIK224JPV6NI3CUNEEEGTBTFB';

const addressEntries: AddressEntry[] = [
  {
    name: 'BLNT asset',
    address: `BLNT:${BLNT_ISSUER}`,
    href: `${EXPLORER_URL}/asset/BLNT-${BLNT_ISSUER}`,
  },
  {
    name: 'Emitter',
    address: 'CDSO6FQSBJ3U3AJHBNNLHHKSMKTTDDN3GLGF3KZTMXBFV7SVB43ZJERT',
    href: `${EXPLORER_URL}/contract/CDSO6FQSBJ3U3AJHBNNLHHKSMKTTDDN3GLGF3KZTMXBFV7SVB43ZJERT`,
  },
  {
    name: 'BLNT backfill',
    address: 'CANIE64BDFKLHROLOIY2KTQVBWUZNUKZP75DLXC272QM7TIN5N3M4LVA',
    href: `${EXPLORER_URL}/contract/CANIE64BDFKLHROLOIY2KTQVBWUZNUKZP75DLXC272QM7TIN5N3M4LVA`,
  },
  {
    name: 'BLNT lockup backfill',
    address: 'CBNRUFL5KYTT7TQMYKRMHQU5KY4LDQEUVXLI6ECKJU7OJGHC3OLGJFBV',
    href: `${EXPLORER_URL}/contract/CBNRUFL5KYTT7TQMYKRMHQU5KY4LDQEUVXLI6ECKJU7OJGHC3OLGJFBV`,
  },
  {
    name: 'Pool factory',
    address: 'CAKLFWAHB2RIYRBSPUL6EH43AIQ5ILBEM7HTMWYSJRL7PHZQ676KMCV5',
    href: `${EXPLORER_URL}/contract/CAKLFWAHB2RIYRBSPUL6EH43AIQ5ILBEM7HTMWYSJRL7PHZQ676KMCV5`,
  },
  {
    name: 'Backstop',
    address: 'CAHCUKBPTW5DR5RNXOHCTJD5U76A6EEZXYZAQFRQEEQRXQ3CRUZ6Z3MO',
    href: `${EXPLORER_URL}/contract/CAHCUKBPTW5DR5RNXOHCTJD5U76A6EEZXYZAQFRQEEQRXQ3CRUZ6Z3MO`,
  },
  {
    name: 'BLNT:USDC Comet V1.1 LP',
    address: 'CDQMIKIHKA5UY3FQJ2UDTLNX3GOPD3GPNZWSPTOBVOHEUMQJQXOPC7Y3',
    href: `${EXPLORER_URL}/contract/CDQMIKIHKA5UY3FQJ2UDTLNX3GOPD3GPNZWSPTOBVOHEUMQJQXOPC7Y3`,
  },
  {
    name: 'BLNT:XLM Comet V1.1 LP',
    address: 'CA5HX3D47PQZWC2E7VWXCKH4534P2NOJEOIXAWU47MI4QV2FQUYY3FLC',
    href: `${EXPLORER_URL}/contract/CA5HX3D47PQZWC2E7VWXCKH4534P2NOJEOIXAWU47MI4QV2FQUYY3FLC`,
  },
  {
    name: 'Fixed Pool V3',
    address: 'CACSQWCMKG45TUHCQ3LXHOB7YEEJH4W376ZHQPXH2IZ3TE4NJHFZMCY7',
    href: `${EXPLORER_URL}/contract/CACSQWCMKG45TUHCQ3LXHOB7YEEJH4W376ZHQPXH2IZ3TE4NJHFZMCY7`,
  },
  {
    name: 'YieldBlent Pool',
    address: 'CAUTPSQDAJEUV5XEU3EXFVYRGDJLEJGVTFJCFZCSPTDCREAMZ573VF4D',
    href: `${EXPLORER_URL}/contract/CAUTPSQDAJEUV5XEU3EXFVYRGDJLEJGVTFJCFZCSPTDCREAMZ573VF4D`,
  },
];

const AddressRow: React.FC<{ entry: AddressEntry; isLast: boolean }> = ({ entry, isLast }) => {
  const theme = useTheme();

  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: { xs: '1fr', md: '220px minmax(0, 1fr)' },
        gap: { xs: '5px', md: '14px' },
        alignItems: 'center',
        padding: '14px 16px',
        borderBottom: isLast ? 'none' : `1px solid ${theme.palette.menu.main}`,
      }}
    >
      <Typography variant="body1">{entry.name}</Typography>
      <Link
        href={entry.href}
        target="_blank"
        rel="noreferrer"
        sx={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '6px',
          minWidth: 0,
          width: 'fit-content',
          maxWidth: '100%',
          overflowWrap: 'anywhere',
          fontFamily: 'monospace',
          fontSize: '0.78rem',
        }}
      >
        <Box component="span" sx={{ minWidth: 0, overflowWrap: 'anywhere' }}>
          {entry.address}
        </Box>
        <OpenInNewIcon sx={{ flex: '0 0 auto', fontSize: '1rem' }} />
      </Link>
    </Box>
  );
};

const ContractsPage: NextPage = () => {
  const theme = useTheme();

  return (
    <>
      <Row sx={{ margin: '6px', padding: '6px', width: 'calc(100% - 12px)' }}>
        <Typography component="h1" variant="h1">
          BLNT V3 Mainnet Addresses
        </Typography>
      </Row>
      <SectionBase type="alt" sx={{ margin: '6px', padding: '12px' }}>
        <Typography component="p" variant="body2">
          Canonical Stellar mainnet asset and contract addresses used by BLNT V3. Follow each
          address to StellarExpert to independently verify its on-chain record.
        </Typography>
      </SectionBase>
      <SectionBase sx={{ margin: '18px 6px' }}>
        <Box
          sx={{
            display: { xs: 'none', md: 'grid' },
            gridTemplateColumns: '220px minmax(0, 1fr)',
            gap: '14px',
            padding: '10px 16px',
            color: theme.palette.text.secondary,
            borderBottom: `1px solid ${theme.palette.menu.main}`,
          }}
        >
          <Typography variant="body2">Name</Typography>
          <Typography variant="body2">Address</Typography>
        </Box>
        {addressEntries.map((entry, index) => (
          <AddressRow key={entry.name} entry={entry} isLast={index === addressEntries.length - 1} />
        ))}
      </SectionBase>
    </>
  );
};

export default ContractsPage;
