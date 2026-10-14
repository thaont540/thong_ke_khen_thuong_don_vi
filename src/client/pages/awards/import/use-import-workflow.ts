import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useRef, useState } from "react";
import { useNavigate } from "react-router";
import type { ImportLookups } from "../../../../shared/import/import-lookup-maps";
import {
  IMPORT_LOT_SIZE,
  type ImportRequest,
  importResponseSchema,
} from "../../../../shared/schemas/award-import-schemas";
import { useToast } from "../../../components/ui/toast-provider";
import { api } from "../../../lib/api-client";
import { errorMessage } from "../../../lib/api-error";
import { OFFICER_DETAIL_KEY } from "../../../officer-detail/use-officer-detail";
import { AWARDS_KEY } from "../use-awards-queries";
import { ImportFileError, readImportFile } from "./excel-file-reader";
import {
  applyDryRunResults,
  buildPreviewRows,
  chunk,
  countPreview,
  type PreviewRow,
  selectRowsToImport,
} from "./import-preview-model";

export type ImportPhase = "idle" | "reading" | "checking" | "ready" | "committing";

export interface ImportPartial {
  savedCount: number;
  batchId: number | null;
}

type LotBody = Omit<
  ImportRequest,
  "rows" | "dry_run" | "include_duplicates" | "client_error_rows"
> &
  Partial<Pick<ImportRequest, "dry_run" | "include_duplicates" | "client_error_rows">>;

const postLot = (body: LotBody & { rows: ImportRequest["rows"] }) =>
  api.post("/api/awards/import", { body, schema: importResponseSchema });

/** Read -> local validation -> server dry run (DB duplicates) -> preview -> commit in lots of 30. */
export function useImportWorkflow(lookups: ImportLookups | null) {
  const toast = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [phase, setPhase] = useState<ImportPhase>("idle");
  const [fileName, setFileName] = useState("");
  const [rows, setRows] = useState<PreviewRow[]>([]);
  const [includeDuplicates, setIncludeDuplicates] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [error, setError] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [partial, setPartial] = useState<ImportPartial | null>(null);
  /** Bumped on reset so answers of an abandoned run are dropped. */
  const run = useRef(0);

  const reset = useCallback(() => {
    run.current += 1;
    setPhase("idle");
    setRows([]);
    setFileName("");
    setIncludeDuplicates(false);
    setError(null);
    setWarnings([]);
    setPartial(null);
  }, []);

  const selectFile = useCallback(
    async (file: File) => {
      if (!lookups) return;
      reset();
      const mine = run.current;
      setFileName(file.name);
      setPhase("reading");
      try {
        const parsed = await readImportFile(file);
        if (run.current !== mine) return;
        setWarnings(parsed.warnings);
        let preview = buildPreviewRows(parsed.rows, lookups);
        setRows(preview);
        setPhase("checking");
        const toCheck = preview.filter((r) => r.check.input !== null).map((r) => r.raw);
        const lots = chunk(toCheck, IMPORT_LOT_SIZE);
        setProgress({ done: 0, total: lots.length });
        for (const [n, lot] of lots.entries()) {
          const res = await postLot({
            file_name: file.name,
            total_rows: parsed.rows.length,
            dry_run: true,
            rows: lot,
          });
          if (run.current !== mine) return;
          preview = applyDryRunResults(preview, res.results);
          setProgress({ done: n + 1, total: lots.length });
        }
        setRows(preview);
        setPhase("ready");
      } catch (e) {
        if (run.current !== mine) return;
        setError(e instanceof ImportFileError ? e.message : errorMessage(e));
        setRows([]);
        setPhase("idle");
      }
    },
    [lookups, reset],
  );

  const commit = useCallback(async () => {
    const mine = run.current;
    const lots = chunk(selectRowsToImport(rows, includeDuplicates), IMPORT_LOT_SIZE);
    const errorRows = countPreview(rows).error;
    let batchId: number | undefined;
    let saved = 0;
    setError(null);
    setPartial(null);
    setProgress({ done: 0, total: lots.length });
    setPhase("committing");
    try {
      for (const [n, lot] of lots.entries()) {
        const res = await postLot({
          file_name: fileName,
          total_rows: rows.length,
          ...(batchId === undefined ? {} : { batch_id: batchId }),
          include_duplicates: includeDuplicates,
          client_error_rows: errorRows,
          rows: lot.map((r) => r.raw),
        });
        batchId = res.batch_id ?? batchId;
        saved += res.imported_count;
        if (run.current === mine) setProgress({ done: n + 1, total: lots.length });
      }
    } catch (e) {
      await queryClient.invalidateQueries({ queryKey: AWARDS_KEY });
      if (run.current !== mine) return;
      setPartial({ savedCount: saved, batchId: batchId ?? null });
      setError(errorMessage(e));
      setPhase("ready");
      return;
    }
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: AWARDS_KEY }),
      queryClient.invalidateQueries({ queryKey: OFFICER_DETAIL_KEY }),
    ]);
    toast(`Đã nhập ${saved} khen thưởng`);
    navigate("/");
  }, [rows, includeDuplicates, fileName, queryClient, toast, navigate]);

  return {
    phase,
    fileName,
    rows,
    counts: countPreview(rows),
    includeDuplicates,
    setIncludeDuplicates,
    toImportCount: selectRowsToImport(rows, includeDuplicates).length,
    progress,
    error,
    warnings,
    partial,
    selectFile,
    commit,
    reset,
  };
}
