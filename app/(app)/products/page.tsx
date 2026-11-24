import type { Metadata } from "next";

import { PagePlaceholder } from "@/components/page-placeholder";

export const metadata: Metadata = { title: "Products & BOM" };

export default function ProductsPage() {
  return (
    <PagePlaceholder
      title="Products & BOM"
      description="Products and their versioned bills of materials."
    />
  );
}
