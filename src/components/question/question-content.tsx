"use client";

/* eslint-disable @next/next/no-img-element */
import { useState } from "react";
import { ImageOff, ZoomIn, ZoomOut, RotateCcw } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { MathText } from "./math-text";

export function QuestionImage({ src, alt, className }: { src: string; alt: string; className?: string }) {
  const [open, setOpen] = useState(false);
  const [failed, setFailed] = useState(false);
  const [zoom, setZoom] = useState(1);
  if (failed)
    return (
      <span className="my-2 inline-flex items-center gap-2 rounded-md border border-dashed px-3 py-2 text-xs text-muted-foreground">
        <ImageOff className="size-4" /> Diagram unavailable
      </span>
    );
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn("question-figure group relative my-2 inline-block max-w-full overflow-hidden rounded-md border p-1.5 align-top focus-visible:outline-2 focus-visible:outline-ring", className)}
        aria-label={`Enlarge ${alt}`}
      >
        <img src={src} alt={alt} loading="lazy" onError={() => setFailed(true)} className="block h-auto max-h-80 w-auto max-w-full object-contain" />
        <span className="absolute right-1.5 top-1.5 rounded bg-black/55 p-1 text-white opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
          <ZoomIn className="size-3.5" />
        </span>
      </button>
      <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setZoom(1); }}>
        <DialogContent size="xl" className="p-0">
          <div className="flex items-center justify-between border-b px-4 py-2.5 pr-12">
            <DialogTitle className="text-sm">{alt}</DialogTitle>
            <div className="flex gap-1">
              <Button variant="ghost" size="icon-sm" onClick={() => setZoom((z) => Math.max(0.5, z - 0.25))} aria-label="Zoom out"><ZoomOut /></Button>
              <Button variant="ghost" size="icon-sm" onClick={() => setZoom(1)} aria-label="Reset zoom"><RotateCcw /></Button>
              <Button variant="ghost" size="icon-sm" onClick={() => setZoom((z) => Math.min(4, z + 0.25))} aria-label="Zoom in"><ZoomIn /></Button>
            </div>
          </div>
          <div className="question-figure max-h-[75vh] overflow-auto p-4">
            <img src={src} alt={alt} className="mx-auto block h-auto max-w-none origin-top" style={{ width: `${zoom * 100}%`, maxWidth: zoom === 1 ? "100%" : undefined }} />
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

/**
 * Renders question text, placing images at [IMAGE] placeholders in order;
 * any remaining images are shown after the text.
 */
export function QuestionContent({ text, images = [], className, label = "Question diagram" }: { text: string; images?: string[]; className?: string; label?: string }) {
  const parts = (text ?? "").split("[IMAGE]");
  const used = Math.min(parts.length - 1, images.length);
  return (
    <div className={cn("text-[16.5px] leading-7", className)}>
      {parts.map((p, i) => (
        <span key={i}>
          {p && <MathText text={p} />}
          {i < parts.length - 1 && (i < images.length ? <span className="block"><QuestionImage src={images[i]} alt={`${label} ${i + 1}`} /></span> : <span className="mx-1 rounded bg-warning-soft px-1.5 py-0.5 text-xs text-warning">[image missing]</span>)}
        </span>
      ))}
      {images.slice(used).length > 0 && (
        <div className="mt-2 flex flex-wrap gap-3">
          {images.slice(used).map((src, i) => (
            <QuestionImage key={src + i} src={src} alt={`${label} ${used + i + 1}`} />
          ))}
        </div>
      )}
    </div>
  );
}

export const OPTION_LETTERS = ["A", "B", "C", "D", "E", "F"];
