import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Check,
  Copy,
  FileDown,
  FileSpreadsheet,
  Layers,
  Plus,
  Printer,
  RotateCcw,
  Save,
  Trash2,
} from 'lucide-react';
import type {
  AttachmentItem,
  AttachmentLayoutType,
  GeneratedLetter,
  KopSuratProfile,
  LetterTemplate,
} from '../types/document';
import {
  computeAttachmentTotal,
  formatLetterNumber,
  formatRupiah,
  parseDelimitedRows,
  parseNumericValue,
  renderTemplateString,
} from '../utils/templateEngine';
import {
  exportDocumentsToPdf,
  exportDocumentsToWord,
} from '../utils/documentExporter';
import { LetterPreview, type PreviewDocumentData } from './LetterPreview';

interface StudioSuratProps {
  templates: LetterTemplate[];
  kopProfiles: KopSuratProfile[];
  sequences: Record<string, number>;
  initialTemplateId?: string;
  loadedLetter?: GeneratedLetter | null;
  onClearLoadedLetter: () => void;
  onSaveLetter: (
    letter: GeneratedLetter,
    incrementSequenceYear?: number
  ) => Promise<void>;
  onSaveBatchLetters: (
    letters: GeneratedLetter[],
    templateId: string,
    year: number
  ) => Promise<void>;
}

type EditorTab = 'data' | 'lampiran' | 'kop';
type StudioMode = 'single' | 'batch';
type PreviewFilter = 'all' | 'letter' | 'attachments';

function buildDefaultFieldValues(template: LetterTemplate): Record<string, string> {
  const values: Record<string, string> = {};
  for (const field of template.fields) {
    values[field.key] = field.defaultValue ?? '';
  }
  return values;
}

export function StudioSurat({
  templates,
  kopProfiles,
  sequences,
  initialTemplateId,
  loadedLetter,
  onClearLoadedLetter,
  onSaveLetter,
  onSaveBatchLetters,
}: StudioSuratProps) {
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>(
    initialTemplateId || templates[0]?.id || ''
  );
  const [selectedKopId, setSelectedKopId] = useState<string>(
    kopProfiles[0]?.id || ''
  );
  const [mode, setMode] = useState<StudioMode>('single');
  const [editorTab, setEditorTab] = useState<EditorTab>('data');
  const [viewFilter, setViewFilter] = useState<PreviewFilter>('all');
  const [zoomPercent, setZoomPercent] = useState<number>(85);

  const todayIso = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const [letterDate, setLetterDate] = useState<string>(todayIso);
  const [unitCode, setUnitCode] = useState<string>('SEK');
  const [sifat, setSifat] = useState<string>('Penting');
  const [useAutoNumber, setUseAutoNumber] = useState<boolean>(true);
  const [manualNumber, setManualNumber] = useState<string>('');
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});
  const [attachments, setAttachments] = useState<AttachmentItem[]>([]);
  const [tembusanText, setTembusanText] = useState<string>('');

  // CSV Import helper for attachments
  const [csvImportAttId, setCsvImportAttId] = useState<string | null>(null);
  const [csvImportText, setCsvImportText] = useState<string>('');

  // Batch generation state
  const [batchCsvText, setBatchCsvText] = useState<string>('');
  const [batchPreviewDocs, setBatchPreviewDocs] = useState<PreviewDocumentData[] | null>(
    null
  );

  // Status feedback
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null);

  const previewRef = useRef<HTMLDivElement | null>(null);

  const activeTemplate = useMemo(
    () =>
      templates.find((t) => t.id === selectedTemplateId) || templates[0] || null,
    [templates, selectedTemplateId]
  );

  const activeKop = useMemo(
    () =>
      kopProfiles.find((k) => k.id === selectedKopId) || kopProfiles[0] || null,
    [kopProfiles, selectedKopId]
  );

  // Sync when initialTemplateId changes from Database Template view
  useEffect(() => {
    if (initialTemplateId && templates.some((t) => t.id === initialTemplateId)) {
      setSelectedTemplateId(initialTemplateId);
      setBatchPreviewDocs(null);
    }
  }, [initialTemplateId, templates]);

  // Apply template defaults when template changes (unless loading an archived letter)
  useEffect(() => {
    if (!activeTemplate) return;
    if (loadedLetter && loadedLetter.templateId === activeTemplate.id) {
      return;
    }
    setUnitCode(activeTemplate.defaultUnitCode);
    setSifat(activeTemplate.sifat);
    setFieldValues(buildDefaultFieldValues(activeTemplate));
    setAttachments(structuredClone(activeTemplate.defaultAttachments));
    setTembusanText(activeTemplate.tembusanDefault.join('\n'));
    setUseAutoNumber(true);
    setBatchPreviewDocs(null);

    // Pre-populate helpful batch sample based on template fields
    const targetFields = activeTemplate.fields.filter((f) => f.section === 'tujuan');
    const cols = targetFields.length > 0 ? targetFields : activeTemplate.fields.slice(0, 3);
    const header = cols.map((c) => c.key).join(', ');
    const sample1 = cols.map((c) => c.defaultValue || c.placeholder).join(', ');
    const sample2 = cols
      .map((c, idx) => (idx === 0 ? `${c.defaultValue || 'Penerima'} (Cabang Surabaya)` : c.defaultValue || c.placeholder))
      .join(', ');
    setBatchCsvText(`${header}\n${sample1}\n${sample2}`);
  }, [activeTemplate?.id]);

  // Hydrate from loaded archived letter
  useEffect(() => {
    if (!loadedLetter) return;
    setSelectedTemplateId(loadedLetter.templateId);
    setSelectedKopId(loadedLetter.kopProfileId);
    setLetterDate(loadedLetter.letterDate);
    setUnitCode(loadedLetter.unitCode);
    setSifat(loadedLetter.sifat);
    setFieldValues({ ...loadedLetter.fieldValues });
    setAttachments(structuredClone(loadedLetter.attachments));
    setTembusanText(loadedLetter.tembusan.join('\n'));
    setUseAutoNumber(false);
    setManualNumber(loadedLetter.letterNumber);
    setMode('single');
    setBatchPreviewDocs(null);
  }, [loadedLetter]);

  const currentYear = useMemo(
    () => Number(letterDate.split('-')[0]) || new Date().getFullYear(),
    [letterDate]
  );

  const nextSequence = useMemo(() => {
    if (!activeTemplate) return 1;
    const key = `${activeTemplate.id}:${currentYear}`;
    return (sequences[key] ?? 0) + 1;
  }, [activeTemplate, sequences, currentYear]);

  const generatedLetterNumber = useMemo(() => {
    if (!activeTemplate) return '001/SRT/XI/2026';
    if (!useAutoNumber && manualNumber.trim()) {
      return manualNumber.trim();
    }
    return formatLetterNumber(
      activeTemplate.numberPattern,
      nextSequence,
      activeTemplate.code,
      unitCode,
      letterDate
    );
  }, [activeTemplate, useAutoNumber, manualNumber, nextSequence, unitCode, letterDate]);

  const tembusanList = useMemo(
    () =>
      tembusanText
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean),
    [tembusanText]
  );

  const showToast = (msg: string) => {
    setFeedbackMsg(msg);
    setTimeout(() => {
      setFeedbackMsg((prev) => (prev === msg ? null : prev));
    }, 3500);
  };

  if (!activeTemplate || !activeKop) {
    return (
      <div className="p-8 text-sm text-slate-600">
        Memuat database template dan profil Kop Surat...
      </div>
    );
  }

  const handleFieldChange = (key: string, value: string) => {
    setFieldValues((prev) => ({ ...prev, [key]: value }));
  };

  const handleResetToTemplate = () => {
    onClearLoadedLetter();
    setUnitCode(activeTemplate.defaultUnitCode);
    setSifat(activeTemplate.sifat);
    setFieldValues(buildDefaultFieldValues(activeTemplate));
    setAttachments(structuredClone(activeTemplate.defaultAttachments));
    setTembusanText(activeTemplate.tembusanDefault.join('\n'));
    setUseAutoNumber(true);
    setManualNumber('');
    showToast('Isian dan lampiran dikembalikan ke standar template.');
  };

  // Attachment CRUD handlers
  const handleAddAttachment = (layoutType: AttachmentLayoutType) => {
    const id = `att-${Date.now()}`;
    const newAtt: AttachmentItem = {
      id,
      title:
        layoutType === 'table'
          ? 'Daftar Rincian Lampiran Tambahan'
          : layoutType === 'list'
          ? 'Ketentuan & Jadwal Pelaksanaan'
          : 'Catatan Teknis Tambahan',
      subtitle: '',
      layoutType,
      columns:
        layoutType === 'table'
          ? [
              { key: 'item', label: 'Uraian / Item', type: 'text', align: 'left' },
              { key: 'jumlah', label: 'Jumlah', type: 'text', align: 'center' },
              { key: 'keterangan', label: 'Keterangan', type: 'text', align: 'left' },
            ]
          : [],
      rows:
        layoutType === 'table'
          ? [{ item: 'Contoh Item 1', jumlah: '1', keterangan: 'Terlampir' }]
          : [],
      listItems:
        layoutType === 'list'
          ? [{ title: 'Poin Ketentuan Pertama', detail: 'Uraian detail pelaksanaan poin pertama.' }]
          : [],
      narrativeText:
        layoutType === 'narrative'
          ? 'Tuliskan penjelasan atau catatan resmi tambahan di bagian ini.'
          : '',
      footerNote: '',
    };
    setAttachments((prev) => [...prev, newAtt]);
  };

  const handleUpdateAttachment = (
    attId: string,
    updater: (att: AttachmentItem) => AttachmentItem
  ) => {
    setAttachments((prev) => prev.map((a) => (a.id === attId ? updater(a) : a)));
  };

  const handleDeleteAttachment = (attId: string) => {
    setAttachments((prev) => prev.filter((a) => a.id !== attId));
  };

  const handleTableCellChange = (
    attId: string,
    rowIdx: number,
    colKey: string,
    value: string
  ) => {
    handleUpdateAttachment(attId, (att) => {
      const nextRows = att.rows.map((r, idx) => {
        if (idx !== rowIdx) return r;
        const updated = { ...r, [colKey]: value };
        // Automatic calculation if volume & harga_satuan & jumlah columns exist
        if (
          (colKey === 'volume' || colKey === 'harga_satuan') &&
          'jumlah' in updated
        ) {
          const vol = parseNumericValue(updated.volume ?? '0');
          const price = parseNumericValue(updated.harga_satuan ?? '0');
          updated.jumlah = String(vol * price);
        }
        return updated;
      });
      return { ...att, rows: nextRows };
    });
  };

  const handleAddTableRow = (attId: string) => {
    handleUpdateAttachment(attId, (att) => {
      const emptyRow: Record<string, string> = {};
      for (const col of att.columns) {
        emptyRow[col.key] = col.type === 'number' ? '1' : col.type === 'currency' ? '0' : '';
      }
      return { ...att, rows: [...att.rows, emptyRow] };
    });
  };

  const handleRemoveTableRow = (attId: string, rowIdx: number) => {
    handleUpdateAttachment(attId, (att) => ({
      ...att,
      rows: att.rows.filter((_, idx) => idx !== rowIdx),
    }));
  };

  const handleApplyCsvImport = (attId: string) => {
    const targetAtt = attachments.find((a) => a.id === attId);
    if (!targetAtt) return;
    const rows = parseDelimitedRows(csvImportText, targetAtt.columns);
    if (rows.length === 0) {
      showToast('Tidak ada baris data valid yang terbaca dari CSV.');
      return;
    }
    handleUpdateAttachment(attId, (att) => ({
      ...att,
      rows: rows.map((r) => {
        if ('volume' in r && 'harga_satuan' in r && 'jumlah' in r && !r.jumlah) {
          r.jumlah = String(
            parseNumericValue(r.volume) * parseNumericValue(r.harga_satuan)
          );
        }
        return r;
      }),
    }));
    setCsvImportAttId(null);
    setCsvImportText('');
    showToast(`${rows.length} baris berhasil diimpor ke lampiran.`);
  };

  const handleSaveSingle = async () => {
    setIsSaving(true);
    try {
      const perihal = renderTemplateString(
        activeTemplate.perihalTemplate,
        fieldValues
      );
      const recipientSummary =
        fieldValues.nama_tujuan ||
        fieldValues.perusahaan_klien ||
        fieldValues.nama_penerima ||
        fieldValues.nama_karyawan ||
        fieldValues.tentang ||
        fieldValues.unit_asal ||
        activeTemplate.name;

      const payload: GeneratedLetter = {
        id: `let-${Date.now()}`,
        templateId: activeTemplate.id,
        templateName: activeTemplate.name,
        templateCode: activeTemplate.code,
        kopProfileId: activeKop.id,
        letterNumber: generatedLetterNumber,
        letterDate,
        sifat,
        perihal,
        recipientSummary,
        unitCode,
        fieldValues: { ...fieldValues },
        attachments: structuredClone(attachments),
        tembusan: tembusanList,
        createdAt: new Date().toISOString(),
      };

      await onSaveLetter(payload, useAutoNumber ? currentYear : undefined);
      onClearLoadedLetter();
      showToast(`Surat ${payload.letterNumber} & lampiran disimpan ke Arsip.`);
    } finally {
      setIsSaving(false);
    }
  };

  // Batch generator parsing
  const parsedBatchItems = useMemo(() => {
    const lines = batchCsvText
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);
    if (lines.length < 2) return { headers: [], rows: [] };
    const delim = lines[0].includes('\t') ? '\t' : lines[0].includes(';') ? ';' : ',';
    const headers = lines[0].split(delim).map((h) => h.trim());
    const rows = lines.slice(1).map((line) => {
      const cells = line.split(delim).map((c) => c.trim());
      const obj: Record<string, string> = {};
      headers.forEach((h, i) => {
        if (h) obj[h] = cells[i] ?? '';
      });
      return obj;
    });
    return { headers, rows };
  }, [batchCsvText]);

  const handleGenerateBatch = async () => {
    if (parsedBatchItems.rows.length === 0) {
      showToast('Masukkan minimal 1 baris penerima pada data CSV massal.');
      return;
    }
    setIsSaving(true);
    try {
      const generatedList: GeneratedLetter[] = [];
      const previewList: PreviewDocumentData[] = [];

      parsedBatchItems.rows.forEach((rowOverride, idx) => {
        const seq = nextSequence + idx;
        const number = formatLetterNumber(
          activeTemplate.numberPattern,
          seq,
          activeTemplate.code,
          unitCode,
          letterDate
        );
        const mergedFields = { ...fieldValues, ...rowOverride };
        const perihal = renderTemplateString(
          activeTemplate.perihalTemplate,
          mergedFields
        );
        const recipientSummary =
          mergedFields.nama_tujuan ||
          mergedFields.perusahaan_klien ||
          mergedFields.nama_penerima ||
          mergedFields.nama_karyawan ||
          Object.values(rowOverride)[0] ||
          activeTemplate.name;

        const letterObj: GeneratedLetter = {
          id: `let-${Date.now()}-${idx}`,
          templateId: activeTemplate.id,
          templateName: activeTemplate.name,
          templateCode: activeTemplate.code,
          kopProfileId: activeKop.id,
          letterNumber: number,
          letterDate,
          sifat,
          perihal,
          recipientSummary,
          unitCode,
          fieldValues: mergedFields,
          attachments: structuredClone(attachments),
          tembusan: tembusanList,
          createdAt: new Date().toISOString(),
        };
        generatedList.push(letterObj);
        previewList.push({
          template: activeTemplate,
          kopProfile: activeKop,
          letterNumber: number,
          letterDate,
          sifat,
          fieldValues: mergedFields,
          attachments: structuredClone(attachments),
          tembusan: tembusanList,
        });
      });

      await onSaveBatchLetters(generatedList, activeTemplate.id, currentYear);
      setBatchPreviewDocs(previewList);
      showToast(
        `${generatedList.length} surat & lampiran massal berhasil dibuat dan disimpan ke Arsip.`
      );
    } finally {
      setIsSaving(false);
    }
  };

  const singlePreviewDoc: PreviewDocumentData = {
    template: activeTemplate,
    kopProfile: activeKop,
    letterNumber: generatedLetterNumber,
    letterDate,
    sifat,
    fieldValues,
    attachments,
    tembusan: tembusanList,
  };

  const activePreviewDocuments =
    mode === 'batch' && batchPreviewDocs && batchPreviewDocs.length > 0
      ? batchPreviewDocs
      : [singlePreviewDoc];

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadPdf = () => {
    const fileLabel =
      activePreviewDocuments.length > 1
        ? `Batch_${activeTemplate.code}_${activePreviewDocuments.length}_Surat`
        : `${generatedLetterNumber}_${activeTemplate.code}`;
    const ok = exportDocumentsToPdf(activePreviewDocuments, fileLabel);
    if (ok) {
      showToast('File PDF berhasil diunduh.');
    }
  };

  const handleExportWord = () => {
    const fileLabel =
      activePreviewDocuments.length > 1
        ? `Batch_${activeTemplate.code}_${activePreviewDocuments.length}_Surat`
        : `${generatedLetterNumber}_${activeTemplate.code}`;
    const ok = exportDocumentsToWord(activePreviewDocuments, fileLabel);
    if (ok) {
      showToast('Dokumen Word (.doc) berhasil diunduh.');
    }
  };

  const sections: { id: 'tujuan' | 'isi' | 'penandatangan'; title: string }[] = [
    { id: 'tujuan', title: 'Pihak Tujuan / Subjek' },
    { id: 'isi', title: 'Substansi & Data Utama' },
    { id: 'penandatangan', title: 'Pejabat Penandatangan' },
  ];

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      {/* Top Bar Contract: Breadcrumb on left, 1 primary CTA on right */}
      <header className="no-print h-16 px-6 bg-white border-b border-slate-200 flex items-center justify-between gap-8 shrink-0">
        <div className="flex items-center gap-2 text-sm min-w-0">
          <span className="text-slate-400 whitespace-nowrap">Studio Surat</span>
          <span className="text-slate-300">/</span>
          <span className="font-display font-semibold text-slate-900 truncate">
            {activeTemplate.name}
          </span>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={handleDownloadPdf}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-950 rounded-lg hover:bg-blue-900 transition-colors whitespace-nowrap shrink-0"
          >
            <FileDown className="w-4 h-4" />
            <span>Download PDF</span>
          </button>
        </div>
      </header>

      {/* Workspace Secondary Toolbar */}
      <div className="no-print px-6 py-2.5 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-4 shrink-0">
        <div className="flex items-center gap-4 min-w-0">
          <div className="flex items-center gap-2">
            <label
              htmlFor="template-select"
              className="text-xs font-medium text-slate-500 whitespace-nowrap"
            >
              Template:
            </label>
            <select
              id="template-select"
              value={activeTemplate.id}
              onChange={(e) => {
                onClearLoadedLetter();
                setSelectedTemplateId(e.target.value);
              }}
              className="text-sm font-medium text-slate-900 bg-white border border-slate-200 rounded-lg px-3 py-1.5 max-w-xs focus:outline-none focus:ring-2 focus:ring-blue-900/20"
            >
              {templates.map((tpl) => (
                <option key={tpl.id} value={tpl.id}>
                  [{tpl.code}] {tpl.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-1 p-1 bg-slate-200/70 rounded-lg">
            <button
              type="button"
              onClick={() => {
                setMode('single');
                setBatchPreviewDocs(null);
              }}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                mode === 'single'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Buat Satuan
            </button>
            <button
              type="button"
              onClick={() => setMode('batch')}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                mode === 'batch'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Buat Massal (CSV)
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {feedbackMsg && (
            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700 mr-2">
              <Check className="w-3.5 h-3.5" />
              <span>{feedbackMsg}</span>
            </span>
          )}
          <button
            type="button"
            onClick={handleResetToTemplate}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-100 transition-colors whitespace-nowrap"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset</span>
          </button>
          <button
            type="button"
            onClick={handlePrint}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-100 transition-colors whitespace-nowrap"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Cetak</span>
          </button>
          <button
            type="button"
            onClick={handleExportWord}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-100 transition-colors whitespace-nowrap"
          >
            <FileDown className="w-3.5 h-3.5" />
            <span>Download Word (.doc)</span>
          </button>
          {mode === 'single' && (
            <button
              type="button"
              disabled={isSaving}
              onClick={handleSaveSingle}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium text-blue-950 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors whitespace-nowrap disabled:opacity-50"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{isSaving ? 'Menyimpan...' : 'Simpan ke Arsip'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Split Workspace */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Editor Panel */}
        <section className="no-print w-[470px] shrink-0 bg-white border-r border-slate-200 flex flex-col overflow-hidden">
          {mode === 'single' ? (
            <>
              {/* Editor Tabs */}
              <div className="px-5 pt-4 pb-3 border-b border-slate-200 flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setEditorTab('data')}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                    editorTab === 'data'
                      ? 'bg-slate-900 text-white'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  1. Data Surat
                </button>
                <button
                  type="button"
                  onClick={() => setEditorTab('lampiran')}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                    editorTab === 'lampiran'
                      ? 'bg-slate-900 text-white'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  2. Lampiran ({attachments.length})
                </button>
                <button
                  type="button"
                  onClick={() => setEditorTab('kop')}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                    editorTab === 'kop'
                      ? 'bg-slate-900 text-white'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  3. Kop & Nomor
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-5 space-y-6">
                {editorTab === 'data' && (
                  <>
                    {/* Quick Summary Line */}
                    <div className="pb-4 border-b border-slate-100 flex items-center justify-between text-xs text-slate-500">
                      <span>
                        Nomor Otomatis:{' '}
                        <strong className="font-mono text-slate-900">
                          {generatedLetterNumber}
                        </strong>
                      </span>
                      <span className="tabular-nums">
                        {activeTemplate.fields.length} variabel
                      </span>
                    </div>

                    {sections.map((sec) => {
                      const secFields = activeTemplate.fields.filter(
                        (f) => f.section === sec.id
                      );
                      if (secFields.length === 0) return null;
                      return (
                        <div key={sec.id} className="space-y-3.5">
                          <h3 className="text-xs font-semibold text-slate-800 tracking-wide">
                            {sec.title}
                          </h3>
                          {secFields.map((field) => (
                            <div key={field.key} className="space-y-1">
                              <div className="flex items-center justify-between">
                                <label
                                  htmlFor={`field-${field.key}`}
                                  className="text-xs font-medium text-slate-700"
                                >
                                  {field.label}
                                  {field.required && (
                                    <span className="text-rose-600 ml-0.5">*</span>
                                  )}
                                </label>
                                <span className="text-[11px] font-mono text-slate-400">
                                  {`{{${field.key}}}`}
                                </span>
                              </div>
                              {field.type === 'textarea' ? (
                                <textarea
                                  id={`field-${field.key}`}
                                  rows={3}
                                  value={fieldValues[field.key] ?? ''}
                                  placeholder={field.placeholder}
                                  onChange={(e) =>
                                    handleFieldChange(field.key, e.target.value)
                                  }
                                  className="w-full text-sm text-slate-900 bg-white border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-900/20 focus:border-blue-900"
                                />
                              ) : field.type === 'select' && field.options ? (
                                <select
                                  id={`field-${field.key}`}
                                  value={fieldValues[field.key] ?? ''}
                                  onChange={(e) =>
                                    handleFieldChange(field.key, e.target.value)
                                  }
                                  className="w-full text-sm text-slate-900 bg-white border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-900/20 focus:border-blue-900"
                                >
                                  {field.options.map((opt) => (
                                    <option key={opt} value={opt}>
                                      {opt}
                                    </option>
                                  ))}
                                </select>
                              ) : (
                                <input
                                  id={`field-${field.key}`}
                                  type={field.type === 'date' ? 'date' : 'text'}
                                  value={fieldValues[field.key] ?? ''}
                                  placeholder={field.placeholder}
                                  onChange={(e) =>
                                    handleFieldChange(field.key, e.target.value)
                                  }
                                  className="w-full text-sm text-slate-900 bg-white border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-900/20 focus:border-blue-900"
                                />
                              )}
                            </div>
                          ))}
                        </div>
                      );
                    })}
                  </>
                )}

                {editorTab === 'lampiran' && (
                  <div className="space-y-5">
                    <div className="flex flex-wrap items-center gap-2 pb-4 border-b border-slate-200">
                      <button
                        type="button"
                        onClick={() => handleAddAttachment('table')}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-blue-950 rounded-lg hover:bg-blue-900 transition-colors"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Lampiran Tabel</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleAddAttachment('list')}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Lampiran Daftar</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleAddAttachment('narrative')}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Lampiran Narasi</span>
                      </button>
                    </div>

                    {attachments.length === 0 ? (
                      <div className="py-10 text-center space-y-2 border border-dashed border-slate-200 rounded-xl">
                        <p className="text-sm font-medium text-slate-700">
                          Tidak ada lampiran terpasang
                        </p>
                        <p className="text-xs text-slate-500 max-w-xs mx-auto">
                          Klik tombol di atas untuk menambahkan lampiran tabel, daftar acara, atau catatan resmi.
                        </p>
                      </div>
                    ) : (
                      attachments.map((att, attIdx) => (
                        <div
                          key={att.id}
                          className="border border-slate-200 rounded-xl p-4 space-y-3.5 bg-slate-50/50"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-xs font-semibold text-slate-800">
                              Lampiran {attIdx + 1} ·{' '}
                              <span className="font-normal text-slate-500">
                                {att.layoutType === 'table'
                                  ? 'Format Tabel'
                                  : att.layoutType === 'list'
                                  ? 'Format Daftar'
                                  : 'Format Narasi'}
                              </span>
                            </span>
                            <button
                              type="button"
                              onClick={() => handleDeleteAttachment(att.id)}
                              className="p-1.5 text-slate-400 hover:text-rose-600 rounded-md hover:bg-rose-50 transition-colors"
                              title="Hapus Lampiran"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>

                          <div className="space-y-2">
                            <input
                              type="text"
                              value={att.title}
                              onChange={(e) =>
                                handleUpdateAttachment(att.id, (prev) => ({
                                  ...prev,
                                  title: e.target.value,
                                }))
                              }
                              placeholder="Judul Lampiran"
                              className="w-full text-sm font-medium text-slate-900 bg-white border border-slate-200 rounded-lg px-3 py-1.5"
                            />
                            <input
                              type="text"
                              value={att.subtitle ?? ''}
                              onChange={(e) =>
                                handleUpdateAttachment(att.id, (prev) => ({
                                  ...prev,
                                  subtitle: e.target.value,
                                }))
                              }
                              placeholder="Subjudul / keterangan singkat (opsional)"
                              className="w-full text-xs text-slate-700 bg-white border border-slate-200 rounded-lg px-3 py-1.5"
                            />
                          </div>

                          {att.layoutType === 'table' && (
                            <div className="space-y-2.5">
                              <div className="flex items-center justify-between">
                                <span className="text-xs font-medium text-slate-600">
                                  Baris Data ({att.rows.length})
                                </span>
                                <div className="flex items-center gap-2">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setCsvImportAttId(
                                        csvImportAttId === att.id ? null : att.id
                                      )
                                    }
                                    className="inline-flex items-center gap-1 text-xs font-medium text-blue-900 hover:underline"
                                  >
                                    <FileSpreadsheet className="w-3.5 h-3.5" />
                                    <span>Impor CSV</span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleAddTableRow(att.id)}
                                    className="inline-flex items-center gap-1 text-xs font-medium text-slate-700 bg-white border border-slate-200 px-2.5 py-1 rounded-md hover:bg-slate-100"
                                  >
                                    <Plus className="w-3 h-3" />
                                    <span>Baris</span>
                                  </button>
                                </div>
                              </div>

                              {csvImportAttId === att.id && (
                                <div className="p-3 bg-white border border-blue-200 rounded-lg space-y-2">
                                  <p className="text-xs text-slate-600">
                                    Tempel data CSV atau salinan dari Excel (urutan kolom:{' '}
                                    <span className="font-mono text-[11px]">
                                      {att.columns.map((c) => c.label).join(', ')}
                                    </span>
                                    ):
                                  </p>
                                  <textarea
                                    rows={4}
                                    value={csvImportText}
                                    onChange={(e) => setCsvImportText(e.target.value)}
                                    placeholder={att.columns
                                      .map((c) => c.label)
                                      .join(', ')}
                                    className="w-full text-xs font-mono border border-slate-200 rounded-md p-2"
                                  />
                                  <div className="flex justify-end gap-2">
                                    <button
                                      type="button"
                                      onClick={() => setCsvImportAttId(null)}
                                      className="px-2.5 py-1 text-xs text-slate-600 hover:text-slate-900"
                                    >
                                      Batal
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleApplyCsvImport(att.id)}
                                      className="px-3 py-1 text-xs font-medium text-white bg-blue-950 rounded-md"
                                    >
                                      Terapkan Baris
                                    </button>
                                  </div>
                                </div>
                              )}

                              <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                                {att.rows.map((row, rIdx) => (
                                  <div
                                    key={rIdx}
                                    className="bg-white border border-slate-200 rounded-lg p-2.5 space-y-2"
                                  >
                                    <div className="flex items-center justify-between text-[11px] text-slate-400">
                                      <span className="font-mono tabular-nums">
                                        Baris #{rIdx + 1}
                                      </span>
                                      <button
                                        type="button"
                                        onClick={() =>
                                          handleRemoveTableRow(att.id, rIdx)
                                        }
                                        className="text-slate-400 hover:text-rose-600"
                                      >
                                        Hapus
                                      </button>
                                    </div>
                                    <div className="grid grid-cols-2 gap-2">
                                      {att.columns.map((col) => (
                                        <div key={col.key}>
                                          <label className="block text-[11px] text-slate-500 mb-0.5 truncate">
                                            {col.label}
                                          </label>
                                          <input
                                            type="text"
                                            value={row[col.key] ?? ''}
                                            onChange={(e) =>
                                              handleTableCellChange(
                                                att.id,
                                                rIdx,
                                                col.key,
                                                e.target.value
                                              )
                                            }
                                            className="w-full text-xs text-slate-900 border border-slate-200 rounded px-2 py-1 focus:outline-none focus:border-blue-900"
                                          />
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                ))}
                              </div>

                              {att.showSummaryRow && att.summaryColumnKey && (
                                <div className="flex items-center justify-between pt-2 border-t border-slate-200 text-xs">
                                  <span className="text-slate-600">
                                    Total Terhitung Otomatis:
                                  </span>
                                  <span className="font-mono font-semibold text-slate-900 tabular-nums">
                                    {formatRupiah(computeAttachmentTotal(att))}
                                  </span>
                                </div>
                              )}
                            </div>
                          )}

                          {att.layoutType === 'list' && (
                            <div className="space-y-2">
                              <div className="flex items-center justify-between">
                                <span className="text-xs font-medium text-slate-600">
                                  Poin Daftar ({att.listItems.length})
                                </span>
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleUpdateAttachment(att.id, (prev) => ({
                                      ...prev,
                                      listItems: [
                                        ...prev.listItems,
                                        { title: 'Poin Baru', detail: '' },
                                      ],
                                    }))
                                  }
                                  className="inline-flex items-center gap-1 text-xs font-medium text-slate-700 bg-white border border-slate-200 px-2.5 py-1 rounded-md"
                                >
                                  <Plus className="w-3 h-3" />
                                  <span>Tambah Poin</span>
                                </button>
                              </div>
                              {att.listItems.map((item, idx) => (
                                <div
                                  key={idx}
                                  className="bg-white border border-slate-200 rounded-lg p-2.5 space-y-1.5"
                                >
                                  <div className="flex items-center justify-between gap-2">
                                    <input
                                      type="text"
                                      value={item.title}
                                      onChange={(e) =>
                                        handleUpdateAttachment(att.id, (prev) => ({
                                          ...prev,
                                          listItems: prev.listItems.map((li, i) =>
                                            i === idx
                                              ? { ...li, title: e.target.value }
                                              : li
                                          ),
                                        }))
                                      }
                                      className="flex-1 text-xs font-medium border border-slate-200 rounded px-2 py-1"
                                    />
                                    <button
                                      type="button"
                                      onClick={() =>
                                        handleUpdateAttachment(att.id, (prev) => ({
                                          ...prev,
                                          listItems: prev.listItems.filter(
                                            (_, i) => i !== idx
                                          ),
                                        }))
                                      }
                                      className="text-xs text-slate-400 hover:text-rose-600"
                                    >
                                      Hapus
                                    </button>
                                  </div>
                                  <input
                                    type="text"
                                    value={item.detail}
                                    onChange={(e) =>
                                      handleUpdateAttachment(att.id, (prev) => ({
                                        ...prev,
                                        listItems: prev.listItems.map((li, i) =>
                                          i === idx
                                            ? { ...li, detail: e.target.value }
                                            : li
                                        ),
                                      }))
                                    }
                                    placeholder="Keterangan detail"
                                    className="w-full text-xs text-slate-600 border border-slate-200 rounded px-2 py-1"
                                  />
                                </div>
                              ))}
                            </div>
                          )}

                          {att.layoutType === 'narrative' && (
                            <textarea
                              rows={5}
                              value={att.narrativeText}
                              onChange={(e) =>
                                handleUpdateAttachment(att.id, (prev) => ({
                                  ...prev,
                                  narrativeText: e.target.value,
                                }))
                              }
                              className="w-full text-xs text-slate-900 bg-white border border-slate-200 rounded-lg p-2.5"
                            />
                          )}

                          <input
                            type="text"
                            value={att.footerNote ?? ''}
                            onChange={(e) =>
                              handleUpdateAttachment(att.id, (prev) => ({
                                ...prev,
                                footerNote: e.target.value,
                              }))
                            }
                            placeholder="Catatan kaki lampiran (opsional)"
                            className="w-full text-xs text-slate-600 bg-white border border-slate-200 rounded-lg px-3 py-1.5"
                          />
                        </div>
                      ))
                    )}
                  </div>
                )}

                {editorTab === 'kop' && (
                  <div className="space-y-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-slate-700">
                        Profil Kop Surat Instansi
                      </label>
                      <select
                        value={activeKop.id}
                        onChange={(e) => setSelectedKopId(e.target.value)}
                        className="w-full text-sm text-slate-900 bg-white border border-slate-200 rounded-lg px-3 py-2"
                      >
                        {kopProfiles.map((kop) => (
                          <option key={kop.id} value={kop.id}>
                            {kop.organizationName} ({kop.city})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-xs font-medium text-slate-700">
                          Tanggal Surat
                        </label>
                        <input
                          type="date"
                          value={letterDate}
                          onChange={(e) => setLetterDate(e.target.value)}
                          className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-medium text-slate-700">
                          Kode Unit Penerbit
                        </label>
                        <input
                          type="text"
                          value={unitCode}
                          onChange={(e) => setUnitCode(e.target.value.toUpperCase())}
                          className="w-full text-sm font-mono uppercase border border-slate-200 rounded-lg px-3 py-2"
                        />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-slate-700">
                        Sifat Surat
                      </label>
                      <input
                        type="text"
                        value={sifat}
                        onChange={(e) => setSifat(e.target.value)}
                        className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2"
                      />
                    </div>

                    <div className="p-3.5 border border-slate-200 rounded-xl space-y-2.5 bg-slate-50">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-slate-800">
                          Penomoran Otomatis Database
                        </span>
                        <button
                          type="button"
                          onClick={() => setUseAutoNumber((v) => !v)}
                          className="text-xs font-medium text-blue-900 hover:underline"
                        >
                          {useAutoNumber ? 'Ubah ke Manual' : 'Gunakan Otomatis'}
                        </button>
                      </div>
                      {useAutoNumber ? (
                        <div className="text-xs text-slate-600 space-y-1">
                          <p>
                            Nomor urut berikutnya:{' '}
                            <strong className="font-mono text-slate-900">
                              #{String(nextSequence).padStart(3, '0')}
                            </strong>{' '}
                            (Tahun {currentYear})
                          </p>
                          <p className="font-mono text-sm font-semibold text-blue-950">
                            {generatedLetterNumber}
                          </p>
                        </div>
                      ) : (
                        <input
                          type="text"
                          value={manualNumber}
                          onChange={(e) => setManualNumber(e.target.value)}
                          placeholder="Contoh: 099/UND-DIR/XI/2026"
                          className="w-full text-sm font-mono bg-white border border-slate-200 rounded-lg px-3 py-2"
                        />
                      )}
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-slate-700">
                        Daftar Tembusan (1 baris per tujuan)
                      </label>
                      <textarea
                        rows={3}
                        value={tembusanText}
                        onChange={(e) => setTembusanText(e.target.value)}
                        placeholder="Direktur Utama&#10;Arsip Sekretariat"
                        className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2"
                      />
                    </div>
                  </div>
                )}
              </div>
            </>
          ) : (
            /* Batch Mode Left Panel */
            <div className="flex-1 overflow-y-auto p-5 space-y-5">
              <div className="pb-4 border-b border-slate-200 space-y-1">
                <h2 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                  <Layers className="w-4 h-4 text-blue-950" />
                  <span>Pembuatan Surat & Lampiran Massal</span>
                </h2>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Tempel daftar penerima dalam format CSV. Setiap baris otomatis menghasilkan 1 surat bernomor urut berkesinambungan beserta lampirannya.
                </p>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-medium text-slate-700">
                    Data Penerima (Baris pertama = nama variabel template)
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      const keys = activeTemplate.fields
                        .filter((f) => f.section === 'tujuan')
                        .map((f) => f.key);
                      navigator.clipboard?.writeText(keys.join(', '));
                      showToast('Nama kolom variabel disalin.');
                    }}
                    className="inline-flex items-center gap-1 text-[11px] font-medium text-blue-900 hover:underline"
                  >
                    <Copy className="w-3 h-3" />
                    <span>Salin Header Kolom</span>
                  </button>
                </div>
                <textarea
                  rows={8}
                  value={batchCsvText}
                  onChange={(e) => setBatchCsvText(e.target.value)}
                  className="w-full text-xs font-mono text-slate-900 bg-slate-50 border border-slate-200 rounded-lg p-3 leading-relaxed focus:outline-none focus:ring-2 focus:ring-blue-900/20"
                />
                <p className="text-[11px] text-slate-500">
                  Variabel tersedia pada template ini:{' '}
                  <span className="font-mono text-slate-700">
                    {activeTemplate.fields.map((f) => f.key).join(', ')}
                  </span>
                </p>
              </div>

              <div className="p-4 border border-slate-200 rounded-xl bg-slate-50 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-600">Jumlah Surat Terdeteksi</span>
                  <span className="font-mono font-semibold text-slate-900 tabular-nums">
                    {parsedBatchItems.rows.length} surat
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-600">Rentang Nomor Otomatis</span>
                  <span className="font-mono font-semibold text-blue-950 tabular-nums">
                    #{String(nextSequence).padStart(3, '0')} – #
                    {String(
                      nextSequence + Math.max(0, parsedBatchItems.rows.length - 1)
                    ).padStart(3, '0')}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-600">Lampiran per Surat</span>
                  <span className="font-mono font-semibold text-slate-900 tabular-nums">
                    {attachments.length} berkas
                  </span>
                </div>
              </div>

              <button
                type="button"
                disabled={isSaving || parsedBatchItems.rows.length === 0}
                onClick={handleGenerateBatch}
                className="w-full py-2.5 px-4 text-sm font-medium text-white bg-blue-950 rounded-lg hover:bg-blue-900 transition-colors disabled:opacity-50"
              >
                {isSaving
                  ? 'Membuat & Menyimpan...'
                  : `Generate & Simpan ${parsedBatchItems.rows.length} Surat ke Arsip`}
              </button>
            </div>
          )}
        </section>

        {/* Right Live A4 Preview Canvas */}
        <section className="flex-1 bg-slate-100 flex flex-col overflow-hidden">
          <div className="no-print px-6 py-2.5 bg-white/80 border-b border-slate-200 flex items-center justify-between gap-4 shrink-0">
            <div className="flex items-center gap-1 p-0.5 bg-slate-100 rounded-lg">
              {(
                [
                  { id: 'all', label: 'Semua Halaman' },
                  { id: 'letter', label: 'Surat Utama' },
                  { id: 'attachments', label: `Lampiran (${attachments.length})` },
                ] as const
              ).map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setViewFilter(item.id)}
                  className={`px-3 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                    viewFilter === item.id
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2 text-xs text-slate-600">
              <span>Zoom:</span>
              {[75, 85, 100].map((pct) => (
                <button
                  key={pct}
                  type="button"
                  onClick={() => setZoomPercent(pct)}
                  className={`px-2 py-1 rounded font-mono tabular-nums ${
                    zoomPercent === pct
                      ? 'bg-slate-900 text-white'
                      : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  {pct}%
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-8">
            <LetterPreview
              documents={activePreviewDocuments}
              viewFilter={viewFilter}
              zoomPercent={zoomPercent}
              previewRef={previewRef}
            />
          </div>
        </section>
      </div>
    </div>
  );
}
