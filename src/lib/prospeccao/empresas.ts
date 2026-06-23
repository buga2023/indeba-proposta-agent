import { prisma } from "../db";
import { EmpresaProspecto } from "../contracts";
import { segmentoDoCnae } from "./cnae";

// Telefone armazenado como dígitos (DDD + número). Formata para exibição.
function formatarTelefone(d: string | null): string | null {
  if (!d) return null;
  const n = d.replace(/\D/g, "");
  if (n.length === 11) return `(${n.slice(0, 2)}) ${n.slice(2, 7)}-${n.slice(7)}`;
  if (n.length === 10) return `(${n.slice(0, 2)}) ${n.slice(2, 6)}-${n.slice(6)}`;
  return n || null;
}

function comporEndereco(r: {
  logradouro: string | null;
  numero: string | null;
  bairro: string | null;
  municipioNome: string | null;
  uf: string;
}): string | null {
  const linha1 = [r.logradouro, r.numero].filter(Boolean).join(", ");
  const linha2 = [r.bairro, r.municipioNome && `${r.municipioNome}/${r.uf}`].filter(Boolean).join(" - ");
  const full = [linha1, linha2].filter(Boolean).join(" - ");
  return full || null;
}

export type BuscaEmpresas = {
  cnaes: string[];
  uf?: string | null;
  municipio?: string | null;
  limite?: number;
};

// Busca determinística na base da Receita: empresas ATIVAS dos CNAEs do nicho, na
// localização pedida. Tudo (nome, atividade, contato, endereço) vem do banco — §2.
export async function buscarEmpresas(opts: BuscaEmpresas): Promise<EmpresaProspecto[]> {
  if (!opts.cnaes.length) return [];
  const rows = await prisma.empresaReceita.findMany({
    where: {
      cnaePrincipal: { in: opts.cnaes },
      situacao: "ATIVA",
      ...(opts.uf ? { uf: opts.uf.toUpperCase() } : {}),
      ...(opts.municipio
        ? { municipioNome: { equals: opts.municipio, mode: "insensitive" } }
        : {}),
    },
    take: opts.limite ?? 12,
    orderBy: { razaoSocial: "asc" }, // determinístico
  });

  return rows.map((r) =>
    EmpresaProspecto.parse({
      cnpj: r.cnpj,
      razaoSocial: r.razaoSocial,
      nomeFantasia: r.nomeFantasia,
      cnaePrincipal: r.cnaePrincipal,
      segmento: segmentoDoCnae(r.cnaePrincipal),
      uf: r.uf,
      municipio: r.municipioNome,
      telefones: [formatarTelefone(r.telefone1), formatarTelefone(r.telefone2)].filter(
        (t): t is string => !!t,
      ),
      email: r.email,
      endereco: comporEndereco(r),
    }),
  );
}

// A base está acessível e populada? Decide se a prospecção usa o backbone
// determinístico ou cai no caminho IA+Tavily (degradação graciosa).
export async function baseEmpresasDisponivel(): Promise<boolean> {
  try {
    return (await prisma.empresaReceita.findFirst({ select: { cnpj: true } })) !== null;
  } catch {
    return false;
  }
}
