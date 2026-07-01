## Fase I — Testes E2E do Boletim de Medição (Playwright)

Cobertura end-to-end do fluxo completo do módulo BM, executável no sandbox contra `http://localhost:8080` usando a sessão Supabase injetada.

### Escopo dos cenários

1. **Import de orçamento** — abrir wizard, subir planilha de exemplo, mapear colunas, confirmar preview, criar versão em rascunho e congelar.
2. **Lançamento do BM** — abrir medição, digitar quantidades na grade hierárquica, colar bloco Excel, salvar em lote, ver totais/saldos atualizados.
3. **Extrapolação com justificativa** — lançar quantidade > saldo, validar bloqueio até preencher justificativa (≥10 chars).
4. **Conferência automática** — disparar `runConferencia`, validar 12 checks e o bloqueio do botão "Validar medição" quando há erro.
5. **Workflow de aprovação** — enviar para conferência → aprovar (ou rejeitar/solicitar revisão com motivo) → conferir badges, histórico e trilha de auditoria.
6. **Painel executivo** — validar 16 KPIs, curva S e Top 8 offenders após aprovação.
7. **Anexos** — upload de arquivo em cada categoria, download via signed URL, remoção com log.
8. **Impactos contratuais** — aditivo + reajuste aplicados, conferir valor ajustado e delta de prazo no `ContratoImpactosPanel`.
9. **Export PDF/XLSX** — gerar ambos e validar bytes/estrutura mínima.

### Estrutura técnica

```text
/tmp/browser/bm-e2e/
  fixtures/
    orcamento-exemplo.xlsx     (gerado via xlsxwriter)
    anexo-foto.jpg
  helpers/
    auth.py                    (restore sessão Supabase — sb cookies + localStorage)
    seed.py                    (cria company/obra/contrato via SQL antes do teste)
    cleanup.py                 (rollback do estado seed)
  scenarios/
    01_import.py
    02_lancamento.py
    03_extrapolacao.py
    04_conferencia.py
    05_workflow.py
    06_executivo.py
    07_anexos.py
    08_contrato.py
    09_export.py
  run_all.sh
  screenshots/                 (evidência por passo)
```

- Cada cenário isola state: cria medição própria, executa fluxo, coleta screenshots.
- Selectors estáveis via `get_by_role`/`aria-label` (adicionar `aria-label` nos pontos onde faltar).
- Seed usa `supabase--insert` direto no banco (company, obra, contrato base) para evitar dependência do onboarding.
- Cleanup roda no `finally` de cada script.

### Ajustes prévios de código

- Adicionar `aria-label` em botões críticos do BM que hoje só têm ícone (salvar, aprovar, enviar, adicionar anexo, remover linha).
- Nenhuma mudança de lógica de negócio.

### Entrega

1. Ajustes de acessibilidade (`aria-label`) na tela de medição.
2. Fixtures + helpers em `/tmp/browser/bm-e2e/`.
3. 9 scripts de cenário + `run_all.sh` agregador.
4. Execução completa dos cenários com screenshots como evidência.
5. Relatório final: passou/falhou por cenário + prints anexados.

Após concluída a Fase I, sigo para os itens 2–5 (Notificações, Integração financeira, Relatório multi-BM, Mobile/PWA) na ordem apresentada.
