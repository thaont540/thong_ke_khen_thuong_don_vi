interface PaginationBarProps {
  page: number;
  size: number;
  total: number;
  onPage: (page: number) => void;
}

/** "Hiển thị a–b trong N" + page buttons, like the mockup pager. */
export function PaginationBar({ page, size, total, onPage }: PaginationBarProps) {
  if (total === 0) return null;
  const pages = Math.max(1, Math.ceil(total / size));
  const start = (page - 1) * size;
  return (
    <div className="pager">
      <span>
        Hiển thị {start + 1}–{Math.min(start + size, total)} trong {total}
      </span>
      <div className="pages">
        <button
          type="button"
          aria-label="Trang trước"
          disabled={page <= 1}
          onClick={() => onPage(page - 1)}
        >
          ‹
        </button>
        {Array.from({ length: pages }, (_, i) => i + 1).map((p) => (
          <button
            key={p}
            type="button"
            aria-current={p === page ? "page" : undefined}
            onClick={() => onPage(p)}
          >
            {p}
          </button>
        ))}
        <button
          type="button"
          aria-label="Trang sau"
          disabled={page >= pages}
          onClick={() => onPage(page + 1)}
        >
          ›
        </button>
      </div>
    </div>
  );
}
