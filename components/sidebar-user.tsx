import { requireUser } from "@/lib/auth/current-user";

/** Name, email and role of the signed-in user for the sidebar footer. */
export async function SidebarUser() {
  const user = await requireUser();

  return (
    <div className="px-2 text-xs group-data-[collapsible=icon]:hidden">
      <div className="truncate font-medium">{user.name}</div>
      <div className="truncate text-muted-foreground">
        {user.email} · {user.role}
      </div>
    </div>
  );
}
