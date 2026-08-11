import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { ComandoEdicao, PropostaScope, type PropostaItem } from "@/lib/contracts";
import { catalogoCompleto } from "@/lib/catalogo";
import { itemDoCatalogo } from "@/lib/montar";
import { interpretarComando } from "@/lib/llm/interpretar-comando";
import { interpretarDeterministico } from "@/lib/llm/comando-deterministico";
import { extrairPedido } from "@/lib/llm/extrair-pedido";
import { selecionarComOrcamento } from "@/lib/selecao/matcher";
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
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ erro: parsed.error.flatten() }, { status: 400 });
  }
  const { mensagem, scope } = parsed.data;
  try {
    const catalogo = await catalogoCompleto();
    const itensProposta = scope.itens.map((it) => ({ codigo: it.codigo, nome: it.nome }));
    const itensCatalogo = catalogo.produtos.filter((p) => p.ativo).map((p) => ({ codigo: p.codigo, nome: p.nome }));
    // Determinístico primeiro (QA 10/08: com Ollama fora do ar o chat não entendia nem o
    // exemplo do placeholder). Comando de forma fixa não precisa de IA — e não pode
    // depender dela. Só o que o regex não resolve com certeza vai ao modelo.
    const comando =
      interpretarDeterministico(mensagem, itensProposta, itensCatalogo) ??
      (await interpretarComando(mensagem, itensProposta, itensCatalogo));
    const numero = extrairNumero(mensagem);

    let itemResolvido: PropostaItem | null = null;
    if (comando.acao === "adicionar_item_catalogo" && comando.codigoItem) {
      try {
        itemResolvido = itemDoCatalogo(comando.codigoItem, 1);
      } catch {
        itemResolvido = null;
      }
    }

    let itensSelecionados: PropostaItem[] | null = null;
    if (comando.acao === "selecionar_por_necessidade" && comando.valorTexto) {
      const linhasCatalogo = new Set(catalogo.produtos.map((p) => p.linha));
      const pedido = await extrairPedido(comando.valorTexto, linhasCatalogo);
      const orcamentoMax = numero ? Number(numero.replace(",", ".")) : null;
      const selecao = selecionarComOrcamento(catalogo.produtos, pedido.facetasDetectadas, orcamentoMax);
      itensSelecionados = selecao.flatMap((s) => {
        try {
          return [itemDoCatalogo(s.codigo, 1)];
        } catch {
          return [];
        }
      });
    }

    return NextResponse.json({
      comando,
      numero,
      itemResolvido,
      itensSelecionados,
      resposta: montarResposta(comando, numero, itemResolvido, itensSelecionados, scope),
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
  itensSelecionados: PropostaItem[] | null,
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
    case "limitar_orcamento":
      if (!numero) return "Não encontrei o valor do teto na mensagem — pode repetir com o número (ex.: R$ 800)?";
      return `Ajustando a proposta pro teto de R$ ${numero}…`; // resultado real (o que saiu) vem do cliente, que sabe o total considerando exclusões
    case "selecionar_por_necessidade":
      if (!comando.valorTexto) return "Não entendi qual necessidade atender — pode descrever (ex.: \"higienização de cozinha\")?";
      if (!itensSelecionados || itensSelecionados.length === 0) {
        return numero
          ? `Não achei produtos do catálogo pra "${comando.valorTexto}" que coubessem em R$ ${numero}.`
          : `Não achei produtos do catálogo pra "${comando.valorTexto}".`;
      }
      const total = itensSelecionados.reduce((s, it) => s + Number(it.embalagens[0]?.preco ?? 0), 0);
      return `Selecionei ${itensSelecionados.length} produto${itensSelecionados.length > 1 ? "s" : ""} pra "${comando.valorTexto}" (total R$ ${total.toFixed(2).replace(".", ",")})${numero ? `, dentro do teto de R$ ${numero}` : ""}.`;
    case "nao_entendi":
    default:
      return "Não entendi o pedido — pode reformular? Consigo trocar dados do cliente, quantidade/preço de item, adicionar/remover produto do catálogo e condições comerciais.";
  }
}
