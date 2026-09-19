import { esc } from "./template";
import { pdfDeHtml } from "./render";

/**
 * Ficha em PDF de UM registro das Ferramentas — visita de rotina, relatório de nova
 * prospecção ou solicitação comercial.
 *
 * Áudio do Mateus (10/09/2026): "em todos os registros você liberar a opção pra gente de
 * extrair isso aí como PDF… o cliente pode falar 'cadê o relatório da última visita?'. A
 * gente tira isso aí". Ou seja: o destinatário é o CLIENTE, não o arquivo interno — por
 * isso a ficha sai com a marca no topo, o que foi feito em texto corrido e as fotos da
 * visita, e NÃO com id, e-mail de autor ou estado de exclusão.
 *
 * Ficam de fora o Estoque de Comodatos e os Contratos e Comodatos (recorte do Gustavo,
 * 10/09/2026): estoque é planilha interna e já exporta Excel/CSV, e contrato já tem a
 * própria cópia em /api/comodatos/<id>/pdf — o documento assinado, que é o que se manda.
 */

// A marca do documento acompanha a da proposta (template.ts), para o cliente receber as
// duas coisas com a mesma cara.

/**
 * Logo da ficha: Indeba EXPRESS, não a institucional.
 *
 * A ficha nasceu (10/09/2026) apontando para /marca/indeba-logo.png — a marca da indústria,
 * "Indeba · Química e Soluções em Higiene". Mateus cobrou em 19/09/2026: "ainda está saindo
 * a logo da Indeba errada, a mesma do início, a da identidade visual Indeba".
 *
 * A divisão é essa: a institucional só assina a PROPOSTA COMERCIAL, que é o documento da
 * indústria (render.ts, case "comercial"). Todo o resto que sai do sistema — orçamento,
 * consolidada, implantação e esta ficha — assina Indeba Express.
 *
 * Fica como constante, e não solta na rota, porque é decisão de marca: quem for trocar
 * tropeça no teste em tests/unit/registro-pdf.test.ts antes de a ficha chegar ao cliente.
 */
export const LOGO_FICHA = "/marca/indeba-express-logo.png";

const NAVY = "#0C355E";
const LARANJA = "#F58220";
const CINZA = "#6B7280";

export type CampoFicha = { rotulo: string; valor: string };
export type FotoFicha = { dataUri: string };

export type Ficha = {
  /** "Relatório de Visita de Rotina" — o que o cliente lê no topo. */
  titulo: string;
  /** Nome do cliente/empresa: a linha grande logo abaixo do título. */
  cliente: string;
  /** Selo de estado ("Resolvido", "Pendente"…). Opcional — nem todo registro tem. */
  selo?: { texto: string; ok: boolean };
  /** Pares rótulo/valor da tabela de cabeçalho (data, horário, quem recebeu, telefone…). */
  campos: CampoFicha[];
  /** Blocos de texto corrido (observação, comodatos). Quebras de linha são preservadas. */
  blocos: { rotulo: string; texto: string }[];
  /** Fotos anexadas, já resolvidas em data-URI pela camada que busca no banco. */
  fotos: FotoFicha[];
  /** Quem lançou (NOME, nunca o e-mail — mesma regra de lib/autores.ts) e quando. */
  registradoPor: string;
  registradoEm: string;
};

// Texto do usuário num <pre> lógico: escapa e converte quebra de linha em <br>, para a
// observação de várias linhas (é assim que ela é digitada e é assim que ela deve sair).
function paragrafo(texto: string): string {
  return esc(texto).replace(/\r?\n/g, "<br/>");
}

/** Exportado para inspeção visual: o HTML da ficha antes de virar PDF. */
export function fichaHtml(ficha: Ficha, logo: string): string {
  const selo = ficha.selo
    ? `<span class="selo ${ficha.selo.ok ? "ok" : "pend"}">${esc(ficha.selo.texto)}</span>`
    : "";

  const campos = ficha.campos
    .filter((c) => c.valor.trim())
    .map((c) => `<tr><th>${esc(c.rotulo)}</th><td>${esc(c.valor)}</td></tr>`)
    .join("");

  const blocos = ficha.blocos
    .filter((b) => b.texto.trim())
    .map((b) => `<section class="bloco"><h2>${esc(b.rotulo)}</h2><p>${paragrafo(b.texto)}</p></section>`)
    .join("");

  // As fotos são o corpo do relatório de visita (o João bate foto do equipamento). Vão
  // numa grade de duas colunas, cada uma inteira dentro da página — `break-inside: avoid`
  // evita a foto cortada ao meio na virada.
  const fotos = ficha.fotos.length
    ? `<section class="bloco"><h2>Fotos</h2><div class="fotos">${ficha.fotos
        .map((f) => `<div class="foto"><img src="${f.dataUri}" alt=""/></div>`)
        .join("")}</div></section>`
    : "";

  return `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8"/><style>${css()}</style></head>
  <body>
    <header class="topo">
      ${logo ? `<img class="logo" src="${logo}" alt="Indeba Express"/>` : `<div class="marca">INDEBA EXPRESS</div>`}
    </header>
    <div class="pg">
      <div class="tit-linha">
        <h1>${esc(ficha.titulo)}</h1>
        ${selo}
      </div>
      <div class="cliente">${esc(ficha.cliente)}</div>
      ${campos ? `<table class="campos">${campos}</table>` : ""}
      ${blocos}
      ${fotos}
      <footer class="rodape">
        Registrado por ${esc(ficha.registradoPor)} em ${esc(ficha.registradoEm)}.
      </footer>
    </div>
  </body></html>`;
}

function css(): string {
  return `
* { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: "Segoe UI", "Helvetica Neue", Arial, sans-serif; color: #25303f; font-size: 12px; -webkit-font-smoothing: antialiased; }
.topo { padding: 6mm 14mm 4mm; border-bottom: 2px solid ${LARANJA}; }
/* 38mm: a logo Express é um lockup deitado (2,12:1) contra 1,44:1 da institucional que
   estava aqui. Na mesma largura de antes ela encolheria 7mm de altura e sumiria ao lado
   do filete laranja — a largura maior devolve o peso que o cabeçalho tinha. */
.topo .logo { width: 38mm; display: block; }
.topo .marca { color: ${NAVY}; font-size: 20px; font-weight: 800; letter-spacing: 2px; }
.pg { padding: 10mm 14mm 0; }

.tit-linha { display: flex; align-items: center; gap: 10px; }
h1 { color: ${NAVY}; font-size: 19px; font-weight: 800; letter-spacing: -.2px; }
.selo { flex: none; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: .4px; padding: 3px 9px; border-radius: 999px; }
.selo.ok { background: #e7f6ec; color: #17703a; }
.selo.pend { background: #fdf0e3; color: #9a5410; }
.cliente { color: ${NAVY}; font-size: 15px; font-weight: 700; margin-top: 3px; padding-bottom: 8px; border-bottom: 1px solid #EAEAEA; }

.campos { width: 100%; border-collapse: collapse; margin-top: 8px; }
.campos th, .campos td { text-align: left; vertical-align: top; padding: 2.6mm 0; border-bottom: 1px solid #F1F3F6; }
.campos th { width: 42mm; color: ${CINZA}; font-size: 10.5px; font-weight: 600; text-transform: uppercase; letter-spacing: .3px; }
.campos td { color: #25303f; font-size: 12.5px; font-weight: 600; }

.bloco { margin-top: 7mm; break-inside: avoid; }
.bloco h2 { color: ${CINZA}; font-size: 10.5px; font-weight: 700; text-transform: uppercase; letter-spacing: .5px; margin-bottom: 2.5mm; }
.bloco p { line-height: 1.6; color: #3a4757; border-left: 3px solid ${LARANJA}; padding-left: 10px; }

.fotos { display: flex; flex-wrap: wrap; gap: 4mm; }
.foto { width: calc(50% - 2mm); break-inside: avoid; }
.foto img { display: block; width: 100%; max-height: 95mm; object-fit: contain; border: 1px solid #EAEAEA; border-radius: 8px; background: #FAFBFC; }

.rodape { margin-top: 9mm; padding-top: 3mm; border-top: 1px solid #EAEAEA; color: ${CINZA}; font-size: 10px; }
`;
}

/** Ficha → PDF. O rodapé nativo numera as páginas (visita com 10 fotos passa de uma). */
export async function pdfDaFicha(ficha: Ficha, logo: string): Promise<Buffer> {
  return pdfDeHtml(fichaHtml(ficha, logo), {
    marginTop: "0",
    marginBottom: "14mm",
    footer: `<div style="width:100%;font-family:'Segoe UI',Arial,sans-serif;font-size:8px;color:${CINZA};padding:0 14mm;text-align:right;">
      <span class="pageNumber"></span>/<span class="totalPages"></span>
    </div>`,
  });
}

/** Nome de arquivo seguro — mesmo saneamento da rota do contrato de comodato. */
export function nomeArquivo(prefixo: string, cliente: string): string {
  const limpo = cliente.replace(/[^A-Za-z0-9._-]/g, "_").slice(0, 60) || "registro";
  return `${prefixo}-${limpo}.pdf`;
}
