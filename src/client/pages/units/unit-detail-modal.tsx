import { EmptyState } from "../../components/ui/empty-state";
import { ModalDialog } from "../../components/ui/modal-dialog";
import { errorMessage } from "../../lib/api-error";
import { KIND_LABEL } from "./unit-form-modal";
import { useUnitDetail } from "./use-units-queries";

interface Props {
  unitId: number;
  onClose: () => void;
  onEdit: () => void;
}

export function UnitDetailModal({ unitId, onClose, onEdit }: Props) {
  const { data, isError, error } = useUnitDetail(unitId);
  return (
    <ModalDialog
      title={data ? data.name : "Chi tiết đơn vị"}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn" onClick={onClose}>
            Đóng
          </button>
          {data ? (
            <button type="button" className="btn btn-primary" onClick={onEdit}>
              Sửa đơn vị
            </button>
          ) : null}
        </>
      }
    >
      {data ? (
        <>
          <div className="table-wrap">
            <table className="data-sm">
              <tbody>
                <tr>
                  <th scope="row">Mã đơn vị</th>
                  <td>{data.code}</td>
                </tr>
                <tr>
                  <th scope="row">Loại</th>
                  <td>{KIND_LABEL[data.kind]}</td>
                </tr>
                <tr>
                  <th scope="row">Số đội</th>
                  <td>{data.team_count}</td>
                </tr>
                <tr>
                  <th scope="row">Số cán bộ</th>
                  <td>{data.officer_count}</td>
                </tr>
                <tr>
                  <th scope="row">Số khen thưởng</th>
                  <td>{data.award_count}</td>
                </tr>
                <tr>
                  <th scope="row">Mô tả</th>
                  <td>{data.description ?? "—"}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <h3>Đội trực thuộc</h3>
          {data.teams.length === 0 ? (
            <EmptyState message="Đơn vị chưa có đội trực thuộc." />
          ) : (
            <div className="table-wrap">
              <table className="data-sm">
                <thead>
                  <tr>
                    <th>Tên đội</th>
                    <th>Số cán bộ</th>
                    <th>Số khen thưởng</th>
                  </tr>
                </thead>
                <tbody>
                  {data.teams.map((t) => (
                    <tr key={t.id}>
                      <td>{t.name}</td>
                      <td className="tnum">{t.officer_count}</td>
                      <td className="tnum">{t.award_count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      ) : (
        <EmptyState message={isError ? errorMessage(error) : "Đang tải…"} />
      )}
    </ModalDialog>
  );
}
