import { AudioLines, Bell, CalendarDays, Guitar, Heart, Mic2 } from "lucide-react";
import { Logo } from "@/components/shared/logo";

/** Ilustrações da interface. Não exibem nomes, números, datas nem letras: o que aparece no sistema é o que a igreja cadastra. */

const MENU = ["Visão geral", "Membros", "Ministérios", "Agenda", "Escalas", "Repertório", "Comunidade"] as const;
const TILES = ["Membros", "Ministérios", "Eventos"] as const;

function Bar({ w, tone = "bg-filete" }: { w: string; tone?: string }) {
  return <span className={`block h-2 rounded-full ${tone}`} style={{ width: w }} />;
}

export function DashboardPreview({ churchName }: { churchName: string }) {
  return (
    <figure className="relative mx-auto w-full max-w-[590px]" aria-label="Ilustração do painel do IGREJAQUA">
      <div aria-hidden="true" className="absolute -inset-5 rounded-[34px] bg-ouro-claro/20 blur-2xl" />
      <div aria-hidden="true" className="relative overflow-hidden rounded-[22px] border border-filete bg-white shadow-[0_28px_80px_rgba(23,43,77,0.13)]">
        <div className="flex items-center justify-between border-b border-filete px-5 py-4">
          <div className="flex items-center gap-2.5">
            <span className="flex size-8 items-center justify-center rounded-lg bg-tinta text-ouro-claro"><Logo size={18} /></span>
            <div>
              <p className="text-xs font-semibold text-tinta">{churchName}</p>
              <p className="text-[10px] text-tinta-4">Painel de organização</p>
            </div>
          </div>
          <span className="relative text-tinta-4"><Bell size={17} /><span className="absolute -right-1 -top-1 size-2 rounded-full border-2 border-white bg-ouro" /></span>
        </div>
        <div className="grid grid-cols-[112px_1fr] sm:grid-cols-[138px_1fr]">
          <div className="min-h-[340px] border-r border-filete bg-papel p-3">
            <p className="mb-3 px-2 pt-2 text-[10px] font-semibold uppercase tracking-[1.5px] text-tinta-4">Menu</p>
            {MENU.map((label, i) => (
              <div key={label} className={`mb-1 flex items-center gap-2 rounded-lg px-2 py-2.5 text-[10px] ${i === 0 ? "bg-tinta font-semibold text-white" : "text-tinta-4"}`}>
                <span className={`size-1.5 rounded-full ${i === 0 ? "bg-ouro-claro" : "bg-filete"}`} />{label}
              </div>
            ))}
          </div>
          <div className="min-w-0 p-4 sm:p-5">
            <h3 className="font-display text-[17px] font-bold text-tinta sm:text-[19px]">Bom dia, equipe!</h3>
            <p className="mt-1 text-[10px] text-tinta-4">Veja o que está acontecendo na sua igreja.</p>
            <div className="mt-5 grid grid-cols-3 gap-2">
              {TILES.map((label) => (
                <div key={label} className="rounded-xl border border-filete p-2.5 sm:p-3">
                  <p className="text-[17px] font-semibold text-tinta">—</p>
                  <p className="mt-0.5 text-[10px] text-tinta-4">{label}</p>
                </div>
              ))}
            </div>
            <div className="mt-5 flex items-center gap-1.5 text-[11px] font-semibold text-tinta"><CalendarDays size={13} />Próximos compromissos</div>
            <div className="mt-2 space-y-2">
              {["62%", "48%"].map((w) => (
                <div key={w} className="flex items-center gap-3 rounded-xl border border-filete p-3">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-papel-2" />
                  <div className="flex-1 space-y-2"><Bar w={w} tone="bg-tinta/20" /><Bar w="36%" /></div>
                </div>
              ))}
            </div>
            <div className="mt-4 rounded-xl bg-tinta p-3.5 text-white">
              <div className="flex items-center justify-between"><p className="text-[10px] font-medium text-white/75">Uma igreja, muitos dons.</p><Heart size={14} className="text-ouro-claro" /></div>
              <p className="mt-1 text-[12px] font-semibold">Cada pessoa faz parte da missão.</p>
            </div>
          </div>
        </div>
      </div>
      <figcaption className="mt-3 text-center text-xs text-tinta-4">Ilustração da interface. Os dados exibidos no sistema são os que a sua igreja cadastra.</figcaption>
    </figure>
  );
}

export function StagePreview() {
  return (
    <figure className="relative" aria-label="Ilustração do Modo Palco">
      <div aria-hidden="true" className="absolute -inset-8 rounded-full bg-ouro-claro/10 blur-3xl" />
      <div aria-hidden="true" className="relative overflow-hidden rounded-2xl border border-white/10 bg-palco p-5 shadow-2xl sm:p-7">
        <div className="flex items-center justify-between border-b border-white/10 pb-5">
          <div><p className="text-[11px] font-semibold uppercase tracking-[2px] text-ouro-claro">Modo Palco</p><div className="mt-2 h-2.5 w-36 rounded-full bg-white/20" /></div>
          <span className="rounded-md border border-white/10 px-3 py-1.5 text-[10px] text-white/70">SETLIST</span>
        </div>
        <div className="mt-6 flex items-center justify-between">
          <div>
            <p className="text-[11px] text-white/60">MÚSICA · TOM ESCOLHIDO</p>
            <div className="mt-3 h-4 w-48 rounded-full bg-white/25 sm:w-64" />
            <p className="mt-3 text-[12px] text-ouro-claro">Tom: G</p>
          </div>
          <div className="flex size-12 items-center justify-center rounded-full border border-ouro-claro/40 text-ouro-claro"><AudioLines size={23} /></div>
        </div>
        <div className="mt-8 rounded-xl bg-tinta p-5 sm:p-7">
          <p className="text-[11px] text-white/60">ACORDES EM CIMA DA LETRA</p>
          <div className="mt-5 grid grid-cols-2 gap-x-5 gap-y-7 sm:grid-cols-3">
            {["G", "D/F#", "Em", "C", "G", "D"].map((chord, i) => (
              <div key={`${chord}-${i}`}><p className="font-mono text-[18px] font-medium text-ouro-claro">{chord}</p><div className="mt-2 space-y-1.5"><div className="h-1.5 w-full rounded-full bg-white/20" /><div className="h-1.5 w-2/3 rounded-full bg-white/10" /></div></div>
            ))}
          </div>
        </div>
        <div className="mt-5 flex items-center justify-between text-[11px]">
          <span className="flex items-center gap-2 text-white/60"><Guitar size={13} />Repertório da equipe</span>
          <span className="flex items-center gap-2 text-ouro-claro"><Mic2 size={13} />Leitura de palco</span>
        </div>
      </div>
      <figcaption className="sr-only">Ilustração do Modo Palco: acordes sobre a letra, em fundo escuro.</figcaption>
    </figure>
  );
}
