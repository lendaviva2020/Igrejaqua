export interface BibleBook {
  readonly nr: number;
  readonly slug: string;
  readonly name: string;
  readonly abbreviation: string;
  readonly chapters: number;
  readonly testament: "AT" | "NT";
}

const RAW: readonly (readonly [string, string, number])[] = [
  ["Gênesis", "Gn", 50], ["Êxodo", "Êx", 40], ["Levítico", "Lv", 27], ["Números", "Nm", 36], ["Deuteronômio", "Dt", 34], ["Josué", "Js", 24], ["Juízes", "Jz", 21], ["Rute", "Rt", 4],
  ["1 Samuel", "1Sm", 31], ["2 Samuel", "2Sm", 24], ["1 Reis", "1Rs", 22], ["2 Reis", "2Rs", 25], ["1 Crônicas", "1Cr", 29], ["2 Crônicas", "2Cr", 36], ["Esdras", "Ed", 10], ["Neemias", "Ne", 13],
  ["Ester", "Et", 10], ["Jó", "Jó", 42], ["Salmos", "Sl", 150], ["Provérbios", "Pv", 31], ["Eclesiastes", "Ec", 12], ["Cântico dos Cânticos", "Ct", 8], ["Isaías", "Is", 66], ["Jeremias", "Jr", 52],
  ["Lamentações", "Lm", 5], ["Ezequiel", "Ez", 48], ["Daniel", "Dn", 12], ["Oseias", "Os", 14], ["Joel", "Jl", 3], ["Amós", "Am", 9], ["Obadias", "Ob", 1], ["Jonas", "Jn", 4],
  ["Miquéias", "Mq", 7], ["Naum", "Na", 3], ["Habacuque", "Hc", 3], ["Sofonias", "Sf", 3], ["Ageu", "Ag", 2], ["Zacarias", "Zc", 14], ["Malaquias", "Ml", 4],
  ["Mateus", "Mt", 28], ["Marcos", "Mc", 16], ["Lucas", "Lc", 24], ["João", "Jo", 21], ["Atos", "At", 28], ["Romanos", "Rm", 16], ["1 Coríntios", "1Co", 16], ["2 Coríntios", "2Co", 13],
  ["Gálatas", "Gl", 6], ["Efésios", "Ef", 6], ["Filipenses", "Fp", 4], ["Colossenses", "Cl", 4], ["1 Tessalonicenses", "1Ts", 5], ["2 Tessalonicenses", "2Ts", 3], ["1 Timóteo", "1Tm", 6], ["2 Timóteo", "2Tm", 4],
  ["Tito", "Tt", 3], ["Filemom", "Fm", 1], ["Hebreus", "Hb", 13], ["Tiago", "Tg", 5], ["1 Pedro", "1Pe", 5], ["2 Pedro", "2Pe", 3], ["1 João", "1Jo", 5], ["2 João", "2Jo", 1], ["3 João", "3Jo", 1], ["Judas", "Jd", 1], ["Apocalipse", "Ap", 22],
];

/** Remove acentos, caixa e separadores: "1 João" → "1joao". */
export function normalizeKey(value: string): string {
  return value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

export const BIBLE_BOOKS: readonly BibleBook[] = RAW.map(([name, abbreviation, chapters], index) => ({
  nr: index + 1,
  slug: normalizeKey(name).replace(/^(\d)/, "$1-"),
  name,
  abbreviation,
  chapters,
  testament: index < 39 ? "AT" : "NT",
}));

const BY_SLUG = new Map(BIBLE_BOOKS.map((b) => [b.slug, b]));
const BY_KEY = new Map<string, BibleBook>();
for (const book of BIBLE_BOOKS) {
  BY_KEY.set(normalizeKey(book.name), book);
  BY_KEY.set(normalizeKey(book.abbreviation), book);
}

export const findBookBySlug = (slug: string): BibleBook | undefined => BY_SLUG.get(slug);
export const findBookByName = (name: string): BibleBook | undefined => BY_KEY.get(normalizeKey(name));
