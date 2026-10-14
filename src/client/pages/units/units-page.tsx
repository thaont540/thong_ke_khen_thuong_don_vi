import { useEffect, useState } from "react";
import type { UnitListItem } from "../../../shared/schemas/unit-schemas";
import { ConfirmDialog } from "../../components/ui/confirm-dialog";
import { EmptyState } from "../../components/ui/empty-state";
import { ModalDialog } from "../../components/ui/modal-dialog";
import { PaginationBar } from "../../components/ui/pagination-bar";
import { useToast } from "../../components/ui/toast-provider";
import { errorMessage } from "../../lib/api-error";
import { UnitDetailModal } from "./unit-detail-modal";
import { UnitFormModal } from "./unit-form-modal";
import { UnitsTable } from "./units-table";
import { useDeleteUnit, useUnitsList } from "./use-units-queries";

const PAGE_SIZE = 10;

type Dialog =
  | { kind: "view"; id: number }
  | { kind: "form"; id: number | null }
  | { kind: "delete"; unit: UnitListItem }
  | { kind: "blocked"; unit: UnitListItem };

export function UnitsPage() {
  const toast = useToast();
  const [input, setInput] = useState("");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const list = useUnitsList({ q, page, size: PAGE_SIZE });
  const remove = useDeleteUnit();

  useEffect(() => {
    const t = setTimeout(() => {
      setQ(input.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [input]);

  const close = () => setDialog(null);
  const items = list.data?.items ?? [];

  const onDeleteClick = (unit: UnitListItem) =>
    setDialog(
      unit.officer_count + unit.award_count > 0
        ? { kind: "blocked", unit }
        : { kind: "delete", unit },
    );
  const onDelete = (unit: UnitListItem) =>
    remove.mutate(unit.id, {
      onSuccess: () => {
        toast("Đã xóa đơn vị");
        close();
      },
      onError: (e) => {
        toast(errorMessage(e), "error");
        close();
      },
    });

  return (
    <>
      <div className="head">
        <div>
          <h1>Quản lý đơn vị</h1>
          <p className="sub">Đơn vị và các đội trực thuộc</p>
        </div>
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => setDialog({ kind: "form", id: null })}
        >
          Thêm đơn vị
        </button>
      </div>
      <div className="toolbar">
        <div className="field field-wide">
          <label htmlFor="units-search">Tìm kiếm</label>
          <input
            id="units-search"
            type="search"
            placeholder="Tên hoặc mã đơn vị"
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
        {list.isPending ? <EmptyState message="Đang tải…" /> : null}
        {list.data && items.length === 0 ? <EmptyState message="Không có đơn vị phù hợp." /> : null}
        {items.length > 0 ? (
          <UnitsTable
            items={items}
            onView={(u) => setDialog({ kind: "view", id: u.id })}
            onEdit={(u) => setDialog({ kind: "form", id: u.id })}
            onDelete={onDeleteClick}
          />
        ) : null}
        <PaginationBar
          page={page}
          size={PAGE_SIZE}
          total={list.data?.total ?? 0}
          onPage={setPage}
        />
      </section>

      {dialog?.kind === "view" ? (
        <UnitDetailModal
          unitId={dialog.id}
          onClose={close}
          onEdit={() => setDialog({ kind: "form", id: dialog.id })}
        />
      ) : null}
      {dialog?.kind === "form" ? (
        <UnitFormModal
          unitId={dialog.id}
          onClose={close}
          onSaved={() => {
            toast("Đã lưu đơn vị");
            close();
          }}
        />
      ) : null}
      {dialog?.kind === "blocked" ? (
        <ModalDialog
          narrow
          title="Chưa thể xóa đơn vị"
          onClose={close}
          footer={
            <button type="button" className="btn btn-primary" onClick={close}>
              Đóng
            </button>
          }
        >
          <p className="confirm-text">
            {dialog.unit.name} còn {dialog.unit.officer_count} cán bộ và {dialog.unit.award_count}{" "}
            khen thưởng. Hãy chuyển hoặc xóa chúng trước khi xóa đơn vị.
          </p>
        </ModalDialog>
      ) : null}
      {dialog?.kind === "delete" ? (
        <ConfirmDialog
          title="Xóa đơn vị"
          message={`Xóa đơn vị ${dialog.unit.name}? Các đội trực thuộc cũng bị xóa.`}
          confirmLabel="Xóa"
          danger
          busy={remove.isPending}
          onConfirm={() => onDelete(dialog.unit)}
          onCancel={close}
        />
      ) : null}
    </>
  );
}

export const Component = UnitsPage;
