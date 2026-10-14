import { isoToDisplay } from "../../../shared/date-format";
import type { AwardRecord } from "../../../shared/schemas/award-schemas";
import { StatusBadge } from "../../components/ui/status-badge";
import { awardPlaceLine, awardSubjectName, awardTitle } from "./award-display-text";

interface Props {
  items: readonly AwardRecord[];
  /** Index of the first row in the whole result (STT continues across pages). */
  offset: number;
  canWrite: boolean;
  onOpenOfficer: (officerId: number, awardId: number) => void;
  onEdit: (r: AwardRecord) => void;
  onDelete: (r: AwardRecord) => void;
}

export function AwardsTable({ items, offset, canWrite, onOpenOfficer, onEdit, onDelete }: Props) {
  return (
    <div className="table-wrap">
      <table className="data">
        <thead>
          <tr>
            <th>STT</th>
            <th>Năm</th>
            <th>Tập thể / cá nhân</th>
            <th>Đối tượng</th>
            <th>Hình thức</th>
            <th>Danh hiệu / khen thưởng</th>
            <th>Quyết định</th>
            {canWrite ? <th className="col-actions">Thao tác</th> : null}
          </tr>
        </thead>
        <tbody>
          {items.map((r, i) => (
            <tr key={r.id}>
              <td className="num">{offset + i + 1}</td>
              <td className="tnum">{r.year}</td>
              <td>
                <div className="who">
                  {r.officer_id !== null ? (
                    <button
                      type="button"
                      className="link"
                      onClick={() => onOpenOfficer(r.officer_id as number, r.id)}
                    >
                      {awardSubjectName(r)}
                    </button>
                  ) : (
                    awardSubjectName(r)
                  )}
                </div>
                <div className="where">{awardPlaceLine(r)}</div>
              </td>
              <td>
                <StatusBadge tone={r.subject === "TAP_THE" ? "ok" : "muted"}>
                  {r.subject === "TAP_THE" ? "Tập thể" : "Cá nhân"}
                </StatusBadge>
              </td>
              <td>
                <StatusBadge tone={r.form === "DANH_HIEU" ? "dh" : "kt"}>
                  {r.form === "DANH_HIEU" ? "Danh hiệu" : "Khen thưởng"}
                </StatusBadge>
              </td>
              <td>
                <div className="award">{awardTitle(r)}</div>
                <div className="where">{r.authority_name}</div>
              </td>
              <td>
                <div>{r.decision_number}</div>
                <div className="decision">{isoToDisplay(r.decision_date)}</div>
              </td>
              {canWrite ? (
                <td className="col-actions">
                  <div className="row-actions">
                    <button
                      type="button"
                      className="btn btn-sm"
                      aria-label={`Sửa khen thưởng của ${awardSubjectName(r)} năm ${r.year}`}
                      onClick={() => onEdit(r)}
                    >
                      Sửa
                    </button>
                    <button
                      type="button"
                      className="btn btn-sm btn-danger"
                      aria-label={`Xóa khen thưởng của ${awardSubjectName(r)} năm ${r.year}`}
                      onClick={() => onDelete(r)}
                    >
                      Xóa
                    </button>
                  </div>
                </td>
              ) : null}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
