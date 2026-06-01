# Refatoração do Módulo Cadastro Mestre de Insumos

Transformar o módulo atual (que carrega todos os ~6000 insumos em memória) em uma base corporativa escalável para 20.000+ registros, com importação SINAPI versionada, controle de acesso e busca otimizada.

## 1. Banco de dados (migration)

Estender o schema existente (sem quebrar o que já está em `insumos_mestre`, `insumo_categorias`, `unidades_medida`, `insumo_aliases`):

- `insumos_mestre`: adicionar `codigo_interno`, `descricao_completa`, `especificacao_tecnica`, `versao_sinapi`, `updated_by`. Já existem: `sinapi_codigo`, `imagem_url`, `normas_tecnicas`, `informacoes_gerais`, `ncm`, `created_by`.
- Índices novos: `idx_insumos_sinapi_codigo`, `idx_insumos_categoria`, `idx_insumos_ncm`, índice GIN `pg_trgm` sobre `descricao` para busca rápida `ILIKE`.
- Nova tabela `historico_importacoes_sinapi` (arquivo, versao_sinapi, usuario_id, data, total, novos, atualizados, ignorados, erros, status). GRANTs + RLS por empresa.
- Função RPC `import_sinapi_batch(_company, _versao, _rows jsonb)` que faz UPSERT em lote por `(company_id, sinapi_codigo)` retornando contadores.
- Função RPC `search_insumos(_company, _q, _categoria, _unidade, _ncm, _page, _page_size)` retornando linhas + count total para paginação server-side.
- Reaproveitar perfis existentes `company_role` (admin/editor/member) como ADMINISTRADOR (admin) e USUÁRIO (member/editor). Apenas admin importa/edita SINAPI; demais leem e usam.

## 2. Categorização automática

Função SQL `categorizar_descricao(_desc text)` com regras por palavra-chave (PVC/TUBO/REGISTRO→Hidráulica; CABO/DISJUNTOR/ELETRODUTO→Elétrica; VERGALHÃO/AÇO/TELA→Aço; CIMENTO/ARGAMASSA/GRAUTE→Concreto; MANTA/SELANTE→Impermeabilização; etc.). Usada durante o import; admin pode reclassificar manualmente na UI.

## 3. Storage de imagens

Bucket `sinapi-imagens` já existe. Adicionar políticas para upload/troca/delete por admins da empresa. Imagens ficam só como `imagem_url` na tabela.

## 4. UI — `_app.insumos.tsx` (reescrita)

- Substituir o load completo por **paginação server-side** via `search_insumos` (20/50/100 por página, exibe página atual / total).
- Barra de busca com debounce (300ms) — autocomplete por descrição ou código SINAPI.
- Filtros: categoria (select), unidade (select), NCM (text).
- Coluna de miniatura quando `imagem_url` existir; click amplia em dialog.
- Dialog de detalhe com todos os campos (código SINAPI, descrição, categoria, unidade, NCM, especificação, normas, versão, datas, criado/editado por).
- Edição/exclusão visível apenas para `admin`; demais perfis veem botão "Usar em orçamento/estoque/diário".
- Upload/troca/remoção de imagem (apenas admin).

## 5. UI — Importação SINAPI (`_app.insumos.importar.tsx`)

Nova rota acessível apenas por admin:

- Upload XLSX/CSV/ZIP (parse client-side com `xlsx` + JSZip para ZIP).
- Detecta colunas: `Código SINAPI`, `Descrição`, `Unidade`, `NCM`, `Normas`, `Imagem` (opcional).
- Campo obrigatório `versao_sinapi` (ex.: "2025-04").
- Envia em lotes de 500 registros via `import_sinapi_batch` (server function `import-sinapi.functions.ts`).
- Barra de progresso por lote.
- Ao final: relatório (total, novos, atualizados, ignorados, erros) e registro em `historico_importacoes_sinapi`.

## 6. Histórico

Aba "Histórico de importações" na tela de importação, lista os registros da tabela com paginação.

## 7. Server Functions

`src/lib/insumos.functions.ts` (createServerFn + requireSupabaseAuth):
- `searchInsumos({ q, categoria, unidade, ncm, page, pageSize })` → chama RPC.
- `importSinapiBatch({ versao, rows })` → admin only; chama RPC.
- `listImportHistory({ page, pageSize })`.

## Detalhes técnicos

```text
search_insumos RPC
  WHERE company_id = _company
    AND ativo
    AND (_q IS NULL OR descricao ILIKE '%'||_q||'%' OR sinapi_codigo = _q OR codigo = _q)
    AND (_categoria IS NULL OR categoria_id = _categoria)
    AND (_unidade IS NULL OR unidade_id = _unidade)
    AND (_ncm IS NULL OR ncm = _ncm)
  ORDER BY descricao
  LIMIT _page_size OFFSET (_page-1)*_page_size
+ COUNT(*) OVER() AS total
```

```text
import_sinapi_batch
  FOR row IN rows:
    INSERT ... ON CONFLICT (company_id, sinapi_codigo) DO UPDATE
      SET descricao, unidade_id, ncm, normas_tecnicas, versao_sinapi,
          imagem_url = COALESCE(EXCLUDED.imagem_url, insumos_mestre.imagem_url),
          updated_by = auth.uid(), updated_at = now()
    -- contar novos vs atualizados via xmax = 0
```

Migration entrega: novas colunas + índices + tabela histórico + RPCs + função de categorização + políticas storage. UI entrega: lista paginada, busca, dialog detalhado, tela de importação, histórico.

## O que NÃO está no escopo

- Migrar consumidores (orçamentos/estoque/diário) para nova busca paginada — eles continuam usando os mesmos selects que já fazem; só ganham acesso aos novos campos.
- Tradução automática de categorias antigas — admin reclassifica conforme necessário.