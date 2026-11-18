'use client';
/**
 * Página de rascunhos de tela, só para desenvolvimento (skill "tela" do cursor-ui-index).
 * Não edite este arquivo. Os rascunhos ficam em ./<slug>/ e são registrados em ./registro.ts.
 *
 *   /dev/rascunhos                       lista de rascunhos
 *   /dev/rascunhos?r=<slug>              moldura com as variantes e os tamanhos de tela
 *   /dev/rascunhos?r=<slug>&v=A&bare=1   só a variante, sem moldura (use esta para anotar com o Design Mode)
 */
import * as React from 'react';
import { rascunhos } from './registro';
import type { Rascunho, VarianteRascunho } from './tipos';

const TAMANHOS = [
  { id: 'celular', nome: 'Celular', largura: 375 },
  { id: 'tablet', nome: 'Tablet', largura: 768 },
  { id: 'desktop', nome: 'Desktop', largura: 1280 },
  { id: 'livre', nome: 'Largura total', largura: 0 },
];

interface Parametros {
  rascunho: string | null;
  variante: string | null;
  tamanho: string | null;
  sozinha: boolean;
}

type Navegar = (mudancas: Record<string, string | null>) => void;

function lerParametros(): Parametros {
  const busca = new URLSearchParams(window.location.search);
  return {
    rascunho: busca.get('r'),
    variante: busca.get('v'),
    tamanho: busca.get('t'),
    sozinha: busca.get('bare') === '1',
  };
}

function urlCom(mudancas: Record<string, string | null>): string {
  const busca = new URLSearchParams(window.location.search);
  for (const [chave, valor] of Object.entries(mudancas)) {
    if (valor === null) busca.delete(chave);
    else busca.set(chave, valor);
  }
  const texto = busca.toString();
  return window.location.pathname + (texto ? `?${texto}` : '');
}

function css(estilo: React.CSSProperties): React.CSSProperties {
  return estilo;
}

const FONTE = "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";

const s = {
  tela: css({
    position: 'fixed',
    inset: 0,
    zIndex: 2147483000,
    display: 'flex',
    flexDirection: 'column',
    background: '#f4f4f5',
    color: '#18181b',
    fontFamily: FONTE,
    fontSize: 14,
    lineHeight: 1.4,
  }),
  lista: css({ maxWidth: 720, width: '100%', margin: '0 auto', padding: '40px 24px', overflowY: 'auto' }),
  tituloLista: css({ fontSize: 24, fontWeight: 600, margin: '0 0 8px' }),
  apoio: css({ margin: '0 0 24px', color: '#52525b' }),
  itens: css({ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 8 }),
  item: css({
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
    width: '100%',
    textAlign: 'left',
    padding: '12px 16px',
    background: '#ffffff',
    border: '1px solid #d4d4d8',
    borderRadius: 8,
    cursor: 'pointer',
    font: 'inherit',
    color: 'inherit',
  }),
  itemTitulo: css({ fontWeight: 600, fontSize: 15 }),
  itemDetalhe: css({ color: '#52525b', fontSize: 13 }),
  topo: css({
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 12,
    padding: '10px 16px',
    background: '#ffffff',
    borderBottom: '1px solid #d4d4d8',
  }),
  titulo: css({ fontSize: 16, fontWeight: 600, margin: 0, marginRight: 'auto' }),
  grupo: css({ display: 'flex', flexWrap: 'wrap', gap: 4 }),
  botao: css({
    padding: '6px 10px',
    background: '#ffffff',
    border: '1px solid #d4d4d8',
    borderRadius: 6,
    cursor: 'pointer',
    font: 'inherit',
    color: 'inherit',
  }),
  botaoAtivo: css({
    padding: '6px 10px',
    background: '#18181b',
    border: '1px solid #18181b',
    borderRadius: 6,
    cursor: 'pointer',
    font: 'inherit',
    color: '#ffffff',
  }),
  link: css({ color: '#1d4ed8', textDecoration: 'underline', background: 'none', border: 0, padding: 0, cursor: 'pointer', font: 'inherit' }),
  info: css({ display: 'flex', flexWrap: 'wrap', gap: 16, padding: '8px 16px', color: '#52525b', fontSize: 13 }),
  palco: css({ flex: 1, minHeight: 0, display: 'flex', justifyContent: 'center', padding: 16, overflow: 'auto' }),
  moldura: css({ height: '100%', minHeight: 480, border: '1px solid #d4d4d8', borderRadius: 4, background: '#ffffff' }),
};

function Lista({ abrir }: { abrir: (slug: string) => void }) {
  return (
    <div style={s.tela}>
      <main style={s.lista}>
        <h1 style={s.tituloLista}>Rascunhos de tela</h1>
        <p style={s.apoio}>Rascunhos com os componentes reais e dados fictícios. Esta página só existe em desenvolvimento.</p>
        {rascunhos.length === 0 ? (
          <p style={s.apoio}>Nenhum rascunho ainda. Peça uma tela ao agent com /tela e ela aparece aqui.</p>
        ) : (
          <ul style={s.itens}>
            {rascunhos.map((item) => (
              <li key={item.slug}>
                <button type="button" style={s.item} onClick={() => abrir(item.slug)}>
                  <span style={s.itemTitulo}>{item.titulo}</span>
                  <span style={s.itemDetalhe}>
                    {item.slug}, {item.variantes.length === 1 ? '1 variante' : `${item.variantes.length} variantes`}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}

function Aviso({ texto, voltar }: { texto: string; voltar: () => void }) {
  return (
    <div style={s.tela}>
      <main style={s.lista}>
        <h1 style={s.tituloLista}>{texto}</h1>
        <button type="button" style={s.link} onClick={voltar}>
          Ver todos os rascunhos
        </button>
      </main>
    </div>
  );
}

function Moldura({
  rascunho,
  variante,
  tamanho,
  navegar,
}: {
  rascunho: Rascunho;
  variante: VarianteRascunho;
  tamanho: string | null;
  navegar: Navegar;
}) {
  const atual = TAMANHOS.find((item) => item.id === tamanho) ?? TAMANHOS.find((item) => item.id === 'desktop');
  const largura = atual && atual.largura > 0 ? `${atual.largura}px` : '100%';
  const enderecoSozinha = urlCom({ v: variante.id, bare: '1', t: null });

  return (
    <div style={s.tela}>
      <header style={s.topo}>
        <button type="button" style={s.link} onClick={() => navegar({ r: null, v: null, t: null })}>
          Rascunhos
        </button>
        <h1 style={s.titulo}>{rascunho.titulo}</h1>
        <nav aria-label="Variantes" style={s.grupo}>
          {rascunho.variantes.map((item) => (
            <button
              key={item.id}
              type="button"
              aria-pressed={item.id === variante.id}
              style={item.id === variante.id ? s.botaoAtivo : s.botao}
              onClick={() => navegar({ v: item.id })}
            >
              {item.id}. {item.nome}
            </button>
          ))}
        </nav>
        <nav aria-label="Tamanho da tela" style={s.grupo}>
          {TAMANHOS.map((item) => (
            <button
              key={item.id}
              type="button"
              aria-pressed={item.id === atual?.id}
              style={item.id === atual?.id ? s.botaoAtivo : s.botao}
              onClick={() => navegar({ t: item.id })}
            >
              {item.nome}
            </button>
          ))}
        </nav>
        <a href={enderecoSozinha} style={s.link}>
          Abrir só a variante para anotar
        </a>
      </header>
      {variante.descricao || rascunho.referencia ? (
        <div style={s.info}>
          {variante.descricao ? <span>{variante.descricao}</span> : null}
          {rascunho.referencia ? <span>Referência: {rascunho.referencia}</span> : null}
        </div>
      ) : null}
      <div style={s.palco}>
        <iframe
          key={enderecoSozinha}
          title={`${rascunho.titulo}, variante ${variante.id}`}
          src={enderecoSozinha}
          style={{ ...s.moldura, width: largura, maxWidth: '100%' }}
        />
      </div>
    </div>
  );
}

/** Página de rascunhos de tela (só em desenvolvimento). */
export default function RascunhosPage() {
  const [parametros, setParametros] = React.useState<Parametros | null>(null);

  React.useEffect(() => {
    const atualizar = () => setParametros(lerParametros());
    atualizar();
    window.addEventListener('popstate', atualizar);
    return () => window.removeEventListener('popstate', atualizar);
  }, []);

  const navegar = React.useCallback<Navegar>((mudancas) => {
    window.history.pushState(null, '', urlCom(mudancas));
    setParametros(lerParametros());
  }, []);

  if (!parametros) return null;

  const voltar = () => navegar({ r: null, v: null, t: null, bare: null });
  if (!parametros.rascunho) return <Lista abrir={(slug) => navegar({ r: slug, v: null, t: null, bare: null })} />;

  const rascunho = rascunhos.find((item) => item.slug === parametros.rascunho);
  if (!rascunho) return <Aviso texto={`Rascunho "${parametros.rascunho}" não encontrado`} voltar={voltar} />;

  const variante = rascunho.variantes.find((item) => item.id === parametros.variante) ?? rascunho.variantes[0];
  if (!variante) return <Aviso texto={`O rascunho "${rascunho.titulo}" não tem variantes`} voltar={voltar} />;

  if (parametros.sozinha) {
    const Tela = variante.Componente;
    return <Tela />;
  }

  return <Moldura rascunho={rascunho} variante={variante} tamanho={parametros.tamanho} navegar={navegar} />;
}
