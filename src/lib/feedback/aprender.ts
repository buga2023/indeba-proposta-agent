// Onde o feedback vira aprendizado de verdade — sem treinar modelo (constituição §2).
// Hoje o Atendimento fecha o loop: a CORREÇÃO humana é reindexada no Qdrant, então a
// próxima pergunta parecida já recupera a resposta certa. Os demais agentes só registram
// (o example-store few-shot deles é o próximo passo — ver memória agentes-ecossistema).
import type { FeedbackRequest } from "../contracts";
import { indexarDoc } from "../rag/indexar";

export type Aprendizado = { aprendido: boolean; detalhe: string };

export async function aprenderComFeedback(fb: FeedbackRequest): Promise<Aprendizado> {
  const correcao = fb.correcao?.trim();
  if (fb.agente === "atendimento" && correcao) {
    const titulo = `Correção: ${(fb.pergunta ?? "").trim().slice(0, 80) || "atendimento"}`;
    const texto = `Pergunta: ${fb.pergunta ?? "—"}\nResposta correta (revisada por humano): ${correcao}`;
    const r = await indexarDoc(titulo, texto);
    return {
      aprendido: r.pontos > 0,
      detalhe: `Correção indexada na base (${r.pontos} trecho(s)) — o atendimento já usa isso na próxima pergunta.`,
    };
  }
  return { aprendido: false, detalhe: "Feedback registrado para revisão." };
}
