/**
 * Busca da cifra fora do app (nova aba), com música e artista ATUAIS do formulário.
 * Não há provedor licenciado de cifras configurado: a pessoa abre o resultado, copia a cifra e
 * volta para "Colar e converter". Nenhuma raspagem de buscador ou de site de cifras é feita.
 */
export function chordSearchUrl(title: string, artist: string): string {
  const terms = ["cifra", title.trim(), artist.trim()].filter((t) => t !== "").join(" ");
  return `https://www.google.com/search?q=${encodeURIComponent(terms)}`;
}
