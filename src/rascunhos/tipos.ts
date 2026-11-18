import type { ComponentType } from 'react';

/** Uma variante de um rascunho de tela. */
export interface VarianteRascunho {
  /** Letra da variante, por exemplo "A". */
  id: string;
  /** Nome curto mostrado na aba, por exemplo "Tabela densa". */
  nome: string;
  /** O que essa variante tenta, em uma linha. */
  descricao?: string;
  /** A tela inteira desta variante, só com dados fictícios. */
  Componente: ComponentType;
}

/** Um rascunho de tela criado pela skill "tela". */
export interface Rascunho {
  /** Identificador em kebab-case, igual ao nome da pasta do rascunho. */
  slug: string;
  /** Nome da tela. */
  titulo: string;
  /** Link ou descrição curta da referência usada. */
  referencia?: string;
  /** Variantes na ordem em que aparecem nas abas (a primeira abre por padrão). */
  variantes: VarianteRascunho[];
}
