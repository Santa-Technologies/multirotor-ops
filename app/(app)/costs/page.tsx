import type { Metadata } from "next";

import { PagePlaceholder } from "@/components/page-placeholder";

export const metadata: Metadata = { title: "Costs" };

export default function CostsPage() {
  return (
    <PagePlaceholder
      title="Costs"
      description="Cost per unit per volume tier from the weekly cost run."
    />
  );
}
