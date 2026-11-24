import { useMemo, useState } from 'react';
import { ExternalLink, FileDown, FileText, Search, Trash2 } from 'lucide-react';
import type {
  GeneratedLetter,
  KopSuratProfile,
  LetterTemplate,
} from '../types/document';
import { formatTanggalIndonesia } from '../utils/templateEngine';
import {
  exportDocumentsToPdf,
  exportDocumentsToWord,
} from '../utils/documentExporter';
import type { PreviewDocumentData } from './LetterPreview';

interface ArchiveViewProps {
  letters: GeneratedLetter[];
  templates: LetterTemplate[];
  kopProfiles: KopSuratProfile[];
  onOpenInStudio: (letter: GeneratedLetter) => void;
  onDeleteLetter: (id: string) => Promise<void>;
}

export function ArchiveView({
  letters,
  templates,
  kopProfiles,
  onOpenInStudio,
  onDeleteLetter,
}: ArchiveViewProps) {
  const [query, setQuery] = useState('');
  const [filterCode, setFilterCode] = useState<string>('SEMUA');

  const codes = useMemo(() => {
    const unique = new Set(letters.map((l) => l.templateCode));
    return ['SEMUA', ...Array.from(unique)];
  }, [letters]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return letters.filter((l) => {
      if (filterCode !== 'SEMUA' && l.templateCode !== filterCode) return false;
      if (!q) return true;
      return (
        l.letterNumber.toLowerCase().includes(q) ||
        l.perihal.toLowerCase().includes(q) ||
        l.recipientSummary.toLowerCase().includes(q) ||
        l.templateName.toLowerCase().includes(q)
      );
    });
  }, [letters, query, filterCode]);

  const buildPreviewData = (item: GeneratedLetter): PreviewDocumentData | null => {
    const tpl =
      templates.find((t) => t.id === item.templateId) || templates[0];
    const kop =
      kopProfiles.find((k) => k.id === item.kopProfileId) || kopProfiles[0];
    if (!tpl || !kop) return null;
    return {
      template: tpl,
      kopProfile: kop,
      letterNumber: item.letterNumber,
      letterDate: item.letterDate,
      sifat: item.sifat,
      fieldValues: item.fieldValues,
      attachments: item.attachments,
      tembusan: item.tembusan,
    };
  };

  const handleDownloadPdf = (item: GeneratedLetter) => {
    const docData = buildPreviewData(item);
    if (!docData) return;
    exportDocumentsToPdf([docData], `${item.letterNumber}_${item.templateCode}`);
  };

  const handleDownloadWord = (item: GeneratedLetter) => {
    const docData = buildPreviewData(item);
    if (!docData) return;
    exportDocumentsToWord([docData], `${item.letterNumber}_${item.templateCode}`);
  };

  return (
    <div className="flex flex-col min-h-screen">
      <header className="h-16 px-6 bg-white border-b border-slate-200 flex items-center justify-between gap-8 shrink-0">
        <div className="flex items-center gap-2 text-sm">
          <span className="text-slate-400">Arsip</span>
          <span className="text-slate-300">/</span>
          <span className="font-display font-semibold text-slate-900">
            Buku Agenda Surat Keluar
          </span>
        </div>
        <div className="text-xs text-slate-500 tabular-nums">
          Total Arsip: <strong className="text-slate-900">{letters.length}</strong> dokumen
        </div>
      </header>

      <main className="flex-1 p-6 max-w-6xl w-full mx-auto space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Cari nomor surat, perihal, atau tujuan..."
              className="w-full pl-9 pr-4 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-900/20"
            />
          </div>

          <div className="flex items-center gap-1 p-1 bg-slate-200/60 rounded-lg overflow-x-auto">
            {codes.map((code) => (
              <button
                key={code}
                type="button"
                onClick={() => setFilterCode(code)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                  filterCode === code
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {code}
              </button>
            ))}
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-xl p-12 text-center space-y-2">
            <FileText className="w-8 h-8 text-slate-300 mx-auto" />
            <p className="text-sm font-semibold text-slate-800">
              Belum ada surat di arsip
            </p>
            <p className="text-xs text-slate-500">
              Buat surat melalui Studio Surat lalu klik Simpan ke Arsip untuk mencatatnya ke buku agenda.
            </p>
          </div>
        ) : (
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-xs font-medium text-slate-500">
                  <th className="py-3 px-4">Nomor Surat</th>
                  <th className="py-3 px-4">Tanggal</th>
                  <th className="py-3 px-4">Perihal & Jenis</th>
                  <th className="py-3 px-4">Tujuan / Subjek</th>
                  <th className="py-3 px-4 text-right">Lampiran</th>
                  <th className="py-3 px-4 text-right">Aksi & Download</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {filtered.map((item) => (
                  <tr
                    key={item.id}
                    className="hover:bg-slate-50/80 transition-colors"
                  >
                    <td className="py-3.5 px-4 font-mono text-xs font-semibold text-blue-950 whitespace-nowrap">
                      {item.letterNumber}
                    </td>
                    <td className="py-3.5 px-4 text-xs text-slate-600 tabular-nums whitespace-nowrap">
                      {formatTanggalIndonesia(item.letterDate)}
                    </td>
                    <td className="py-3.5 px-4 max-w-xs">
                      <p className="font-medium text-slate-900 truncate">
                        {item.perihal}
                      </p>
                      <p className="text-xs text-slate-500 truncate mt-0.5">
                        {item.templateCode} · {item.sifat}
                      </p>
                    </td>
                    <td className="py-3.5 px-4 text-xs text-slate-700 max-w-[180px] truncate">
                      {item.recipientSummary}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono text-xs text-slate-700 tabular-nums whitespace-nowrap">
                      {item.attachments.length} berkas
                    </td>
                    <td className="py-3.5 px-4 text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleDownloadPdf(item)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-white bg-blue-950 rounded-md hover:bg-blue-900 transition-colors"
                          title="Download PDF"
                        >
                          <FileDown className="w-3.5 h-3.5" />
                          <span>PDF</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDownloadWord(item)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-md hover:bg-slate-100 transition-colors"
                          title="Download Word (.doc)"
                        >
                          <FileDown className="w-3.5 h-3.5" />
                          <span>Word</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => onOpenInStudio(item)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-blue-950 bg-blue-50 rounded-md hover:bg-blue-100 transition-colors"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                          <span>Buka</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => onDeleteLetter(item.id)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 rounded-md hover:bg-rose-50 transition-colors"
                          title="Hapus Arsip"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  );
}
