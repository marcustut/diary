import * as React from "react";

import { ExtendedRecordMap } from "notion-types";

import * as notion from "../lib/notion";
import { NotionPage } from "../components/NotionPage";
import {
  rootNotionPageId,
  rootDomain,
  previewImagesEnabled,
} from "../lib/config";
import { Links } from "../components/Links";
import { AuthProvider } from "../providers/AuthProvider";

export const getStaticProps = async () => {
  const pageId = rootNotionPageId;
  const recordMap = await notion.getPage(pageId);

  return {
    props: {
      recordMap,
    },
    revalidate: 10,
  };
};

export default function Page({ recordMap }: { recordMap: ExtendedRecordMap }) {
  return (
    <AuthProvider>
      <NotionPage
        recordMap={recordMap}
        rootDomain={rootDomain}
        rootPageId={rootNotionPageId}
        previewImagesEnabled={previewImagesEnabled}
      />
      <Links />
    </AuthProvider>
  );
}
