import type { Metadata } from "next";
import { ContactLine, LegalPage } from "@/components/marketing/legal-page";
import { formatLegalDate, LEGAL_UPDATED_AT } from "@/lib/seo/content-dates";

const DESCRIPTION = "Condições de uso do IGREJAQUA: o que é o sistema, responsabilidades da igreja e de cada usuário.";
export const metadata: Metadata = { title: "Termos de Uso", description: DESCRIPTION, alternates: { canonical: "/termos" }, openGraph: { url: "/termos", title: "Termos de Uso · IGREJAQUA", description: DESCRIPTION } };

export default function TermsPage() {
  return (
    <LegalPage title="Termos de Uso" updated={formatLegalDate(LEGAL_UPDATED_AT.termos)}>
      <p>Ao criar uma conta ou entrar no IGREJAQUA você concorda com estes termos. Se não concordar, não use o sistema.</p>

      <h2>O que é o IGREJAQUA</h2>
      <p>Um sistema de gestão para igrejas: ministérios, escalas, repertório, eventos, comunicados, pedidos de oração e, quando ativado, contribuições por Pix.</p>

      <h2>Sua conta</h2>
      <ul>
        <li>Informe dados verdadeiros e mantenha sua senha em sigilo.</li>
        <li>Você é responsável pelo que for feito com a sua conta. Avise a liderança se suspeitar de uso indevido.</li>
        <li>O acesso a cada área depende do seu papel na igreja. A administração pode alterar papéis ou suspender acessos.</li>
      </ul>

      <h2>Uso adequado</h2>
      <ul>
        <li>Não tente acessar dados de outras pessoas ou de outras igrejas, nem contornar as regras de acesso.</li>
        <li>Não publique conteúdo ilegal, ofensivo ou que exponha terceiros sem autorização. Pedidos de oração com dados de saúde de outras pessoas exigem a autorização delas.</li>
        <li>Não use o sistema para spam, fraude ou para sobrecarregar o serviço.</li>
      </ul>

      <h2>Conteúdo e músicas</h2>
      <p>Letras e cifras cadastradas continuam sujeitas aos direitos de seus autores. Cabe à igreja garantir que tem licença para o uso que fizer delas.</p>

      <h2>Contribuições</h2>
      <p>Contribuições por Pix são feitas à igreja, não ao IGREJAQUA. O pagamento é processado pelo Mercado Pago e só é confirmado depois do retorno dele. Pedidos de estorno devem ser feitos à igreja.</p>

      <h2>Disponibilidade e alterações</h2>
      <p>Trabalhamos para manter o sistema disponível, mas ele pode ficar fora do ar para manutenção ou por falhas de terceiros. Podemos alterar funcionalidades e estes termos, avisando no sistema quando a mudança for relevante.</p>

      <h2>Encerramento</h2>
      <p>Você pode parar de usar o sistema a qualquer momento. O acesso pode ser suspenso em caso de descumprimento destes termos.</p>

      <h2>Privacidade e contato</h2>
      <p>O tratamento de dados é descrito na <a href="/privacidade">Política de Privacidade</a>.</p>
      <ContactLine />
    </LegalPage>
  );
}
