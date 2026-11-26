"use client";

import { Suspense } from "react";
import { LogOut } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { NAV_ITEMS, type NavItem } from "@/lib/navigation";

/** Whether this nav href matches the current path (exact for home, prefix otherwise). */
function pathIsActive(pathname: string, href: string) {
  return href === "/"
    ? pathname === "/"
    : pathname === href || pathname.startsWith(`${href}/`);
}

/** Nav button with Links always present; active styling waits on pathname. */
function NavLinkButton({
  item,
  isActive = false,
}: {
  item: NavItem;
  isActive?: boolean;
}) {
  return (
    <SidebarMenuButton
      isActive={isActive}
      tooltip={item.title}
      render={<Link href={item.href} />}
    >
      <item.icon />
      <span>{item.title}</span>
    </SidebarMenuButton>
  );
}

/** Reads the pathname so only this leaf suspends on dynamic routes. */
function ActiveNavLinkButton({ item }: { item: NavItem }) {
  const pathname = usePathname();
  return <NavLinkButton item={item} isActive={pathIsActive(pathname, item.href)} />;
}

/**
 * Main navigation. Links stay in the static shell (and in the Suspense
 * fallback) so clicks never disappear while pathname resolves.
 */
export function AppSidebar({ footer }: { footer: React.ReactNode }) {
  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <div className="px-2 py-1.5 text-sm font-semibold group-data-[collapsible=icon]:hidden">
          Multirotor Ops
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {NAV_ITEMS.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <Suspense fallback={<NavLinkButton item={item} />}>
                    <ActiveNavLinkButton item={item} />
                  </Suspense>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        {footer}
        <form action="/auth/signout" method="post">
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton type="submit" tooltip="Sign out">
                <LogOut />
                <span>Sign out</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </form>
      </SidebarFooter>
    </Sidebar>
  );
}
