import { useState } from "react";
import { useNavigate } from "react-router";
import { can } from "../../../shared/role-permissions";
import type { AwardRecord } from "../../../shared/schemas/award-schemas";
import { DEFAULT_PAGE_SIZE } from "../../../shared/schemas/list-query-schemas";
import { EmptyState } from "../../components/ui/empty-state";
import { PaginationBar } from "../../components/ui/pagination-bar";
import { useToast } from "../../components/ui/toast-provider";
import { useCurrentUser } from "../../hooks/use-current-user";
import { errorMessage } from "../../lib/api-error";
import { AwardDeleteDialog } from "./award-delete-dialog";
import { awardSubjectName } from "./award-display-text";
import { AwardsFilterBar } from "./awards-filter-bar";
import { AwardsStatsLine } from "./awards-stats-line";
import { AwardsTable } from "./awards-table";
import { useAwardListSearchParams } from "./use-award-list-search-params";
import { useAwardsList, useDeleteAward } from "./use-awards-queries";

/** F01 list + F09 row actions. */
export function AwardsListPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const { data: me } = useCurrentUser();
  const { filters, page, setFilters, setPage, reset, filterSearch, openOfficer } =
    useAwardListSearchParams();
  const [toDelete, setToDelete] = useState<AwardRecord | null>(null);
  const remove = useDeleteAward();

  const list = useAwardsList({
    unit_id: filters.unitId ?? undefined,
    team_id: filters.teamId ?? undefined,
    subject: filters.subject,
    form: filters.form,
    q: filters.q,
    page,
    size: DEFAULT_PAGE_SIZE,
  });
  const canWrite = me ? can(me.role, "award:write") : false;
  const items = list.data?.items ?? [];

  const confirmDelete = (r: AwardRecord) =>
    remove.mutate(r.id, {
      onSuccess: () => {
        toast(`Đã xóa khen thưởng của ${awardSubjectName(r)}`);
        setToDelete(null);
        if (items.length === 1 && page > 1) setPage(page - 1);
      },
      onError: (e) => {
        toast(errorMessage(e), "error");
        setToDelete(null);
      },
    });

  return (
    <>
      <div className="head">
        <div>
          <h1>Danh hiệu, khen thưởng</h1>
          <p className="sub">
            Danh sách danh hiệu thi đua và hình thức khen thưởng của tập thể, cá nhân trong đơn vị
          </p>
        </div>
        {canWrite ? (
          <button type="button" className="btn btn-primary" onClick={() => navigate("/awards/new")}>
            Thêm khen thưởng
          </button>
        ) : null}
      </div>

      <AwardsFilterBar filters={filters} onChange={setFilters} onReset={reset} />
      {list.data ? <AwardsStatsLine stats={list.data.stats} /> : null}

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
        {list.data && items.length === 0 ? (
          <EmptyState
            message="Không có bản ghi nào khớp với bộ lọc hiện tại."
            action={
              <button type="button" className="btn" onClick={reset}>
                Xóa bộ lọc
              </button>
            }
          />
        ) : null}
        {items.length > 0 ? (
          <AwardsTable
            items={items}
            offset={(page - 1) * DEFAULT_PAGE_SIZE}
            canWrite={canWrite}
            onOpenOfficer={openOfficer}
            onEdit={(r) => navigate(`/awards/${r.id}/edit${filterSearch}`)}
            onDelete={setToDelete}
          />
        ) : null}
        <PaginationBar
          page={page}
          size={DEFAULT_PAGE_SIZE}
          total={list.data?.total ?? 0}
          onPage={setPage}
        />
      </section>

      {toDelete ? (
        <AwardDeleteDialog
          record={toDelete}
          busy={remove.isPending}
          onConfirm={() => confirmDelete(toDelete)}
          onCancel={() => setToDelete(null)}
        />
      ) : null}
    </>
  );
}

export const Component = AwardsListPage;
