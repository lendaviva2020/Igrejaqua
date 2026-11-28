import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
import { isPublicAddress } from "@/modules/repertoire/import/address-guard";
import { convertChordSheet, isChordLine, isChordToken, normalizeKey } from "@/modules/repertoire/import/chord-sheet";
import { decodeEntities, extractSongFromHtml, extractSongFromText } from "@/modules/repertoire/import/extract";
import { parseChordPro } from "@/lib/chords/chordpro";

/** Página sintética com a estrutura usual dos sites de cifra brasileiros (texto neutro, sem letra real). */
const CIFRA_PAGE = `<!doctype html><html lang="pt-BR"><head>
<meta charset="utf-8">
<title>Canção de Teste - Banda Exemplo - Cifra Club</title>
<meta property="og:title" content="Can&ccedil;&atilde;o de Teste - Banda Exemplo - Cifra Club">
<script>var tom = "Z"; window.x = "tom: A";</script>
</head><body>
<h1 class="t1">Canção de Teste</h1><h2 class="t3"><a href="/banda-exemplo/">Banda Exemplo</a></h2>
<div class="cifra_cnt">
<span id="cifra_tom">tom: <a class="js-modal-trigger" title="alterar o tom da cifra">G</a></span>
<span id="cifra_capo">Capotraste na 2ª casa</span>
<button>meio tom acima</button>
<pre>[Intro] <b>G</b>  <b>D/F#</b>  <b>Em7</b>  <b>C9</b>

<span class="tablatura">E|-------3-----|
B|---3-------3-|</span>

[Primeira Parte]
<b>G</b>           <b>D/F#</b>
  Primeira linha de teste
<b>Em7</b>              <b>C9</b>
  Segunda linha de teste

[Refrão]
      <b>C</b>        <b>G</b>     <b>D</b>
E agora o refrão de teste
<b>G</b>  <b>D</b>  (2x)
</pre>
<pre>texto qualquer sem acordes</pre>
</div></body></html>`;

describe("detecção de acordes", () => {
  it("reconhece acordes comuns das cifras brasileiras", () => {
    for (const c of ["G", "F#m", "C7M", "Bb/D", "E7(9)", "A4", "Dº", "G#m7(b5)", "C9", "Am7", "D/F#", "Gsus4", "Cadd9", "(G)"]) expect(isChordToken(c), c).toBe(true);
    for (const w of ["Eu", "Amor", "Deus", "Cada", "Bem", "Fé"]) expect(isChordToken(w), w).toBe(false);
  });

  it("linha de acordes exige que tudo seja acorde ou marca de repetição", () => {
    expect(isChordLine("G   D/F#   Em7  C9")).toBe(true);
    expect(isChordLine("G  D  (2x)")).toBe(true);
    expect(isChordLine("| G | D |")).toBe(true);
    expect(isChordLine("Em tudo eu confio")).toBe(false);
    expect(isChordLine("E agora o refrão")).toBe(false);
    expect(isChordLine("")).toBe(false);
  });
});

describe("conversão para ChordPro", () => {
  it("encaixa cada acorde na coluna da letra e converte seções em comentário", () => {
    const r = convertChordSheet("[Primeira Parte]\nG           D/F#\n  Primeira linha de teste\n\n[Refrão]\n      C        G\nE agora o refrão");
    expect(r.chordpro).toBe("{comment: Primeira Parte}\n[G]  Primeira l[D/F#]inha de teste\n\n{comment: Refrão}\nE agor[C]a o refrã[G]o");
    expect(r.firstChord).toBe("G");
    expect(() => parseChordPro(r.chordpro)).not.toThrow();
  });

  it("acordes depois do fim da letra não se perdem; linha só de acordes vira [G] [D]", () => {
    expect(convertChordSheet("G            D\nCurta").chordpro).toBe("[G]Curta        [D]");
    expect(convertChordSheet("[Intro] G  D  Em\n").chordpro).toBe("{comment: Intro}\n[G] [D] [Em]");
  });

  it("remove tablaturas e conta para avisar", () => {
    const r = convertChordSheet("E|-------3-----|\nB|---3-------3-|\nG  D\nTexto");
    expect(r.removedTabLines).toBe(2);
    expect(r.chordpro).toBe("[G]Tex[D]to");
  });

  it("texto que já está em ChordPro é mantido", () => {
    const src = "{start_of_chorus}\n[G]Linha de [D]teste\n{end_of_chorus}";
    expect(convertChordSheet(src).chordpro).toBe(src);
  });
});

describe("tom", () => {
  it("normaliza para os tons do formulário", () => {
    expect(normalizeKey("G")).toBe("G");
    expect(normalizeKey("F#m7")).toBe("F#m");
    expect(normalizeKey("A#")).toBe("Bb");
    expect(normalizeKey("D#m")).toBe("Ebm");
    expect(normalizeKey("C7M")).toBe("C");
    expect(normalizeKey("Cmaj7")).toBe("C");
    expect(normalizeKey("H")).toBeNull();
  });
});

describe("extração de página", () => {
  it("encontra título, artista, tom da página, capotraste e a cifra certa", () => {
    const song = extractSongFromHtml(CIFRA_PAGE);
    expect(song.title).toBe("Canção de Teste");
    expect(song.artist).toBe("Banda Exemplo");
    // "tom: G" do span visível; ignora "tom" dentro de <script> e "meio tom acima".
    expect(song.key).toBe("G");
    expect(song.capo).toBe(2);
    expect(song.warnings).toEqual(expect.arrayContaining(["tabs-removed", "capo"]));
    expect(song.warnings).not.toContain("key-estimated");
    expect(song.chordpro).toContain("{comment: Capotraste na 2ª casa}");
    expect(song.chordpro).toContain("[G]  Primeira");
    expect(song.chordpro).not.toContain("<b>");
    expect(song.chordpro).not.toContain("E|---");
    expect(() => parseChordPro(song.chordpro)).not.toThrow();
  });

  it("sem tom na página, estima pelo primeiro acorde e avisa", () => {
    const song = extractSongFromHtml("<html><head><title>Outra Música | Artista Teste</title></head><body><pre>Am     F\nLinha um\nC      G\nLinha dois</pre></body></html>");
    expect(song.title).toBe("Outra Música");
    expect(song.artist).toBe("Artista Teste");
    expect(song.key).toBe("Am");
    expect(song.warnings).toContain("key-estimated");
  });

  it("usa dados estruturados schema.org quando existem", () => {
    const html = `<html><head><script type="application/ld+json">{"@context":"https://schema.org","@type":"MusicComposition","name":"Título LD","composer":{"@type":"Person","name":"Compositor LD"}}</script><meta property="og:title" content="Outro - Nome - Site"></head><body></body></html>`;
    const song = extractSongFromHtml(html);
    expect(song.title).toBe("Título LD");
    expect(song.artist).toBe("Compositor LD");
    expect(song.warnings).toEqual(expect.arrayContaining(["no-chords", "key-missing"]));
  });

  it("arquivo ChordPro: lê título, artista e tom das diretivas", () => {
    const song = extractSongFromText("{title: Hino Teste}\n{artist: Autor Teste}\n{key: D}\n[D]Linha [A]um");
    expect(song).toMatchObject({ title: "Hino Teste", artist: "Autor Teste", key: "D", chordpro: "[D]Linha [A]um" });
  });

  it("decodifica entidades HTML", () => {
    expect(decodeEntities("Can&ccedil;&atilde;o &amp; F&#233; &#x2014;")).toBe("Canção & Fé —");
  });
});

describe("proteção contra SSRF", () => {
  it("bloqueia rede interna, loopback, metadados de nuvem e IPv4 embutido", () => {
    for (const ip of ["127.0.0.1", "10.1.2.3", "172.16.0.1", "192.168.0.10", "169.254.169.254", "100.64.0.1", "0.0.0.0", "224.0.0.1", "::1", "::", "fe80::1", "fc00::1", "fd12::1", "::ffff:127.0.0.1", "::ffff:10.0.0.1", "64:ff9b::a00:1", "2001:db8::1", "nao-e-ip"]) {
      expect(isPublicAddress(ip), ip).toBe(false);
    }
  });

  it("aceita endereços públicos", () => {
    for (const ip of ["8.8.8.8", "1.1.1.1", "151.101.1.69", "2606:4700:4700::1111", "::ffff:8.8.8.8"]) expect(isPublicAddress(ip), ip).toBe(true);
  });
});

describe("validação do link antes de qualquer conexão", async () => {
  const { parseImportUrl, fetchPublicPage, PageFetchError } = await import("@/modules/repertoire/import/safe-fetch");
  it("aceita só https público na porta padrão", () => {
    expect(parseImportUrl(" https://www.exemplo.com.br/musica/#cifra ").toString()).toBe("https://www.exemplo.com.br/musica/");
    for (const bad of ["http://exemplo.com", "ftp://exemplo.com/x", "https://user:senha@exemplo.com/", "https://exemplo.com:8443/", "javascript:alert(1)", "nao e link"]) {
      expect(() => parseImportUrl(bad), bad).toThrow(PageFetchError);
    }
  });

  it("recusa rede interna por IP literal ou nome local, sem abrir conexão", async () => {
    for (const bad of ["https://127.0.0.1/", "https://[::1]/", "https://169.254.169.254/latest/meta-data", "https://10.0.0.5/", "https://localhost/", "https://intranet/", "https://servidor.internal/"]) {
      await expect(fetchPublicPage(bad), bad).rejects.toMatchObject({ reason: "blocked-address" });
    }
  });
});

describe("cifra colada", async () => {
  const { extractSongFromPaste } = await import("@/modules/repertoire/import/extract");
  it("aproveita título, artista e tom do cabeçalho copiado e converte a cifra", () => {
    const song = extractSongFromPaste("Canção de Teste\nBanda Exemplo\nTom: D\n\n[Intro] D  A\n\n[Primeira Parte]\nD          A\nLinha de teste um\n");
    expect(song.title).toBe("Canção de Teste");
    expect(song.artist).toBe("Banda Exemplo");
    expect(song.key).toBe("D");
    expect(song.warnings).not.toContain("key-estimated");
    expect(song.chordpro).toBe("{comment: Intro}\n[D] [A]\n\n{comment: Primeira Parte}\n[D]Linha de te[A]ste um");
    expect(() => parseChordPro(song.chordpro)).not.toThrow();
  });

  it("só a cifra, sem cabeçalho: estima o tom e não inventa título", () => {
    const song = extractSongFromPaste("Em       C\nLinha um\nG        D\nLinha dois");
    expect(song.title).toBeNull();
    expect(song.key).toBe("Em");
    expect(song.warnings).toContain("key-estimated");
  });
});

describe("formulário de música", async () => {
  const { CreateSongSchema } = await import("@/modules/repertoire/schemas");
  it("BPM vazio é aceito (opcional) e fora da faixa tem mensagem em português", () => {
    expect(CreateSongSchema.safeParse({ title: "T", originalKey: "G", chordpro: "", bpm: "" }).success).toBe(true);
    expect(CreateSongSchema.parse({ title: "T", originalKey: "G", chordpro: "", bpm: "72" }).bpm).toBe(72);
    const bad = CreateSongSchema.safeParse({ title: "T", originalKey: "G", chordpro: "", bpm: "5" });
    expect(bad.success).toBe(false);
    expect(bad.error?.issues[0]?.message).toBe("BPM entre 30 e 300");
  });
});

describe("YouTube", async () => {
  const { youTubeVideoId, splitVideoTitle, youTubeOEmbedUrl, cleanChannelName } = await import("@/modules/repertoire/import/youtube");
  const ID = "dQw4w9WgXcQ";
  it("reconhece todos os formatos de link de vídeo", () => {
    for (const url of [`https://www.youtube.com/watch?v=${ID}`, `https://youtube.com/watch?v=${ID}&list=PL1&t=30s`, `https://m.youtube.com/watch?v=${ID}`, `https://music.youtube.com/watch?v=${ID}&si=abc`, `https://youtu.be/${ID}?si=xyz`, `https://www.youtube.com/shorts/${ID}`, `https://www.youtube.com/live/${ID}`, `https://www.youtube.com/embed/${ID}`]) {
      expect(youTubeVideoId(url), url).toBe(ID);
    }
    for (const url of ["https://www.youtube.com/@canal", "https://www.youtube.com/watch?v=curto", "https://youtube.com.golpe.com/watch?v=dQw4w9WgXcQ", "https://www.cifraclub.com.br/x/", "nao e link"]) {
      expect(youTubeVideoId(url), url).toBeNull();
    }
    expect(youTubeOEmbedUrl(ID)).toBe("https://www.youtube.com/oembed?format=json&url=https%3A%2F%2Fwww.youtube.com%2Fwatch%3Fv%3DdQw4w9WgXcQ");
  });

  it("separa música e artista nos padrões de título dos canais", () => {
    expect(splitVideoTitle("Aline Barros - Ressuscita-me (Ao Vivo)", "Aline Barros")).toEqual({ title: "Ressuscita-me", artist: "Aline Barros" });
    expect(splitVideoTitle("Galileu | Fernandinho (Clipe Oficial)", "Fernandinho")).toEqual({ title: "Galileu", artist: "Fernandinho" });
    expect(splitVideoTitle("Fernandinho - Galileu [Clipe Oficial] #gospel #louvor", "Fernandinho Oficial")).toEqual({ title: "Galileu", artist: "Fernandinho" });
    expect(splitVideoTitle("Ressuscita-me - Aline Barros | DVD Extraordinário Amor de Deus", "Aline Barros")).toEqual({ title: "Ressuscita-me", artist: "Aline Barros" });
    // Canal automático do YouTube Music: título é só a música.
    expect(splitVideoTitle("Ressuscita-me", "Aline Barros - Topic")).toEqual({ title: "Ressuscita-me", artist: "Aline Barros" });
    // Sem pista do canal: convenção "Artista - Música".
    expect(splitVideoTitle("Banda X - Canção Y (Lyric Video)", "Gravadora Z")).toEqual({ title: "Canção Y", artist: "Banda X" });
    expect(cleanChannelName("ArtistaVEVO")).toBe("Artista");
  });
});

describe("link de referência no formulário", async () => {
  const { CreateSongSchema } = await import("@/modules/repertoire/schemas");
  it("opcional, só https e até 500 caracteres", () => {
    const base = { title: "T", originalKey: "G", chordpro: "" };
    expect(CreateSongSchema.safeParse({ ...base, referenceUrl: "" }).success).toBe(true);
    expect(CreateSongSchema.parse({ ...base, referenceUrl: " https://youtu.be/dQw4w9WgXcQ " }).referenceUrl).toBe("https://youtu.be/dQw4w9WgXcQ");
    for (const bad of ["http://youtu.be/x", "javascript:alert(1)", "youtube.com/watch", `https://a.com/${"a".repeat(600)}`]) {
      expect(CreateSongSchema.safeParse({ ...base, referenceUrl: bad }).success, bad).toBe(false);
    }
  });
});

describe("Spotify", async () => {
  const { parseSpotifyLink, readSpotifyTrackPage, spotifyOEmbedUrl, findSpotifyTrackId } = await import("@/modules/repertoire/import/spotify");
  const ID = "4cOdK2wGLETKBW3PvgPWqT";
  it("reconhece links e URIs de faixa; recusa álbum, playlist e artista", () => {
    for (const url of [`https://open.spotify.com/track/${ID}`, `https://open.spotify.com/track/${ID}?si=abc123`, `https://open.spotify.com/intl-pt/track/${ID}`, `https://open.spotify.com/intl-pt-br/track/${ID}?si=x`, `spotify:track:${ID}`]) {
      expect(parseSpotifyLink(url), url).toEqual({ kind: "track", id: ID });
    }
    for (const url of ["https://open.spotify.com/album/6N9PS4QXF1D0OWPk0Sxtb4", "https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M", "https://open.spotify.com/artist/0gxyHStUsqpMadRV0Di1Qt", "spotify:album:6N9PS4QXF1D0OWPk0Sxtb4"]) {
      expect(parseSpotifyLink(url), url).toEqual({ kind: "not-a-track" });
    }
    expect(parseSpotifyLink("https://spotify.link/AbCdEf")).toEqual({ kind: "short-link" });
    for (const url of ["https://open.spotify.com.golpe.com/track/x", "https://www.youtube.com/watch?v=dQw4w9WgXcQ"]) expect(parseSpotifyLink(url), url).toBeNull();
    expect(spotifyOEmbedUrl(ID)).toBe("https://open.spotify.com/oembed?url=https%3A%2F%2Fopen.spotify.com%2Ftrack%2F4cOdK2wGLETKBW3PvgPWqT");
    expect(findSpotifyTrackId(`<a href="https://open.spotify.com/track/${ID}?si=1">abrir</a>`)).toBe(ID);
  });

  it("lê música e artista das meta tags reais da página da faixa", () => {
    // Trecho real de open.spotify.com/track/4cOdK2wGLETKBW3PvgPWqT (2026-11-28).
    const real = `<meta property="og:title" content="Never Gonna Give You Up"/><meta property="og:description" content="Rick Astley · Whenever You Need Somebody · Song · 1987"/><meta name="music:musician_description" content="Rick Astley"/>`;
    expect(readSpotifyTrackPage(real, decodeEntities)).toEqual({ title: "Never Gonna Give You Up", artist: "Rick Astley" });
    // Sem o campo do artista, usa o 1º trecho da descrição; entidades são decodificadas.
    const semArtista = `<meta property="og:title" content="Can&ccedil;&atilde;o"/><meta property="og:description" content="Banda &amp; Coral · Álbum · Song · 2020"/>`;
    expect(readSpotifyTrackPage(semArtista, decodeEntities)).toEqual({ title: "Canção", artist: "Banda & Coral" });
  });
});
