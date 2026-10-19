import { zodResolver } from "@hookform/resolvers/zod";
import { type FormEvent, useState } from "react";
import { useForm } from "react-hook-form";
import type { z } from "zod";
import {
  DOC_STATUS_LABEL,
  DOC_STATUSES,
  DOC_TYPE_LABEL,
  DOC_TYPES,
  type DocumentInput,
  type DocumentItem,
  documentFileProblem,
  documentInputSchema,
} from "../../../shared/schemas/document-schemas";
import { FormField, fieldA11y } from "../../components/ui/form-field";
import { ModalDialog } from "../../components/ui/modal-dialog";
import { SelectField } from "../../components/ui/select-field";
import { errorMessage, isApiError } from "../../lib/api-error";
import { fieldMessage } from "../../lib/field-message";
import { DocumentFileField } from "./document-file-field";
import { useSaveDocument } from "./use-documents-queries";

type FormValues = z.input<typeof documentInputSchema>;
const FIELD_NAMES = [
  "doc_number",
  "title",
  "doc_type",
  "issuer",
  "issued_date",
  "status",
  "note",
] as const;
const FORM_ID = "document-form";

interface Props {
  /** null = create. */
  document: DocumentItem | null;
  onClose: () => void;
  onSaved: () => void;
}

export function DocumentFormModal({ document: doc, onClose, onSaved }: Props) {
  const save = useSaveDocument();
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | undefined>();
  const form = useForm<FormValues, unknown, DocumentInput>({
    resolver: zodResolver(documentInputSchema),
    defaultValues: {
      doc_number: doc?.doc_number ?? "",
      title: doc?.title ?? "",
      doc_type: doc?.doc_type ?? "",
      issuer: doc?.issuer ?? "",
      issued_date: doc?.issued_date ?? "",
      status: doc?.status ?? "CON_HIEU_LUC",
      note: doc?.note ?? "",
    } as FormValues,
  });
  const { errors } = form.formState;

  const fail = (e: unknown) => {
    const fields = isApiError(e) ? e.fields : undefined;
    let mapped = false;
    for (const name of FIELD_NAMES) {
      const msg = fields?.[name];
      if (msg) {
        form.setError(name, { message: msg });
        mapped = true;
      }
    }
    if (fields?.file) {
      setFileError(fields.file);
      mapped = true;
    }
    if (!mapped) form.setError("root.server", { message: errorMessage(e) });
  };

  const pick = (picked: File | null) => {
    const problem = picked ? documentFileProblem(picked) : null;
    setFileError(problem ?? undefined);
    setFile(problem ? null : picked);
  };

  const saveForm = form.handleSubmit((input) => {
    if (!doc && !file) return;
    save.mutate({ id: doc?.id, input, file }, { onSuccess: onSaved, onError: fail });
  });
  const submit = (e: FormEvent<HTMLFormElement>) => {
    // The file is not a form field, so its "required" check runs alongside the zod resolver.
    if (!doc && !file) setFileError("Chọn tệp văn bản");
    return saveForm(e);
  };

  const required = "Bắt buộc nhập";
  const numberError = fieldMessage(errors.doc_number, required);
  const titleError = fieldMessage(errors.title, "Nhập trích yếu (tối đa 1000 ký tự)");
  const issuerError = fieldMessage(errors.issuer, required);
  const dateError = fieldMessage(errors.issued_date, "Chọn ngày ban hành");
  return (
    <ModalDialog
      title={doc ? "Sửa văn bản" : "Thêm văn bản"}
      onClose={onClose}
      busy={save.isPending}
      footer={
        <>
          <button type="button" className="btn" onClick={onClose} disabled={save.isPending}>
            Hủy
          </button>
          <button
            type="submit"
            form={FORM_ID}
            className="btn btn-primary"
            disabled={save.isPending}
          >
            Lưu
          </button>
        </>
      }
    >
      <form id={FORM_ID} noValidate onSubmit={submit} className="form-grid cols-2">
        {errors.root?.server ? (
          <div className="alert-inline full" role="alert">
            {errors.root.server.message}
          </div>
        ) : null}
        <FormField id="doc-number" label="Số hiệu" required error={numberError}>
          <input
            type="text"
            autoComplete="off"
            {...form.register("doc_number")}
            {...fieldA11y("doc-number", numberError)}
          />
        </FormField>
        <SelectField
          id="doc-type"
          label="Loại văn bản"
          required
          options={[
            { value: "", label: "Chọn loại" },
            ...DOC_TYPES.map((t) => ({ value: t, label: DOC_TYPE_LABEL[t] })),
          ]}
          error={fieldMessage(errors.doc_type, "Chọn loại văn bản")}
          {...form.register("doc_type")}
        />
        <FormField id="doc-title" label="Trích yếu" required error={titleError} className="full">
          <textarea rows={3} {...form.register("title")} {...fieldA11y("doc-title", titleError)} />
        </FormField>
        <FormField id="doc-issuer" label="Cơ quan ban hành" required error={issuerError}>
          <input
            type="text"
            autoComplete="off"
            {...form.register("issuer")}
            {...fieldA11y("doc-issuer", issuerError)}
          />
        </FormField>
        <FormField id="doc-date" label="Ngày ban hành" required error={dateError}>
          <input
            type="date"
            {...form.register("issued_date")}
            {...fieldA11y("doc-date", dateError)}
          />
        </FormField>
        <SelectField
          id="doc-status"
          label="Hiệu lực"
          required
          options={DOC_STATUSES.map((s) => ({ value: s, label: DOC_STATUS_LABEL[s] }))}
          {...form.register("status")}
        />
        <FormField
          id="doc-note"
          label="Ghi chú"
          error={fieldMessage(errors.note, "Tối đa 1000 ký tự")}
        >
          <input
            type="text"
            autoComplete="off"
            {...form.register("note")}
            {...fieldA11y("doc-note")}
          />
        </FormField>
        <DocumentFileField document={doc} file={file} error={fileError} onPick={pick} />
      </form>
    </ModalDialog>
  );
}
