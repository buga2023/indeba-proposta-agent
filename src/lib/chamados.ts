import type { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { authAtiva, validarSessao } from "@/lib/auth";
import { Chamado, type ChamadoCreate, type ChamadoUpdate } from "@/lib/contracts";

// Quem está pedindo: login + papel (gestor = admin). Em dev local sem auth, vira admin
// "local" pra não travar o uso. Com auth ativa e sem sessão válida → null (401 na rota).
export type SessaoUsuario = { login: string; papel: "admin" | "user" };

export async function usuarioAtual(req: NextRequest): Promise<SessaoUsuario | null> {
  const u = await validarSessao(req.cookies.get("sessao")?.value);
  if (u) return { login: u.login, papel: u.papel };
  if (!authAtiva()) return { login: "local", papel: "admin" };
  return null;
}

// Linha do Prisma → contrato Chamado (datas em ISO; valida os enums via Zod).
type ChamadoRow = {
  id: string;
  titulo: string;
  descricao: string;
  categoria: string;
  prioridade: string;
  status: string;
  autor: string;
  respostaGestor: string | null;
  criadoEm: Date;
  atualizadoEm: Date;
};

function mapear(row: ChamadoRow): Chamado {
  return Chamado.parse({
    ...row,
    criadoEm: row.criadoEm.toISOString(),
    atualizadoEm: row.atualizadoEm.toISOString(),
  });
}

// Colaborador abre um chamado — `autor` SEMPRE da sessão, nunca do cliente.
export async function criarChamado(autor: string, dados: ChamadoCreate): Promise<Chamado> {
  const row = await prisma.chamado.create({ data: { ...dados, autor } });
  return mapear(row);
}

// Gestor vê TODOS; colaborador vê só os seus. Mais recentes primeiro.
export async function listarChamados(usuario: SessaoUsuario): Promise<Chamado[]> {
  const where = usuario.papel === "admin" ? {} : { autor: usuario.login };
  const rows = await prisma.chamado.findMany({ where, orderBy: { criadoEm: "desc" } });
  return rows.map(mapear);
}

// Só o gestor chega aqui (autorização na rota): muda status e/ou responde.
export async function atualizarChamado(id: string, dados: ChamadoUpdate): Promise<Chamado> {
  const row = await prisma.chamado.update({ where: { id }, data: dados });
  return mapear(row);
}
