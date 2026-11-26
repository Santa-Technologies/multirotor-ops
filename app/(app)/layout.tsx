import { Suspense } from "react";

import { AppSidebar } from "@/components/app-sidebar";
import { SidebarUser } from "@/components/sidebar-user";
import { Separator } from "@/components/ui/separator";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { Skeleton } from "@/components/ui/skeleton";
import { TooltipProvider } from "@/components/ui/tooltip";
import { requireUser } from "@/lib/auth/current-user";

/** Renders page content only after the server has confirmed an allowlisted session. */
async function AuthGate({ children }: { children: React.ReactNode }) {
  await requireUser();
  return children;
}

export default function AppLayout({ children }: LayoutProps<"/">) {
  // The sidebar and header form the static shell; everything that reads the
  // session streams in behind Suspense, as Cache Components requires.
  return (
    <TooltipProvider>
      <SidebarProvider>
        <AppSidebar
          footer={
            <Suspense fallback={<Skeleton className="mx-2 h-8" />}>
              <SidebarUser />
            </Suspense>
          }
        />
        <SidebarInset>
          <header className="flex h-12 items-center gap-2 border-b px-4">
            <SidebarTrigger className="-ml-1" />
            <Separator
              orientation="vertical"
              className="data-vertical:h-4 data-vertical:self-center"
            />
            <span className="text-sm text-muted-foreground">Kern</span>
          </header>
          <div className="flex-1 p-6">
            <Suspense fallback={<Skeleton className="h-40 w-full" />}>
              <AuthGate>{children}</AuthGate>
            </Suspense>
          </div>
        </SidebarInset>
      </SidebarProvider>
    </TooltipProvider>
  );
}
