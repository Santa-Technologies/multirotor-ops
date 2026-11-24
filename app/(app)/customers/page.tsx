import type { Metadata } from "next";

import { PagePlaceholder } from "@/components/page-placeholder";

export const metadata: Metadata = { title: "Customers" };

export default function CustomersPage() {
  return (
    <PagePlaceholder
      title="Customers"
      description="Companies and contacts, synced with Pipedrive."
    />
  );
}
