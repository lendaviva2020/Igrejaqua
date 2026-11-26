import { describe, expect, it } from "vitest";
import {
  circleOfFifthsDistance, keyName, noteToPitchClass, parseChord, parseKey, recommendVocalKey,
  semitonesBetween, transposeChord, transposeKey, prefersFlats, MusicTheoryError,
} from "@/lib/music-theory";

describe("notas e tonalidades", () => {
  it("converte notas em pitch class", () => {
    expect(noteToPitchClass("C")).toBe(0);
    expect(noteToPitchClass("F#")).toBe(6);
    expect(noteToPitchClass("Gb")).toBe(6);
    expect(noteToPitchClass("Bb")).toBe(10);
  });
  it("rejeita entradas inválidas", () => {
    expect(() => noteToPitchClass("H")).toThrow(MusicTheoryError);
    expect(() => parseKey("C##")).toThrow(MusicTheoryError);
  });
  it("menor deslocamento entre tons", () => {
    expect(semitonesBetween("C", "D")).toBe(2);
    expect(semitonesBetween("C", "B")).toBe(-1);
    expect(semitonesBetween("G", "C")).toBe(5);
    expect(semitonesBetween("C", "F#")).toBe(6);
  });
  it("grafia segue a tonalidade-alvo", () => {
    expect(transposeKey("C", 5)).toBe("F");
    expect(transposeKey("C", 10)).toBe("Bb");
    expect(transposeKey("C", 7)).toBe("G");
    expect(transposeKey("Am", 3)).toBe("Cm");
    expect(keyName(parseKey("Eb"))).toBe("Eb");
    expect(prefersFlats(parseKey("D"))).toBe(false);
  });
});

describe("acordes", () => {
  it("decompõe acordes complexos", () => {
    expect(parseChord("F#m7b5")).toEqual({ root: "F#", quality: "m7b5", bass: null });
    expect(parseChord("C/E")).toEqual({ root: "C", quality: "", bass: "E" });
    expect(parseChord("Am7/G")).toEqual({ root: "A", quality: "m7", bass: "G" });
    expect(parseChord("N.C.")).toBeNull();
  });
  it("transpõe preservando qualidade e baixo", () => {
    expect(transposeChord("Cmaj7", 2, false)).toBe("Dmaj7");
    expect(transposeChord("G/B", 2, false)).toBe("A/C#");
    expect(transposeChord("Dsus4", -2, true)).toBe("Csus4");
    expect(transposeChord("Bbadd9", 2, false)).toBe("Cadd9");
    expect(transposeChord("N.C.", 3, false)).toBe("N.C.");
  });
  it("propriedade: transpor n e depois -n é identidade (todas as raízes/qualidades)", () => {
    const roots = ["C", "C#", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B"];
    const quals = ["", "m", "7", "maj7", "m7b5", "sus4", "add9", "dim", "aug"];
    for (const r of roots) for (const q of quals) for (let n = -11; n <= 11; n += 1) {
      const there = transposeChord(`${r}${q}`, n, false);
      const back = transposeChord(there, -n, false);
      expect(noteToPitchClass(parseChord(back)!.root)).toBe(noteToPitchClass(r));
      expect(parseChord(back)!.quality).toBe(q);
    }
  });
  it("12 semitons voltam à mesma classe", () => {
    expect(transposeChord("F#m7", 12, false)).toBe("F#m7");
  });
});

describe("círculo de quintas", () => {
  it("distâncias conhecidas", () => {
    expect(circleOfFifthsDistance("C", "G")).toBe(1);
    expect(circleOfFifthsDistance("C", "F#")).toBe(6);
    expect(circleOfFifthsDistance("C", "Am")).toBe(0);
    expect(circleOfFifthsDistance("D", "Bb")).toBe(4);
  });
});

describe("tom vocal (R-18)", () => {
  it("mantém tom quando já cabe", () => {
    const r = recommendVocalKey("G", { low: 55, high: 67 }, { low: 52, high: 72 });
    expect(r.fits).toBe(true);
    expect(r.semitones).toBe(0);
    expect(r.targetKey).toBe("G");
  });
  it("abaixa quando a melodia passa do agudo", () => {
    const r = recommendVocalKey("G", { low: 57, high: 74 }, { low: 52, high: 72 });
    expect(r.fits).toBe(true);
    expect(r.semitones).toBeLessThan(0);
  });
  it("sem solução devolve a de menor violação", () => {
    const r = recommendVocalKey("C", { low: 40, high: 80 }, { low: 55, high: 65 });
    expect(r.fits).toBe(false);
    expect(r.violation).toBeGreaterThan(0);
  });
  it("rejeita faixas invertidas", () => {
    expect(() => recommendVocalKey("C", { low: 70, high: 60 }, { low: 50, high: 70 })).toThrow(MusicTheoryError);
  });
});
