/**
 * Live transcription feed with quick-tag highlights.
 * Auto-scrolls; optional pause-scroll. Highlights key terms (symptoms/vitals).
 */

export interface TranscriptSegment {
  text: string;
  key_terms?: string[];
}

interface LiveTranscriptionProps {
  segments: TranscriptSegment[];
  paused?: boolean;
  className?: string;
}

function highlightText(text: string, terms: string[] = []): React.ReactNode {
  if (terms.length === 0) return text;
  const lowerText = text.toLowerCase();
  const ranges: { start: number; end: number; value: string }[] = [];
  const seen = new Set<string>();
  for (const term of terms) {
    const t = term.trim();
    if (!t || seen.has(t.toLowerCase())) continue;
    seen.add(t.toLowerCase());
    const idx = lowerText.indexOf(t.toLowerCase());
    if (idx !== -1)
      ranges.push({ start: idx, end: idx + t.length, value: text.slice(idx, idx + t.length) });
  }
  if (ranges.length === 0) return text;
  ranges.sort((a, b) => a.start - b.start);
  const merged: { start: number; end: number; value: string }[] = [];
  for (const r of ranges) {
    if (merged.length && r.start < merged[merged.length - 1].end) continue;
    merged.push(r);
  }
  const out: React.ReactNode[] = [];
  let last = 0;
  for (const r of merged) {
    if (r.start > last) out.push(text.slice(last, r.start));
    out.push(
      <mark
        key={`${r.start}-${r.value}`}
        className="bg-amber-100 text-amber-900 rounded px-0.5 font-medium"
        title="Key finding"
      >
        {r.value}
      </mark>
    );
    last = r.end;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

function uniqueTerms(segments: TranscriptSegment[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const s of segments) {
    for (const t of s.key_terms ?? []) {
      const term = t.trim();
      if (!term) continue;
      const k = term.toLowerCase();
      if (seen.has(k)) continue;
      seen.add(k);
      out.push(term);
      if (out.length >= 32) return out;
    }
  }
  return out;
}

export function LiveTranscription({
  segments,
  paused = false,
  className = "",
}: LiveTranscriptionProps) {
  const fullText = segments.map((s) => s.text).join("");
  const allTerms = uniqueTerms(segments);

  return (
    <div className={`flex flex-col ${className}`}>
      <div className="text-xs text-clinical-muted mb-1">
        Live transcription {paused && "(paused)"}
      </div>
      <div
        className="flex-1 min-h-[200px] max-h-[320px] overflow-y-auto scroll-thin p-4 rounded-lg border border-clinical-border bg-clinical-surface text-gray-800"
        role="log"
        aria-live="polite"
      >
        {segments.length === 0 ? (
          <span className="text-clinical-muted">Waiting for speech…</span>
        ) : (
          <div className="space-y-3">
            <div>
              <div className="text-[11px] uppercase tracking-wide text-clinical-muted mb-2">Key transcript words</div>
              <div className="flex flex-wrap gap-2">
                {allTerms.length > 0 ? allTerms.map((term) => (
                  <span
                    key={term}
                    className="rounded-full border border-red-200 bg-white px-2.5 py-1 text-xs font-medium text-gray-800"
                  >
                    {term}
                  </span>
                )) : <span className="text-clinical-muted text-sm">No keywords yet.</span>}
              </div>
            </div>
            <details>
              <summary className="cursor-pointer text-xs text-clinical-muted">Show raw transcript</summary>
              <p className="mt-2 whitespace-pre-wrap text-sm">{highlightText(fullText, allTerms)}</p>
            </details>
          </div>
        )}
      </div>
    </div>
  );
}
