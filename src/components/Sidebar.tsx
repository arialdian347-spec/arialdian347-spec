import { Archive, Building2, Database, FilePlus2 } from 'lucide-react';

export type ActiveNav = 'studio' | 'templates' | 'archive' | 'kop';

interface SidebarProps {
  activeNav: ActiveNav;
  onSelectNav: (nav: ActiveNav) => void;
  templateCount: number;
  archiveCount: number;
  kopCount: number;
}

const NAV_ITEMS: {
  id: ActiveNav;
  label: string;
  icon: typeof FilePlus2;
}[] = [
  { id: 'studio', label: 'Studio Surat', icon: FilePlus2 },
  { id: 'templates', label: 'Database Template', icon: Database },
  { id: 'archive', label: 'Arsip Surat Keluar', icon: Archive },
  { id: 'kop', label: 'Profil Kop Surat', icon: Building2 },
];

export function Sidebar({
  activeNav,
  onSelectNav,
  templateCount,
  archiveCount,
  kopCount,
}: SidebarProps) {
  const counts: Record<ActiveNav, number | null> = {
    studio: null,
    templates: templateCount,
    archive: archiveCount,
    kop: kopCount,
  };

  return (
    <aside className="no-print w-64 shrink-0 border-r border-slate-200 bg-white flex flex-col justify-between min-h-screen">
      <div>
        <div className="h-16 px-6 flex items-center border-b border-slate-200">
          <span className="font-display text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap">
            TataNaskah
          </span>
        </div>

        <div className="px-3 py-5">
          <p className="px-3 mb-2 text-xs font-medium text-slate-400">
            Navigasi Utama
          </p>
          <nav className="space-y-1">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const isActive = activeNav === item.id;
              const count = counts[item.id];
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onSelectNav(item.id)}
                  className={`w-full flex items-center justify-between px-3 py-2.5 text-sm font-medium rounded-lg transition-colors whitespace-nowrap ${
                    isActive
                      ? 'bg-blue-950 text-white'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                  }`}
                >
                  <span className="flex items-center gap-2.5 min-w-0">
                    <Icon className="w-4 h-4 shrink-0" />
                    <span className="truncate">{item.label}</span>
                  </span>
                  {count !== null && (
                    <span
                      className={`text-xs font-mono tabular-nums ${
                        isActive ? 'text-blue-200' : 'text-slate-400'
                      }`}
                    >
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>
      </div>

      <div className="p-5 border-t border-slate-200 space-y-1.5 text-xs text-slate-500">
        <p className="font-medium text-slate-700">Tata Naskah Otomatis</p>
        <p className="leading-relaxed">
          Database template terstruktur dengan penomoran otomatis dan lampiran siap cetak A4.
        </p>
      </div>
    </aside>
  );
}
