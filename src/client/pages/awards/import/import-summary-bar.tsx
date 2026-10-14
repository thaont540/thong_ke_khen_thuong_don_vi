import type { PreviewCounts } from "./import-preview-model";

interface Props {
  fileName: string;
  total: number;
  counts: PreviewCounts;
  includeDuplicates: boolean;
  onIncludeDuplicates: (v: boolean) => void;
  toImportCount: number;
  busy: boolean;
  onCommit: () => void;
  onReset: () => void;
}

export function ImportSummaryBar(p: Props) {
  const { ok, duplicate, error } = p.counts;
  return (
    <div className="import-head">
      <p>
        <strong>{p.fileName}</strong>: {p.total} dòng, <span className="count-ok">{ok} hợp lệ</span>
        {duplicate > 0 ? (
          <>
            , <span className="count-warn">{duplicate} có thể trùng</span>
          </>
        ) : null}
        {error > 0 ? (
          <>
            , <span className="count-err">{error} lỗi</span>. Dòng lỗi sẽ không được nhập, sửa trong
            file rồi tải lên lại.
          </>
        ) : (
          "."
        )}
      </p>
      <div className="import-actions">
        {duplicate > 0 ? (
          <label className="check-inline">
            <input
              type="checkbox"
              checked={p.includeDuplicates}
              disabled={p.busy}
              onChange={(e) => p.onIncludeDuplicates(e.target.checked)}
            />
            Nhập cả {duplicate} dòng có thể trùng
          </label>
        ) : null}
        <button type="button" className="btn" disabled={p.busy} onClick={p.onReset}>
          Chọn file khác
        </button>
        <button
          type="button"
          className="btn btn-primary"
          disabled={p.busy || p.toImportCount === 0}
          onClick={p.onCommit}
        >
          Nhập {p.toImportCount} dòng hợp lệ
        </button>
      </div>
    </div>
  );
}
