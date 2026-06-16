import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/terms")({
  head: () => ({
    meta: [
      { title: "Termos de Uso — Esportes Unidos" },
      { name: "description", content: "Termos de Uso da plataforma Esportes Unidos." },
      { property: "og:title", content: "Termos de Uso — Esportes Unidos" },
      { property: "og:description", content: "Termos de Uso da plataforma Esportes Unidos." },
    ],
  }),
  component: TermsPage,
});

function TermsPage() {
  return (
    <main className="min-h-screen bg-paper px-5 py-10">
      <article className="max-w-2xl mx-auto">
        <h1 className="text-4xl font-extrabold uppercase leading-none">
          Termos de Uso<span className="text-pop">.</span>
        </h1>
        <p className="mt-2 text-sm text-ink/70">
          Esportes Unidos — Última atualização: junho de 2026
        </p>

        <section className="mt-8 grid gap-3">
          <h2 className="text-xl font-extrabold uppercase">1. Aceitação</h2>
          <p className="text-ink/80">
            Ao criar uma conta no Esportes Unidos você concorda com estes Termos. Se não concordar,
            não utilize o serviço.
          </p>
        </section>

        <section className="mt-6 grid gap-3">
          <h2 className="text-xl font-extrabold uppercase">2. O serviço</h2>
          <p className="text-ink/80">
            O Esportes Unidos é uma plataforma para conexão de pessoas que desejam praticar
            esportes. Não organizamos, financiamos nem somos responsáveis pelos jogos criados
            pelos usuários.
          </p>
        </section>

        <section className="mt-6 grid gap-3">
          <h2 className="text-xl font-extrabold uppercase">3. Conduta do usuário</h2>
          <p className="text-ink/80">
            É proibido: criar perfis falsos; usar linguagem ofensiva no chat; assediar outros
            usuários; manipular o sistema de pontos; criar jogos com informações falsas. O
            descumprimento pode resultar em suspensão ou exclusão da conta.
          </p>
        </section>

        <section className="mt-6 grid gap-3">
          <h2 className="text-xl font-extrabold uppercase">4. Responsabilidade</h2>
          <p className="text-ink/80">
            A prática de atividades físicas envolve riscos inerentes. O Esportes Unidos não se
            responsabiliza por lesões, acidentes ou danos ocorridos durante os jogos. Cada
            usuário é responsável pela sua própria segurança.
          </p>
        </section>

        <section className="mt-6 grid gap-3">
          <h2 className="text-xl font-extrabold uppercase">5. Propriedade intelectual</h2>
          <p className="text-ink/80">
            A marca, o design e o código do Esportes Unidos são de propriedade de seus criadores.
            O conteúdo gerado por usuários (textos, avaliações) permanece de propriedade do
            usuário, mas nos autoriza a exibi-lo na plataforma.
          </p>
        </section>

        <section className="mt-6 grid gap-3">
          <h2 className="text-xl font-extrabold uppercase">6. Alterações</h2>
          <p className="text-ink/80">
            Podemos atualizar estes Termos a qualquer momento. Notificaremos usuários por e-mail
            em caso de mudanças relevantes.
          </p>
        </section>

        <section className="mt-6 grid gap-3">
          <h2 className="text-xl font-extrabold uppercase">7. Contato</h2>
          <p className="text-ink/80">esportesunidoseu@gmail.com</p>
        </section>
      </article>
    </main>
  );
}
