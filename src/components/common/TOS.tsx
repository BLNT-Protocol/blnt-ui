import { Box, Link, Typography } from '@mui/material';
import { ReactNode } from 'react';

const EFFECTIVE_DATE = 'August 31, 2026';

const Paragraph = ({ children }: { children: ReactNode }) => (
  <Typography variant="body2" sx={{ marginBottom: '12px' }}>
    {children}
  </Typography>
);

const SectionHeading = ({ children }: { children: ReactNode }) => (
  <Typography
    component="h2"
    variant="body2"
    sx={{ fontWeight: 700, marginTop: '24px', marginBottom: '12px' }}
  >
    {children}
  </Typography>
);

export const TOS = () => {
  return (
    <Box>
      <Paragraph>Last updated: {EFFECTIVE_DATE}</Paragraph>

      <Paragraph>
        These Terms of Use (“Terms”) govern access to and use of the website and hosted user
        interface available at{' '}
        <Link href="https://blnt.trade" target="_blank" rel="noreferrer">
          https://blnt.trade
        </Link>{' '}
        and any subdomains operated by the BLNT Protocol project maintainer (collectively, the
        “Site”). BLNT Protocol is an open-source project and is not currently an incorporated legal
        entity. The Site is currently made available by the project maintainer (“Operator,” “we,”
        “us,” or “our”).
      </Paragraph>

      <Paragraph>
        By accessing or using the Site, you agree to these Terms. If you do not agree, do not use
        the Site. If you use the Site on behalf of another person or organization, you represent
        that you have authority to accept these Terms on its behalf.
      </Paragraph>

      <SectionHeading>1. Scope of these Terms</SectionHeading>

      <Paragraph>
        The Site is one optional interface for viewing information and preparing or submitting
        transactions involving open-source smart contracts deployed on the Stellar network (the
        “Protocol”). The Protocol may be accessed independently without using the Site.
      </Paragraph>

      <Paragraph>
        These Terms apply only to the Site. They do not govern the Protocol, deployed smart
        contracts, independent interaction with those contracts, third-party interfaces, or
        open-source software. Open-source software is governed by the licenses distributed with that
        software, and nothing in these Terms limits rights granted under those licenses.
      </Paragraph>

      <Paragraph>
        Operating the Site does not make the Operator an owner, custodian, administrator, agent, or
        fiduciary of the Protocol or its users. The Operator does not take custody of user assets or
        private keys and cannot reverse transactions executed on the Stellar network.
      </Paragraph>

      <SectionHeading>2. Eligibility and lawful use</SectionHeading>

      <Paragraph>
        You may use the Site only if you are legally capable of entering into these Terms and your
        use is permitted by all laws and regulations applicable to you. You are responsible for
        determining whether your use of the Site or Protocol is lawful in your jurisdiction.
      </Paragraph>

      <Paragraph>
        You must not use the Site to violate any law, evade sanctions or access controls, transact
        with assets obtained through unlawful activity, infringe another person’s rights, mislead
        others, interfere with the Site, gain unauthorized access, introduce malicious code, or
        assist another person in doing any of those things.
      </Paragraph>

      <SectionHeading>3. Wallets and transactions</SectionHeading>

      <Paragraph>
        You are solely responsible for your wallet, private keys, devices, accounts, transaction
        instructions, and assets. You must review every transaction, including contract addresses,
        assets, amounts, fees, and authorization details, before signing. A transaction may be
        irreversible once submitted.
      </Paragraph>

      <Paragraph>
        Wallet software, RPC services, blockchain explorers, price sources, and other services used
        with the Site are provided by third parties. Their availability, security, and practices are
        outside the Operator’s control and may be governed by separate terms.
      </Paragraph>

      <SectionHeading>4. Fees and professional advice</SectionHeading>

      <Paragraph>
        The Operator currently charges no fee to access the Site and receives no protocol fees.
        Network fees, protocol mechanisms, spreads, slippage, or third-party charges may still
        apply. Displayed estimates may differ from final execution results.
      </Paragraph>

      <Paragraph>
        The Site provides software and informational displays only. Nothing on the Site is
        financial, investment, legal, tax, accounting, or other professional advice, and nothing is
        a recommendation, solicitation, or guarantee. Obtain independent professional advice where
        appropriate.
      </Paragraph>

      <SectionHeading>5. Protocol and digital-asset risks</SectionHeading>

      <Paragraph>
        Use of the Site and Protocol is experimental and involves substantial risk, including smart
        contract defects, software errors, exploits, oracle failures, market volatility,
        liquidation, bad debt, liquidity shortages, impaired assets, transaction-ordering effects,
        network congestion or failure, governance or administrative actions, regulatory changes, and
        partial or complete loss of assets. Past operation does not guarantee future safety or
        performance.
      </Paragraph>

      <Paragraph>
        Testnet deployments may be modified, expire, or reset without notice. Testnet assets are
        intended for testing and should not be assumed to have monetary value. You accept all risks
        arising from your decision to use the Site or sign a transaction.
      </Paragraph>

      <SectionHeading>6. Public blockchain and third-party services</SectionHeading>

      <Paragraph>
        Stellar addresses and transaction data are public. Connecting a wallet or submitting a
        transaction may disclose information to wallet providers, RPC providers, hosting providers,
        and the Stellar network. Third-party services and links are provided for convenience and are
        not endorsed, controlled, or warranted by the Operator.
      </Paragraph>

      <SectionHeading>7. Open-source software and project identity</SectionHeading>

      <Paragraph>
        Source code used by the Site is available under the licenses identified in its repositories.
        Those licenses, rather than these Terms, control copying, modification, and distribution of
        that code. You must not use the BLNT Protocol name or project identity to falsely claim
        endorsement, sponsorship, or affiliation.
      </Paragraph>

      <SectionHeading>8. Availability and changes</SectionHeading>

      <Paragraph>
        The Site is provided without an obligation to maintain, support, update, or continue it. We
        may modify, suspend, restrict, or discontinue any part of the Site at any time. Information
        may be delayed, incomplete, inaccurate, or unavailable.
      </Paragraph>

      <SectionHeading>9. Disclaimer of warranties</SectionHeading>

      <Paragraph>
        TO THE MAXIMUM EXTENT PERMITTED BY LAW, THE SITE IS PROVIDED “AS IS” AND “AS AVAILABLE,”
        WITHOUT WARRANTIES OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING WARRANTIES OF ACCURACY,
        AVAILABILITY, SECURITY, MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, TITLE, AND
        NON-INFRINGEMENT. NO OPERATOR, MAINTAINER, OR CONTRIBUTOR WARRANTS THAT THE SITE OR PROTOCOL
        WILL BE SECURE, ERROR-FREE, OR UNINTERRUPTED.
      </Paragraph>

      <SectionHeading>10. Limitation of liability</SectionHeading>

      <Paragraph>
        TO THE MAXIMUM EXTENT PERMITTED BY LAW, THE OPERATOR, MAINTAINERS, AND CONTRIBUTORS WILL NOT
        BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, PUNITIVE, OR CONSEQUENTIAL
        DAMAGES; LOST PROFITS, DATA, OPPORTUNITIES, OR ASSETS; OR LOSSES ARISING FROM THE SITE,
        PROTOCOL, SMART CONTRACTS, WALLETS, THIRD-PARTY SERVICES, OR TRANSACTIONS. SOME
        JURISDICTIONS DO NOT ALLOW CERTAIN EXCLUSIONS OR LIMITATIONS, SO SOME OF THESE PROVISIONS
        MAY NOT APPLY TO YOU.
      </Paragraph>

      <SectionHeading>11. Changes to these Terms</SectionHeading>

      <Paragraph>
        We may update these Terms by posting a revised version on the Site and changing the “Last
        updated” date. Materially revised Terms will be presented for acceptance before continued
        use of the Site when reasonably practicable.
      </Paragraph>

      <SectionHeading>12. Contact</SectionHeading>

      <Paragraph>
        Questions about the Site or these Terms may be submitted through the{' '}
        <Link href="https://github.com/blnt-protocol" target="_blank" rel="noreferrer">
          BLNT Protocol GitHub organization
        </Link>
        . Do not post private keys, seed phrases, or other sensitive information in a public issue.
      </Paragraph>
    </Box>
  );
};
