import { useEffect, useState } from "react";
import { useSearchParams } from "react-router";
import type { OfficerListItem } from "../../../shared/schemas/officer-schemas";
import { EmptyState } from "../../components/ui/empty-state";
import { ModalDialog } from "../../components/ui/modal-dialog";
import { PaginationBar } from "../../components/ui/pagination-bar";
import { useToast } from "../../components/ui/toast-provider";
import { UnitTeamSelect } from "../../components/unit-team-select";
import { useMasterData } from "../../hooks/use-master-data";
import { errorMessage } from "../../lib/api-error";
import { OfficerDeleteDialog } from "./officer-delete-dialog";
import { OfficerFormModal } from "./officer-form-modal";
import { OfficersTable } from "./officers-table";
import { useOfficerForEdit, useOfficersList } from "./use-officers-queries";

const PAGE_SIZE = 10;

type Dialog =
  | { kind: "form"; officer: OfficerListItem | null }
  | { kind: "delete"; officer: OfficerListItem };

export function OfficersPage() {
  const toast = useToast();
  const master = useMasterData();
  const [params, setParams] = useSearchParams();
  const editId = Number(params.get("edit")) || null;
  const [unitId, setUnitId] = useState<number | null>(null);
  const [teamId, setTeamId] = useState<number | null>(null);
  const [input, setInput] = useState("");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const list = useOfficersList({ unit_id: unitId, team_id: teamId, q, page, size: PAGE_SIZE });
  const editTarget = useOfficerForEdit(dialog ? null : editId);

  useEffect(() => {
    const t = setTimeout(() => {
      setQ(input.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [input]);

  const setParam = (key: string, value: string | null) =>
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (value === null) next.delete(key);
        else next.set(key, value);
        return next;
      },
      { replace: false },
    );
  const closeEdit = () => setParam("edit", null);
  const close = () => setDialog(null);
  const items = list.data?.items ?? [];

  if (master.isError) return <EmptyState message={errorMessage(master.error)} />;
  return (
    <>
      <div className="head">
        <div>
          <h1>Quản lý cán bộ</h1>
          <p className="sub">Danh sách cán bộ dùng khi nhập khen thưởng cá nhân</p>
        </div>
        <button
          type="button"
          className="btn btn-primary"
          disabled={!master.data}
          onClick={() => setDialog({ kind: "form", officer: null })}
        >
          Thêm cán bộ
        </button>
      </div>
      <div className="toolbar">
        <UnitTeamSelect
          idPrefix="of-filter"
          units={master.data?.units ?? []}
          unitId={unitId}
          teamId={teamId}
          onChange={(v) => {
            setUnitId(v.unitId);
            setTeamId(v.teamId);
            setPage(1);
          }}
        />
        <div className="field field-wide">
          <label htmlFor="officers-search">Tìm kiếm</label>
          <input
            id="officers-search"
            type="search"
            placeholder="Họ tên, số hiệu hoặc mã cán bộ"
            value={input}
            onChange={(e) => setInput(e.target.value)}
          />
        </div>
      </div>

      <section className="table-card" aria-busy={list.isFetching}>
        {list.isError ? (
          <EmptyState
            message={errorMessage(list.error)}
            action={
              <button type="button" className="btn" onClick={() => list.refetch()}>
                Thử lại
              </button>
            }
          />
        ) : null}
        {list.isPending || master.isPending ? <EmptyState message="Đang tải…" /> : null}
        {list.data && items.length === 0 ? <EmptyState message="Không có cán bộ phù hợp." /> : null}
        {items.length > 0 && master.data ? (
          <OfficersTable
            items={items}
            master={master.data}
            onView={(o) => setParam("officer", String(o.id))}
            onEdit={(officer) => setDialog({ kind: "form", officer })}
            onDelete={(officer) => setDialog({ kind: "delete", officer })}
          />
        ) : null}
        <PaginationBar
          page={page}
          size={PAGE_SIZE}
          total={list.data?.total ?? 0}
          onPage={setPage}
        />
      </section>

      {master.data && dialog?.kind === "form" ? (
        <OfficerFormModal
          officer={dialog.officer}
          master={master.data}
          onClose={close}
          onSaved={() => {
            toast("Đã lưu cán bộ");
            close();
          }}
        />
      ) : null}
      {master.data && !dialog && editTarget.data ? (
        <OfficerFormModal
          officer={editTarget.data}
          master={master.data}
          onClose={closeEdit}
          onSaved={() => {
            toast("Đã lưu cán bộ");
            closeEdit();
          }}
        />
      ) : null}
      {!dialog && editId && editTarget.isError ? (
        <ModalDialog
          narrow
          title="Sửa cán bộ"
          onClose={closeEdit}
          footer={
            <button type="button" className="btn btn-primary" onClick={closeEdit}>
              Đóng
            </button>
          }
        >
          <p className="confirm-text">{errorMessage(editTarget.error)}</p>
        </ModalDialog>
      ) : null}
      {dialog?.kind === "delete" ? (
        <OfficerDeleteDialog officer={dialog.officer} onClose={close} />
      ) : null}
    </>
  );
}

export const Component = OfficersPage;
