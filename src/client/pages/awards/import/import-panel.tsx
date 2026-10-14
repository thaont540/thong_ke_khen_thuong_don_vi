import { useMemo, useState } from "react";
import { buildImportLookups } from "../../../../shared/import/import-lookup-maps";
import { useMasterData } from "../../../hooks/use-master-data";
import { useOfficerOptions } from "../use-awards-queries";
import { downloadImportTemplate } from "./excel-template-builder";
import { ImportDropzone } from "./import-dropzone";
import { ImportPreviewTable } from "./import-preview-table";
import { ImportSummaryBar } from "./import-summary-bar";
import { useImportWorkflow } from "./use-import-workflow";
import "./import-panel.css";

/** F04 tab body: template download, file drop, preview with duplicates, commit in lots of 30. */
export function ImportPanel() {
  const master = useMasterData();
  const officers = useOfficerOptions(true);
  const [templateError, setTemplateError] = useState<string | null>(null);

  const lookups = useMemo(
    () =>
      master.data && officers.data ? buildImportLookups(master.data, officers.data.items) : null,
    [master.data, officers.data],
  );
  const wf = useImportWorkflow(lookups);
  const showFile = wf.phase === "ready" || wf.phase === "committing";

  async function onTemplate() {
    if (!master.data || !officers.data) return;
    setTemplateError(null);
    try {
      await downloadImportTemplate(master.data, officers.data.items);
    } catch {
      setTemplateError("Không tạo được file mẫu. Vui lòng thử lại.");
    }
  }

  return (
    <div className="card" role="tabpanel" aria-labelledby="tab-import">
      <ol className="steps">
        <li>
          Tải file mẫu, trong đó có sẵn các cột và sheet danh mục giá trị hợp lệ.
          <button type="button" className="btn btn-sm" disabled={!lookups} onClick={onTemplate}>
            Tải file mẫu (.xlsx)
          </button>
        </li>
        <li>
          Điền mỗi dòng một khen thưởng. Với cá nhân, ghi mã cán bộ. Với tập thể, để trống cột mã
          cán bộ.
        </li>
        <li>Tải file lên để kiểm tra dữ liệu, sau đó nhập các dòng hợp lệ.</li>
      </ol>

      {templateError ? <p className="alert-inline import-notice">{templateError}</p> : null}
      {wf.error ? (
        <p className="alert-inline import-notice" role="alert">
          {wf.error}
        </p>
      ) : null}
      {wf.partial ? (
        <p className="alert-inline import-notice" role="alert">
          Đã lưu {wf.partial.savedCount} khen thưởng
          {wf.partial.batchId ? ` (đợt import #${wf.partial.batchId})` : ""} trước khi gặp lỗi. Tải
          lại file để nhập tiếp: các dòng đã lưu sẽ được báo là có thể trùng.
        </p>
      ) : null}
      {wf.warnings.map((w) => (
        <p key={w} className="muted import-notice">
          {w}
        </p>
      ))}

      {showFile ? null : (
        <ImportDropzone
          disabled={!lookups || wf.phase === "reading" || wf.phase === "checking"}
          onFile={wf.selectFile}
        />
      )}
      {wf.phase === "reading" ? <p className="import-progress">Đang đọc file…</p> : null}
      {wf.phase === "checking" || wf.phase === "committing" ? (
        <p className="import-progress" role="status">
          {wf.phase === "checking" ? "Đang kiểm tra dữ liệu" : "Đang nhập"}: {wf.progress.done}/
          {wf.progress.total} lô
        </p>
      ) : null}

      {showFile ? (
        <>
          <ImportSummaryBar
            fileName={wf.fileName}
            total={wf.rows.length}
            counts={wf.counts}
            includeDuplicates={wf.includeDuplicates}
            onIncludeDuplicates={wf.setIncludeDuplicates}
            toImportCount={wf.toImportCount}
            busy={wf.phase === "committing"}
            onCommit={wf.commit}
            onReset={wf.reset}
          />
          <ImportPreviewTable rows={wf.rows} />
        </>
      ) : null}
    </div>
  );
}
