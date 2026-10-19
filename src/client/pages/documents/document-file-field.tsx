import { DOCUMENT_ACCEPT, type DocumentItem } from "../../../shared/schemas/document-schemas";
import { FormField, fieldA11y } from "../../components/ui/form-field";
import { formatFileSize } from "./format-file-size";

interface Props {
  /** null = create (file required). */
  document: DocumentItem | null;
  file: File | null;
  error: string | undefined;
  onPick: (file: File | null) => void;
}

export function DocumentFileField({ document: doc, file, error, onPick }: Props) {
  return (
    <FormField
      id="doc-file"
      label="Tệp văn bản"
      required={!doc}
      error={error}
      hint="PDF, DOC, DOCX, XLS, XLSX; tối đa 20 MB"
      className="full"
    >
      <input
        type="file"
        accept={DOCUMENT_ACCEPT}
        onChange={(e) => onPick(e.target.files?.[0] ?? null)}
        {...fieldA11y("doc-file", error)}
      />
      {file ? (
        <div className="hint">
          Đã chọn: {file.name} ({formatFileSize(file.size)})
        </div>
      ) : doc ? (
        <div className="hint">
          Tệp hiện tại: {doc.file_name} ({formatFileSize(doc.size_bytes)}). Chọn tệp mới để thay
          thế.
        </div>
      ) : null}
    </FormField>
  );
}
