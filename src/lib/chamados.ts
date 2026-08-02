import { prisma } from "@/lib/db";
import { Chamado, type ChamadoCreate, type ChamadoUpdate } from "@/lib/contracts";

// `usuarioAtual`/`SessaoUsuario` moraram aqui até 01/08/2026, quando a listagem de propostas
// passou a precisar do mesmo escopo por autor. São de autenticação, não de chamados — foram
// para lib/auth.ts. O reexport mantém quem já importava daqui.
export { usuarioAtual } from "@/lib/auth-db";
export type { SessaoUsuario } from "@/lib/auth";
import type { SessaoUsuario } from "@/lib/auth";

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
  const where = usuario.papel === "admin" ? {} : { autor: usuario.email };
  const rows = await prisma.chamado.findMany({ where, orderBy: { criadoEm: "desc" } });
  return rows.map(mapear);
}

// Só o gestor chega aqui (autorização na rota): muda status e/ou responde.
export async function atualizarChamado(id: string, dados: ChamadoUpdate): Promise<Chamado> {
  const row = await prisma.chamado.update({ where: { id }, data: dados });
  return mapear(row);
}
