import {
  Boxes,
  Calculator,
  Component,
  Euro,
  Inbox,
  LayoutDashboard,
  Mail,
  Settings,
  Users,
  Warehouse,
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
  { title: "Parts", href: "/parts", icon: Component },
  { title: "Inventory", href: "/inventory", icon: Warehouse },
  { title: "Costs", href: "/costs", icon: Euro },
  { title: "Supplier RFQ", href: "/rfq", icon: Mail },
  { title: "Quotes", href: "/quotes", icon: Calculator },
  { title: "Settings", href: "/settings", icon: Settings },
];
