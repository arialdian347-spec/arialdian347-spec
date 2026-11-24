import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { PreviewDocumentData } from '../components/LetterPreview';
import {
  computeAttachmentTotal,
  formatRupiah,
  formatTanggalIndonesia,
  renderTemplateString,
  toRomanIndex,
} from './templateEngine';

function escapeHtml(str: string): string {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function sanitizeFileName(name: string): string {
  return name.replace(/[^\w\-.]+/g, '_');
}

export function exportDocumentsToPdf(
  documents: PreviewDocumentData[],
  fileName: string
): boolean {
  if (!documents || documents.length === 0) return false;

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = 210;
  const marginLeft = 24;
  const marginRight = 22;
  const contentWidth = pageWidth - marginLeft - marginRight;

  documents.forEach((docData, docIdx) => {
    if (docIdx > 0) {
      doc.addPage();
    }

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
      attachments.length > 0 ? `${attachments.length} berkas` : '-';

    const signerName =
      fieldValues.nama_penandatangan || 'Nama Pejabat Penandatangan';
    const signerRole =
      fieldValues.jabatan_penandatangan || 'Jabatan Penandatangan';
    const signerId = fieldValues.nip_nik || '';
    const isDecisionOrStatement =
      template.code === 'SK' || template.code === 'SKK';

    let y = 18;

    // Kop Surat Header
    doc.setFillColor(kopProfile.accentColor || '#1E3A8A');
    doc.roundedRect(marginLeft, y, 16, 16, 1.5, 1.5, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text(kopProfile.crestCode || 'TN', marginLeft + 8, y + 9.5, {
      align: 'center',
    });

    const textCenterX = marginLeft + 18 + (contentWidth - 18) / 2;
    doc.setTextColor(15, 23, 42);
    doc.setFont('times', 'bold');
    doc.setFontSize(13);
    doc.text(kopProfile.organizationName.toUpperCase(), textCenterX, y + 4.5, {
      align: 'center',
      maxWidth: contentWidth - 20,
    });

    let headerBottom = y + 8.5;
    if (kopProfile.subOrganization) {
      doc.setFontSize(10);
      doc.text(
        kopProfile.subOrganization.toUpperCase(),
        textCenterX,
        headerBottom,
        {
          align: 'center',
          maxWidth: contentWidth - 20,
        }
      );
      headerBottom += 4.2;
    }

    doc.setFont('times', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(51, 65, 85);
    doc.text(kopProfile.address, textCenterX, headerBottom, {
      align: 'center',
      maxWidth: contentWidth - 20,
    });
    headerBottom += 3.8;
    doc.text(kopProfile.contactLine, textCenterX, headerBottom, {
      align: 'center',
      maxWidth: contentWidth - 20,
    });

    y = Math.max(y + 18, headerBottom + 3);
    doc.setDrawColor(15, 23, 42);
    doc.setLineWidth(0.8);
    doc.line(marginLeft, y, pageWidth - marginRight, y);
    doc.setLineWidth(0.25);
    doc.line(marginLeft, y + 1, pageWidth - marginRight, y + 1);
    y += 8;

    doc.setTextColor(17, 24, 39);

    if (isDecisionOrStatement) {
      doc.setFont('times', 'bold');
      doc.setFontSize(11);
      recipientLines.forEach((line) => {
        const wrapped = doc.splitTextToSize(line, contentWidth);
        doc.text(wrapped, pageWidth / 2, y, { align: 'center' });
        y += wrapped.length * 5;
      });
      doc.setFont('times', 'normal');
      doc.setFontSize(10);
      doc.text(`Nomor: ${letterNumber}`, pageWidth / 2, y, { align: 'center' });
      y += 8;
    } else {
      doc.setFont('times', 'normal');
      doc.setFontSize(10.5);
      doc.text(`${kopProfile.city}, ${formattedDate}`, pageWidth - marginRight, y, {
        align: 'right',
      });
      y += 6;

      const metaRows: [string, string][] = [
        ['Nomor', letterNumber],
        ['Sifat', sifat || '-'],
        ['Lampiran', lampiranLabel],
        ['Perihal', perihal],
      ];

      metaRows.forEach(([label, val]) => {
        doc.setFont('times', 'normal');
        doc.text(label, marginLeft, y);
        doc.text(':', marginLeft + 22, y);
        doc.setFont('times', label === 'Nomor' || label === 'Perihal' ? 'bold' : 'normal');
        const wrappedVal = doc.splitTextToSize(val, contentWidth - 28);
        doc.text(wrappedVal, marginLeft + 25, y);
        y += Math.max(5.2, wrappedVal.length * 5);
      });

      y += 4;
      recipientLines.forEach((line, idx) => {
        doc.setFont('times', idx === 0 ? 'bold' : 'normal');
        const wrapped = doc.splitTextToSize(line, contentWidth);
        doc.text(wrapped, marginLeft, y);
        y += wrapped.length * 5;
      });
      y += 4;
    }

    if (template.salutation) {
      doc.setFont('times', isDecisionOrStatement ? 'bold' : 'normal');
      doc.setFontSize(11);
      const salText = renderTemplateString(template.salutation, fieldValues);
      if (isDecisionOrStatement) {
        doc.text(salText, pageWidth / 2, y, { align: 'center' });
      } else {
        doc.text(salText, marginLeft, y);
      }
      y += 6.5;
    }

    doc.setFont('times', 'normal');
    doc.setFontSize(11);
    template.bodyParagraphs.forEach((para) => {
      const rendered = renderTemplateString(para, fieldValues);
      const subLines = rendered.split('\n');
      subLines.forEach((subLine) => {
        const isIndentedBlock = subLines.length > 1;
        const xPos = isIndentedBlock ? marginLeft + 5 : marginLeft;
        const availW = isIndentedBlock ? contentWidth - 5 : contentWidth;
        const wrapped = doc.splitTextToSize(subLine, availW);
        if (y + wrapped.length * 5.2 > 265) {
          doc.addPage();
          y = 20;
        }
        doc.text(wrapped, xPos, y);
        y += wrapped.length * 5.2;
      });
      y += 2.5;
    });

    if (template.closingParagraph) {
      const closing = renderTemplateString(template.closingParagraph, fieldValues);
      const wrapped = doc.splitTextToSize(closing, contentWidth);
      if (y + wrapped.length * 5.2 > 265) {
        doc.addPage();
        y = 20;
      }
      doc.text(wrapped, marginLeft, y);
      y += wrapped.length * 5.2 + 6;
    }

    // Signature block
    if (y > 235) {
      doc.addPage();
      y = 24;
    }
    const signX = pageWidth - marginRight - 64;
    doc.setFont('times', 'normal');
    doc.setFontSize(10.5);
    doc.text(`${kopProfile.city}, ${formattedDate}`, signX, y);
    y += 5;
    doc.setFont('times', 'bold');
    const roleLines = doc.splitTextToSize(signerRole, 64);
    doc.text(roleLines, signX, y);
    y += roleLines.length * 5 + 16;
    doc.text(signerName, signX, y);
    const nameWidth = doc.getTextWidth(signerName);
    doc.setLineWidth(0.3);
    doc.line(signX, y + 0.8, signX + nameWidth, y + 0.8);
    if (signerId) {
      y += 4.8;
      doc.setFont('times', 'normal');
      doc.setFontSize(9.5);
      doc.text(signerId, signX, y);
    }

    if (tembusan.length > 0) {
      y += 10;
      if (y < 275) {
        doc.setDrawColor(203, 213, 225);
        doc.line(marginLeft, y, pageWidth - marginRight, y);
        y += 5;
        doc.setFont('times', 'bold');
        doc.setFontSize(9.5);
        doc.text('Tembusan:', marginLeft, y);
        y += 4.5;
        doc.setFont('times', 'normal');
        tembusan.forEach((item, idx) => {
          doc.text(`${idx + 1}. ${item}`, marginLeft, y);
          y += 4.2;
        });
      }
    }

    // Attachment pages
    attachments.forEach((att, attIdx) => {
      doc.addPage();
      let ay = 20;
      const romanIdx = toRomanIndex(attIdx + 1);
      const renderedTitle = renderTemplateString(att.title, fieldValues);
      const renderedSubtitle = att.subtitle
        ? renderTemplateString(att.subtitle, fieldValues)
        : '';

      doc.setFont('times', 'bold');
      doc.setFontSize(9.5);
      doc.setTextColor(71, 85, 105);
      doc.text(kopProfile.organizationName.toUpperCase(), marginLeft, ay);
      doc.setFont('times', 'normal');
      doc.text(`Surat Nomor: ${letterNumber}`, pageWidth - marginRight, ay, {
        align: 'right',
      });
      ay += 5;

      doc.setFont('times', 'bold');
      doc.setFontSize(11.5);
      doc.setTextColor(15, 23, 42);
      doc.text(`LAMPIRAN ${romanIdx}`, marginLeft, ay);
      doc.setFont('times', 'normal');
      doc.setFontSize(9.5);
      doc.text(`Tanggal: ${formattedDate}`, pageWidth - marginRight, ay, {
        align: 'right',
      });
      ay += 3;

      doc.setDrawColor(15, 23, 42);
      doc.setLineWidth(0.6);
      doc.line(marginLeft, ay, pageWidth - marginRight, ay);
      ay += 8;

      doc.setFont('times', 'bold');
      doc.setFontSize(12);
      const titleLines = doc.splitTextToSize(renderedTitle.toUpperCase(), contentWidth);
      doc.text(titleLines, marginLeft, ay);
      ay += titleLines.length * 5.5;

      if (renderedSubtitle) {
        doc.setFont('times', 'normal');
        doc.setFontSize(10);
        doc.setTextColor(51, 65, 85);
        const subLines = doc.splitTextToSize(renderedSubtitle, contentWidth);
        doc.text(subLines, marginLeft, ay);
        ay += subLines.length * 4.8;
      }
      ay += 4;
      doc.setTextColor(17, 24, 39);

      if (att.layoutType === 'table') {
        const head = [['No', ...att.columns.map((c) => c.label)]];
        const body = att.rows.map((row, rIdx) => [
          String(rIdx + 1),
          ...att.columns.map((col) => {
            const raw = row[col.key] ?? '';
            return col.type === 'currency' ? formatRupiah(raw) : raw;
          }),
        ]);

        if (att.showSummaryRow && att.summaryColumnKey) {
          const totalAmount = computeAttachmentTotal(att);
          const summaryRow = new Array(att.columns.length + 1).fill('');
          summaryRow[0] = '';
          summaryRow[Math.max(1, att.columns.length - 1)] = 'TOTAL KESELURUHAN';
          summaryRow[att.columns.length] = formatRupiah(totalAmount);
          body.push(summaryRow);
        }

        autoTable(doc, {
          startY: ay,
          head,
          body,
          margin: { left: marginLeft, right: marginRight },
          styles: {
            font: 'times',
            fontSize: 9.5,
            cellPadding: 2.5,
            lineColor: [30, 41, 59],
            lineWidth: 0.2,
            textColor: [17, 24, 39],
          },
          headStyles: {
            fillColor: [241, 245, 249],
            textColor: [15, 23, 42],
            fontStyle: 'bold',
          },
          columnStyles: Object.fromEntries([
            [0, { halign: 'center', cellWidth: 10 }],
            ...att.columns.map((col, idx) => [
              idx + 1,
              {
                halign:
                  col.align === 'right' || col.type === 'currency'
                    ? 'right'
                    : col.align === 'center' || col.type === 'number'
                    ? 'center'
                    : 'left',
              },
            ]),
          ]),
        });
        const finalY = (doc as unknown as { lastAutoTable?: { finalY?: number } })
          .lastAutoTable?.finalY;
        ay = (finalY ?? ay + 20) + 6;
      } else if (att.layoutType === 'list') {
        att.listItems.forEach((item, idx) => {
          doc.setFont('times', 'bold');
          doc.setFontSize(10.5);
          const tLines = doc.splitTextToSize(
            `${idx + 1}. ${renderTemplateString(item.title, fieldValues)}`,
            contentWidth
          );
          doc.text(tLines, marginLeft, ay);
          ay += tLines.length * 5;
          if (item.detail) {
            doc.setFont('times', 'normal');
            doc.setFontSize(10);
            const dLines = doc.splitTextToSize(
              renderTemplateString(item.detail, fieldValues),
              contentWidth - 5
            );
            doc.text(dLines, marginLeft + 5, ay);
            ay += dLines.length * 4.8;
          }
          ay += 2.5;
        });
      } else {
        doc.setFont('times', 'normal');
        doc.setFontSize(10.5);
        const nLines = doc.splitTextToSize(
          renderTemplateString(att.narrativeText, fieldValues),
          contentWidth
        );
        doc.text(nLines, marginLeft, ay);
        ay += nLines.length * 5.2 + 4;
      }

      if (att.footerNote) {
        doc.setFont('times', 'italic');
        doc.setFontSize(9.5);
        doc.setTextColor(71, 85, 105);
        const fLines = doc.splitTextToSize(
          `Catatan: ${renderTemplateString(att.footerNote, fieldValues)}`,
          contentWidth
        );
        doc.text(fLines, marginLeft, ay);
        ay += fLines.length * 4.5 + 8;
      }

      if (ay > 245) {
        doc.addPage();
        ay = 24;
      }
      doc.setTextColor(17, 24, 39);
      doc.setFont('times', 'bold');
      doc.setFontSize(10);
      doc.text(signerRole, signX, ay);
      ay += 16;
      doc.text(signerName, signX, ay);
      if (signerId) {
        ay += 4.5;
        doc.setFont('times', 'normal');
        doc.setFontSize(9);
        doc.text(signerId, signX, ay);
      }
    });
  });

  doc.save(`${sanitizeFileName(fileName)}.pdf`);
  return true;
}

export function exportDocumentsToWord(
  documents: PreviewDocumentData[],
  fileName: string
): boolean {
  if (!documents || documents.length === 0) return false;

  const sectionsHtml = documents
    .map((docData) => {
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
        attachments.length > 0 ? `${attachments.length} berkas` : '-';

      const signerName =
        fieldValues.nama_penandatangan || 'Nama Pejabat Penandatangan';
      const signerRole =
        fieldValues.jabatan_penandatangan || 'Jabatan Penandatangan';
      const signerId = fieldValues.nip_nik || '';
      const isDecisionOrStatement =
        template.code === 'SK' || template.code === 'SKK';

      const kopHtml = `
        <table style="width:100%; border-collapse:collapse; border-bottom:3px solid #0f172a; margin-bottom:14px;">
          <tr>
            <td style="width:64px; vertical-align:middle; padding-bottom:10px;">
              <div style="width:54px; height:54px; background:${escapeHtml(kopProfile.accentColor || '#1E3A8A')}; color:#ffffff; font-family:Arial,sans-serif; font-weight:bold; font-size:14pt; text-align:center; line-height:54px;">
                ${escapeHtml(kopProfile.crestCode || 'TN')}
              </div>
            </td>
            <td style="text-align:center; vertical-align:middle; padding-bottom:10px;">
              <div style="font-size:13.5pt; font-weight:bold; text-transform:uppercase; color:#0f172a;">
                ${escapeHtml(kopProfile.organizationName)}
              </div>
              ${
                kopProfile.subOrganization
                  ? `<div style="font-size:10.5pt; font-weight:bold; text-transform:uppercase; color:#1e293b; margin-top:2px;">${escapeHtml(kopProfile.subOrganization)}</div>`
                  : ''
              }
              <div style="font-size:9pt; color:#334155; margin-top:3px;">${escapeHtml(kopProfile.address)}</div>
              <div style="font-size:8.5pt; color:#475569;">${escapeHtml(kopProfile.contactLine)}</div>
            </td>
          </tr>
        </table>
      `;

      const headerBlockHtml = isDecisionOrStatement
        ? `
          <div style="text-align:center; margin-bottom:16px;">
            ${recipientLines
              .map(
                (l, i) =>
                  `<div style="font-weight:bold; font-size:${i === 0 ? '12pt' : '11pt'};">${escapeHtml(l)}</div>`
              )
              .join('')}
            <div style="font-size:10.5pt; margin-top:4px;">Nomor: ${escapeHtml(letterNumber)}</div>
          </div>
        `
        : `
          <div style="text-align:right; font-size:10.5pt; margin-bottom:10px;">
            ${escapeHtml(kopProfile.city)}, ${escapeHtml(formattedDate)}
          </div>
          <table style="width:100%; border-collapse:collapse; font-size:10.5pt; margin-bottom:14px;">
            <tr><td style="width:85px; padding:2px 0;">Nomor</td><td style="width:12px;">:</td><td><strong>${escapeHtml(letterNumber)}</strong></td></tr>
            <tr><td style="padding:2px 0;">Sifat</td><td>:</td><td>${escapeHtml(sifat || '-')}</td></tr>
            <tr><td style="padding:2px 0;">Lampiran</td><td>:</td><td>${escapeHtml(lampiranLabel)}</td></tr>
            <tr><td style="padding:2px 0; vertical-align:top;">Perihal</td><td style="vertical-align:top;">:</td><td><strong>${escapeHtml(perihal)}</strong></td></tr>
          </table>
          <div style="font-size:10.5pt; margin-bottom:14px;">
            ${recipientLines
              .map(
                (l, idx) =>
                  `<div${idx === 0 ? ' style="font-weight:bold;"' : ''}>${escapeHtml(l)}</div>`
              )
              .join('')}
          </div>
        `;

      const bodyHtml = template.bodyParagraphs
        .map((p) => {
          const rendered = renderTemplateString(p, fieldValues);
          if (rendered.includes('\n')) {
            return `<div style="margin:8px 0 8px 18px; white-space:pre-line; font-size:10.5pt;">${escapeHtml(rendered)}</div>`;
          }
          return `<p style="text-align:justify; margin:8px 0;">${escapeHtml(rendered)}</p>`;
        })
        .join('');

      const signatureHtml = `
        <table style="width:100%; border-collapse:collapse; margin-top:28px;">
          <tr>
            <td style="width:55%;"></td>
            <td style="width:45%; text-align:left; font-size:10.5pt;">
              <div>${escapeHtml(kopProfile.city)}, ${escapeHtml(formattedDate)}</div>
              <div style="font-weight:bold; margin-top:2px;">${escapeHtml(signerRole)}</div>
              <div style="height:56px;"></div>
              <div style="font-weight:bold; text-decoration:underline;">${escapeHtml(signerName)}</div>
              ${signerId ? `<div style="font-size:9.5pt; color:#334155;">${escapeHtml(signerId)}</div>` : ''}
            </td>
          </tr>
        </table>
      `;

      const tembusanHtml =
        tembusan.length > 0
          ? `<div style="margin-top:18px; padding-top:8px; border-top:1px solid #cbd5e1; font-size:9.5pt;">
               <strong>Tembusan:</strong>
               <ol style="margin:4px 0 0 18px; padding:0;">
                 ${tembusan.map((t) => `<li>${escapeHtml(t)}</li>`).join('')}
               </ol>
             </div>`
          : '';

      const attachmentsHtml = attachments
        .map((att, attIdx) => {
          const romanIdx = toRomanIndex(attIdx + 1);
          const renderedTitle = renderTemplateString(att.title, fieldValues);
          const renderedSubtitle = att.subtitle
            ? renderTemplateString(att.subtitle, fieldValues)
            : '';
          const totalAmount = computeAttachmentTotal(att);

          let contentHtml = '';
          if (att.layoutType === 'table') {
            contentHtml = `
              <table style="width:100%; border-collapse:collapse; font-size:9.5pt; margin-top:10px;">
                <thead>
                  <tr style="background:#f1f5f9;">
                    <th style="border:1px solid #1e293b; padding:6px; text-align:center; width:36px;">No</th>
                    ${att.columns
                      .map(
                        (c) =>
                          `<th style="border:1px solid #1e293b; padding:6px; text-align:${c.align || 'left'};">${escapeHtml(c.label)}</th>`
                      )
                      .join('')}
                  </tr>
                </thead>
                <tbody>
                  ${att.rows
                    .map(
                      (r, rIdx) => `
                        <tr>
                          <td style="border:1px solid #1e293b; padding:5px; text-align:center;">${rIdx + 1}</td>
                          ${att.columns
                            .map((c) => {
                              const raw = r[c.key] ?? '';
                              const display =
                                c.type === 'currency' ? formatRupiah(raw) : raw;
                              const align =
                                c.align ||
                                (c.type === 'currency'
                                  ? 'right'
                                  : c.type === 'number'
                                  ? 'center'
                                  : 'left');
                              return `<td style="border:1px solid #1e293b; padding:5px; text-align:${align};">${escapeHtml(display)}</td>`;
                            })
                            .join('')}
                        </tr>
                      `
                    )
                    .join('')}
                  ${
                    att.showSummaryRow && att.summaryColumnKey
                      ? `<tr style="background:#f8fafc; font-weight:bold;">
                           <td colspan="${att.columns.length}" style="border:1px solid #1e293b; padding:6px; text-align:right;">TOTAL KESELURUHAN</td>
                           <td style="border:1px solid #1e293b; padding:6px; text-align:right;">${escapeHtml(formatRupiah(totalAmount))}</td>
                         </tr>`
                      : ''
                  }
                </tbody>
              </table>
            `;
          } else if (att.layoutType === 'list') {
            contentHtml = att.listItems
              .map(
                (item, idx) => `
                  <div style="margin-bottom:8px; padding-bottom:6px; border-bottom:1px solid #e2e8f0;">
                    <div style="font-weight:bold;">${idx + 1}. ${escapeHtml(renderTemplateString(item.title, fieldValues))}</div>
                    ${item.detail ? `<div style="margin-left:16px; color:#334155;">${escapeHtml(renderTemplateString(item.detail, fieldValues))}</div>` : ''}
                  </div>
                `
              )
              .join('');
          } else {
            contentHtml = `<div style="white-space:pre-line; text-align:justify;">${escapeHtml(renderTemplateString(att.narrativeText, fieldValues))}</div>`;
          }

          return `
            <div style="page-break-before:always;">
              <table style="width:100%; border-collapse:collapse; border-bottom:2px solid #0f172a; margin-bottom:14px;">
                <tr>
                  <td style="padding-bottom:8px;">
                    <div style="font-size:9.5pt; font-weight:bold; text-transform:uppercase; color:#334155;">${escapeHtml(kopProfile.organizationName)}</div>
                    <div style="font-size:11.5pt; font-weight:bold;">LAMPIRAN ${romanIdx}</div>
                  </td>
                  <td style="text-align:right; font-size:9.5pt; padding-bottom:8px;">
                    <div><strong>Surat Nomor:</strong> ${escapeHtml(letterNumber)}</div>
                    <div><strong>Tanggal:</strong> ${escapeHtml(formattedDate)}</div>
                  </td>
                </tr>
              </table>
              <div style="font-size:12pt; font-weight:bold; text-transform:uppercase; margin-bottom:4px;">${escapeHtml(renderedTitle)}</div>
              ${renderedSubtitle ? `<div style="font-size:10pt; color:#334155; margin-bottom:10px;">${escapeHtml(renderedSubtitle)}</div>` : ''}
              ${contentHtml}
              ${att.footerNote ? `<p style="font-size:9.5pt; font-style:italic; color:#334155; margin-top:12px;">Catatan: ${escapeHtml(renderTemplateString(att.footerNote, fieldValues))}</p>` : ''}
              ${signatureHtml}
            </div>
          `;
        })
        .join('');

      return `
        <div style="page-break-after:always;">
          ${kopHtml}
          ${headerBlockHtml}
          ${
            template.salutation
              ? `<p style="${isDecisionOrStatement ? 'text-align:center; font-weight:bold;' : ''} margin:8px 0;">${escapeHtml(renderTemplateString(template.salutation, fieldValues))}</p>`
              : ''
          }
          ${bodyHtml}
          ${
            template.closingParagraph
              ? `<p style="text-align:justify; margin:10px 0;">${escapeHtml(renderTemplateString(template.closingParagraph, fieldValues))}</p>`
              : ''
          }
          ${signatureHtml}
          ${tembusanHtml}
        </div>
        ${attachmentsHtml}
      `;
    })
    .join('');

  const htmlDocument = `
    <html xmlns:o="urn:schemas-microsoft-com:office:office"
          xmlns:w="urn:schemas-microsoft-com:office:word"
          xmlns="http://www.w3.org/TR/REC-html40">
      <head>
        <meta charset="utf-8" />
        <title>${escapeHtml(fileName)}</title>
        <style>
          @page { size: A4 portrait; margin: 20mm 22mm 20mm 25mm; }
          body { font-family: "Times New Roman", serif; font-size: 11pt; color: #111827; line-height: 1.5; }
        </style>
      </head>
      <body>${sectionsHtml}</body>
    </html>
  `;

  const blob = new Blob(['\ufeff', htmlDocument], {
    type: 'application/msword;charset=utf-8',
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `${sanitizeFileName(fileName)}.doc`;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
  return true;
}
