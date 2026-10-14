import { useEffect, useState } from "react";
import { SUBJECT } from "../../../shared/domain-enums";
import { FormField, fieldA11y } from "../../components/ui/form-field";
import { SelectField } from "../../components/ui/select-field";
import { UnitTeamSelect } from "../../components/unit-team-select";
import { useMasterData } from "../../hooks/use-master-data";
import type { AwardFilters } from "./use-award-list-search-params";

const MIN_SEARCH_CHARS = 2;
const DEBOUNCE_MS = 400;

interface Props {
  filters: AwardFilters;
  onChange: (patch: Partial<AwardFilters>) => void;
  onReset: () => void;
}

/** Search text that is actually sent to the API (BR-07; shorter input would scan too much). */
const effectiveQuery = (input: string) =>
  input.trim().length >= MIN_SEARCH_CHARS ? input.trim() : "";

export function AwardsFilterBar({ filters, onChange, onReset }: Props) {
  const { data: master } = useMasterData();
  const [input, setInput] = useState(filters.q);

  useEffect(() => {
    const t = setTimeout(() => {
      const next = effectiveQuery(input);
      if (next !== filters.q) onChange({ q: next });
    }, DEBOUNCE_MS);
    return () => clearTimeout(t);
    // Deliberately keyed on `input` only: just typing schedules a search.
  }, [input]);

  // External changes (reset button, back navigation) replace the box content.
  useEffect(() => {
    setInput((cur) => (effectiveQuery(cur) === filters.q ? cur : filters.q));
  }, [filters.q]);

  return (
    <section className="filters" aria-label="Bộ lọc">
      <UnitTeamSelect
        idPrefix="f"
        units={master?.units ?? []}
        unitId={filters.unitId}
        teamId={filters.teamId}
        onChange={({ unitId, teamId }) => onChange({ unitId, teamId })}
      />
      <SelectField
        id="f-subject"
        label="Đối tượng"
        value={filters.subject}
        options={[
          { value: "", label: "Tất cả" },
          { value: SUBJECT.TAP_THE, label: "Tập thể" },
          { value: SUBJECT.CA_NHAN, label: "Cá nhân" },
        ]}
        onChange={(e) => onChange({ subject: e.target.value as AwardFilters["subject"] })}
      />
      <SelectField
        id="f-form"
        label="Hình thức"
        value={filters.form}
        options={[
          { value: "", label: "Tất cả" },
          { value: "DANH_HIEU", label: "Danh hiệu" },
          { value: "KHEN_THUONG", label: "Khen thưởng" },
        ]}
        onChange={(e) => onChange({ form: e.target.value as AwardFilters["form"] })}
      />
      <FormField id="f-q" label="Tìm kiếm" className="field-search" hint={undefined}>
        <input
          type="search"
          value={input}
          placeholder="Tên tập thể, cá nhân hoặc số quyết định"
          onChange={(e) => setInput(e.target.value)}
          {...fieldA11y("f-q")}
        />
      </FormField>
      <div className="actions">
        <button type="button" className="btn" onClick={onReset}>
          Xóa bộ lọc
        </button>
      </div>
    </section>
  );
}
