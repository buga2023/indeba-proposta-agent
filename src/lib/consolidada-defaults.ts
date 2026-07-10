import type { ConsolidadaBloco } from "./contracts";

// Conteúdo institucional padrão do modelo Proposta Consolidada (marca IES),
// transcrito de proposta-indeba-consolidada.pdf. É só default: cada campo é
// editável por proposta (Fase 2). Nada de dado crítico (preço/produto) aqui.
export function consolidadaDefaults(opts?: { consultor?: string; cidade?: string }): ConsolidadaBloco {
  const consultor = opts?.consultor ?? "Matheus Maristane Resende";
  const cidade = opts?.cidade ?? "Salvador - BA";
  return {
    capa: { consultor, cidade, subtitulo: "Soluções em Higienização Profissional" },
    apresentacao: {
      saudacao: "Prezado(a),",
      paragrafos: [
        "A Indeba Express agradece a oportunidade de apresentar esta proposta comercial.",
        "Somos especializados em fornecer soluções completas em higienização profissional, oferecendo produtos de alta performance, equipamentos e suporte técnico para empresas que buscam eficiência, economia e segurança em seus processos de limpeza.",
        "Nosso compromisso é entender as necessidades de cada cliente e entregar soluções personalizadas que geram resultados reais, com qualidade, agilidade e confiabilidade.",
        "Esta proposta foi elaborada especialmente para sua empresa e esperamos que ela seja o início de uma parceria sólida e duradoura.",
      ],
      cards: [
        { titulo: "Produtos Certificados", texto: "Trabalhamos com as melhores marcas e produtos de alta qualidade.", icone: "selo" },
        { titulo: "Atendimento Consultivo", texto: "Entendemos sua necessidade e indicamos a melhor solução.", icone: "pessoa" },
        { titulo: "Entrega Ágil", texto: "Logística eficiente para garantir rapidez e segurança nas entregas.", icone: "entrega" },
        { titulo: "Suporte Técnico", texto: "Equipe especializada pronta para oferecer todo o suporte necessário.", icone: "suporte" },
      ],
    },
    comodatos: {
      intro: "A Indeba Express disponibiliza equipamentos em comodato para atender às necessidades operacionais da sua empresa, com tecnologia de ponta e assistência inclusa.",
      equipamentos: [
        { titulo: "Dispenser Automático", descricao: "Equipamento moderno e eficiente para dispensação de sabonete, álcool em gel ou papel.", icone: "dispenser" },
        { titulo: "Toalheiro Automático", descricao: "Solução prática e higiênica para fornecimento automático de papel toalha.", icone: "toalheiro" },
        { titulo: "Aromatizador Automático", descricao: "Equipamento que proporciona ambientes sempre perfumados e agradáveis.", icone: "aromatizador" },
        { titulo: "Lixeira com Tampa", descricao: "Lixeira resistente e com tampa para descarte seguro e higiênico de resíduos.", icone: "lixeira" },
      ],
      vantagens: [
        "Sem custo de aquisição dos equipamentos",
        "Manutenção preventiva e corretiva inclusa",
        "Substituição imediata em caso de necessidade",
        "Tecnologia atualizada e de alta performance",
      ],
    },
    condicoes: {
      itens: [
        { titulo: "Validade da Proposta", texto: "Esta proposta é válida por 30 (trinta) dias a partir da data de emissão.", icone: "validade" },
        { titulo: "Prazo de Implantação", texto: "Até 15 (quinze) dias úteis após a confirmação do pedido.", icone: "prazo" },
        { titulo: "Forma de Pagamento", texto: "Boleto bancário com vencimento para 30 dias.", icone: "pagamento" },
        { titulo: "Frete e Entrega", texto: "Entrega e instalação inclusas na cidade de Salvador - BA.", icone: "frete" },
        { titulo: "Suporte e Atendimento", texto: "Suporte técnico e atendimento consultivo durante toda a vigência do contrato.", icone: "suporte" },
      ],
      mensagemFechamento: "Nos colocamos à disposição para quaisquer esclarecimentos e aguardamos sua aprovação para darmos início a esta parceria de sucesso.",
      consultor,
      cargo: "Consultor Comercial",
    },
  };
}
