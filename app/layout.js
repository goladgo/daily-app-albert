import './globals.css';
import SwipeNav from './components/SwipeNav';

export const metadata = {
  title: 'Daily',
  description: 'Your daily hub — schedule, reminders, groceries, brain dump.',
  manifest: '/manifest.json',
};

export const viewport = {
  themeColor: '#4f46e5',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link rel="apple-touch-icon" href="/icon-192.png" />
      </head>
      <body><SwipeNav>{children}</SwipeNav></body>
    </html>
  );
}
