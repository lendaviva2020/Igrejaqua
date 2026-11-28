import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

describe("Biblioteca aberta (WorshipCommons)", async () => {
  const { searchLibrary, getLibrarySong, libraryLanguages, foldText } = await import("@/modules/repertoire/library/catalog");
  const { parseChordPro } = await import("@/lib/chords/chordpro");
  const { MUSICAL_KEYS } = await import("@/modules/repertoire/schemas");
  const all = searchLibrary({ q: "", language: "todas", chordsOnly: false, page: 1 });

  it("toda música passa no validador de cifra, tem tom do formulário, licença permitida e crédito", () => {
    expect(all.total).toBeGreaterThan(1000);
    for (let page = 1; (page - 1) * 24 < all.total; page += 1) {
      for (const summary of searchLibrary({ q: "", language: "todas", chordsOnly: false, page }).items) {
        const song = getLibrarySong(summary.id);
        expect(song, summary.id).not.toBeNull();
        if (song === null) continue;
        expect(() => parseChordPro(song.chordpro), song.id).not.toThrow();
        expect(MUSICAL_KEYS as readonly string[], `${song.id} tom ${song.key}`).toContain(song.key);
        expect(["PD", "WC", "CC-BY", "CC-BY-SA"]).toContain(song.license);
        expect(song.copyrightNotice).toContain("Licença:");
        expect(song.copyrightNotice).toContain(song.sourceUrl);
        if (song.license.startsWith("CC")) expect(song.copyrightNotice, song.id).toMatch(/creativecommons\.org|https:\/\//);
        expect(song.copyrightNotice.length).toBeLessThanOrEqual(500);
      }
    }
  });

  it("nenhuma licença personalizada ou não comercial entra", () => {
    expect(all.items.every((s) => !/larry|NC/.test(s.license))).toBe(true);
  });

  it("busca sem acento, português primeiro e filtro só com cifra", () => {
    const castelo = searchLibrary({ q: "castelo forte", language: "pt", chordsOnly: false, page: 1 });
    expect(castelo.items.map((s) => s.title)).toContain("Castelo Forte");
    const semAcento = searchLibrary({ q: "fiel senhor", language: "pt", chordsOnly: false, page: 1 });
    expect(semAcento.items.some((s) => foldText(s.title).includes("fiel"))).toBe(true);
    expect(searchLibrary({ q: "", language: "todas", chordsOnly: true, page: 1 }).items.every((s) => s.hasChords)).toBe(true);
    expect(searchLibrary({ q: "", language: "todas", chordsOnly: false, page: 1 }).items[0]?.language).toBe("pt");
    expect(libraryLanguages()[0]?.code).toBe("pt");
  });

  it("seções em inglês viram comentários em português na cifra", () => {
    const amazing = searchLibrary({ q: "amazing grace", language: "en", chordsOnly: true, page: 1 }).items[0];
    const song = amazing === undefined ? null : getLibrarySong(amazing.id);
    expect(song?.chordpro).toContain("{comment: Estrofe 1}");
    expect(song?.chordpro).not.toMatch(/^Verse \d/m);
  });
});
