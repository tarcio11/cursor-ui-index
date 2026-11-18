---
name: tela
description: Cria telas novas como rascunho visual com os componentes reais do design system, para o usuário ajustar até ficar bom (como um artefato) antes de virar código do produto. Use quando pedirem uma tela ou página nova, mandarem uma referência visual (print, link, outra tela, ideia) ou digitarem /tela. Para levar um rascunho aprovado para a rota real, use /tela promover.
---

# Tela: rascunho visual que o usuário ajusta até ficar bom

O rascunho é código de verdade: usa os componentes reais do projeto e dados fictícios, numa rota que só existe em desenvolvimento. Nada é ligado a API nem às rotas do produto até a promoção.

## Onde as coisas ficam

- Rascunhos: `<<RASCUNHOS>>/<slug>/`, com `index.tsx` (título, referência e variantes), `VarianteA.tsx`, `VarianteB.tsx`... e `dados.ts` (dados fictícios).
- Infraestrutura (não edite): `<<RASCUNHOS>>/RascunhosPage.tsx` e `<<RASCUNHOS>>/tipos.ts`. Em `<<RASCUNHOS>>/registro.ts`, só adicione ou remova rascunhos.
- Endereços, no servidor de desenvolvimento:
  - `/dev/rascunhos?r=<slug>`: moldura com abas de variantes e tamanhos de tela (celular, tablet, desktop);
  - `/dev/rascunhos?r=<slug>&v=<letra>&bare=1`: só a variante, sem moldura. É nesse endereço que o usuário anota com o Design Mode.
- Servidor de desenvolvimento: se já houver um rodando, use ele. Se não, rode `<<DEV_CMD>>` dentro de `<<APP>>` e use o endereço que ele mostrar.
- Typecheck: `<<TYPECHECK>>` dentro de `<<APP>>`.
- Skill de estética do projeto: `<<ESTETICA>>` (se estiver `nenhuma`, use só o arquivo de referência desta skill).

## Modo criar (padrão)

1. **Entender o pedido.** Veja o que veio como referência:
   - imagem colada: use como alvo visual;
   - link: abra no browser e tire screenshot;
   - "parecida com a tela X": encontre a rota com `list_routes` e `get_route` e abra no browser;
   - só texto: trabalhe com a descrição.

   Escreva em até 3 linhas: quem usa a tela, a tarefa principal e a informação mais importante. Se faltar algo que muda a tela inteira (por exemplo, se é uma listagem ou um formulário), faça uma pergunta e espere a resposta. O resto, decida e diga o que decidiu.
2. **Estética.** Leia o arquivo `references/estetica-com-design-system.md` desta skill e a skill de estética do projeto. O arquivo de referência vale por cima da skill de estética.
3. **Plano de reaproveitamento.** Faça as etapas 1, 2, 3 e 4 da regra `reuse-first-ui` (decompor, buscar no `ui-index`, rotas e telas parecidas, tabela). Entregue a tabela e siga sem esperar aprovação: rascunho não vai para o produto.
4. **Plano visual.** Antes de escrever código, escreva um wireframe em ASCII, o alinhamento, o único ponto de destaque da tela e os estados (carregando, vazio, erro). Revise o plano contra o pedido: o que parecer padrão genérico (por exemplo, tudo em cards iguais), troque e diga por quê.
5. **Criar o rascunho.**
   1. `slug` em kebab-case com o nome da tela (por exemplo, `vendas-por-parceiro`). Se a pasta já existir, escolha outro.
   2. `dados.ts`: dados fictícios realistas, no idioma e no assunto da tela (nada de "Lorem ipsum" ou "Item 1"). Inclua casos de borda: texto longo, lista vazia, número grande.
   3. `VarianteA.tsx`: a tela inteira, só com componentes do design system e componentes locais encontrados no índice. Sem chamada de API, sem router e sem estado global: tudo vem de `dados.ts`. Se a tela tiver estados (carregando, vazio, erro), mostre-os com um seletor simples no topo da variante.
   4. `index.tsx`, neste formato:

      ```tsx
      import type { Rascunho } from '../tipos';
      import VarianteA from './VarianteA';

      const rascunho: Rascunho = {
        slug: 'vendas-por-parceiro',
        titulo: 'Vendas por parceiro',
        referencia: 'print enviado no chat',
        variantes: [
          { id: 'A', nome: 'Tabela densa', descricao: 'Muitos parceiros por tela, foco em comparar', Componente: VarianteA },
        ],
      };

      export default rascunho;
      ```
   5. `registro.ts`: adicione o import (`import vendasPorParceiro from './vendas-por-parceiro';`) e o item na lista `rascunhos`.
   6. Rode o typecheck e corrija os erros dos arquivos do rascunho.
6. **Conferir antes de mostrar.** Abra `/dev/rascunhos?r=<slug>` no browser e confira o console sem erros. Tire screenshot nos tamanhos Desktop e Celular. Compare com a referência e com o plano visual e corrija o que estiver errado (alinhamento, quebra no celular, contraste, texto cortado, espaço sobrando). Faça uma rodada disso.
7. **Entregar.** Responda com:
   - o endereço do rascunho;
   - a tabela de reaproveitamento;
   - em 2 a 4 linhas, o que você fez e por quê;
   - as dúvidas que ficaram;
   - como ajustar: no browser do Agents Window, abrir a variante sozinha (`&v=A&bare=1`), ligar o Design Mode (Cmd/Ctrl + Shift + D) e clicar, desenhar ou falar o que mudar; ou pedir no chat.

## Modo ajustar

- A cada pedido de ajuste: altere a variante, confira de novo (passo 6 do modo criar) e diga o que mudou.
- "Me mostra outras opções": crie `VarianteB`, `VarianteC`... com direções de verdade diferentes (por exemplo, tabela densa, cards, lista com detalhe ao lado), nunca só troca de cor. Registre cada uma em `index.tsx`.
- Não apague variantes antigas sem o usuário pedir: elas são o histórico.
- Se o pedido precisar de algo que o design system não tem, diga isso e proponha COMPOR, ESTENDER ou CRIAR, como na tabela da regra.

## Modo promover (`/tela promover <slug> <variante>` ou quando o usuário aprovar)

Aqui a regra `reuse-first-ui` vale inteira, com a parada para aprovação.

1. **Plano de promoção:**
   - rota final: caminho, rota pai e layout (`list_routes`) e o arquivo onde a rota é registrada;
   - dados reais: de onde vêm (procure hooks e serviços existentes; se não achar, pergunte);
   - arquivos a criar e a alterar;
   - componentes novos e a pasta de cada um;
   - testes.

   PARE e peça aprovação.
2. **Implementar:** leve a variante aprovada para o lugar definitivo, troque `dados.ts` pelos dados reais e extraia componentes novos para as pastas certas, com JSDoc de uma linha. Nenhum import pode apontar para `<<RASCUNHOS>>`.
3. **Apagar o rascunho:** a pasta `<<RASCUNHOS>>/<slug>/`, o import e o item em `registro.ts`.
4. **Conferir:** `refresh_index` (ou `<<RUN>> <<P>>tools/ai-index/generate.mjs`), `get_route` na rota nova, typecheck, lint e testes do projeto, e abrir a rota real no browser.
5. **Responder** com a tabela final e o que foi feito.

## Proibido

- Importar qualquer coisa de `<<RASCUNHOS>>` em código do produto.
- Editar `RascunhosPage.tsx` e `tipos.ts`.
- Usar cor, fonte, espaçamento, sombra ou ícone fora do design system (detalhes em `references/estetica-com-design-system.md`).
