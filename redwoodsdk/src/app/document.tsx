export function Document({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="theme-color" content="#173b2f" />
        <meta
          name="description"
          content="Help turn Riverbend's unused courtyard into a garden for learning, growing, and gathering."
        />
        <title>Openfield — Riverbend Learning Garden</title>
        <link rel="icon" href="/favicon.svg" />
        <link rel="stylesheet" href="/styles.css" />
        <link rel="stylesheet" href="/checkout-presentations.css" />
      </head>
      <body>
        {children}
        <script type="module">{`import('/src/client.tsx')`}</script>
      </body>
    </html>
  );
}
