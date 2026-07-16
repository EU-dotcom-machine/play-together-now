-- Corrige regressão de acesso (F1 da auditoria de 15/07/2026).
--
-- A migration 20260714135502 substituiu a política de leitura do chat por
-- "Messages readable by host or participants", que aceitava QUALQUER linha em
-- game_participants (inclusive status 'pending'/'declined'). Como a política de
-- INSERT em game_participants ("participants insert self pending") permite que
-- qualquer usuário se auto-insira como 'pending' em qualquer jogo, na prática
-- qualquer usuário autenticado conseguia ler o chat de qualquer jogo.
--
-- Esta migration restaura a exigência de participante CONFIRMADO ou host para
-- leitura, alinhando novamente a leitura com a escrita ("messages insert
-- confirmed or host").

DROP POLICY IF EXISTS "Messages readable by host or participants" ON public.messages;

CREATE POLICY "Messages readable by host or confirmed participants" ON public.messages
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.games
    WHERE games.id = messages.game_id
      AND games.host_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM public.game_participants
    WHERE game_participants.game_id = messages.game_id
      AND game_participants.user_id = auth.uid()
      AND game_participants.status = 'confirmed'
  )
);
