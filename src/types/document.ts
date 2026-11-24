export type FieldType = 'text' | 'textarea' | 'date' | 'number' | 'select';

export interface TemplateField {
  key: string;
  label: string;
  type: FieldType;
  placeholder: string;
  defaultValue: string;
  required?: boolean;
  options?: string[];
  section: 'tujuan' | 'isi' | 'penandatangan';
  helpText?: string;
}

export type AttachmentColumnType = 'text' | 'number' | 'currency';

export interface AttachmentColumn {
  key: string;
  label: string;
  type: AttachmentColumnType;
  width?: string;
  align?: 'left' | 'center' | 'right';
}

export type AttachmentLayoutType = 'table' | 'list' | 'narrative';

export interface AttachmentItem {
  id: string;
  title: string;
  subtitle?: string;
  layoutType: AttachmentLayoutType;
  columns: AttachmentColumn[];
  rows: Record<string, string>[];
  listItems: { title: string; detail: string }[];
  narrativeText: string;
  showSummaryRow?: boolean;
  summaryColumnKey?: string;
  summaryMultiplierKey?: string;
  footerNote?: string;
}

export interface LetterTemplate {
  id: string;
  code: string;
  name: string;
  category: 'Undangan' | 'Penugasan' | 'Keputusan' | 'Niaga' | 'Administrasi' | 'Kepegawaian';
  description: string;
  numberPattern: string;
  defaultUnitCode: string;
  sifat: string;
  perihalTemplate: string;
  recipientBlockTemplate: string;
  salutation: string;
  bodyParagraphs: string[];
  closingParagraph: string;
  tembusanDefault: string[];
  fields: TemplateField[];
  defaultAttachments: AttachmentItem[];
  updatedAt: string;
}

export interface KopSuratProfile {
  id: string;
  institutionType: string;
  organizationName: string;
  subOrganization: string;
  address: string;
  contactLine: string;
  city: string;
  crestCode: string;
  accentColor: string;
}

export interface GeneratedLetter {
  id: string;
  templateId: string;
  templateName: string;
  templateCode: string;
  kopProfileId: string;
  letterNumber: string;
  letterDate: string;
  sifat: string;
  perihal: string;
  recipientSummary: string;
  unitCode: string;
  fieldValues: Record<string, string>;
  attachments: AttachmentItem[];
  tembusan: string[];
  createdAt: string;
}

export interface DatabaseSnapshot {
  templates: LetterTemplate[];
  kopProfiles: KopSuratProfile[];
  letters: GeneratedLetter[];
  sequences: Record<string, number>;
}
