import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import {
  type DocumentInput,
  documentItemSchema,
  documentListResponseSchema,
} from "../../../shared/schemas/document-schemas";
import { api } from "../../lib/api-client";

export type DocumentsQuery = {
  q: string;
  doc_type: string;
  status: string;
  page: number;
  size: number;
};

export function useDocumentsList(query: DocumentsQuery) {
  return useQuery({
    queryKey: ["documents", "list", query],
    queryFn: ({ signal }) =>
      api.get("/api/documents", { query, schema: documentListResponseSchema, signal }),
    placeholderData: keepPreviousData,
  });
}

/** Metadata as text parts plus the optional `file` part (the server reads multipart only). */
export function toDocumentFormData(input: DocumentInput, file: File | null): FormData {
  const form = new FormData();
  for (const [key, value] of Object.entries(input)) form.set(key, value ?? "");
  if (file) form.set("file", file);
  return form;
}

function useDocumentMutation<TVars, TData>(fn: (vars: TVars) => Promise<TData>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["documents"] }),
  });
}

interface SaveVars {
  /** Absent = create. */
  id?: number;
  input: DocumentInput;
  file: File | null;
}

export const useSaveDocument = () =>
  useDocumentMutation((v: SaveVars) => {
    const formData = toDocumentFormData(v.input, v.file);
    return v.id === undefined
      ? api.post("/api/documents", { formData, schema: documentItemSchema })
      : api.put(`/api/documents/${v.id}`, { formData, schema: documentItemSchema });
  });

export const useDeleteDocument = () =>
  useDocumentMutation((id: number) =>
    api.delete(`/api/documents/${id}`, { schema: z.object({ ok: z.literal(true) }) }),
  );
