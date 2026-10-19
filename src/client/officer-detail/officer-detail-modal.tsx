import { useNavigate } from "react-router";
import {
  formatJoinedMonth,
  formatSeniority,
  officerSeniorityYears,
} from "../../shared/officer-seniority";
import { can } from "../../shared/role-permissions";
import { ModalDialog } from "../components/ui/modal-dialog";
import { useCurrentUser } from "../hooks/use-current-user";
import { useMasterData } from "../hooks/use-master-data";
import { errorMessage } from "../lib/api-error";
import { formatCurrentRating } from "../lib/format-current-rating";
import { OfficerAwardHistoryTable } from "./officer-award-history-table";
import { OfficerCurrentAwardCard } from "./officer-current-award-card";
import { useOfficerDetail } from "./use-officer-detail";

interface Props {
  officerId: number;
  /** Award opened from F01; highlighted + shown as "Khen thưởng đang xem". */
  awardId: number | null;
  onClose: () => void;
}

const initials = (name: string) => {
  const w = name.trim().split(/\s+/);
  return ((w[0]?.[0] ?? "") + (w.length > 1 ? (w[w.length - 1]?.[0] ?? "") : "")).toUpperCase();
};

/** F02 officer detail modal (global; opened through `?officer=<id>&award=<id>`). */
export function OfficerDetailModal({ officerId, awardId, onClose }: Props) {
  const navigate = useNavigate();
  const { data: me } = useCurrentUser();
  const { data: master } = useMasterData();
  const { data: o, error, isPending } = useOfficerDetail(officerId);

  const rank = master?.ranks.find((r) => r.id === o?.rank_id)?.name ?? "—";
  const position = master?.positions.find((p) => p.id === o?.position_id)?.name ?? "—";
  const unit = master?.units.find((u) => u.id === o?.unit_id);
  const team = unit?.teams.find((t) => t.id === o?.team_id);
  const current = o?.awards.find((a) => a.id === awardId) ?? null;

  const footer = (
    <>
      <button type="button" className="btn" onClick={onClose}>
        Đóng
      </button>
      {o && me && can(me.role, "award:write") ? (
        <button
          type="button"
          className="btn"
          onClick={() => {
            const q = new URLSearchParams({ subject: "CA_NHAN", officer: String(o.id) });
            q.set("unit", String(o.unit_id));
            q.set("team", o.team_id === null ? "" : String(o.team_id));
            navigate(`/awards/new?${q}`);
          }}
        >
          Thêm khen thưởng
        </button>
      ) : null}
      {o && me && can(me.role, "officer:manage") ? (
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => navigate(`/officers?edit=${o.id}`)}
        >
          Sửa thông tin
        </button>
      ) : null}
    </>
  );

  return (
    <ModalDialog title={o?.full_name ?? "Chi tiết cán bộ"} onClose={onClose} footer={footer}>
      {error ? (
        <p className="alert-inline" role="alert">
          {errorMessage(error)}
        </p>
      ) : null}
      {isPending ? <p className="muted">Đang tải…</p> : null}
      {o ? (
        <>
          <div className="m-section" style={{ display: "flex", gap: 14, alignItems: "center" }}>
            <div className="avatar" aria-hidden="true">
              {initials(o.full_name)}
            </div>
            <p style={{ margin: 0 }} className="muted">
              {rank}, {position}
            </p>
          </div>
          <section className="m-section">
            <h3>Thông tin cán bộ</h3>
            <dl className="info">
              <div>
                <dt>Họ tên</dt>
                <dd>{o.full_name}</dd>
              </div>
              <div>
                <dt>Năm sinh</dt>
                <dd>{o.birth_year ?? "—"}</dd>
              </div>
              <div>
                <dt>Số hiệu</dt>
                <dd>{o.badge_number ?? "—"}</dd>
              </div>
              <div>
                <dt>Cấp bậc</dt>
                <dd>{rank}</dd>
              </div>
              <div>
                <dt>Chức vụ</dt>
                <dd>{position}</dd>
              </div>
              <div>
                <dt>Mã cán bộ</dt>
                <dd>{o.code}</dd>
              </div>
              <div>
                <dt>Tháng năm vào ngành</dt>
                <dd>{formatJoinedMonth(o.joined_month)}</dd>
              </div>
              <div>
                <dt>Thâm niên</dt>
                <dd>{formatSeniority(officerSeniorityYears(o.joined_month))}</dd>
              </div>
              <div>
                <dt>Xếp loại (năm)</dt>
                <dd>{formatCurrentRating(o.current_rating)}</dd>
              </div>
              <div className="full">
                <dt>Đơn vị</dt>
                <dd>{unit ? (team ? `${unit.name} / ${team.name}` : unit.name) : "—"}</dd>
              </div>
            </dl>
          </section>
          {current ? (
            <section className="m-section">
              <h3>Khen thưởng đang xem</h3>
              <OfficerCurrentAwardCard award={current} />
            </section>
          ) : null}
          <section className="m-section">
            <h3>Quá trình thi đua, khen thưởng</h3>
            <OfficerAwardHistoryTable awards={o.awards} currentAwardId={current?.id ?? null} />
          </section>
        </>
      ) : null}
    </ModalDialog>
  );
}
