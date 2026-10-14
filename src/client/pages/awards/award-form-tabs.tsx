export type AwardFormTab = "manual" | "import";

/** Minimal tab strip of F03 / F04 (phase 07 only fills the Import panel). */
export function AwardFormTabs({
  tab,
  onTab,
}: {
  tab: AwardFormTab;
  onTab: (tab: AwardFormTab) => void;
}) {
  return (
    <div className="tabs" role="tablist">
      <button
        type="button"
        className="tab"
        role="tab"
        id="tab-manual"
        aria-selected={tab === "manual"}
        onClick={() => onTab("manual")}
      >
        Nhập thủ công
      </button>
      <button
        type="button"
        className="tab"
        role="tab"
        id="tab-import"
        aria-selected={tab === "import"}
        onClick={() => onTab("import")}
      >
        Import từ Excel
      </button>
    </div>
  );
}
