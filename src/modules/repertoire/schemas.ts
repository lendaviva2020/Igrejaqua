import { z } from "zod";

export const KEY_PATTERN = /^[A-G][#b]?m?$/;
export const MUSICAL_KEYS = ["C","C#","Db","D","Eb","E","F","F#","Gb","G","Ab","A","Bb","B","Cm","C#m","Dm","Ebm","Em","Fm","F#m","Gm","G#m","Am","Bbm","Bm"] as const;

export const CreateSongSchema = z
  .object({
    title: z.string().trim().min(1, "Informe o título").max(200),
    artist: z.string().trim().max(200).optional(),
    originalKey: z.string().regex(KEY_PATTERN, "Tonalidade inválida"),
    chordpro: z.string().max(65536, "Cifra grande demais (máx. 64 KB)"),
    // Campo opcional: vazio chega do formulário como "" e não pode virar 0 (reprovaria o mínimo).
    bpm: z.preprocess((v) => (v === "" || v === null ? undefined : v), z.coerce.number().int("Use um número inteiro de BPM").min(30, "BPM entre 30 e 300").max(300, "BPM entre 30 e 300").optional()),
  })
  .strict();
export type CreateSongInput = z.infer<typeof CreateSongSchema>;

export const SongRowSchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  artist: z.string().nullable(),
  default_key: z.string().nullable(),
});
export const VersionRowSchema = z.object({
  id: z.string().uuid(),
  song_id: z.string().uuid(),
  label: z.string(),
  original_key: z.string(),
  chordpro: z.string(),
  bpm: z.number().nullable(),
  capo: z.number().nullable(),
  songs: z.object({ title: z.string(), artist: z.string().nullable(), copyright_notice: z.string().nullable() }),
});
export type SongRow = z.infer<typeof SongRowSchema>;
export type VersionRow = z.infer<typeof VersionRowSchema>;
