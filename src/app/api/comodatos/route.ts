import { NextRequest, NextResponse } from "next/server";
import { ContratoComodatoCreate, ContratoComodatoUpdate } from "@/lib/contracts";
import { usuarioAtual } from "@/lib/auth-db";
import {
  criarContratoComodato,
  listarContratosComodato,
  editarContratoComodato,
  excluirContratoComodato,
  restaurarContratoComodato,
  excluirContratoComodatoDefinitivo,
} from "@/lib/ferramentas-tecnicas";
import { respostaErro } from "@/lib/erro";

export const runtime = "nodejs";

// Contratos e Comodatos (Ferramentas Técnicas): cliente, comodatos, observações e a cópia
// do contrato em PDF. Escrita aberta a todo vendedor; leitura com o recorte por autor.

// Mesmo teto do upload de ficha técnica: a função da Vercel corta o corpo em ~4,5 MB e
// responde 413 antes de o código rodar — prometer mais seria mentir (ver /api/produtos).
const LIMITE_PDF = 4 * 1024 * 1024;

export async function GET(req: NextRequest) {
  const usuario = await usuarioAtual(req);
  if (!usuario) return NextResponse.json({ erro: "Não autenticado." }, { status: 401 });
  const excluidas = req.nextUrl.searchParams.get("excluidas") === "1";
  try {
    const contratos = await listarContratosComodato(usuario, excluidas);
    return NextResponse.json({ contratos, souGestor: usuario.papel === "admin" });
  } catch (e) {
    return respostaErro(e, "Falha ao listar os contratos.", 500);
  }
}

// Cadastro em multipart: os campos vão como JSON no campo `dados`, o PDF (opcional) no
// campo `contrato` — mesmo desenho do cadastro de produto (foto/ficha).
export async function POST(req: NextRequest) {
  const usuario = await usuarioAtual(req);
  if (!usuario) return NextResponse.json({ erro: "Não autenticado." }, { status: 401 });

  const form = await req.formData().catch(() => null);
  if (!form) return NextResponse.json({ erro: "Envio inválido." }, { status: 400 });

  let crus: unknown = null;
  try {
    crus = JSON.parse(String(form.get("dados") ?? "null") || "null");
  } catch {
    crus = null;
  }
  const parsed = ContratoComodatoCreate.safeParse(crus);
  if (!parsed.success) return NextResponse.json({ erro: parsed.error.flatten() }, { status: 400 });

  const arquivo = form.get("contrato");
  let pdf: { bytes: Uint8Array<ArrayBuffer>; mime: string } | null = null;
  if (arquivo instanceof File && arquivo.size > 0) {
    if (arquivo.type !== "application/pdf") {
      return NextResponse.json({ erro: "O contrato deve ser um PDF." }, { status: 400 });
    }
    if (arquivo.size > LIMITE_PDF) {
      return NextResponse.json({ erro: "Contrato acima de 4 MB — a plataforma recusa envios maiores." }, { status: 400 });
    }
    pdf = { bytes: new Uint8Array(await arquivo.arrayBuffer()), mime: arquivo.type };
  }

  try {
    const contrato = await criarContratoComodato(usuario.email, parsed.data, pdf);
    return NextResponse.json(contrato, { status: 201 });
  } catch (e) {
    return respostaErro(e, "Falha ao cadastrar o contrato.", 500);
  }
}

// Editar (áudio do Mateus, 25/08/2026): cliente, comodatos e observações — o PDF não
// muda por aqui. `?acao=restaurar` tira o contrato da aba Excluídos (só gestor).
export async function PATCH(req: NextRequest) {
  const usuario = await usuarioAtual(req);
  if (!usuario) return NextResponse.json({ erro: "Não autenticado." }, { status: 401 });
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ erro: "Contrato não informado." }, { status: 400 });

  if (req.nextUrl.searchParams.get("acao") === "restaurar") {
    if (usuario.papel !== "admin") return NextResponse.json({ erro: "Apenas o gestor pode restaurar contratos." }, { status: 403 });
    try {
      const ok = await restaurarContratoComodato(usuario, id);
      if (!ok) return NextResponse.json({ erro: "Contrato não encontrado." }, { status: 404 });
      return NextResponse.json({ ok: true });
    } catch (e) {
      return respostaErro(e, "Falha ao restaurar o contrato.", 500);
    }
  }

  const parsed = ContratoComodatoUpdate.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ erro: parsed.error.flatten() }, { status: 400 });
  try {
    const ok = await editarContratoComodato(usuario, id, parsed.data);
    if (!ok) return NextResponse.json({ erro: "Contrato não encontrado." }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return respostaErro(e, "Falha ao editar o contrato.", 500);
  }
}

// Excluir é SÓ do gestor (áudio do Mateus, 25/08/2026). Sem `?definitivo=1` vira lápide;
// com, some de vez — e só de lá.
export async function DELETE(req: NextRequest) {
  const usuario = await usuarioAtual(req);
  if (!usuario) return NextResponse.json({ erro: "Não autenticado." }, { status: 401 });
  if (usuario.papel !== "admin") return NextResponse.json({ erro: "Apenas o gestor pode excluir contratos." }, { status: 403 });
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ erro: "Contrato não informado." }, { status: 400 });
  const definitivo = req.nextUrl.searchParams.get("definitivo") === "1";
  try {
    const ok = definitivo ? await excluirContratoComodatoDefinitivo(usuario, id) : await excluirContratoComodato(usuario, id);
    if (!ok) return NextResponse.json({ erro: "Contrato não encontrado." }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return respostaErro(e, "Falha ao excluir o contrato.", 500);
  }
}
