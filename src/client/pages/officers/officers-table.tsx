import type { MasterDataDto as MasterData } from "../../../shared/schemas/master-data-dto";
import type { OfficerListItem } from "../../../shared/schemas/officer-schemas";

interface Props {
  items: OfficerListItem[];
  master: MasterData;
  onView: (o: OfficerListItem) => void;
  onEdit: (o: OfficerListItem) => void;
  onDelete: (o: OfficerListItem) => void;
}

export function OfficersTable({ items, master, onView, onEdit, onDelete }: Props) {
  const rank = new Map(master.ranks.map((r) => [r.id, r.name]));
  const position = new Map(master.positions.map((p) => [p.id, p.name]));
  const unit = new Map(master.units.map((u) => [u.id, u]));
  return (
    <div className="table-wrap">
      <table className="data-sm">
        <thead>
          <tr>
            <th>Mã</th>
            <th>Họ tên</th>
            <th>Năm sinh</th>
            <th>Số hiệu</th>
            <th>Cấp bậc</th>
            <th>Chức vụ</th>
            <th>Đơn vị / đội</th>
            <th>Số khen thưởng</th>
            <th className="col-actions">Thao tác</th>
          </tr>
        </thead>
        <tbody>
          {items.map((o) => {
            const u = unit.get(o.unit_id);
            const team = u?.teams.find((t) => t.id === o.team_id);
            return (
              <tr key={o.id}>
                <td className="decision">{o.code}</td>
                <td>
                  <a
                    className="who"
                    href={`?officer=${o.id}`}
                    aria-label={`Xem ${o.full_name}`}
                    onClick={(e) => {
                      e.preventDefault();
                      onView(o);
                    }}
                  >
                    {o.full_name}
                  </a>
                </td>
                <td className="tnum">{o.birth_year}</td>
                <td className="tnum">{o.badge_number}</td>
                <td>{rank.get(o.rank_id) ?? "—"}</td>
                <td>{position.get(o.position_id) ?? "—"}</td>
                <td>
                  {u?.name ?? "—"}
                  {team ? <div className="where">{team.name}</div> : null}
                </td>
                <td className="tnum">{o.award_count}</td>
                <td className="col-actions">
                  <div className="row-actions">
                    <button
                      type="button"
                      className="btn btn-sm"
                      aria-label={`Sửa ${o.full_name}`}
                      onClick={() => onEdit(o)}
                    >
                      Sửa
                    </button>
                    <button
                      type="button"
                      className="btn btn-sm btn-danger"
                      aria-label={`Xóa ${o.full_name}`}
                      onClick={() => onDelete(o)}
                    >
                      Xóa
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
