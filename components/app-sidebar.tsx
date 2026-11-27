"use client";

import { Suspense, useEffect } from "react";
import { Loader2Icon, LogOut } from "lucide-react";
import Link from "next/link";
import { useLinkStatus } from "next/link";
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
  sidebarMenuButtonVariants,
} from "@/components/ui/sidebar";
import { cn } from "cn";
import { NAV_ITEMS, type NavItem } from "@/lib/navigation";

/** Whether this nav href matches the current path (exact for home, prefix otherwise). */
function pathIsActive(pathname: string, href: string) {
  return href === "/"
    ? pathname === "/"
    : pathname === href || pathname.startsWith(`${href}/`);
}

function navLinkId(href: string) {
  return `nav-link-${href === "/" ? "home" : href.replace(/^\//, "").replace(/\//g, "-")}`;
}

/** Inline pending hint for a Link — must be a descendant of that Link. */
function NavPendingHint() {
  const { pending } = useLinkStatus();
  return (
    <Loader2Icon
      aria-hidden
      className={cn(
        "ml-auto size-3.5 shrink-0 animate-spin opacity-0 transition-opacity",
        pending && "opacity-100",
      )}
    />
  );
}

/**
 * Plain Next.js Link styled as a sidebar button. Stays mounted across navigations;
 * active styling is applied by ActiveNavSynchronizer via data-active.
 */
function NavItemLink({ item }: { item: NavItem }) {
  return (
    <Link
      id={navLinkId(item.href)}
      href={item.href}
      title={item.title}
      data-slot="sidebar-menu-button"
      data-sidebar="menu-button"
      className={cn(sidebarMenuButtonVariants())}
    >
      <item.icon />
      <span>{item.title}</span>
      <NavPendingHint />
    </Link>
  );
}

/**
 * Reads pathname in a Suspense boundary and toggles data-active on the
 * already-mounted Links — so the Links themselves never remount when
 * Cache Components suspends on usePathname.
 */
function ActiveNavSynchronizer() {
  const pathname = usePathname();

  useEffect(() => {
    for (const item of NAV_ITEMS) {
      const el = document.getElementById(navLinkId(item.href));
      if (!el) continue;
      if (pathIsActive(pathname, item.href)) {
        el.setAttribute("data-active", "true");
      } else {
        el.removeAttribute("data-active");
      }
    }
  }, [pathname]);

  return null;
}

/**
 * Main navigation. Links are always in the tree; only the active-state
 * synchronizer suspends for Cache Components / usePathname.
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
                  <NavItemLink item={item} />
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
            <Suspense fallback={null}>
              <ActiveNavSynchronizer />
            </Suspense>
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
