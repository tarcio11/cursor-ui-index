# Estética dentro do design system

Use este arquivo junto com a skill de estética do projeto (por exemplo, `frontend-design`). Quando os dois discordarem, este arquivo vence: a tela precisa parecer parte do produto, não um projeto à parte.

## O design system decide

- **Cores:** só tokens e props de cor do design system. Nenhum hex, rgb, hsl ou gradiente novo.
- **Tipografia:** só as famílias e a escala do design system, pelos componentes de texto e título dele. Nenhuma fonte nova. A personalidade da tela vem de hierarquia, peso e espaço, não de trocar a fonte.
- **Espaçamento, raio de borda, sombra e ícones:** só da escala e da biblioteca do design system.
- **Componentes:** botão, campo, select, tabela, modal, abas, badge, toast e afins são sempre os do design system ou os componentes locais encontrados no índice. Nunca recrie com HTML e CSS próprios.
- **Pedido fora do design system:** se a skill de estética sugerir algo que o design system não tem (cor, fonte, efeito, textura), não implemente. Escreva como sugestão na resposta, para o time decidir.

## A skill de estética decide, dentro dessas regras

- **Assunto:** parta de quem usa a tela, da tarefa principal e dos dados reais do domínio. Os dados fictícios do rascunho precisam parecer do negócio.
- **Plano antes do código:** wireframe em ASCII, alinhamento e os princípios da tela. Revise o plano procurando escolhas genéricas e troque as que encontrar.
- **Hierarquia:** um único ponto de destaque por tela. O resto fica calmo e disciplinado.
- **Composição e densidade:** escolha de propósito. Tabela densa para comparar e analisar; cards só quando cada item é uma unidade independente; lista com detalhe ao lado quando o usuário abre um item por vez. Evite cortar tudo em cards iguais com a mesma sombra.
- **Estrutura que informa:** borda, divisória, numeração e rótulo só quando carregam informação. Numeração só para sequência de verdade (etapas, linha do tempo).
- **Sem os vícios de tela gerada:** rótulo em caixa alta acima de cada título, uma palavra destacada sozinha no título, metadados no formato "A · B · C", seta no fim do texto de botão e rótulos que só enfeitam.
- **Movimento:** só o que responde a uma ação do usuário (abrir, expandir, confirmar) e mostra o que mudou. Nada de animação de entrada em cada bloco.
- **Texto da interface:**
  - escrito do ponto de vista de quem usa, com voz ativa e frases em caixa normal;
  - o botão diz exatamente o que acontece, e a mesma ação mantém o mesmo nome no fluxo inteiro (botão "Publicar", aviso "Publicado");
  - mensagem de erro diz o que aconteceu e como resolver, sem pedir desculpa;
  - tela vazia convida a agir.
- **Qualidade mínima:** funciona até a largura de celular, foco visível no teclado, contraste acessível e respeito à preferência de reduzir movimento.
- **Autocrítica:** confira com screenshot antes de entregar e tire um enfeite antes de mostrar.
