import { useState } from 'react';
import { Edit3, Plus, Trash2, X } from 'lucide-react';
import type { KopSuratProfile } from '../types/document';

interface KopProfilesViewProps {
  kopProfiles: KopSuratProfile[];
  onSaveKop: (profile: KopSuratProfile) => Promise<void>;
  onDeleteKop: (id: string) => Promise<void>;
}

function createEmptyKop(): KopSuratProfile {
  return {
    id: `kop-${Date.now()}`,
    institutionType: 'Korporasi / Instansi',
    organizationName: 'NAMA INSTANSI / PERUSAHAAN BARU',
    subOrganization: 'DIVISI SEKRETARIAT & TATA USAHA',
    address: 'Jl. Contoh Alamat Lengkap No. 1, Jakarta',
    contactLine: 'Telp. (021) 0000-0000 · Surel: sekretariat@instansi.id',
    city: 'Jakarta',
    crestCode: 'INS',
    accentColor: '#1E3A8A',
  };
}

export function KopProfilesView({
  kopProfiles,
  onSaveKop,
  onDeleteKop,
}: KopProfilesViewProps) {
  const [editing, setEditing] = useState<KopSuratProfile | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    if (!editing) return;
    setIsSaving(true);
    try {
      await onSaveKop(editing);
      setEditing(null);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="flex flex-col min-h-screen">
      <header className="h-16 px-6 bg-white border-b border-slate-200 flex items-center justify-between gap-8 shrink-0">
        <div className="flex items-center gap-2 text-sm">
          <span className="text-slate-400">Pengaturan</span>
          <span className="text-slate-300">/</span>
          <span className="font-display font-semibold text-slate-900">
            Profil Kop Surat Instansi
          </span>
        </div>
        <button
          type="button"
          onClick={() => setEditing(createEmptyKop())}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-950 rounded-lg hover:bg-blue-900 transition-colors whitespace-nowrap shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>Tambah Kop Surat</span>
        </button>
      </header>

      <main className="flex-1 p-6 max-w-5xl w-full mx-auto space-y-4">
        {kopProfiles.map((kop) => (
          <article
            key={kop.id}
            className="bg-white border border-slate-200 rounded-xl p-6 flex flex-col md:flex-row md:items-center justify-between gap-6"
          >
            <div className="flex items-start gap-4">
              <div
                className="w-14 h-14 rounded-lg shrink-0 flex items-center justify-center font-display font-bold text-white text-base"
                style={{ backgroundColor: kop.accentColor || '#1E3A8A' }}
              >
                {kop.crestCode}
              </div>
              <div className="space-y-1">
                <p className="text-xs text-slate-500">
                  {kop.institutionType} · {kop.city}
                </p>
                <h3 className="font-display text-base font-bold text-slate-900">
                  {kop.organizationName}
                </h3>
                {kop.subOrganization && (
                  <p className="text-xs font-semibold text-slate-700">
                    {kop.subOrganization}
                  </p>
                )}
                <p className="text-xs text-slate-600">{kop.address}</p>
                <p className="text-xs text-slate-500">{kop.contactLine}</p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setEditing(structuredClone(kop))}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-100"
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>Ubah</span>
              </button>
              {kopProfiles.length > 1 && (
                <button
                  type="button"
                  onClick={() => onDeleteKop(kop.id)}
                  className="p-2 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50"
                  title="Hapus Kop Surat"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          </article>
        ))}
      </main>

      {editing && (
        <div className="fixed inset-0 z-50 bg-slate-950/40 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-xl w-full max-w-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <h2 className="font-display text-base font-semibold text-slate-900">
                Ubah Profil Kop Surat
              </h2>
              <button
                type="button"
                onClick={() => setEditing(null)}
                className="p-1.5 text-slate-400 hover:text-slate-900"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-700">
                    Jenis Instansi
                  </label>
                  <input
                    type="text"
                    value={editing.institutionType}
                    onChange={(e) =>
                      setEditing({ ...editing, institutionType: e.target.value })
                    }
                    className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-700">
                    Kota Penerbit
                  </label>
                  <input
                    type="text"
                    value={editing.city}
                    onChange={(e) =>
                      setEditing({ ...editing, city: e.target.value })
                    }
                    className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-700">
                  Nama Instansi / Perusahaan
                </label>
                <input
                  type="text"
                  value={editing.organizationName}
                  onChange={(e) =>
                    setEditing({ ...editing, organizationName: e.target.value })
                  }
                  className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-700">
                  Sub-Unit / Sekretariat
                </label>
                <input
                  type="text"
                  value={editing.subOrganization}
                  onChange={(e) =>
                    setEditing({ ...editing, subOrganization: e.target.value })
                  }
                  className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-700">
                  Alamat Lengkap
                </label>
                <input
                  type="text"
                  value={editing.address}
                  onChange={(e) =>
                    setEditing({ ...editing, address: e.target.value })
                  }
                  className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-700">
                  Baris Kontak (Telp, Surel, Situs Web)
                </label>
                <input
                  type="text"
                  value={editing.contactLine}
                  onChange={(e) =>
                    setEditing({ ...editing, contactLine: e.target.value })
                  }
                  className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-700">
                    Inisial Logo (2–3 Huruf)
                  </label>
                  <input
                    type="text"
                    maxLength={4}
                    value={editing.crestCode}
                    onChange={(e) =>
                      setEditing({
                        ...editing,
                        crestCode: e.target.value.toUpperCase(),
                      })
                    }
                    className="w-full text-sm font-mono uppercase border border-slate-200 rounded-lg px-3 py-2"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-700">
                    Warna Emblem Kop
                  </label>
                  <input
                    type="color"
                    value={editing.accentColor}
                    onChange={(e) =>
                      setEditing({ ...editing, accentColor: e.target.value })
                    }
                    className="w-full h-9 border border-slate-200 rounded-lg px-1 py-1 bg-white"
                  />
                </div>
              </div>
            </div>

            <div className="px-6 py-4 border-t border-slate-200 flex justify-end gap-2 bg-slate-50">
              <button
                type="button"
                onClick={() => setEditing(null)}
                className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-lg"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={isSaving}
                onClick={handleSave}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-950 rounded-lg hover:bg-blue-900 disabled:opacity-50"
              >
                {isSaving ? 'Menyimpan...' : 'Simpan Profil'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
