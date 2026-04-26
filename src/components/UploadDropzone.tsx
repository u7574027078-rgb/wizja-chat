import { useRef, useState } from "react";
import { cn } from "@/lib/utils";

export type UploadKind = "video" | "dicom" | "image";

interface UploadedFile {
  file: File;
  url: string;
  kind: UploadKind;
}

interface Props {
  onUpload: (uploaded: UploadedFile) => void;
}

// Strefa wgrywania pliku — wideo / DICOM / obraz
export function UploadDropzone({ onUpload }: Props) {
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function detectKind(file: File): UploadKind {
    const name = file.name.toLowerCase();
    if (name.endsWith(".dcm") || name.endsWith(".dicom")) return "dicom";
    if (file.type.startsWith("video/") || name.endsWith(".mp4") || name.endsWith(".webm")) return "video";
    return "image";
  }

  function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    const file = files[0];
    const kind = detectKind(file);
    const url = URL.createObjectURL(file);
    onUpload({ file, url, kind });
  }

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        handleFiles(e.dataTransfer.files);
      }}
      className={cn(
        "relative grid grid-cols-1 gap-4 rounded-2xl border-2 border-dashed p-8 transition-colors md:grid-cols-2",
        dragOver ? "border-primary bg-primary/5" : "border-border bg-card/40",
      )}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept="video/*,image/*,.dcm,.dicom"
        onChange={(e) => handleFiles(e.target.files)}
        className="hidden"
      />

      <button
        type="button"
        onClick={() => {
          if (fileInputRef.current) {
            fileInputRef.current.accept = "video/*,image/*";
            fileInputRef.current.click();
          }
        }}
        className="group flex flex-col items-center justify-center rounded-xl border border-border bg-secondary/40 p-8 text-center transition-all hover:border-primary hover:bg-secondary"
      >
        <div className="mb-3 text-4xl">📹</div>
        <h3 className="mb-1 text-lg font-semibold">Wgraj wideo / obraz naczyniowy</h3>
        <p className="text-xs text-muted-foreground">MP4, WebM, PNG, JPG</p>
      </button>

      <button
        type="button"
        onClick={() => {
          if (fileInputRef.current) {
            fileInputRef.current.accept = ".dcm,.dicom";
            fileInputRef.current.click();
          }
        }}
        className="group flex flex-col items-center justify-center rounded-xl border border-border bg-secondary/40 p-8 text-center transition-all hover:border-accent hover:bg-secondary"
      >
        <div className="mb-3 text-4xl">💾</div>
        <h3 className="mb-1 text-lg font-semibold">Wgraj DICOM naczyniowy</h3>
        <p className="text-xs text-muted-foreground">.dcm — Cornerstone3D (lazy)</p>
      </button>

      <p className="col-span-full text-center text-xs text-muted-foreground">
        Możesz też przeciągnąć plik bezpośrednio w to pole.
      </p>
    </div>
  );
}
