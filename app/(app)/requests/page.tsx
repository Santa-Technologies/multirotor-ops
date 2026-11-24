import type { Metadata } from "next";

import { PagePlaceholder } from "@/components/page-placeholder";

export const metadata: Metadata = { title: "Requests" };

export default function RequestsPage() {
  return (
    <PagePlaceholder
      title="Requests"
      description="Customer requirements, feature wishes, custom variants and quote requests."
    />
  );
}
