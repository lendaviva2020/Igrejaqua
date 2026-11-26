import { describe, expect, it } from "vitest";
import { ChordProError, MAX_CHORDPRO_BYTES, parseChordPro, serializeChordPro, transposeSong } from "@/lib/chords/chordpro";

const SONG = `{title: Grande é o Senhor}
{key: G}
{capo: 2}
{tempo: 72}
{start_of_verse: Estrofe 1}
[G]Grande é o [D]Senhor e [Em]mui digno de lou[C]vor
{end_of_verse}
{start_of_chorus}
[C]Aleluia, [G/B]aleluia
{end_of_chorus}`;

describe("ChordPro", () => {
  it("lê metadados e seções", () => {
    const s = parseChordPro(SONG);
    expect(s.title).toBe("Grande é o Senhor");
    expect(s.key).toBe("G");
    expect(s.capo).toBe(2);
    expect(s.tempo).toBe(72);
    expect(s.sections.map((x) => x.kind)).toEqual(["verse", "chorus"]);
    expect(s.sections[0]!.label).toBe("Estrofe 1");
  });
  it("associa acorde ao trecho de letra que o segue", () => {
    const line = parseChordPro("[Am]Oh [F]glória").sections[0]!.lines[0]!;
    expect(line.segments).toEqual([{ chord: "Am", text: "Oh " }, { chord: "F", text: "glória" }]);
  });
  it("transpõe G → A sem alterar o original", () => {
    const original = parseChordPro(SONG);
    const up = transposeSong(original, "G", "A");
    expect(up.key).toBe("A");
    expect(up.sections[0]!.lines[0]!.segments.map((s) => s.chord)).toEqual(["A", "E", "F#m", "D"]);
    expect(up.sections[1]!.lines[0]!.segments.map((s) => s.chord)).toEqual(["D", "A/C#"]);
    expect(original.sections[0]!.lines[0]!.segments[0]!.chord).toBe("G");
  });
  it("usa bemóis ao ir para tom bemolizado", () => {
    const down = transposeSong(parseChordPro("[A]x [D]y"), "A", "Bb");
    expect(down.sections[0]!.lines[0]!.segments.map((s) => s.chord)).toEqual(["Bb", "Eb"]);
  });
  it("ida e volta (transpor e desfazer) preserva a cifra", () => {
    const s = parseChordPro(SONG);
    const back = transposeSong(transposeSong(s, "G", "Eb"), "Eb", "G");
    expect(serializeChordPro(back)).toBe(serializeChordPro(s));
  });
  it("trata HTML como texto inerte e ignora diretivas desconhecidas", () => {
    const s = parseChordPro("{x_evil: <script>alert(1)</script>}\n[C]<img src=x onerror=alert(1)>");
    const text = s.sections.flatMap((x) => x.lines).flatMap((l) => l.segments).map((g) => g.text).join("");
    expect(text).toContain("<img"); // permanece string; a UI renderiza como texto (React escapa)
    expect(s.title).toBeNull();
  });
  it("valida limites de metadados", () => {
    const s = parseChordPro("{capo: 99}\n{tempo: 5}\n{key: H}");
    expect(s.capo).toBeNull();
    expect(s.tempo).toBeNull();
    expect(s.key).toBeNull();
  });
  it("rejeita cifra acima de 64 KB", () => {
    expect(() => parseChordPro("a".repeat(MAX_CHORDPRO_BYTES + 1))).toThrow(ChordProError);
  });
  it("aceita CRLF", () => {
    expect(parseChordPro("[C]a\r\n[D]b").sections[0]!.lines).toHaveLength(2);
  });
});
