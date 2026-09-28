import type { Metadata } from 'next';
import type { ReactNode } from 'react';

import './globals.css';

export const metadata: Metadata = {
  title: 'Aircraft Registry Explorer',
  description:
    'Open-source reference application for exploring U.S. FAA aircraft registry data with the Grizzly Bulls Aircraft Intelligence API.',
  robots: {
    index: false,
    follow: true,
  },
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
