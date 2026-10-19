import { useEffect, useState } from "react";
import { can } from "../../../shared/role-permissions";
import {
  DOC_STATUS_LABEL,
  DOC_STATUSES,
  DOC_TYPE_LABEL,
  DOC_TYPES,
  type DocumentItem,
} from "../../../shared/schemas/document-schemas";
import { EmptyState } from "../../components/ui/empty-state";
import { PaginationBar } from "../../components/ui/pagination-bar";
import { SelectField } from "../../components/ui/select-field";
import { useToast } from "../../components/ui/toast-provider";
import { useCurrentUser } from "../../hooks/use-current-user";
import { apiDownload } from "../../lib/api-client";
import { errorMessage } from "../../lib/api-error";
import { DocumentDeleteDialog } from "./document-delete-dialog";
import { DocumentFormModal } from "./document-form-modal";
import { DocumentsTable } from "./documents-table";
import { useDocumentsList } from "./use-documents-queries";

const PAGE_SIZE = 10;

type Dialog =
  | { kind: "form"; document: DocumentItem | null }
  | { kind: "delete"; document: DocumentItem };

export function DocumentsPage() {
  const toast = useToast();
  const { data: me } = useCurrentUser();
  const canManage = me ? can(me.role, "document:manage") : false;
  const [input, setInput] = useState("");
  const [q, setQ] = useState("");
  const [docType, setDocType] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const [downloadingId, setDownloadingId] = useState<number | null>(null);
  const list = useDocumentsList({ q, doc_type: docType, status, page, size: PAGE_SIZE });

  useEffect(() => {
    const t = setTimeout(() => {
      setQ(input.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [input]);

  const download = async (d: DocumentItem) => {
    setDownloadingId(d.id);
    try {
      await apiDownload(`/api/documents/${d.id}/download`, d.file_name);
    } catch (e) {
      toast(errorMessage(e), "error");
    } finally {
      setDownloadingId(null);
    }
  };
  const close = () => setDialog(null);
  const items = list.data?.items ?? [];
  const filtered = q !== "" || docType !== "" || status !== "";

  return (
    <>
      <div className="head">
        <div>
          <h1>Văn bản quy định</h1>
          <p className="sub">Văn bản quy định về công tác thi đua, khen thưởng</p>
        </div>
        {canManage ? (
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => setDialog({ kind: "form", document: null })}
          >
            Thêm văn bản
          </button>
        ) : null}
      </div>
      <div className="toolbar">
        <div className="field field-wide">
          <label htmlFor="documents-search">Tìm kiếm</label>
          <input
            id="documents-search"
            type="search"
            placeholder="Số hiệu hoặc trích yếu"
            value={input}
            onChange={(e) => setInput(e.target.value)}
          />
        </div>
        <SelectField
          id="documents-type"
          label="Loại văn bản"
          value={docType}
          options={[
            { value: "", label: "Tất cả" },
            ...DOC_TYPES.map((t) => ({ value: t, label: DOC_TYPE_LABEL[t] })),
          ]}
          onChange={(e) => {
            setDocType(e.target.value);
            setPage(1);
          }}
        />
        <SelectField
          id="documents-status"
          label="Hiệu lực"
          value={status}
          options={[
            { value: "", label: "Tất cả" },
            ...DOC_STATUSES.map((s) => ({ value: s, label: DOC_STATUS_LABEL[s] })),
          ]}
          onChange={(e) => {
            setStatus(e.target.value);
            setPage(1);
          }}
        />
      </div>

      <section className="table-card" aria-busy={list.isFetching}>
        {list.isError ? (
          <EmptyState
            message={errorMessage(list.error)}
            action={
              <button type="button" className="btn" onClick={() => list.refetch()}>
                Thử lại
              </button>
            }
          />
        ) : null}
        {list.isPending ? <EmptyState message="Đang tải…" /> : null}
        {list.data && items.length === 0 ? (
          <EmptyState
            message={filtered ? "Không có văn bản phù hợp." : "Chưa có văn bản quy định nào."}
          />
        ) : null}
        {items.length > 0 ? (
          <DocumentsTable
            items={items}
            canManage={canManage}
            downloadingId={downloadingId}
            onDownload={download}
            onEdit={(document) => setDialog({ kind: "form", document })}
            onDelete={(document) => setDialog({ kind: "delete", document })}
          />
        ) : null}
        <PaginationBar
          page={page}
          size={PAGE_SIZE}
          total={list.data?.total ?? 0}
          onPage={setPage}
        />
      </section>

      {dialog?.kind === "form" ? (
        <DocumentFormModal
          document={dialog.document}
          onClose={close}
          onSaved={() => {
            toast("Đã lưu văn bản");
            close();
          }}
        />
      ) : null}
      {dialog?.kind === "delete" ? (
        <DocumentDeleteDialog document={dialog.document} onClose={close} />
      ) : null}
    </>
  );
}

export const Component = DocumentsPage;
