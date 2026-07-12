import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { ComandoEdicao, PropostaScope, type PropostaItem } from "@/lib/contracts";
import { carregarCatalogo } from "@/lib/catalogo";
import { itemDoCatalogo } from "@/lib/montar";
import { interpretarComando } from "@/lib/llm/interpretar-comando";
import { extrairNumero } from "@/lib/proposta-edit";
import { respostaErro } from "@/lib/erro";

export const runtime = "nodejs";
export const maxDuration = 60;

const Body = z.object({
  mensagem: z.string().min(1).max(500),
  scope: PropostaScope,
});

// Chat de correção da proposta (Revisão): interpreta a mensagem em um ComandoEdicao
// (IA só classifica ação + resolve item/campo alvo), extrai o número — se houver —
// por regex determinístico da mensagem ORIGINAL (nunca da saída da IA), e resolve
// o item do catálogo quando a ação é "adicionar_item_catalogo" (preço sempre do
// catálogo real). Não aplica nada no scope: quem aplica é o cliente, com os mesmos
// setters que os controles manuais da Revisão já usam.
export async function POST(req: NextRequest) {
  const parsed = Body.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ erro: parsed.error.flatten() }, { status: 400 });
  }
  const { mensagem, scope } = parsed.data;
  try {
    const catalogo = carregarCatalogo();
    const itensProposta = scope.itens.map((it) => ({ codigo: it.codigo, nome: it.nome }));
    const itensCatalogo = catalogo.produtos.filter((p) => p.ativo).map((p) => ({ codigo: p.codigo, nome: p.nome }));
    const comando = await interpretarComando(mensagem, itensProposta, itensCatalogo);
    const numero = extrairNumero(mensagem);

    let itemResolvido: PropostaItem | null = null;
    if (comando.acao === "adicionar_item_catalogo" && comando.codigoItem) {
      try {
        itemResolvido = itemDoCatalogo(comando.codigoItem, 1);
      } catch {
        itemResolvido = null;
      }
    }

    return NextResponse.json({
      comando,
      numero,
      itemResolvido,
      resposta: montarResposta(comando, numero, itemResolvido, scope),
    });
  } catch (e) {
    return respostaErro(e, "Erro ao interpretar o comando", 400);
  }
}

function nomeItemProposta(scope: PropostaScope, codigo: string): string {
  return scope.itens.find((it) => it.codigo === codigo)?.nome ?? codigo;
}

// Resposta de confirmação composta EM CÓDIGO (switch determinístico), não texto
// solto da IA — o chat nunca "narra" um resultado que o backbone não garantiu.
function montarResposta(
  comando: ComandoEdicao,
  numero: string | null,
  itemResolvido: PropostaItem | null,
  scope: PropostaScope,
): string {
  switch (comando.acao) {
    case "alterar_razao_social":
      return comando.valorTexto ? `Troquei a razão social para "${comando.valorTexto}".` : "Não entendi o novo valor da razão social — pode repetir?";
    case "alterar_cnpj":
      return comando.valorTexto ? `Troquei o CNPJ para "${comando.valorTexto}".` : "Não entendi o novo CNPJ — pode repetir?";
    case "alterar_segmento":
      return comando.valorTexto ? `Troquei o segmento para "${comando.valorTexto}".` : "Não entendi o novo segmento — pode repetir?";
    case "alterar_responsavel_cliente":
      return comando.valorTexto ? `Troquei o responsável do cliente para "${comando.valorTexto}".` : "Não entendi o novo responsável — pode repetir?";
    case "alterar_quantidade_item":
      if (!comando.codigoItem) return "Não identifiquei qual item — pode citar o nome do produto?";
      if (!numero) return `Não encontrei um número na mensagem para a quantidade de "${nomeItemProposta(scope, comando.codigoItem)}".`;
      return `Quantidade de "${nomeItemProposta(scope, comando.codigoItem)}" alterada para ${numero}.`;
    case "remover_item":
      if (!comando.codigoItem) return "Não identifiquei qual item remover — pode citar o nome do produto?";
      return `Removi "${nomeItemProposta(scope, comando.codigoItem)}" da proposta.`;
    case "adicionar_item_catalogo":
      if (!itemResolvido) {
        return comando.codigoItem
          ? `Não encontrei o produto "${comando.codigoItem}" no catálogo (ou ele está sem preço).`
          : "Não identifiquei qual produto do catálogo adicionar — pode ser mais específico?";
      }
      return `Adicionei "${itemResolvido.nome}" à proposta.`;
    case "alterar_preco_item":
      if (!comando.codigoItem) return "Não identifiquei qual item — pode citar o nome do produto?";
      if (!numero) return `Não encontrei um número na mensagem para o preço de "${nomeItemProposta(scope, comando.codigoItem)}".`;
      return `Preço de "${nomeItemProposta(scope, comando.codigoItem)}" alterado para R$ ${numero}.`;
    case "alterar_condicao_comercial":
      if (!comando.campoCondicao || !comando.valorTexto) return "Não entendi qual condição comercial mudar — pode detalhar?";
      return `Condição "${comando.campoCondicao}" alterada para "${comando.valorTexto}".`;
    case "nao_entendi":
    default:
      return "Não entendi o pedido — pode reformular? Consigo trocar dados do cliente, quantidade/preço de item, adicionar/remover produto do catálogo e condições comerciais.";
  }
}
