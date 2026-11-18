import type { Rascunho } from './tipos';

/**
 * Lista de rascunhos mostrada em /dev/rascunhos.
 * Ao criar um rascunho: importe o default de ./<slug> e adicione na lista.
 * Ao promover ou apagar um rascunho: remova o import e o item.
 */
export const rascunhos: Rascunho[] = [];
