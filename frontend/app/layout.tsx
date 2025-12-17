import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'ChainPulse - Real-Time Blockchain Activity Tracker',
  description: 'Experience the future of on-chain engagement. Send pulses, earn points, climb the leaderboard — all powered by Hiro Chainhooks.',
  keywords: ['Stacks', 'Blockchain', 'Chainhooks', 'DeFi', 'Web3'],
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={inter.className}>{children}</body>
    </html>
  )
}
