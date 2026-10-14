import type { ReactNode } from "react";
import { isoToDisplay } from "../../shared/date-format";
import type { AwardRecord } from "../../shared/schemas/award-schemas";
import { StatusBadge } from "../components/ui/status-badge";
import { awardTitle } from "../pages/awards/award-display-text";

const DASH = "—";

function Item({ label, children, cls }: { label: string; children: ReactNode; cls?: string }) {
  return (
    <div className={cls}>
      <dt>{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

/** F02 "Khen thưởng đang xem": fields that do not apply to the record show "—". */
export function OfficerCurrentAwardCard({ award: a }: { award: AwardRecord }) {
  const isTitle = a.form === "DANH_HIEU";
  return (
    <div className={isTitle ? "award-card" : "award-card kt"}>
      <dl className="info">
        <Item label="Hình thức">
          <StatusBadge tone={isTitle ? "dh" : "kt"}>
            {isTitle ? "Danh hiệu" : "Khen thưởng"}
          </StatusBadge>
        </Item>
        <Item label="Năm">{a.year}</Item>
        <Item label="Cấp quyết định">{a.authority_name}</Item>
        <Item label="Danh hiệu thi đua" cls="wide">
          {isTitle ? a.award_type_name : DASH}
        </Item>
        <Item label="Số quyết định">{a.decision_number}</Item>
        <Item label="Hình thức khen thưởng" cls="wide">
          {isTitle ? DASH : awardTitle(a)}
        </Item>
        <Item label="Ngày quyết định">{isoToDisplay(a.decision_date)}</Item>
        <Item label="Chi tiết giải thưởng" cls="full">
          {a.achievement}
        </Item>
        {a.note ? (
          <Item label="Ghi chú" cls="full">
            {a.note}
          </Item>
        ) : null}
      </dl>
    </div>
  );
}
