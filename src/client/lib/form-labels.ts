import type { Form } from "../../shared/domain-enums";
import type { BadgeTone } from "../components/ui/status-badge";

/** Display name of an award form (F01 filter/table, F02 history, F03/F09 segmented field). */
export const FORM_LABEL: Record<Form, string> = {
  DANH_HIEU: "Danh hiệu",
  KHEN_THUONG: "Khen thưởng",
  XEP_LOAI: "Xếp loại cán bộ",
};

export const FORM_TONE: Record<Form, BadgeTone> = {
  DANH_HIEU: "dh",
  KHEN_THUONG: "kt",
  XEP_LOAI: "warn",
};
