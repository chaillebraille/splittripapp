import { useRef, useState } from "react";
import { Camera, X } from "lucide-react";
import { toast } from "sonner";
import { fileToSquareDataUrl } from "@/lib/image";

type Props = {
  value: string | null;
  onChange: (value: string | null) => void;
  fallback?: string;
};

export function TripImagePicker({ value, onChange, fallback }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  async function handleFile(file: File | undefined) {
    if (!file) return;
    setIsProcessing(true);
    try {
      onChange(await fileToSquareDataUrl(file));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not use that image");
    } finally {
      setIsProcessing(false);
    }
  }

  return (
    <div className="flex items-center gap-4">
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="relative flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-secondary text-secondary-foreground"
        aria-label="Choose trip photo"
      >
        {value ? (
          <img src={value} alt="Trip photo" className="h-full w-full object-cover" />
        ) : fallback ? (
          <span className="text-2xl font-bold">{fallback}</span>
        ) : (
          <Camera className="h-6 w-6" />
        )}
      </button>

      <div className="flex flex-col gap-1">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="text-sm font-semibold text-primary"
          disabled={isProcessing}
        >
          {isProcessing ? "Processing…" : value ? "Change photo" : "Add a photo"}
        </button>
        {value && (
          <button
            type="button"
            onClick={() => onChange(null)}
            className="inline-flex items-center gap-1 text-sm text-muted-foreground"
          >
            <X className="h-3.5 w-3.5" /> Remove
          </button>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          void handleFile(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
    </div>
  );
}
