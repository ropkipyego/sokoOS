import { AppShell } from "../components/AppShell";
import { useDemoDataStore } from "../stores/demoData";

export function BranchesPage() {
  const branches = useDemoDataStore((s) => s.branches);

  return (
    <AppShell title="Branches" description="Locations under this tenant.">
      <div className="overflow-x-auto rounded-[var(--soko-radius-lg)] border border-[var(--soko-color-border)] bg-[var(--soko-color-surface)]">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-[var(--soko-color-border)] bg-[var(--soko-color-surface-muted)] text-[var(--soko-color-text-muted)]">
            <tr>
              <th className="px-4 py-3 font-semibold">Code</th>
              <th className="px-4 py-3 font-semibold">Name</th>
              <th className="px-4 py-3 font-semibold">City</th>
            </tr>
          </thead>
          <tbody>
            {branches.map((branch) => (
              <tr key={branch.id} className="border-b border-[var(--soko-color-border)] last:border-b-0">
                <td className="px-4 py-3 font-medium">{branch.code}</td>
                <td className="px-4 py-3">{branch.name}</td>
                <td className="px-4 py-3">{branch.city}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AppShell>
  );
}
