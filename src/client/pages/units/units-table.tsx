import type { UnitListItem } from "../../../shared/schemas/unit-schemas";
import { KIND_LABEL } from "./unit-form-modal";

interface Props {
  items: UnitListItem[];
  onView: (u: UnitListItem) => void;
  onEdit: (u: UnitListItem) => void;
  onDelete: (u: UnitListItem) => void;
}

export function UnitsTable({ items, onView, onEdit, onDelete }: Props) {
  return (
    <div className="table-wrap">
      <table className="data-sm">
        <thead>
          <tr>
            <th>Mã</th>
            <th>Tên đơn vị</th>
            <th>Loại</th>
            <th>Số đội</th>
            <th>Số cán bộ</th>
            <th>Số khen thưởng</th>
            <th className="col-actions">Thao tác</th>
          </tr>
        </thead>
        <tbody>
          {items.map((u) => (
            <tr key={u.id}>
              <td className="who">{u.code}</td>
              <td>
                <button
                  type="button"
                  className="btn btn-sm"
                  aria-label={`Xem ${u.name}`}
                  onClick={() => onView(u)}
                >
                  {u.name}
                </button>
                {u.description ? <div className="where">{u.description}</div> : null}
              </td>
              <td>{KIND_LABEL[u.kind]}</td>
              <td className="tnum">{u.team_count}</td>
              <td className="tnum">{u.officer_count}</td>
              <td className="tnum">{u.award_count}</td>
              <td className="col-actions">
                <div className="row-actions">
                  <button
                    type="button"
                    className="btn btn-sm"
                    aria-label={`Sửa ${u.name}`}
                    onClick={() => onEdit(u)}
                  >
                    Sửa
                  </button>
                  <button
                    type="button"
                    className="btn btn-sm btn-danger"
                    aria-label={`Xóa ${u.name}`}
                    onClick={() => onDelete(u)}
                  >
                    Xóa
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
