import { describe, expect, it, vi } from "vitest";
import { BIBLE_BOOKS, findBookByName, findBookBySlug } from "@/lib/bible/books";
import { BibleUnavailableError, fetchChapter, parseTranslation } from "@/lib/bible/client";
import { parseReference } from "@/lib/bible/reference";

const joao = findBookBySlug("joao");

describe("catálogo de livros", () => {
  it("66 livros, 1189 capítulos, numeração igual à da API", () => {
    expect(BIBLE_BOOKS).toHaveLength(66);
    expect(BIBLE_BOOKS.reduce((n, b) => n + b.chapters, 0)).toBe(1189);
    expect(BIBLE_BOOKS[42]?.name).toBe("João");
    expect(BIBLE_BOOKS[18]?.name).toBe("Salmos");
    expect(BIBLE_BOOKS[65]?.name).toBe("Apocalipse");
    expect(BIBLE_BOOKS.filter((b) => b.testament === "AT")).toHaveLength(39);
  });
  it("slugs únicos e seguros para URL", () => {
    const slugs = BIBLE_BOOKS.map((b) => b.slug);
    expect(new Set(slugs).size).toBe(66);
    for (const slug of slugs) expect(slug).toMatch(/^[a-z0-9-]+$/);
    expect(findBookBySlug("1-corintios")?.nr).toBe(46);
  });
  it("resolve nome e abreviação sem depender de acento", () => {
    expect(findBookByName("joao")?.nr).toBe(43);
    expect(findBookByName("Jo")?.nr).toBe(43);
    expect(findBookByName("Jn")?.name).toBe("Jonas");
    expect(findBookByName("1 jo")?.name).toBe("1 João");
    expect(findBookByName("inexistente")).toBeUndefined();
  });
});

describe("parseReference", () => {
  it("interpreta capítulo, versículo e intervalo", () => {
    expect(parseReference("João 3:16")).toMatchObject({ chapter: 3, verseStart: 16, verseEnd: null });
    expect(parseReference("Jo 3.16-18")).toMatchObject({ chapter: 3, verseStart: 16, verseEnd: 18 });
    expect(parseReference("Sl 23")).toMatchObject({ chapter: 23, verseStart: null });
    expect(parseReference("1 Coríntios 13")?.book.nr).toBe(46);
    expect(parseReference("1Co 13:4-7")?.book.nr).toBe(46);
  });
  it("rejeita livro/capítulo inexistentes e entradas malformadas", () => {
    for (const bad of ["", "João", "João 22", "Salmos 151", "Foo 1", "João 3:0", "João 3:9-2", "<script>1", "João 3:16:2"]) expect(parseReference(bad)).toBeNull();
  });
});

describe("cliente da Bíblia", () => {
  const payload = (over: Record<string, unknown> = {}) => ({ book_nr: 43, chapter: 3, verses: [{ chapter: 3, verse: 1, text: "  um   texto \n qualquer " }, { chapter: 3, verse: 2, text: "outro" }], ...over });
  const reply = (body: unknown, status = 200) => vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify(body), { status }));

  it("traduz só ids da allowlist", () => {
    expect(parseTranslation("almeida")).toBe("almeida");
    expect(parseTranslation("../../x")).toBe("livre");
    expect(parseTranslation(undefined)).toBe("livre");
  });
  it("busca na URL esperada e normaliza espaços", async () => {
    if (joao === undefined) throw new Error("livro ausente");
    const fetchMock = reply(payload());
    const chapter = await fetchChapter("livre", joao, 3, fetchMock);
    expect(fetchMock.mock.calls[0]?.[0]).toBe("https://api.getbible.net/v2/livre/43/3.json");
    expect(chapter.verses[0]).toEqual({ number: 1, text: "um texto qualquer" });
  });
  it("rejeita capítulo fora do intervalo sem chamar a rede", async () => {
    if (joao === undefined) throw new Error("livro ausente");
    const fetchMock = reply(payload());
    await expect(fetchChapter("livre", joao, 22, fetchMock)).rejects.toBeInstanceOf(BibleUnavailableError);
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("trata HTTP de erro, JSON inválido, rede e resposta de outro capítulo", async () => {
    if (joao === undefined) throw new Error("livro ausente");
    await expect(fetchChapter("livre", joao, 3, reply({}, 503))).rejects.toBeInstanceOf(BibleUnavailableError);
    await expect(fetchChapter("livre", joao, 3, vi.fn<typeof fetch>().mockResolvedValue(new Response("não é json")))).rejects.toBeInstanceOf(BibleUnavailableError);
    await expect(fetchChapter("livre", joao, 3, vi.fn<typeof fetch>().mockRejectedValue(new Error("rede")))).rejects.toBeInstanceOf(BibleUnavailableError);
    await expect(fetchChapter("livre", joao, 3, reply(payload({ chapter: 4 })))).rejects.toBeInstanceOf(BibleUnavailableError);
    await expect(fetchChapter("livre", joao, 3, reply(payload({ verses: [] })))).rejects.toBeInstanceOf(BibleUnavailableError);
  });
});
