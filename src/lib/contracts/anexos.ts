import { z } from "zod";

/**
 * Anexos das ferramentas (áudio do Mateus, 27/08/2026: "aplicasse a essa opção de anexar
 * arquivo e foto em todas as outras ferramentas"): fotos e documentos pendurados em
 * registros de prospecção, solicitação comercial, contrato/comodato e estoque. As visitas
 * ficam de fora — já têm VisitaFoto e o documento na própria linha.
 *
 * Os bytes NUNCA trafegam na listagem: só id/categoria/nome; /api/anexos/<id> serve o
 * conteúdo, com o mesmo escopo por autor do registro dono.
 */

export const TipoRegistroAnexo = z.enum(["prospeccao", "solicitacao", "contrato", "estoque"]);
export type TipoRegistroAnexo = z.infer<typeof TipoRegistroAnexo>;

export const CategoriaAnexo = z.enum(["foto", "documento"]);
export type CategoriaAnexo = z.infer<typeof CategoriaAnexo>;

export const AnexoInfo = z.object({
  id: z.string(),
  categoria: CategoriaAnexo,
  nome: z.string().nullable(),
});
export type AnexoInfo = z.infer<typeof AnexoInfo>;
