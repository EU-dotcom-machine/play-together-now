import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "Política de Privacidade — Esportes Unidos" },
      { name: "description", content: "Política de Privacidade do Esportes Unidos em conformidade com a LGPD." },
      { property: "og:title", content: "Política de Privacidade — Esportes Unidos" },
      { property: "og:description", content: "Política de Privacidade do Esportes Unidos em conformidade com a LGPD." },
    ],
  }),
  component: PrivacyPage,
});

function PrivacyPage() {
  return (
    <main className="min-h-screen bg-paper px-5 py-10">
      <article className="max-w-2xl mx-auto">
        <h1 className="text-4xl font-extrabold uppercase leading-none">
          Política de Privacidade<span className="text-pop">.</span>
        </h1>
        <p className="mt-2 text-sm text-ink/70">
          Esportes Unidos — Última atualização: junho de 2026
        </p>

        <section className="mt-8 grid gap-3">
          <h2 className="text-xl font-extrabold uppercase">1. Quais dados coletamos</h2>
          <p className="text-ink/80">
            Nome, e-mail e senha para criação de conta. Dados opcionais de perfil: bio, peso,
            altura, esportes, posições e nível. Localização geográfica (latitude/longitude) para
            mostrar atividades próximas — coletada somente com sua autorização explícita. Marca
            patrocinadora escolhida por você. Mensagens de chat em atividades confirmadas. Avaliações
            de atividades e atletas. Dados de uso anônimos para melhoria do serviço.
          </p>
        </section>

        <section className="mt-6 grid gap-3">
          <h2 className="text-xl font-extrabold uppercase">2. Como usamos seus dados</h2>
          <p className="text-ink/80">
            Para conectar você a atividades próximas e a outros atletas. Para calcular sua pontuação
            e exibir seu perfil público. Para enviar notificações sobre atividades e amizades. Nunca
            vendemos seus dados a terceiros nem exibimos anúncios de terceiros.
          </p>
        </section>

        <section className="mt-6 grid gap-3">
          <h2 className="text-xl font-extrabold uppercase">3. Compartilhamento</h2>
          <p className="text-ink/80">
            Seus dados de perfil público (nome, pontos, esportes, nível) são visíveis a outros
            usuários cadastrados. Sua localização precisa, peso e altura são visíveis somente a
            você. Mensagens de chat são visíveis apenas ao organizador e participantes confirmados
            da atividade.
          </p>
        </section>

        <section className="mt-6 grid gap-3">
          <h2 className="text-xl font-extrabold uppercase">4. Seus direitos (LGPD — Lei 13.709/2018)</h2>
          <p className="text-ink/80">
            Você tem direito a: acessar, corrigir ou excluir seus dados; revogar o consentimento
            de localização a qualquer momento nas configurações do dispositivo; solicitar a
            exclusão da sua conta pelo e-mail esportesunidoseu@gmail.com.
          </p>
        </section>

        <section className="mt-6 grid gap-3">
          <h2 className="text-xl font-extrabold uppercase">5. Segurança</h2>
          <p className="text-ink/80">
            Seus dados são armazenados no Supabase com criptografia em trânsito (HTTPS) e controle
            de acesso por políticas de linha (RLS).
          </p>
        </section>

        <section className="mt-6 grid gap-3">
          <h2 className="text-xl font-extrabold uppercase">6. Contato</h2>
          <p className="text-ink/80">esportesunidoseu@gmail.com</p>
        </section>
      </article>
    </main>
  );
}
