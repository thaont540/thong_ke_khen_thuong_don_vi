import { isoToDisplay } from "../../../shared/date-format";
import {
  DOC_STATUS_LABEL,
  DOC_TYPE_LABEL,
  type DocumentItem,
} from "../../../shared/schemas/document-schemas";
import { StatusBadge } from "../../components/ui/status-badge";
import { formatFileSize } from "./format-file-size";

interface Props {
  items: DocumentItem[];
  canManage: boolean;
  downloadingId: number | null;
  onDownload: (d: DocumentItem) => void;
  onEdit: (d: DocumentItem) => void;
  onDelete: (d: DocumentItem) => void;
}

export function DocumentsTable({
  items,
  canManage,
  downloadingId,
  onDownload,
  onEdit,
  onDelete,
}: Props) {
  return (
    <div className="table-wrap">
      <table className="data-sm">
        <thead>
          <tr>
            <th>Số hiệu</th>
            <th>Trích yếu</th>
            <th>Loại</th>
            <th>Cơ quan ban hành</th>
            <th>Ngày ban hành</th>
            <th>Hiệu lực</th>
            <th>Tệp</th>
            <th className="col-actions">Thao tác</th>
          </tr>
        </thead>
        <tbody>
          {items.map((d) => (
            <tr key={d.id}>
              <td className="decision">{d.doc_number}</td>
              <td>
                {d.title}
                {d.note ? <div className="where">{d.note}</div> : null}
              </td>
              <td>{DOC_TYPE_LABEL[d.doc_type]}</td>
              <td>{d.issuer}</td>
              <td className="tnum">{isoToDisplay(d.issued_date)}</td>
              <td>
                <StatusBadge tone={d.status === "CON_HIEU_LUC" ? "ok" : "muted"}>
                  {DOC_STATUS_LABEL[d.status]}
                </StatusBadge>
              </td>
              <td>
                {d.file_name}
                <div className="where">{formatFileSize(d.size_bytes)}</div>
              </td>
              <td className="col-actions">
                <div className="row-actions">
                  <button
                    type="button"
                    className="btn btn-sm"
                    aria-label={`Tải về ${d.doc_number}`}
                    disabled={downloadingId === d.id}
                    onClick={() => onDownload(d)}
                  >
                    Tải về
                  </button>
                  {canManage ? (
                    <>
                      <button
                        type="button"
                        className="btn btn-sm"
                        aria-label={`Sửa ${d.doc_number}`}
                        onClick={() => onEdit(d)}
                      >
                        Sửa
                      </button>
                      <button
                        type="button"
                        className="btn btn-sm btn-danger"
                        aria-label={`Xóa ${d.doc_number}`}
                        onClick={() => onDelete(d)}
                      >
                        Xóa
                      </button>
                    </>
                  ) : null}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
