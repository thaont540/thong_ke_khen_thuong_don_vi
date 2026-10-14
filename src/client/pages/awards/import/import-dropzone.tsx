import { type DragEvent, useState } from "react";

interface Props {
  disabled: boolean;
  onFile: (file: File) => void;
}

export function ImportDropzone({ disabled, onFile }: Props) {
  const [dragging, setDragging] = useState(false);

  function onDrop(e: DragEvent<HTMLLabelElement>) {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file && !disabled) onFile(file);
  }

  return (
    <label
      className={dragging ? "dropzone drag" : "dropzone"}
      onDragEnter={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={onDrop}
    >
      <input
        type="file"
        accept=".xlsx,.xls,.csv"
        hidden
        disabled={disabled}
        aria-label="Chọn file import"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) onFile(file);
        }}
      />
      <strong>Kéo thả file vào đây, hoặc bấm để chọn file</strong>
      <span className="hint">Hỗ trợ .xlsx, .xls, .csv (tối đa 100 dòng, 5 MB)</span>
    </label>
  );
}
