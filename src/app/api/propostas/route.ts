import { NextRequest, NextResponse } from "next/server";
import { PropostaScope } from "@/lib/contracts";
import { usuarioAtual } from "@/lib/auth";
import { listarPropostas, autorDaProposta, salvarProposta } from "@/lib/propostas";
import { respostaErro } from "@/lib/erro";

export const runtime = "nodejs";

// Histórico = propostas persistidas (store de trabalho, com status comercial mutável).
// `?arquivadas=1` inclui as arquivadas, que por padrão ficam fora (ver listarPropostas).
//
// Gestor vê o time; vendedor vê a própria carteira. Mesmo recorte de listarChamados — e o
// corte é aqui, no servidor: esconder no front deixaria o JSON com as propostas dos colegas
// viajando pela rede de qualquer jeito.
export async function GET(req: NextRequest) {
  try {
    const usuario = await usuarioAtual(req);
    const incluirArquivadas = req.nextUrl.searchParams.get("arquivadas") === "1";
    const autor = usuario && usuario.papel !== "admin" ? usuario.email : undefined;
    return NextResponse.json({ propostas: await listarPropostas(200, incluirArquivadas, autor) });
  } catch (e) {
    return respostaErro(e, "Falha ao listar propostas", 500);
  }
}

// Auto-save da proposta gerada/editada (constituição: informação gerada é persistida).
// `autor` vem da sessão — dado crítico não vem do cliente.
export async function POST(req: NextRequest) {
  const parsed = PropostaScope.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ erro: parsed.error.flatten() }, { status: 400 });
  }
  try {
    const usuario = await usuarioAtual(req);
    const autor = usuario?.email ?? "local";
    // O upsert casa só por `id`, e o `id` vem do cliente: sem esta checagem, reenviar o
    // scope com o id de um colega SOBRESCREVE a proposta dele. Escopar a leitura sem
    // escopar a escrita não é isolamento. 404 e não 403 — não confirmar o que é do outro.
    //
    // Só o `autor`, não a proposta inteira: este é o caminho do auto-save, dispara a cada
    // edição, e carregar o `scope` do colega para ler uma string sairia caro no lugar mais
    // quente do app.
    const dono = await autorDaProposta(parsed.data.id);
    if (dono && usuario && usuario.papel !== "admin" && dono !== usuario.email) {
      return NextResponse.json({ erro: "Proposta não encontrada." }, { status: 404 });
    }
    const registro = await salvarProposta(parsed.data, autor);
    return NextResponse.json(registro, { status: 201 });
  } catch (e) {
    return respostaErro(e, "Falha ao salvar a proposta", 500);
  }
}
