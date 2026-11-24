import {
  Boxes,
  Calculator,
  Euro,
  Inbox,
  LayoutDashboard,
  Settings,
  Users,
  type LucideIcon,
} from "lucide-react";

export type NavItem = {
  title: string;
  href: string;
  icon: LucideIcon;
};

export const NAV_ITEMS: NavItem[] = [
  { title: "Dashboard", href: "/", icon: LayoutDashboard },
  { title: "Requests", href: "/requests", icon: Inbox },
  { title: "Customers", href: "/customers", icon: Users },
  { title: "Products & BOM", href: "/products", icon: Boxes },
  { title: "Costs", href: "/costs", icon: Euro },
  { title: "Quotes", href: "/quotes", icon: Calculator },
  { title: "Settings", href: "/settings", icon: Settings },
];
