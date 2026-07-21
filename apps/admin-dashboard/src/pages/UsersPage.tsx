import { AppShell } from "../components/AppShell";
import { useDemoDataStore } from "../stores/demoData";

export function UsersPage() {
  const users = useDemoDataStore((s) => s.users);

  return (
    <AppShell title="Users" description="People with access to this tenant.">
      <div className="overflow-x-auto rounded-[var(--soko-radius-lg)] border border-[var(--soko-color-border)] bg-[var(--soko-color-surface)]">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-[var(--soko-color-border)] bg-[var(--soko-color-surface-muted)] text-[var(--soko-color-text-muted)]">
            <tr>
              <th className="px-4 py-3 font-semibold">Name</th>
              <th className="px-4 py-3 font-semibold">Email</th>
              <th className="px-4 py-3 font-semibold">Role</th>
              <th className="px-4 py-3 font-semibold">Branch</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id} className="border-b border-[var(--soko-color-border)] last:border-b-0">
                <td className="px-4 py-3 font-medium">{user.name}</td>
                <td className="px-4 py-3">{user.email}</td>
                <td className="px-4 py-3">{user.role}</td>
                <td className="px-4 py-3">{user.branch}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AppShell>
  );
}
