import * as React from "react";
import { createTheme, NextUIProvider } from "@nextui-org/react";
import { ToastContainer } from "react-toastify";

import "../styles/globals.css";

// core styles shared by all of react-notion-x (required)
import "react-notion-x/src/styles.css";

// used for code syntax highlighting (optional)
import "prismjs/themes/prism-tomorrow.css";

// used for rendering equations (optional)
import "katex/dist/katex.min.css";

// react-toastify
import "react-toastify/dist/ReactToastify.css";

import "../styles/notion.css";

const darkTheme = createTheme({
  type: "dark",
});

function MyApp({ Component, pageProps }) {
  return (
    <NextUIProvider theme={darkTheme}>
      <Component {...pageProps} />
      <ToastContainer position="bottom-center" theme="dark" />
    </NextUIProvider>
  );
}

export default MyApp;
