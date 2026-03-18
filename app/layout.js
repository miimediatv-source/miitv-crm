export const metadata = { title: 'MiiTV CRM', description: 'MiiTV Subscriber Management' }

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, background: '#07090f' }}>{children}</body>
    </html>
  )
}
