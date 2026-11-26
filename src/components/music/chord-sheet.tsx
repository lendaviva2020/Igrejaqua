import type { ParsedSong } from "@/lib/chords/chordpro";
import { cn } from "@/lib/utils/cn";

const KIND_LABEL = { verse: "Estrofe", chorus: "Refrão", bridge: "Ponte", intro: "Introdução", outro: "Final", other: "" } as const;

/** Renderiza a cifra com acordes sobre a sílaba. Todo conteúdo é texto (React escapa); nunca HTML bruto. */
export function ChordSheet({ song, tone }: { song: ParsedSong; tone: "paper" | "stage" }) {
  const stage = tone === "stage";
  return (
    <div className={cn("font-mono", stage ? "text-[length:var(--stage-size,2rem)] leading-[2.4]" : "text-base leading-[2.2]")}>
      {song.sections.map((section, i) => (
        <section key={i} className="mb-8" aria-label={section.label ?? (KIND_LABEL[section.kind] || undefined)}>
          {section.label || KIND_LABEL[section.kind] ? (
            <p className={cn("mb-1 text-xs font-sans uppercase tracking-widest", stage ? "text-palco-mudo" : "text-tinta-2")}>{section.label ?? KIND_LABEL[section.kind]}</p>
          ) : null}
          {section.lines.map((line, j) =>
            line.kind === "blank" ? <div key={j} className="h-4" aria-hidden="true" />
            : line.kind === "comment" ? <p key={j} className={cn("font-sans italic", stage ? "text-palco-mudo" : "text-tinta-2")}>{line.segments.map((s) => s.text).join("")}</p>
            : (
              <p key={j} className="flex flex-wrap items-end">
                {line.segments.map((seg, k) => (
                  <span key={k} className="inline-flex flex-col whitespace-pre">
                    <span className={cn("h-[1.2em] font-semibold leading-none", stage ? "text-palco-acorde" : "text-cobre")} aria-label={seg.chord ? `acorde ${seg.chord}` : undefined}>{seg.chord ?? " "}</span>
                    <span>{seg.text === "" ? " " : seg.text}</span>
                  </span>
                ))}
              </p>
            ),
          )}
        </section>
      ))}
    </div>
  );
}
