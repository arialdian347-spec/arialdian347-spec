import { useCallback, useEffect, useState } from 'react';
import { ArchiveView } from './components/ArchiveView';
import { KopProfilesView } from './components/KopProfilesView';
import { type ActiveNav, Sidebar } from './components/Sidebar';
import { StudioSurat } from './components/StudioSurat';
import { TemplateDatabaseView } from './components/TemplateDatabaseView';
import type {
  DatabaseSnapshot,
  GeneratedLetter,
  KopSuratProfile,
  LetterTemplate,
} from './types/document';

export default function App() {
  const [activeNav, setActiveNav] = useState<ActiveNav>('studio');
  const [db, setDb] = useState<DatabaseSnapshot | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | undefined>(
    undefined
  );
  const [loadedLetter, setLoadedLetter] = useState<GeneratedLetter | null>(null);

  const fetchBootstrap = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/bootstrap');
      if (!res.ok) {
        throw new Error(`Gagal memuat database (${res.status})`);
      }
      const data = (await res.json()) as DatabaseSnapshot;
      setDb(data);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Terjadi kesalahan memuat data'
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBootstrap();
  }, [fetchBootstrap]);

  const handleSaveTemplate = async (template: LetterTemplate) => {
    const res = await fetch('/api/templates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(template),
    });
    if (!res.ok) throw new Error('Gagal menyimpan template');
    const saved = (await res.json()) as LetterTemplate;
    setDb((prev) => {
      if (!prev) return prev;
      const exists = prev.templates.some((t) => t.id === saved.id);
      return {
        ...prev,
        templates: exists
          ? prev.templates.map((t) => (t.id === saved.id ? saved : t))
          : [saved, ...prev.templates],
      };
    });
  };

  const handleDeleteTemplate = async (id: string) => {
    const res = await fetch(`/api/templates/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
    if (!res.ok) throw new Error('Gagal menghapus template');
    setDb((prev) =>
      prev
        ? { ...prev, templates: prev.templates.filter((t) => t.id !== id) }
        : prev
    );
  };

  const handleSaveKop = async (profile: KopSuratProfile) => {
    const res = await fetch('/api/kop-profiles', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(profile),
    });
    if (!res.ok) throw new Error('Gagal menyimpan profil Kop Surat');
    const saved = (await res.json()) as KopSuratProfile;
    setDb((prev) => {
      if (!prev) return prev;
      const exists = prev.kopProfiles.some((k) => k.id === saved.id);
      return {
        ...prev,
        kopProfiles: exists
          ? prev.kopProfiles.map((k) => (k.id === saved.id ? saved : k))
          : [...prev.kopProfiles, saved],
      };
    });
  };

  const handleDeleteKop = async (id: string) => {
    const res = await fetch(`/api/kop-profiles/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
    if (!res.ok) throw new Error('Gagal menghapus profil Kop Surat');
    setDb((prev) =>
      prev
        ? { ...prev, kopProfiles: prev.kopProfiles.filter((k) => k.id !== id) }
        : prev
    );
  };

  const handleSaveLetter = async (
    letter: GeneratedLetter,
    incrementSequenceYear?: number
  ) => {
    const res = await fetch('/api/letters', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ letter, incrementSequenceYear }),
    });
    if (!res.ok) throw new Error('Gagal menyimpan surat ke arsip');
    const result = (await res.json()) as {
      letter: GeneratedLetter;
      sequences: Record<string, number>;
    };
    setDb((prev) => {
      if (!prev) return prev;
      const exists = prev.letters.some((l) => l.id === result.letter.id);
      return {
        ...prev,
        letters: exists
          ? prev.letters.map((l) =>
              l.id === result.letter.id ? result.letter : l
            )
          : [result.letter, ...prev.letters],
        sequences: result.sequences,
      };
    });
  };

  const handleSaveBatchLetters = async (
    letters: GeneratedLetter[],
    templateId: string,
    year: number
  ) => {
    const res = await fetch('/api/letters/batch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ letters, templateId, year }),
    });
    if (!res.ok) throw new Error('Gagal menyimpan batch surat');
    const result = (await res.json()) as {
      letters: GeneratedLetter[];
      sequences: Record<string, number>;
    };
    setDb((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        letters: [...result.letters, ...prev.letters],
        sequences: result.sequences,
      };
    });
  };

  const handleDeleteLetter = async (id: string) => {
    const res = await fetch(`/api/letters/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
    if (!res.ok) throw new Error('Gagal menghapus arsip surat');
    setDb((prev) =>
      prev
        ? { ...prev, letters: prev.letters.filter((l) => l.id !== id) }
        : prev
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="w-full max-w-md bg-white border border-slate-200 rounded-xl p-6 space-y-3">
          <div className="h-5 w-40 bg-slate-200 rounded animate-pulse" />
          <div className="h-4 w-full bg-slate-100 rounded animate-pulse" />
          <div className="h-4 w-3/4 bg-slate-100 rounded animate-pulse" />
        </div>
      </div>
    );
  }

  if (error || !db) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="w-full max-w-md bg-white border border-slate-200 rounded-xl p-6 space-y-4">
          <h1 className="font-display text-base font-semibold text-slate-900">
            Gagal Terhubung ke Database Template
          </h1>
          <p className="text-sm text-slate-600">{error}</p>
          <button
            type="button"
            onClick={fetchBootstrap}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-950 rounded-lg hover:bg-blue-900"
          >
            Muat Ulang
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex bg-slate-50 text-slate-900">
      <Sidebar
        activeNav={activeNav}
        onSelectNav={setActiveNav}
        templateCount={db.templates.length}
        archiveCount={db.letters.length}
        kopCount={db.kopProfiles.length}
      />

      <div className="flex-1 min-w-0">
        {activeNav === 'studio' && (
          <StudioSurat
            templates={db.templates}
            kopProfiles={db.kopProfiles}
            sequences={db.sequences}
            initialTemplateId={selectedTemplateId}
            loadedLetter={loadedLetter}
            onClearLoadedLetter={() => setLoadedLetter(null)}
            onSaveLetter={handleSaveLetter}
            onSaveBatchLetters={handleSaveBatchLetters}
          />
        )}

        {activeNav === 'templates' && (
          <TemplateDatabaseView
            templates={db.templates}
            onUseTemplate={(tplId) => {
              setLoadedLetter(null);
              setSelectedTemplateId(tplId);
              setActiveNav('studio');
            }}
            onSaveTemplate={handleSaveTemplate}
            onDeleteTemplate={handleDeleteTemplate}
          />
        )}

        {activeNav === 'archive' && (
          <ArchiveView
            letters={db.letters}
            templates={db.templates}
            kopProfiles={db.kopProfiles}
            onOpenInStudio={(letter) => {
              setLoadedLetter(letter);
              setSelectedTemplateId(letter.templateId);
              setActiveNav('studio');
            }}
            onDeleteLetter={handleDeleteLetter}
          />
        )}

        {activeNav === 'kop' && (
          <KopProfilesView
            kopProfiles={db.kopProfiles}
            onSaveKop={handleSaveKop}
            onDeleteKop={handleDeleteKop}
          />
        )}
      </div>
    </div>
  );
}
