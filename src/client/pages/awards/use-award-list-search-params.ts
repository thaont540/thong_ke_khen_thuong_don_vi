import { useSearchParams } from "react-router";
import { FORMS, type Form, SUBJECTS, type Subject } from "../../../shared/domain-enums";

export interface AwardFilters {
  unitId: number | null;
  teamId: number | null;
  subject: Subject | "";
  form: Form | "";
  q: string;
}

const FILTER_KEYS = ["unit_id", "team_id", "subject", "form", "q", "page"] as const;

const toId = (v: string | null): number | null => {
  const n = Number(v);
  return v !== null && Number.isInteger(n) && n > 0 ? n : null;
};
const oneOf = <T extends string>(list: readonly T[], v: string | null): T | "" =>
  list.find((x) => x === v) ?? "";

/** F01 filters + page live in the URL (`?unit_id=&team_id=&subject=&form=&q=&page=`), so they survive edit/cancel. */
export function useAwardListSearchParams() {
  const [params, setParams] = useSearchParams();

  const filters: AwardFilters = {
    unitId: toId(params.get("unit_id")),
    teamId: toId(params.get("team_id")),
    subject: oneOf(SUBJECTS, params.get("subject")),
    form: oneOf(FORMS, params.get("form")),
    q: params.get("q") ?? "",
  };
  const page = toId(params.get("page")) ?? 1;

  const write = (mutate: (next: URLSearchParams) => void) =>
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        mutate(next);
        return next;
      },
      { replace: true },
    );

  const setOrDelete = (next: URLSearchParams, key: string, value: string | number | null) =>
    value === null || value === "" ? next.delete(key) : next.set(key, String(value));

  /** Any filter change goes back to page 1. */
  const setFilters = (patch: Partial<AwardFilters>) =>
    write((next) => {
      if ("unitId" in patch) setOrDelete(next, "unit_id", patch.unitId ?? null);
      if ("teamId" in patch) setOrDelete(next, "team_id", patch.teamId ?? null);
      if ("subject" in patch) setOrDelete(next, "subject", patch.subject ?? "");
      if ("form" in patch) setOrDelete(next, "form", patch.form ?? "");
      if ("q" in patch) setOrDelete(next, "q", patch.q ?? "");
      next.delete("page");
    });

  const setPage = (p: number) => write((next) => setOrDelete(next, "page", p > 1 ? p : null));

  const reset = () =>
    write((next) => {
      for (const k of FILTER_KEYS) next.delete(k);
    });

  /** `?...` with only filter params (no officer/award modal params) for edit round trips. */
  const filterSearch = (() => {
    const only = new URLSearchParams();
    for (const k of FILTER_KEYS) {
      const v = params.get(k);
      if (v !== null) only.set(k, v);
    }
    const s = only.toString();
    return s ? `?${s}` : "";
  })();

  const openOfficer = (officerId: number, awardId: number) =>
    setParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set("officer", String(officerId));
      next.set("award", String(awardId));
      return next;
    });

  return { filters, page, setFilters, setPage, reset, filterSearch, openOfficer };
}
