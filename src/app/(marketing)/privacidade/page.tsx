import type { Metadata } from "next";
import { ContactLine, LegalPage } from "@/components/marketing/legal-page";
import { formatLegalDate, LEGAL_UPDATED_AT } from "@/lib/seo/content-dates";

const DESCRIPTION = "Quais dados o IGREJAQUA trata, para quê, com quem compartilha e como exercer seus direitos pela LGPD.";
export const metadata: Metadata = { title: "Política de Privacidade", description: DESCRIPTION, alternates: { canonical: "/privacidade" }, openGraph: { url: "/privacidade", title: "Política de Privacidade · IGREJAQUA", description: DESCRIPTION } };

export default function PrivacyPage() {
  return (
    <LegalPage title="Política de Privacidade" updated={formatLegalDate(LEGAL_UPDATED_AT.privacidade)}>
      <p>Esta política explica quais dados o IGREJAQUA trata, para quê e quais são os seus direitos, conforme a Lei Geral de Proteção de Dados (Lei 13.709/2018, LGPD).</p>

      <h2>Quem é responsável pelos dados</h2>
      <p>A igreja que usa o sistema é a controladora dos dados dos seus membros e decide como eles são usados. O IGREJAQUA atua como operador: guarda e processa os dados em nome da igreja, seguindo as instruções dela.</p>

      <h2>Quais dados tratamos</h2>
      <ul>
        <li>Conta: nome, e-mail e senha (guardada somente em forma criptografada). Se você entrar com o Google, recebemos nome, e-mail e foto da sua conta Google, e nada além disso.</li>
        <li>Vínculo com a igreja: papel (administração, liderança ou membro), status e participação em ministérios.</li>
        <li>Serviço: escalas e confirmações, disponibilidade (o motivo é visível só para você e para quem tem permissão para vê-lo), repertório, eventos, comunicados e notificações.</li>
        <li>Pedidos de oração: o texto e, se você não escolher o anonimato, quem pediu. Em pedidos anônimos, o autor não é exibido a nenhum papel do sistema.</li>
        <li>Contribuições por Pix, quando ativadas: valor, finalidade e situação do pagamento. Os dados de pagamento em si são tratados pelo Mercado Pago.</li>
        <li>Segurança: registros de auditoria das alterações importantes e dados técnicos de acesso necessários para evitar abusos.</li>
      </ul>
      <p>Informações sobre vínculo religioso são dados pessoais sensíveis. Elas só são usadas para a gestão da igreja a que você pertence.</p>

      <h2>Para que usamos</h2>
      <p>Para criar e manter a sua conta, organizar escalas e eventos, enviar notificações do sistema, registrar contribuições e manter a segurança. Não vendemos dados e não usamos para publicidade.</p>

      <h2>Cookies e rastreamento</h2>
      <p>Usamos apenas cookies estritamente necessários: manter você conectado e lembrar qual igreja está aberta. Não há cookies de publicidade, pixels de redes sociais nem ferramentas de análise de terceiros. As fontes do site são servidas pelo próprio sistema, sem contato com servidores do Google.</p>
      <p>Para manter o sistema rápido, o navegador envia ao próprio IGREJAQUA medições anônimas de desempenho das páginas (tempos de carregamento e de resposta). Elas não usam cookies, não incluem nome, e-mail nem identificador da conta e não são compartilhadas com terceiros.</p>

      <h2>Com quem os dados são compartilhados</h2>
      <ul>
        <li>Provedor de banco de dados e autenticação (Supabase) e provedores de hospedagem, para o sistema funcionar.</li>
        <li>Mercado Pago, somente se a igreja ativar contribuições por Pix.</li>
        <li>Google, somente se você escolher entrar com a conta Google.</li>
        <li>Recursos de inteligência artificial ficam desligados por padrão; se a igreja os ativar, ela será informada de quais dados são enviados. A IA apenas sugere, e uma pessoa sempre revisa antes de publicar.</li>
      </ul>

      <h2>Por quanto tempo guardamos</h2>
      <p>Enquanto a sua conta e o vínculo com a igreja estiverem ativos. Depois, mantemos apenas o que a lei exigir, como registros de auditoria e de pagamentos.</p>

      <h2>Seus direitos</h2>
      <p>Você pode pedir confirmação do tratamento, acesso, correção, anonimização, portabilidade, eliminação, informação sobre compartilhamento e revogação de consentimento, nos termos do art. 18 da LGPD.</p>
      <ContactLine />
      <p>Você também pode reclamar à Autoridade Nacional de Proteção de Dados (ANPD).</p>

      <h2>Mudanças nesta política</h2>
      <p>Quando houver mudanças relevantes, a data de atualização acima será alterada e os usuários serão avisados no sistema.</p>
    </LegalPage>
  );
}
