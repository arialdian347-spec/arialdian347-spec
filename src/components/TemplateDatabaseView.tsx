import { useMemo, useState } from 'react';
import {
  ArrowRight,
  Copy,
  Download,
  Edit3,
  Plus,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import type {
  LetterTemplate,
  TemplateField,
} from '../types/document';
import { extractTemplateVariables } from '../utils/templateEngine';

interface TemplateDatabaseViewProps {
  templates: LetterTemplate[];
  onUseTemplate: (templateId: string) => void;
  onSaveTemplate: (template: LetterTemplate) => Promise<void>;
  onDeleteTemplate: (id: string) => Promise<void>;
}

const CATEGORIES: Array<'Semua' | LetterTemplate['category']> = [
  'Semua',
  'Undangan',
  'Penugasan',
  'Keputusan',
  'Niaga',
  'Administrasi',
  'Kepegawaian',
];

function createEmptyTemplate(): LetterTemplate {
  return {
    id: `tpl-${Date.now()}`,
    code: 'SRT',
    name: 'Template Surat Resmi Baru',
    category: 'Administrasi',
    description: 'Template surat resmi beserta lampiran otomatis.',
    numberPattern: '{seq}/{code}-{unit}/{roman_month}/{year}',
    defaultUnitCode: 'SEK',
    sifat: 'Penting',
    perihalTemplate: '{{perihal_surat}}',
    recipientBlockTemplate: 'Yth. {{nama_tujuan}}\n{{instansi_tujuan}}\ndi Tempat',
    salutation: 'Dengan hormat,',
    bodyParagraphs: [
      'Sehubungan dengan {{pokok_bahasan}}, bersama ini kami sampaikan pemberitahuan resmi kepada {{nama_tujuan}}.',
      'Rincian informasi dan daftar pendukung terlampir pada Lampiran surat ini.',
    ],
    closingParagraph:
      'Demikian surat ini kami sampaikan. Atas perhatian dan kerja samanya, kami ucapkan terima kasih.',
    tembusanDefault: ['Arsip Sekretariat'],
    fields: [
      {
        key: 'perihal_surat',
        label: 'Perihal Surat',
        type: 'text',
        placeholder: 'Pemberitahuan Program Kerja',
        defaultValue: 'Pemberitahuan Program Kerja Semester I',
        required: true,
        section: 'isi',
      },
      {
        key: 'nama_tujuan',
        label: 'Nama Penerima',
        type: 'text',
        placeholder: 'Kepala Unit Kerja',
        defaultValue: 'Kepala Bagian Operasional',
        required: true,
        section: 'tujuan',
      },
      {
        key: 'instansi_tujuan',
        label: 'Instansi Tujuan',
        type: 'text',
        placeholder: 'PT Mitra Usaha',
        defaultValue: 'PT Mitra Usaha Bersama',
        section: 'tujuan',
      },
      {
        key: 'pokok_bahasan',
        label: 'Pokok Bahasan',
        type: 'textarea',
        placeholder: 'pelaksanaan evaluasi berkala...',
        defaultValue: 'pelaksanaan evaluasi berkala dan sinkronisasi data',
        section: 'isi',
      },
      {
        key: 'nama_penandatangan',
        label: 'Nama Penandatangan',
        type: 'text',
        placeholder: 'Nama Pejabat',
        defaultValue: 'Ir. Hendrawan Kusuma, M.M.',
        required: true,
        section: 'penandatangan',
      },
      {
        key: 'jabatan_penandatangan',
        label: 'Jabatan Penandatangan',
        type: 'text',
        placeholder: 'Sekretaris Perusahaan',
        defaultValue: 'Sekretaris Perusahaan',
        required: true,
        section: 'penandatangan',
      },
      {
        key: 'nip_nik',
        label: 'NIP / NIK',
        type: 'text',
        placeholder: 'NIK. 20180412009',
        defaultValue: 'NIK. 20180412009',
        section: 'penandatangan',
      },
    ],
    defaultAttachments: [
      {
        id: `att-${Date.now()}`,
        title: 'Daftar Rincian Lampiran {{perihal_surat}}',
        subtitle: 'Kepada: {{nama_tujuan}}',
        layoutType: 'table',
        columns: [
          { key: 'uraian', label: 'Uraian', type: 'text', align: 'left' },
          { key: 'keterangan', label: 'Keterangan', type: 'text', align: 'left' },
        ],
        rows: [
          { uraian: 'Poin Utama 1', keterangan: 'Sesuai ketentuan berlaku' },
        ],
        listItems: [],
        narrativeText: '',
        footerNote: '',
      },
    ],
    updatedAt: new Date().toISOString(),
  };
}

export function TemplateDatabaseView({
  templates,
  onUseTemplate,
  onSaveTemplate,
  onDeleteTemplate,
}: TemplateDatabaseViewProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<
    'Semua' | LetterTemplate['category']
  >('Semua');
  const [editingTemplate, setEditingTemplate] = useState<LetterTemplate | null>(
    null
  );
  const [isSaving, setIsSaving] = useState(false);

  const filteredTemplates = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return templates.filter((t) => {
      const catMatch =
        selectedCategory === 'Semua' || t.category === selectedCategory;
      if (!catMatch) return false;
      if (!q) return true;
      return (
        t.name.toLowerCase().includes(q) ||
        t.code.toLowerCase().includes(q) ||
        t.description.toLowerCase().includes(q) ||
        t.category.toLowerCase().includes(q)
      );
    });
  }, [templates, searchQuery, selectedCategory]);

  const handleDuplicate = async (tpl: LetterTemplate) => {
    const copy: LetterTemplate = {
      ...structuredClone(tpl),
      id: `tpl-${Date.now()}`,
      name: `${tpl.name} (Salinan)`,
      updatedAt: new Date().toISOString(),
    };
    await onSaveTemplate(copy);
  };

  const handleSaveEditor = async () => {
    if (!editingTemplate) return;
    setIsSaving(true);
    try {
      // Auto-sync detected {{variables}} into fields list
      const allTexts = [
        editingTemplate.perihalTemplate,
        editingTemplate.recipientBlockTemplate,
        editingTemplate.salutation,
        ...editingTemplate.bodyParagraphs,
        editingTemplate.closingParagraph,
        ...editingTemplate.defaultAttachments.flatMap((a) => [
          a.title,
          a.subtitle ?? '',
          a.narrativeText,
        ]),
      ];
      const detectedKeys = extractTemplateVariables(allTexts);
      const existingMap = new Map(
        editingTemplate.fields.map((f) => [f.key, f])
      );
      const mergedFields: TemplateField[] = [...editingTemplate.fields];

      for (const key of detectedKeys) {
        if (!existingMap.has(key)) {
          mergedFields.push({
            key,
            label: key
              .replace(/_/g, ' ')
              .replace(/\b\w/g, (c) => c.toUpperCase()),
            type: 'text',
            placeholder: `Masukkan ${key.replace(/_/g, ' ')}`,
            defaultValue: '',
            section: key.includes('tujuan') || key.includes('penerima')
              ? 'tujuan'
              : key.includes('penandatangan') || key.includes('nip')
              ? 'penandatangan'
              : 'isi',
          });
        }
      }

      await onSaveTemplate({
        ...editingTemplate,
        fields: mergedFields,
        updatedAt: new Date().toISOString(),
      });
      setEditingTemplate(null);
    } finally {
      setIsSaving(false);
    }
  };

  const handleExportTemplatesJson = () => {
    const blob = new Blob([JSON.stringify(templates, null, 2)], {
      type: 'application/json;charset=utf-8',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'database-template-surat.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-col min-h-screen">
      {/* Top Bar Contract */}
      <header className="h-16 px-6 bg-white border-b border-slate-200 flex items-center justify-between gap-8 shrink-0">
        <div className="flex items-center gap-2 text-sm">
          <span className="text-slate-400">Database</span>
          <span className="text-slate-300">/</span>
          <span className="font-display font-semibold text-slate-900">
            Template Surat & Lampiran
          </span>
        </div>
        <div className="flex items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={handleExportTemplatesJson}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-100 transition-colors whitespace-nowrap shrink-0"
          >
            <Download className="w-4 h-4" />
            <span>Ekspor JSON</span>
          </button>
          <button
            type="button"
            onClick={() => setEditingTemplate(createEmptyTemplate())}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-950 rounded-lg hover:bg-blue-900 transition-colors whitespace-nowrap shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Tambah Template Baru</span>
          </button>
        </div>
      </header>

      <main className="flex-1 p-6 max-w-6xl w-full mx-auto space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari kode, nama template, atau kategori..."
              className="w-full pl-9 pr-4 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-900/20"
            />
          </div>

          <div className="flex items-center gap-1 p-1 bg-slate-200/60 rounded-lg overflow-x-auto">
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                  selectedCategory === cat
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {filteredTemplates.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-xl p-12 text-center space-y-2">
            <p className="text-sm font-semibold text-slate-800">
              Tidak ada template yang cocok
            </p>
            <p className="text-xs text-slate-500">
              Ubah kata kunci pencarian atau tambahkan template surat baru ke database.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredTemplates.map((tpl) => (
              <article
                key={tpl.id}
                className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col justify-between gap-4"
              >
                <div className="space-y-2.5">
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <span className="font-mono font-semibold text-blue-950">
                      {tpl.code}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span>{tpl.category}</span>
                    <span aria-hidden="true">·</span>
                    <span className="tabular-nums">
                      {tpl.fields.length} variabel
                    </span>
                    <span aria-hidden="true">·</span>
                    <span className="tabular-nums">
                      {tpl.defaultAttachments.length} lampiran default
                    </span>
                  </div>

                  <h3 className="font-display text-base font-semibold text-slate-900 leading-snug">
                    {tpl.name}
                  </h3>

                  <p className="text-sm text-slate-600 leading-relaxed">
                    {tpl.description}
                  </p>

                  <div className="pt-1 text-xs text-slate-500 font-mono truncate">
                    Pola Nomor: {tpl.numberPattern}
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-100 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setEditingTemplate(structuredClone(tpl))}
                      className="p-2 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
                      title="Edit Template"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDuplicate(tpl)}
                      className="p-2 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
                      title="Duplikat Template"
                    >
                      <Copy className="w-4 h-4" />
                    </button>
                    {templates.length > 1 && (
                      <button
                        type="button"
                        onClick={() => onDeleteTemplate(tpl.id)}
                        className="p-2 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                        title="Hapus Template"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => onUseTemplate(tpl.id)}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-white bg-blue-950 rounded-lg hover:bg-blue-900 transition-colors whitespace-nowrap"
                  >
                    <span>Gunakan Template</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </main>

      {/* Template Editor Modal */}
      {editingTemplate && (
        <div className="fixed inset-0 z-50 bg-slate-950/40 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <h2 className="font-display text-base font-semibold text-slate-900">
                Edit Struktur Template Database
              </h2>
              <button
                type="button"
                onClick={() => setEditingTemplate(null)}
                className="p-1.5 text-slate-400 hover:text-slate-900 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="md:col-span-2 space-y-1">
                  <label className="text-xs font-medium text-slate-700">
                    Nama Template
                  </label>
                  <input
                    type="text"
                    value={editingTemplate.name}
                    onChange={(e) =>
                      setEditingTemplate({
                        ...editingTemplate,
                        name: e.target.value,
                      })
                    }
                    className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-700">
                    Kode Klasifikasi
                  </label>
                  <input
                    type="text"
                    value={editingTemplate.code}
                    onChange={(e) =>
                      setEditingTemplate({
                        ...editingTemplate,
                        code: e.target.value.toUpperCase(),
                      })
                    }
                    className="w-full text-sm font-mono uppercase border border-slate-200 rounded-lg px-3 py-2"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-700">
                    Kategori
                  </label>
                  <select
                    value={editingTemplate.category}
                    onChange={(e) =>
                      setEditingTemplate({
                        ...editingTemplate,
                        category: e.target.value as LetterTemplate['category'],
                      })
                    }
                    className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2"
                  >
                    {CATEGORIES.filter((c) => c !== 'Semua').map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-700">
                    Unit Default
                  </label>
                  <input
                    type="text"
                    value={editingTemplate.defaultUnitCode}
                    onChange={(e) =>
                      setEditingTemplate({
                        ...editingTemplate,
                        defaultUnitCode: e.target.value.toUpperCase(),
                      })
                    }
                    className="w-full text-sm font-mono uppercase border border-slate-200 rounded-lg px-3 py-2"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-700">
                    Pola Nomor Otomatis
                  </label>
                  <input
                    type="text"
                    value={editingTemplate.numberPattern}
                    onChange={(e) =>
                      setEditingTemplate({
                        ...editingTemplate,
                        numberPattern: e.target.value,
                      })
                    }
                    className="w-full text-xs font-mono border border-slate-200 rounded-lg px-3 py-2"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-700">
                  Deskripsi Singkat
                </label>
                <input
                  type="text"
                  value={editingTemplate.description}
                  onChange={(e) =>
                    setEditingTemplate({
                      ...editingTemplate,
                      description: e.target.value,
                    })
                  }
                  className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-700">
                  Template Perihal (gunakan {'{{variabel}}'})
                </label>
                <input
                  type="text"
                  value={editingTemplate.perihalTemplate}
                  onChange={(e) =>
                    setEditingTemplate({
                      ...editingTemplate,
                      perihalTemplate: e.target.value,
                    })
                  }
                  className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-700">
                  Blok Tujuan Surat
                </label>
                <textarea
                  rows={3}
                  value={editingTemplate.recipientBlockTemplate}
                  onChange={(e) =>
                    setEditingTemplate({
                      ...editingTemplate,
                      recipientBlockTemplate: e.target.value,
                    })
                  }
                  className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-700">
                  Paragraf Isi Surat (pisahkan antar paragraf dengan baris kosong)
                </label>
                <textarea
                  rows={6}
                  value={editingTemplate.bodyParagraphs.join('\n\n')}
                  onChange={(e) =>
                    setEditingTemplate({
                      ...editingTemplate,
                      bodyParagraphs: e.target.value
                        .split(/\n\s*\n/)
                        .map((p) => p.trim())
                        .filter(Boolean),
                    })
                  }
                  className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-700">
                  Paragraf Penutup
                </label>
                <textarea
                  rows={2}
                  value={editingTemplate.closingParagraph}
                  onChange={(e) =>
                    setEditingTemplate({
                      ...editingTemplate,
                      closingParagraph: e.target.value,
                    })
                  }
                  className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2"
                />
              </div>
            </div>

            <div className="px-6 py-4 border-t border-slate-200 flex items-center justify-between bg-slate-50">
              <p className="text-xs text-slate-500">
                Variabel baru dengan format {'{{nama_variabel}}'} otomatis ditambahkan ke form input.
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setEditingTemplate(null)}
                  className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-100"
                >
                  Batal
                </button>
                <button
                  type="button"
                  disabled={isSaving}
                  onClick={handleSaveEditor}
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-950 rounded-lg hover:bg-blue-900 disabled:opacity-50"
                >
                  {isSaving ? 'Menyimpan...' : 'Simpan Template'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
