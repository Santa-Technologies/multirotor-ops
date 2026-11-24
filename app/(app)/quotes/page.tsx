import type { Metadata } from "next";

import { PagePlaceholder } from "@/components/page-placeholder";

export const metadata: Metadata = { title: "Quotes" };

export default function QuotesPage() {
  return (
    <PagePlaceholder title="Quotes" description="Indicative quotes for any quantity." />
  );
}
