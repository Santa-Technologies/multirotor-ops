import type { Metadata } from "next";
import Link from "next/link";

import { PagePlaceholder } from "@/components/page-placeholder";

export const metadata: Metadata = { title: "Settings" };

export default function SettingsPage() {
  return (
    <div className="flex flex-col gap-6">
      <PagePlaceholder
        title="Settings"
        description="Users, roles, quote defaults and price sources."
      />
      <section className="flex flex-col gap-1">
        <h2 className="text-sm font-semibold">Your account</h2>
        <Link href="/settings/password" className="text-sm underline">
          Change password
        </Link>
      </section>
    </div>
  );
}
