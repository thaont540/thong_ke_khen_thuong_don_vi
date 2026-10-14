import { useLocation, useSearchParams } from "react-router";
import { OfficerDetailModal } from "./officer-detail-modal";

const toId = (v: string | null): number | null => {
  const n = Number(v);
  return v !== null && Number.isInteger(n) && n > 0 ? n : null;
};

/**
 * Global F02 host (mounted in AppLayout): shows the modal while the URL has `?officer=<id>[&award=<id>]`.
 * Inactive on /awards/* because the add form uses `?officer=` as a prefill, not as a modal trigger.
 */
export function OfficerDetailModalHost() {
  const [params, setParams] = useSearchParams();
  const { pathname } = useLocation();
  const officerId = toId(params.get("officer"));
  if (officerId === null || pathname.startsWith("/awards/")) return null;

  const close = () =>
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.delete("officer");
        next.delete("award");
        return next;
      },
      { replace: true },
    );
  return (
    <OfficerDetailModal officerId={officerId} awardId={toId(params.get("award"))} onClose={close} />
  );
}
