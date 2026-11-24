import React from 'react';
import type {
  AttachmentItem,
  KopSuratProfile,
  LetterTemplate,
} from '../types/document';
import {
  computeAttachmentTotal,
  formatRupiah,
  formatTanggalIndonesia,
  renderTemplateString,
  toRomanIndex,
} from '../utils/templateEngine';

export interface PreviewDocumentData {
  template: LetterTemplate;
  kopProfile: KopSuratProfile;
  letterNumber: string;
  letterDate: string;
  sifat: string;
  fieldValues: Record<string, string>;
  attachments: AttachmentItem[];
  tembusan: string[];
}

interface LetterPreviewProps {
  documents: PreviewDocumentData[];
  viewFilter?: 'all' | 'letter' | 'attachments';
  zoomPercent?: number;
  previewRef?: React.RefObject<HTMLDivElement | null>;
}

function KopSuratHeader({ kop }: { kop: KopSuratProfile }) {
  return (
    <div className="mb-5">
      <div className="flex items-center gap-4 pb-3 border-b-[3px] border-slate-900 relative">
        <div
          className="w-16 h-16 shrink-0 rounded-md flex items-center justify-center font-display font-bold text-lg tracking-wider text-white border border-slate-900/20"
          style={{ backgroundColor: kop.accentColor || '#1E3A8A' }}
        >
          {kop.crestCode || 'TN'}
        </div>
        <div className="flex-1 text-center pr-8">
          <div className="text-[13.5pt] font-bold tracking-wide text-slate-900 leading-tight uppercase">
            {kop.organizationName}
          </div>
          {kop.subOrganization && (
            <div className="text-[10.5pt] font-bold tracking-wide text-slate-800 mt-0.5 uppercase">
              {kop.subOrganization}
            </div>
          )}
          <div className="text-[9pt] text-slate-700 mt-1 leading-snug">
            {kop.address}
          </div>
          <div className="text-[8.5pt] text-slate-600 leading-snug">
            {kop.contactLine}
          </div>
        </div>
      </div>
      <div className="border-b border-slate-900 mt-[2px]" />
    </div>
  );
}

export function LetterPreview({
  documents,
  viewFilter = 'all',
  zoomPercent = 100,
  previewRef,
}: LetterPreviewProps) {
  const scale = zoomPercent / 100;

  return (
    <div
      ref={previewRef}
      className="print-only-container flex flex-col items-center gap-8"
      style={{
        transform: scale !== 1 ? `scale(${scale})` : undefined,
        transformOrigin: 'top center',
        marginBottom: scale < 1 ? `-${(1 - scale) * 280}px` : undefined,
      }}
    >
      {documents.map((docData, docIdx) => {
        const {
          template,
          kopProfile,
          letterNumber,
          letterDate,
          sifat,
          fieldValues,
          attachments,
          tembusan,
        } = docData;

        const formattedDate = formatTanggalIndonesia(letterDate);
        const perihal = renderTemplateString(template.perihalTemplate, fieldValues);
        const recipientLines = renderTemplateString(
          template.recipientBlockTemplate,
          fieldValues
        ).split('\n');
        const lampiranLabel =
          attachments.length > 0
            ? `${attachments.length} (${
                attachments.length === 1
                  ? 'satu'
                  : attachments.length === 2
                  ? 'dua'
                  : attachments.length === 3
                  ? 'tiga'
                  : String(attachments.length)
              }) berkas`
            : '-';

        const signerName =
          fieldValues.nama_penandatangan || 'Nama Pejabat Penandatangan';
        const signerRole =
          fieldValues.jabatan_penandatangan || 'Jabatan Penandatangan';
        const signerId = fieldValues.nip_nik || '';

        const isDecisionOrStatement =
          template.code === 'SK' || template.code === 'SKK';

        return (
          <React.Fragment key={`${letterNumber}-${docIdx}`}>
            {viewFilter !== 'attachments' && (
              <article className="a4-sheet font-letter text-[11pt] leading-[1.55] text-slate-900 flex flex-col justify-between">
                <div>
                  <KopSuratHeader kop={kopProfile} />

                  {isDecisionOrStatement ? (
                    <div className="text-center mb-5 mt-2">
                      {recipientLines.map((line, i) => (
                        <p
                          key={i}
                          className={`${
                            i === 0
                              ? 'font-bold text-[12pt] tracking-wide'
                              : i === recipientLines.length - 1
                              ? 'font-bold text-[11pt] mt-1'
                              : 'font-semibold text-[10.5pt]'
                          }`}
                        >
                          {line}
                        </p>
                      ))}
                      <p className="text-[10.5pt] mt-1 font-mono">
                        Nomor: {letterNumber}
                      </p>
                    </div>
                  ) : (
                    <>
                      <div className="flex justify-end mb-3">
                        <p className="text-[10.5pt]">
                          {kopProfile.city}, {formattedDate}
                        </p>
                      </div>

                      <div className="flex items-start justify-between gap-6 mb-5">
                        <table className="text-[10.5pt] border-collapse">
                          <tbody>
                            <tr>
                              <td className="pr-3 py-0.5 align-top w-24">Nomor</td>
                              <td className="pr-2 py-0.5 align-top">:</td>
                              <td className="py-0.5 align-top font-semibold">
                                {letterNumber}
                              </td>
                            </tr>
                            <tr>
                              <td className="pr-3 py-0.5 align-top">Sifat</td>
                              <td className="pr-2 py-0.5 align-top">:</td>
                              <td className="py-0.5 align-top">{sifat || '-'}</td>
                            </tr>
                            <tr>
                              <td className="pr-3 py-0.5 align-top">Lampiran</td>
                              <td className="pr-2 py-0.5 align-top">:</td>
                              <td className="py-0.5 align-top">{lampiranLabel}</td>
                            </tr>
                            <tr>
                              <td className="pr-3 py-0.5 align-top">Perihal</td>
                              <td className="pr-2 py-0.5 align-top">:</td>
                              <td className="py-0.5 align-top font-bold max-w-[85mm]">
                                {perihal}
                              </td>
                            </tr>
                          </tbody>
                        </table>
                      </div>

                      <div className="mb-5 text-[10.5pt]">
                        {recipientLines.map((line, idx) => (
                          <p
                            key={idx}
                            className={idx === 0 ? 'font-semibold' : undefined}
                          >
                            {line}
                          </p>
                        ))}
                      </div>
                    </>
                  )}

                  {template.salutation && (
                    <p
                      className={`mb-3 ${
                        isDecisionOrStatement ? 'font-bold text-center tracking-wide' : ''
                      }`}
                    >
                      {renderTemplateString(template.salutation, fieldValues)}
                    </p>
                  )}

                  <div className="space-y-3 text-justify">
                    {template.bodyParagraphs.map((para, pIdx) => {
                      const rendered = renderTemplateString(para, fieldValues);
                      const hasLines = rendered.includes('\n');
                      if (hasLines) {
                        return (
                          <div
                            key={pIdx}
                            className="pl-4 py-1 space-y-0.5 whitespace-pre-wrap text-[10.5pt]"
                          >
                            {rendered}
                          </div>
                        );
                      }
                      return <p key={pIdx}>{rendered}</p>;
                    })}
                  </div>

                  {template.closingParagraph && (
                    <p className="mt-3 text-justify">
                      {renderTemplateString(template.closingParagraph, fieldValues)}
                    </p>
                  )}
                </div>

                <div className="mt-8">
                  <div className="flex justify-end">
                    <div className="w-64 text-left">
                      <p className="text-[10.5pt]">
                        {kopProfile.city}, {formattedDate}
                      </p>
                      <p className="text-[10.5pt] font-semibold mt-0.5">
                        {signerRole}
                      </p>
                      <div className="h-16" />
                      <p className="text-[10.5pt] font-bold underline underline-offset-4">
                        {signerName}
                      </p>
                      {signerId && (
                        <p className="text-[9.5pt] text-slate-700 mt-0.5">
                          {signerId}
                        </p>
                      )}
                    </div>
                  </div>

                  {tembusan.length > 0 && (
                    <div className="mt-6 pt-3 border-t border-slate-200 text-[9.5pt] text-slate-700">
                      <p className="font-semibold mb-1">Tembusan:</p>
                      <ol className="list-decimal list-inside space-y-0.5">
                        {tembusan.map((t, idx) => (
                          <li key={idx}>{t}</li>
                        ))}
                      </ol>
                    </div>
                  )}
                </div>
              </article>
            )}

            {viewFilter !== 'letter' &&
              attachments.map((att, attIdx) => {
                const romanIdx = toRomanIndex(attIdx + 1);
                const renderedTitle = renderTemplateString(att.title, fieldValues);
                const renderedSubtitle = att.subtitle
                  ? renderTemplateString(att.subtitle, fieldValues)
                  : '';
                const totalAmount = computeAttachmentTotal(att);

                return (
                  <article
                    key={`${att.id}-${attIdx}-${docIdx}`}
                    className="a4-sheet font-letter text-[10.5pt] leading-[1.5] text-slate-900 flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-start justify-between border-b-2 border-slate-900 pb-3 mb-5">
                        <div>
                          <p className="text-[9.5pt] font-bold uppercase tracking-wider text-slate-700">
                            {kopProfile.organizationName}
                          </p>
                          <p className="text-[11.5pt] font-bold text-slate-900 mt-0.5">
                            LAMPIRAN {romanIdx}
                          </p>
                        </div>
                        <div className="text-right text-[9.5pt] text-slate-700">
                          <p>
                            <span className="font-semibold">Surat Nomor:</span>{' '}
                            {letterNumber}
                          </p>
                          <p>
                            <span className="font-semibold">Tanggal:</span>{' '}
                            {formattedDate}
                          </p>
                        </div>
                      </div>

                      <div className="mb-4">
                        <h3 className="text-[12pt] font-bold text-slate-900 uppercase">
                          {renderedTitle}
                        </h3>
                        {renderedSubtitle && (
                          <p className="text-[10pt] text-slate-700 mt-1">
                            {renderedSubtitle}
                          </p>
                        )}
                      </div>

                      {att.layoutType === 'table' && (
                        <div className="mt-3">
                          <table className="w-full border-collapse border border-slate-800 text-[9.5pt]">
                            <thead>
                              <tr className="bg-slate-100">
                                <th className="border border-slate-800 px-2.5 py-2 text-center w-10 font-bold">
                                  No
                                </th>
                                {att.columns.map((col) => (
                                  <th
                                    key={col.key}
                                    className={`border border-slate-800 px-2.5 py-2 font-bold ${
                                      col.align === 'right'
                                        ? 'text-right'
                                        : col.align === 'center'
                                        ? 'text-center'
                                        : 'text-left'
                                    }`}
                                  >
                                    {col.label}
                                  </th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {att.rows.length === 0 ? (
                                <tr>
                                  <td
                                    colSpan={att.columns.length + 1}
                                    className="border border-slate-800 px-3 py-6 text-center text-slate-500 italic"
                                  >
                                    Belum ada baris data pada lampiran ini.
                                  </td>
                                </tr>
                              ) : (
                                att.rows.map((row, rIdx) => (
                                  <tr key={rIdx}>
                                    <td className="border border-slate-800 px-2.5 py-1.5 text-center tabular-nums">
                                      {rIdx + 1}
                                    </td>
                                    {att.columns.map((col) => {
                                      const raw = row[col.key] ?? '';
                                      const display =
                                        col.type === 'currency'
                                          ? formatRupiah(raw)
                                          : raw;
                                      return (
                                        <td
                                          key={col.key}
                                          className={`border border-slate-800 px-2.5 py-1.5 ${
                                            col.align === 'right' ||
                                            col.type === 'currency'
                                              ? 'text-right tabular-nums'
                                              : col.align === 'center' ||
                                                col.type === 'number'
                                              ? 'text-center tabular-nums'
                                              : 'text-left'
                                          }`}
                                        >
                                          {display}
                                        </td>
                                      );
                                    })}
                                  </tr>
                                ))
                              )}
                              {att.showSummaryRow && att.summaryColumnKey && (
                                <tr className="bg-slate-50 font-bold">
                                  <td
                                    colSpan={att.columns.length}
                                    className="border border-slate-800 px-2.5 py-2 text-right"
                                  >
                                    TOTAL KESELURUHAN
                                  </td>
                                  <td className="border border-slate-800 px-2.5 py-2 text-right tabular-nums">
                                    {formatRupiah(totalAmount)}
                                  </td>
                                </tr>
                              )}
                            </tbody>
                          </table>
                        </div>
                      )}

                      {att.layoutType === 'list' && (
                        <div className="mt-4 space-y-2.5">
                          {att.listItems.map((item, idx) => (
                            <div
                              key={idx}
                              className="pb-2 border-b border-slate-200 last:border-b-0"
                            >
                              <p className="font-bold text-[10.5pt] text-slate-900">
                                {idx + 1}. {renderTemplateString(item.title, fieldValues)}
                              </p>
                              {item.detail && (
                                <p className="text-[10pt] text-slate-700 pl-4 mt-0.5">
                                  {renderTemplateString(item.detail, fieldValues)}
                                </p>
                              )}
                            </div>
                          ))}
                        </div>
                      )}

                      {att.layoutType === 'narrative' && (
                        <div className="mt-4 whitespace-pre-wrap text-justify text-[10.5pt] leading-relaxed">
                          {renderTemplateString(att.narrativeText, fieldValues)}
                        </div>
                      )}

                      {att.footerNote && (
                        <p className="mt-4 text-[9.5pt] italic text-slate-700">
                          Catatan: {renderTemplateString(att.footerNote, fieldValues)}
                        </p>
                      )}
                    </div>

                    <div className="mt-8 flex justify-end">
                      <div className="w-64 text-left">
                        <p className="text-[10pt] font-semibold">{signerRole}</p>
                        <div className="h-14" />
                        <p className="text-[10pt] font-bold underline underline-offset-4">
                          {signerName}
                        </p>
                        {signerId && (
                          <p className="text-[9pt] text-slate-700 mt-0.5">
                            {signerId}
                          </p>
                        )}
                      </div>
                    </div>
                  </article>
                );
              })}
          </React.Fragment>
        );
      })}
    </div>
  );
}
