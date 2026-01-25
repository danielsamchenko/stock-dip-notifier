import { Stack } from "expo-router";
import Head from "expo-router/head";

const WEB_HEAD_STYLE = `
  :root {
    color-scheme: dark;
  }

  html, body, #root {
    background-color: #000000;
  }

  body {
    margin: 0;
  }
`;

export default function RootLayout() {
  return (
    <>
      <Head>
        <meta name="theme-color" content="#000000" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        <style>{WEB_HEAD_STYLE}</style>
      </Head>
      <Stack screenOptions={{ headerShown: false }} />
    </>
  );
}
