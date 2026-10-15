import { formatSeniority, officerSeniorityYears } from "../../../shared/officer-seniority";
import type { MasterDataDto } from "../../../shared/schemas/master-data-dto";
import { useOfficerDetail } from "../../officer-detail/use-officer-detail";

/** Read-only officer card of F03 (name, birth year, rank, position, unit / team). */
export function AwardFormOfficerInfo({
  officerId,
  master,
}: {
  officerId: number | null;
  master: MasterDataDto;
}) {
  const { data: o, isPending } = useOfficerDetail(officerId);
  if (officerId === null) return <div className="person-card">Chưa chọn cán bộ</div>;
  if (!o)
    return (
      <div className="person-card">
        {isPending ? "Đang tải…" : "Không tải được thông tin cán bộ"}
      </div>
    );
  const unit = master.units.find((u) => u.id === o.unit_id);
  const team = unit?.teams.find((t) => t.id === o.team_id);
  return (
    <div className="person-card">
      <strong>{o.full_name}</strong>, sinh {o.birth_year}
      <br />
      {master.ranks.find((r) => r.id === o.rank_id)?.name},{" "}
      {master.positions.find((p) => p.id === o.position_id)?.name}
      <br />
      {unit?.name}
      {team ? ` / ${team.name}` : ""}
      <br />
      Thâm niên: {formatSeniority(officerSeniorityYears(o.joined_month))}
    </div>
  );
}
