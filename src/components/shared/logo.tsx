import Image from "next/image";
import { cn } from "@/lib/utils/cn";

/** Proporção do emblema (cruz + Bíblia + arco), em public/brand/emblema.webp (512×310). */
const EMBLEM_RATIO = 512 / 310;
/** Proporção da logo completa (emblema + nome + "Adorar • Conectar • Servir"), em public/brand/logo.webp (960×757). */
const FULL_RATIO = 960 / 757;

/** Emblema IGREJAQUA. `size` é a altura em px; a largura acompanha a proporção da arte. */
export function Logo({ size = 32, className, decorative = false }: { size?: number; className?: string; decorative?: boolean }) {
  return (
    <Image
      src="/brand/emblema.webp"
      width={Math.round(size * EMBLEM_RATIO)}
      height={size}
      alt={decorative ? "" : "IGREJAQUA"}
      className={cn("shrink-0 select-none", className)}
      unoptimized
      priority
    />
  );
}

/** Nome da marca: "IGREJA" na cor do texto e "QUA" em âmbar, como na logo. */
export function BrandName({ className }: { className?: string }) {
  return <span className={cn("font-bold tracking-wide text-texto", className)}>IGREJA<span className="text-ambar">QUA</span></span>;
}

/** Logo completa com o lema. `width` em px. */
export function LogoFull({ width = 240, className }: { width?: number; className?: string }) {
  return (
    <Image
      src="/brand/logo.webp"
      width={width}
      height={Math.round(width / FULL_RATIO)}
      alt="IGREJAQUA — Adorar, Conectar, Servir"
      className={cn("select-none", className)}
      unoptimized
      priority
    />
  );
}
