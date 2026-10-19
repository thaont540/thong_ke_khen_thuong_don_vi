import { StatusBadge } from "../../../components/ui/status-badge";
import { type PreviewRow, rowErrors, rowStatus } from "./import-preview-model";

const STATUS = {
  OK: { tone: "ok", label: "Hợp lệ", row: "" },
  ERROR: { tone: "err", label: "Lỗi", row: "row-err" },
  DUPLICATE: { tone: "warn", label: "Có thể trùng", row: "row-warn" },
} as const;

const FORM_LABEL = {
  DANH_HIEU: "Danh hiệu",
  KHEN_THUONG: "Khen thưởng",
  XEP_LOAI: "Xếp loại cán bộ",
} as const;

const NEW_OFFICER_NOTE = "Sẽ tạo cán bộ mới";

function Messages({ row }: { row: PreviewRow }) {
  const errors = rowErrors(row);
  if (errors.length > 0) {
    return (
      <ul className="err-list">
        {errors.map((m) => (
          <li key={m}>{m}</li>
        ))}
      </ul>
    );
  }
  return (
    <>
      {row.check.newOfficer ? (
        <ul className="info-list">
          <li>{NEW_OFFICER_NOTE}</li>
        </ul>
      ) : null}
      {row.dupMessages.length > 0 ? (
        <ul className="warn-list">
          {row.dupMessages.map((m) => (
            <li key={m}>{m}</li>
          ))}
        </ul>
      ) : null}
    </>
  );
}

export function ImportPreviewTable({ rows }: { rows: readonly PreviewRow[] }) {
  return (
    <div className="table-card">
      <div className="table-wrap">
        <table className="data">
          <thead>
            <tr>
              <th>Dòng</th>
              <th>Trạng thái</th>
              <th>Họ và tên / đơn vị</th>
              <th>Đối tượng</th>
              <th>Hình thức</th>
              <th>Danh hiệu / khen thưởng</th>
              <th>Năm</th>
              <th>Số quyết định</th>
              <th>Lỗi / cảnh báo</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const s = STATUS[rowStatus(r)];
              const d = r.check.display;
              return (
                <tr key={r.raw.row_number} className={s.row}>
                  <td className="num">{r.raw.row_number}</td>
                  <td>
                    <StatusBadge tone={s.tone}>{s.label}</StatusBadge>
                  </td>
                  <td className="who">
                    {d.subjectName}
                    {r.check.newOfficer ? (
                      <span className="new-officer-badge">
                        <StatusBadge tone="warn">mới</StatusBadge>
                      </span>
                    ) : null}
                  </td>
                  <td>
                    {d.subject ? (
                      <StatusBadge tone={d.subject === "TAP_THE" ? "ok" : "muted"}>
                        {d.subject === "TAP_THE" ? "Tập thể" : "Cá nhân"}
                      </StatusBadge>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td>{d.form ? FORM_LABEL[d.form] : "—"}</td>
                  <td>{d.awardLabel || "—"}</td>
                  <td className="tnum">{d.year}</td>
                  <td className="decision">{d.decision || "—"}</td>
                  <td>
                    <Messages row={r} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
