import { isoToDisplay } from "../../shared/date-format";
import type { AwardRecord } from "../../shared/schemas/award-schemas";
import { StatusBadge } from "../components/ui/status-badge";
import { awardTitle } from "../pages/awards/award-display-text";

/** F02 "Quá trình thi đua, khen thưởng": year desc (server order), current record highlighted. */
export function OfficerAwardHistoryTable({
  awards,
  currentAwardId,
}: {
  awards: readonly AwardRecord[];
  currentAwardId: number | null;
}) {
  if (awards.length === 0) return <p className="muted">Cán bộ này chưa có khen thưởng nào.</p>;
  return (
    <div className="table-wrap">
      <table className="history">
        <thead>
          <tr>
            <th>Năm</th>
            <th>Hình thức</th>
            <th>Danh hiệu / khen thưởng</th>
            <th>Quyết định</th>
          </tr>
        </thead>
        <tbody>
          {awards.map((a) => (
            <tr
              key={a.id}
              className={a.id === currentAwardId ? "current" : undefined}
              aria-current={a.id === currentAwardId ? "true" : undefined}
            >
              <td className="tnum">{a.year}</td>
              <td>
                <StatusBadge tone={a.form === "DANH_HIEU" ? "dh" : "kt"}>
                  {a.form === "DANH_HIEU" ? "Danh hiệu" : "Khen thưởng"}
                </StatusBadge>
              </td>
              <td>{awardTitle(a)}</td>
              <td className="decision">
                {a.decision_number}, {isoToDisplay(a.decision_date)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
