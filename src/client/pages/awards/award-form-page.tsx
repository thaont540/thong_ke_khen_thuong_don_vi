import { lazy, type ReactNode, Suspense, useState } from "react";
import { Link, useLocation, useParams, useSearchParams } from "react-router";
import { SUBJECTS } from "../../../shared/domain-enums";
import { EmptyState } from "../../components/ui/empty-state";
import { useMasterData } from "../../hooks/use-master-data";
import { errorMessage } from "../../lib/api-error";
import { AwardFormScreen } from "./award-form-screen";
import { type AwardFormTab, AwardFormTabs } from "./award-form-tabs";
import { type AwardFormValues, emptyAwardForm, recordToFormValues } from "./award-form-values";
import { useAward, useOfficerOptions } from "./use-awards-queries";

// Import panel is owned by phase 07 (F04); loaded only when its tab opens.
const ImportPanel = lazy(() =>
  import("./import/import-panel").then((m) => ({ default: m.ImportPanel })),
);

const asId = (v: string | null): string =>
  v && Number.isInteger(Number(v)) && Number(v) > 0 ? v : "";

/** `/awards/new?subject=CA_NHAN&unit=&team=&officer=` prefill (used by the F02 modal). */
function prefillFromParams(sp: URLSearchParams): AwardFormValues {
  const subject = SUBJECTS.find((s) => s === sp.get("subject")) ?? "CA_NHAN";
  const base = emptyAwardForm();
  return {
    ...base,
    subject,
    unit_id: asId(sp.get("unit")),
    team_id: asId(sp.get("team")),
    officer_id: subject === "CA_NHAN" ? asId(sp.get("officer")) : "",
  };
}

/** F03 add (`/awards/new`, with Import tab) and F09 edit (`/awards/:id/edit`). */
export function AwardFormPage() {
  const { id } = useParams();
  const [sp] = useSearchParams();
  const { search } = useLocation();
  const [tab, setTab] = useState<AwardFormTab>("manual");
  const editId = id === undefined ? null : Number(id);
  const master = useMasterData();
  const officers = useOfficerOptions(master.isSuccess);
  const award = useAward(editId !== null && Number.isInteger(editId) ? editId : null);

  const failure = master.error ?? officers.error ?? award.error;
  const ready = master.data && officers.data && (editId === null || award.data);

  let body: ReactNode;
  if (failure) {
    body = (
      <EmptyState
        message={errorMessage(failure)}
        action={
          <Link className="btn" to={`/${editId === null ? "" : search}`}>
            Về danh sách
          </Link>
        }
      />
    );
  } else if (!ready) {
    body = <EmptyState message="Đang tải…" />;
  } else {
    body = (
      <>
        {editId === null ? <AwardFormTabs tab={tab} onTab={setTab} /> : null}
        <div hidden={tab !== "manual"}>
          <AwardFormScreen
            key={award.data?.id ?? "new"}
            editing={award.data ?? null}
            initial={award.data ? recordToFormValues(award.data) : prefillFromParams(sp)}
            master={master.data as NonNullable<typeof master.data>}
            officers={officers.data?.items ?? []}
            backSearch={search}
          />
        </div>
        {editId === null && tab === "import" ? (
          <Suspense fallback={<EmptyState message="Đang tải…" />}>
            <ImportPanel />
          </Suspense>
        ) : null}
      </>
    );
  }

  return (
    <>
      <div className="head">
        <div>
          <h1>{editId === null ? "Thêm khen thưởng" : "Sửa khen thưởng"}</h1>
          <p className="sub">
            {editId === null
              ? "Nhập từng bản ghi hoặc import nhiều bản ghi từ file Excel"
              : "Cập nhật thông tin bản ghi khen thưởng"}
          </p>
        </div>
      </div>
      {body}
    </>
  );
}

export const Component = AwardFormPage;
