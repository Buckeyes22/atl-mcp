export type IntakeSource = RawMarkdownIntakeSource | UioDocumentIntakeSource | UioFileUploadIntakeSource;

export interface RawMarkdownIntakeSource {
  readonly kind: "raw_markdown";
  readonly markdown: string;
}

export interface UioDocumentIntakeSource {
  readonly kind: "uio_document";
  readonly uioSourceId: string;
  readonly uioChunkIndices?: readonly number[];
  readonly title?: string;
  readonly version?: string;
}

export interface UioFileUploadIntakeSource {
  readonly kind: "uio_file_upload";
  readonly garageKey: string;
  readonly mimeType: string;
  readonly envelopeId?: string;
  readonly uioSourceId?: string;
  readonly uioChunkIndices?: readonly number[];
  readonly title?: string;
  readonly version?: string;
}

export interface ProjectIntake {
  readonly source: IntakeSource;
  readonly capturedAt: string;
  readonly promptVersion?: string;
}
