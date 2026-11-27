import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/context";
import { JoinByLinkButton } from "./join-by-link-button";

export const metadata: Metadata = { title: "Entrar na igreja" };

/**
 * Destino do link geral da igreja. Quem não está logado é levado pelo proxy ao /login?next=/entrar/<código>
 * (e de lá ao cadastro, já como "membro"). O pedido só é feito ao clicar — abrir o link não altera nada.
 */
export default async function JoinByLinkPage({ params }: { params: Promise<{ codigo: string }> }) {
  const { codigo } = await params;
  if (!/^[A-Za-z0-9_-]{32,64}$/.test(codigo)) notFound();
  await requireUser();
  return (
    <section aria-labelledby="titulo" className="max-w-md">
      <h1 id="titulo" className="text-3xl">Você recebeu o link de uma igreja</h1>
      <p className="mt-2 text-texto-2">Peça para entrar. A administração da igreja confirma o seu pedido e, depois disso, você passa a ver escalas, comunicados e pedidos de oração.</p>
      <div className="mt-6"><JoinByLinkButton code={codigo} /></div>
      <p className="mt-8 text-sm"><Link className="text-texto-2 underline" href="/selecionar-igreja">Voltar para Sua igreja</Link></p>
    </section>
  );
}
