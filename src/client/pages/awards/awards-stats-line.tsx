import type { AwardStats } from "../../../shared/schemas/award-schemas";

/** Totals of the filtered set (spec F01 "Dòng thống kê"). */
export function AwardsStatsLine({ stats }: { stats: AwardStats }) {
  return (
    <div className="summary" aria-live="polite">
      <span className="total">
        <strong>{stats.total}</strong>bản ghi
      </span>
      <span>
        <strong>{stats.danh_hieu}</strong>danh hiệu
      </span>
      <span>
        <strong>{stats.khen_thuong}</strong>khen thưởng
      </span>
      <span>
        <strong>{stats.xep_loai}</strong>xếp loại
      </span>
      <span>
        <strong>{stats.tap_the}</strong>tập thể
      </span>
      <span>
        <strong>{stats.ca_nhan}</strong>cá nhân
      </span>
    </div>
  );
}
