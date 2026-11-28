"use client";

import { useRouter } from "next/navigation";
import { useId, useState, useTransition } from "react";
import { CheckCircle2, Landmark, Wallet } from "lucide-react";
import { FormField } from "@/components/shared/form-field";
import { Button } from "@/components/ui/button";
import { PIX_KEY_TYPE_LABEL, PIX_KEY_TYPES, type PixKeyType } from "@/lib/payments/pix-key";
import { disconnectMercadoPagoAction, removePixKeyAction, savePixKeyAction } from "@/modules/contributions/settings-actions";

export interface PaymentSetupView {
  readonly pixKey: { readonly type: PixKeyType; readonly maskedKey: string; readonly recipientName: string; readonly recipientCity: string } | null;
  readonly mercadoPago: { readonly mpUserId: string; readonly connectedAt: string; readonly liveMode: boolean } | null;
  readonly mercadoPagoAvailable: boolean;
}

const MP_STATUS: Readonly<Record<string, { readonly tone: "ok" | "erro"; readonly text: string }>> = {
  conectado: { tone: "ok", text: "Mercado Pago conectado. As próximas contribuições vão para a conta da igreja com confirmação automática." },
  cancelado: { tone: "erro", text: "A conexão foi cancelada no Mercado Pago. Nada mudou." },
  invalido: { tone: "erro", text: "A conexão expirou ou foi iniciada por outra pessoa. Tente conectar de novo." },
  erro: { tone: "erro", text: "O Mercado Pago não concluiu a conexão. Tente de novo em instantes." },
  indisponivel: { tone: "erro", text: "A conexão com Mercado Pago ainda não foi ativada no IGREJAQUA." },
  "sem-permissao": { tone: "erro", text: "Só a administração da igreja conecta o Mercado Pago." },
};

const KEY_PLACEHOLDER: Readonly<Record<PixKeyType, string>> = {
  cnpj: "00.000.000/0001-00", cpf: "000.000.000-00", email: "tesouraria@suaigreja.org", phone: "(11) 99999-9999", random: "0000aaaa-00aa-00aa-00aa-000000aaaaaa",
};

/**
 * Como a igreja recebe as contribuições. O dinheiro sempre cai na conta DA IGREJA: o IGREJAQUA só gera
 * o Pix. Mercado Pago conectado (automático) tem prioridade sobre a chave Pix (a tesouraria confirma).
 */
export function PaymentSettings({ setup, mpStatus }: { setup: PaymentSetupView; mpStatus: string | null }) {
  const router = useRouter();
  const id = useId();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Readonly<Record<string, readonly string[]>>>({});
  const [editing, setEditing] = useState(setup.pixKey === null);
  const [type, setType] = useState<PixKeyType>(setup.pixKey?.type ?? "cnpj");
  const [key, setKey] = useState("");
  const [name, setName] = useState(setup.pixKey?.recipientName ?? "");
  const [city, setCity] = useState(setup.pixKey?.recipientCity ?? "");
  const status = mpStatus === null ? undefined : MP_STATUS[mpStatus];
  const active = setup.mercadoPago !== null ? "mercadopago" : setup.pixKey !== null ? "pix_key" : "none";

  const save = (): void => {
    setError(null); setFieldErrors({});
    start(async () => {
      const r = await savePixKeyAction({ type, key, recipientName: name, recipientCity: city });
      if (r.ok) { setEditing(false); setKey(""); router.refresh(); }
      else { setError(r.error.message); setFieldErrors(r.error.fields ?? {}); }
    });
  };
  const run = (fn: () => Promise<{ ok: boolean; error?: { message: string } }>): void => {
    setError(null);
    start(async () => { const r = await fn(); if (r.ok) router.refresh(); else setError(r.error?.message ?? "Falha na operação."); });
  };

  return (
    <div className="flex max-w-2xl flex-col gap-5">
      <p className="text-texto-2">As ofertas e os dízimos vão <strong className="text-texto">direto para a conta da igreja</strong>. O IGREJAQUA só gera o Pix e nunca recebe nem guarda o dinheiro.</p>
      <p className="text-sm text-texto-2" aria-live="polite">
        Em uso agora: <strong className="text-texto">{active === "mercadopago" ? "Mercado Pago da igreja (confirmação automática)" : active === "pix_key" ? "Chave Pix da igreja (a tesouraria confirma)" : "nenhum: as contribuições online estão desligadas"}</strong>
      </p>
      {status !== undefined ? <p role="status" className={status.tone === "ok" ? "rounded-superficie border border-sucesso/60 bg-superficie p-3 text-sm text-sucesso" : "rounded-superficie border border-perigo/60 bg-superficie p-3 text-sm text-perigo"}>{status.text}</p> : null}

      <section aria-labelledby={`${id}-pix`} className="rounded-superficie border border-linha bg-superficie p-4 sm:p-5">
        <div className="flex items-start gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-controle bg-superficie-2 text-ambar"><Landmark aria-hidden="true" size={20} /></span>
          <div className="min-w-0">
            <h3 id={`${id}-pix`} className="font-sans text-base font-semibold">Chave Pix da igreja</h3>
            <p className="text-sm text-texto-2">Funciona com qualquer banco e não tem taxa. A tesouraria confere o extrato e confirma cada contribuição.</p>
          </div>
        </div>
        {!editing && setup.pixKey !== null ? (
          <div className="mt-4 flex flex-col gap-3">
            <dl className="grid gap-x-4 gap-y-1 text-sm sm:grid-cols-[auto_1fr]">
              <dt className="text-texto-2">Chave</dt><dd className="break-all font-semibold">{PIX_KEY_TYPE_LABEL[setup.pixKey.type]}: {setup.pixKey.maskedKey}</dd>
              <dt className="text-texto-2">Recebedor</dt><dd className="font-semibold">{setup.pixKey.recipientName} · {setup.pixKey.recipientCity}</dd>
            </dl>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="secondary" onClick={() => setEditing(true)}>Trocar chave</Button>
              <Button type="button" variant="secondary" disabled={pending} onClick={() => run(removePixKeyAction)}>Remover</Button>
            </div>
          </div>
        ) : (
          <form className="mt-4 flex flex-col gap-4" noValidate onSubmit={(e) => { e.preventDefault(); save(); }}>
            <label className="flex flex-col gap-1.5 text-sm font-medium">
              Tipo da chave
              <select value={type} onChange={(e) => setType(e.target.value as PixKeyType)} className="min-h-11 rounded-controle border border-borda bg-fundo px-3 text-texto">
                {PIX_KEY_TYPES.map((t) => <option key={t} value={t}>{PIX_KEY_TYPE_LABEL[t]}</option>)}
              </select>
            </label>
            <FormField label="Chave Pix" value={key} onChange={(e) => setKey(e.target.value)} placeholder={KEY_PLACEHOLDER[type]} autoComplete="off" spellCheck={false} error={fieldErrors["key"]?.[0]} hint="Use a chave da conta bancária da igreja (de preferência a do CNPJ)." />
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField label="Nome do recebedor" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} error={fieldErrors["recipientName"]?.[0]} hint="Como no banco. Até 25 letras, sem acento." />
              <FormField label="Cidade" value={city} onChange={(e) => setCity(e.target.value)} maxLength={60} error={fieldErrors["recipientCity"]?.[0]} hint="Até 15 letras." />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="submit" disabled={pending}>{pending ? "Salvando…" : "Salvar chave Pix"}</Button>
              {setup.pixKey !== null ? <Button type="button" variant="secondary" onClick={() => setEditing(false)}>Cancelar</Button> : null}
            </div>
            <p className="text-xs text-texto-2">Por segurança, toda troca de chave avisa todas as pessoas da administração.</p>
          </form>
        )}
      </section>

      <section aria-labelledby={`${id}-mp`} className="rounded-superficie border border-linha bg-superficie p-4 sm:p-5">
        <div className="flex items-start gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-controle bg-superficie-2 text-ambar"><Wallet aria-hidden="true" size={20} /></span>
          <div className="min-w-0">
            <h3 id={`${id}-mp`} className="font-sans text-base font-semibold">Mercado Pago da igreja <span className="font-normal text-texto-2">(opcional)</span></h3>
            <p className="text-sm text-texto-2">Confirma cada contribuição sozinho, sem conferir extrato. O dinheiro cai na conta Mercado Pago da igreja, com a taxa do Mercado Pago.</p>
          </div>
        </div>
        <div className="mt-4">
          {setup.mercadoPago !== null ? (
            <div className="flex flex-col gap-3">
              <p className="flex items-center gap-2 text-sm font-semibold text-sucesso"><CheckCircle2 aria-hidden="true" size={18} />Conectado à conta {setup.mercadoPago.mpUserId}{setup.mercadoPago.liveMode ? "" : " (modo de teste)"}</p>
              <div><Button type="button" variant="secondary" disabled={pending} onClick={() => run(disconnectMercadoPagoAction)}>Desconectar</Button></div>
              <p className="text-xs text-texto-2">Para revogar de vez o acesso, depois de desconectar entre no Mercado Pago da igreja em Seu perfil, Segurança, Aplicativos conectados.</p>
            </div>
          ) : setup.mercadoPagoAvailable ? (
            <a href="/api/payments/mercadopago/connect" className="inline-flex min-h-11 items-center rounded-full bg-ambar px-5 text-sm font-semibold text-sobre-ambar hover:bg-ambar-claro">Conectar Mercado Pago</a>
          ) : (
            <p className="text-sm text-texto-2">Ainda não disponível: o responsável técnico do IGREJAQUA precisa ativar a conexão com o Mercado Pago. Enquanto isso, use a chave Pix.</p>
          )}
        </div>
      </section>
      {error !== null ? <p role="alert" className="text-sm text-perigo">{error}</p> : null}
    </div>
  );
}
