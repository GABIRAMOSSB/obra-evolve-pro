export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      aditivos_contratuais: {
        Row: {
          aplicado_em: string | null
          company_id: string
          contrato_id: string
          created_at: string
          created_by: string | null
          data_assinatura: string | null
          id: string
          justificativa: string | null
          metadata: Json
          numero: number
          prazo_dias_delta: number
          status: string
          tipo: string
          updated_at: string
          valor_delta: number
        }
        Insert: {
          aplicado_em?: string | null
          company_id: string
          contrato_id: string
          created_at?: string
          created_by?: string | null
          data_assinatura?: string | null
          id?: string
          justificativa?: string | null
          metadata?: Json
          numero: number
          prazo_dias_delta?: number
          status?: string
          tipo: string
          updated_at?: string
          valor_delta?: number
        }
        Update: {
          aplicado_em?: string | null
          company_id?: string
          contrato_id?: string
          created_at?: string
          created_by?: string | null
          data_assinatura?: string | null
          id?: string
          justificativa?: string | null
          metadata?: Json
          numero?: number
          prazo_dias_delta?: number
          status?: string
          tipo?: string
          updated_at?: string
          valor_delta?: number
        }
        Relationships: [
          {
            foreignKeyName: "aditivos_contratuais_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "aditivos_contratuais_contrato_id_fkey"
            columns: ["contrato_id"]
            isOneToOne: false
            referencedRelation: "contratos"
            referencedColumns: ["id"]
          },
        ]
      }
      apontamentos_mao_obra: {
        Row: {
          centro_custo: string | null
          centro_custo_id: string | null
          company_id: string
          created_at: string
          created_by: string | null
          custo_hora: number
          custo_total: number
          data: string
          diary_entry_id: string | null
          equipamento_id: string | null
          equipe_id: string | null
          frente_servico: string | null
          funcao_id: string | null
          funcionario_id: string | null
          horas_extras: number
          horas_normais: number
          id: string
          item_codigo: string | null
          item_descricao: string | null
          item_key: string | null
          jornada_horas: number
          obra_id: string
          observacoes: string | null
          quantidade_executada: number | null
          quantidade_pessoas: number
          recurso_nome: string | null
          recurso_tipo: string
          unidade: string | null
          updated_at: string
        }
        Insert: {
          centro_custo?: string | null
          centro_custo_id?: string | null
          company_id: string
          created_at?: string
          created_by?: string | null
          custo_hora?: number
          custo_total?: number
          data: string
          diary_entry_id?: string | null
          equipamento_id?: string | null
          equipe_id?: string | null
          frente_servico?: string | null
          funcao_id?: string | null
          funcionario_id?: string | null
          horas_extras?: number
          horas_normais?: number
          id?: string
          item_codigo?: string | null
          item_descricao?: string | null
          item_key?: string | null
          jornada_horas?: number
          obra_id: string
          observacoes?: string | null
          quantidade_executada?: number | null
          quantidade_pessoas?: number
          recurso_nome?: string | null
          recurso_tipo?: string
          unidade?: string | null
          updated_at?: string
        }
        Update: {
          centro_custo?: string | null
          centro_custo_id?: string | null
          company_id?: string
          created_at?: string
          created_by?: string | null
          custo_hora?: number
          custo_total?: number
          data?: string
          diary_entry_id?: string | null
          equipamento_id?: string | null
          equipe_id?: string | null
          frente_servico?: string | null
          funcao_id?: string | null
          funcionario_id?: string | null
          horas_extras?: number
          horas_normais?: number
          id?: string
          item_codigo?: string | null
          item_descricao?: string | null
          item_key?: string | null
          jornada_horas?: number
          obra_id?: string
          observacoes?: string | null
          quantidade_executada?: number | null
          quantidade_pessoas?: number
          recurso_nome?: string | null
          recurso_tipo?: string
          unidade?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "apontamentos_mao_obra_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "centros_custo"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "apontamentos_mao_obra_equipe_id_fkey"
            columns: ["equipe_id"]
            isOneToOne: false
            referencedRelation: "equipes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "apontamentos_mao_obra_funcao_id_fkey"
            columns: ["funcao_id"]
            isOneToOne: false
            referencedRelation: "funcoes_mao_obra"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "apontamentos_mao_obra_funcionario_id_fkey"
            columns: ["funcionario_id"]
            isOneToOne: false
            referencedRelation: "funcionarios"
            referencedColumns: ["id"]
          },
        ]
      }
      arts: {
        Row: {
          company_id: string
          conselho: string | null
          contratante: string | null
          created_at: string
          data_emissao: string | null
          data_inicio: string | null
          data_termino: string | null
          id: string
          nome_arquivo: string | null
          numero_art: string
          objeto: string | null
          observacoes: string | null
          responsavel_id: string | null
          status: string | null
          storage_path: string | null
          tamanho_bytes: number | null
          tipo: string | null
          uf: string | null
          updated_at: string
          valor_contrato: number | null
        }
        Insert: {
          company_id: string
          conselho?: string | null
          contratante?: string | null
          created_at?: string
          data_emissao?: string | null
          data_inicio?: string | null
          data_termino?: string | null
          id?: string
          nome_arquivo?: string | null
          numero_art: string
          objeto?: string | null
          observacoes?: string | null
          responsavel_id?: string | null
          status?: string | null
          storage_path?: string | null
          tamanho_bytes?: number | null
          tipo?: string | null
          uf?: string | null
          updated_at?: string
          valor_contrato?: number | null
        }
        Update: {
          company_id?: string
          conselho?: string | null
          contratante?: string | null
          created_at?: string
          data_emissao?: string | null
          data_inicio?: string | null
          data_termino?: string | null
          id?: string
          nome_arquivo?: string | null
          numero_art?: string
          objeto?: string | null
          observacoes?: string | null
          responsavel_id?: string | null
          status?: string | null
          storage_path?: string | null
          tamanho_bytes?: number | null
          tipo?: string | null
          uf?: string | null
          updated_at?: string
          valor_contrato?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "arts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "arts_responsavel_id_fkey"
            columns: ["responsavel_id"]
            isOneToOne: false
            referencedRelation: "responsaveis_tecnicos"
            referencedColumns: ["id"]
          },
        ]
      }
      atestados: {
        Row: {
          company_id: string
          contratante_cnpj: string | null
          contratante_nome: string | null
          created_at: string
          data_emissao: string | null
          id: string
          nome_arquivo: string | null
          objeto: string | null
          observacoes: string | null
          periodo_fim: string | null
          periodo_inicio: string | null
          responsavel_id: string | null
          storage_path: string | null
          tamanho_bytes: number | null
          titulo: string
          updated_at: string
          valor: number | null
        }
        Insert: {
          company_id: string
          contratante_cnpj?: string | null
          contratante_nome?: string | null
          created_at?: string
          data_emissao?: string | null
          id?: string
          nome_arquivo?: string | null
          objeto?: string | null
          observacoes?: string | null
          periodo_fim?: string | null
          periodo_inicio?: string | null
          responsavel_id?: string | null
          storage_path?: string | null
          tamanho_bytes?: number | null
          titulo: string
          updated_at?: string
          valor?: number | null
        }
        Update: {
          company_id?: string
          contratante_cnpj?: string | null
          contratante_nome?: string | null
          created_at?: string
          data_emissao?: string | null
          id?: string
          nome_arquivo?: string | null
          objeto?: string | null
          observacoes?: string | null
          periodo_fim?: string | null
          periodo_inicio?: string | null
          responsavel_id?: string | null
          storage_path?: string | null
          tamanho_bytes?: number | null
          titulo?: string
          updated_at?: string
          valor?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "atestados_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "atestados_responsavel_id_fkey"
            columns: ["responsavel_id"]
            isOneToOne: false
            referencedRelation: "responsaveis_tecnicos"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs_v2: {
        Row: {
          acao: string
          company_id: string
          created_at: string
          entidade: string | null
          entidade_id: string | null
          erro: string | null
          id: string
          ip: string | null
          justificativa: string | null
          modulo: string
          payload_antes: Json | null
          payload_depois: Json | null
          payload_hash: string | null
          resultado: string
          user_agent: string | null
          user_email: string | null
          user_id: string | null
          versao: string | null
        }
        Insert: {
          acao: string
          company_id: string
          created_at?: string
          entidade?: string | null
          entidade_id?: string | null
          erro?: string | null
          id?: string
          ip?: string | null
          justificativa?: string | null
          modulo: string
          payload_antes?: Json | null
          payload_depois?: Json | null
          payload_hash?: string | null
          resultado?: string
          user_agent?: string | null
          user_email?: string | null
          user_id?: string | null
          versao?: string | null
        }
        Update: {
          acao?: string
          company_id?: string
          created_at?: string
          entidade?: string | null
          entidade_id?: string | null
          erro?: string | null
          id?: string
          ip?: string | null
          justificativa?: string | null
          modulo?: string
          payload_antes?: Json | null
          payload_depois?: Json | null
          payload_hash?: string | null
          resultado?: string
          user_agent?: string | null
          user_email?: string | null
          user_id?: string | null
          versao?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_v2_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      biblioteca_documentos: {
        Row: {
          ativo: boolean
          categoria: string
          company_id: string
          created_at: string
          created_by: string | null
          data_emissao: string | null
          data_validade: string | null
          descricao: string | null
          emissor: string | null
          id: string
          mime_type: string | null
          nome: string
          nome_arquivo: string
          numero_documento: string | null
          storage_path: string
          tags: string[]
          tamanho_bytes: number | null
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          categoria: string
          company_id: string
          created_at?: string
          created_by?: string | null
          data_emissao?: string | null
          data_validade?: string | null
          descricao?: string | null
          emissor?: string | null
          id?: string
          mime_type?: string | null
          nome: string
          nome_arquivo: string
          numero_documento?: string | null
          storage_path: string
          tags?: string[]
          tamanho_bytes?: number | null
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          categoria?: string
          company_id?: string
          created_at?: string
          created_by?: string | null
          data_emissao?: string | null
          data_validade?: string | null
          descricao?: string | null
          emissor?: string | null
          id?: string
          mime_type?: string | null
          nome?: string
          nome_arquivo?: string
          numero_documento?: string | null
          storage_path?: string
          tags?: string[]
          tamanho_bytes?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "biblioteca_documentos_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      boletim_anexos: {
        Row: {
          categoria: string | null
          company_id: string
          created_at: string
          created_by: string | null
          descricao: string | null
          id: string
          medicao_id: string
          mime_type: string | null
          nome: string
          storage_path: string
          tamanho_bytes: number | null
        }
        Insert: {
          categoria?: string | null
          company_id: string
          created_at?: string
          created_by?: string | null
          descricao?: string | null
          id?: string
          medicao_id: string
          mime_type?: string | null
          nome: string
          storage_path: string
          tamanho_bytes?: number | null
        }
        Update: {
          categoria?: string | null
          company_id?: string
          created_at?: string
          created_by?: string | null
          descricao?: string | null
          id?: string
          medicao_id?: string
          mime_type?: string | null
          nome?: string
          storage_path?: string
          tamanho_bytes?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "boletim_anexos_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "boletim_anexos_medicao_id_fkey"
            columns: ["medicao_id"]
            isOneToOne: false
            referencedRelation: "medicoes"
            referencedColumns: ["id"]
          },
        ]
      }
      boletim_aprovacoes: {
        Row: {
          aprovador_id: string | null
          aprovador_nome: string | null
          company_id: string
          created_at: string
          decidido_em: string
          decisao: string
          id: string
          justificativa: string | null
          medicao_id: string
          metadata: Json
          papel: string
        }
        Insert: {
          aprovador_id?: string | null
          aprovador_nome?: string | null
          company_id: string
          created_at?: string
          decidido_em?: string
          decisao: string
          id?: string
          justificativa?: string | null
          medicao_id: string
          metadata?: Json
          papel?: string
        }
        Update: {
          aprovador_id?: string | null
          aprovador_nome?: string | null
          company_id?: string
          created_at?: string
          decidido_em?: string
          decisao?: string
          id?: string
          justificativa?: string | null
          medicao_id?: string
          metadata?: Json
          papel?: string
        }
        Relationships: [
          {
            foreignKeyName: "boletim_aprovacoes_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "boletim_aprovacoes_medicao_id_fkey"
            columns: ["medicao_id"]
            isOneToOne: false
            referencedRelation: "medicoes"
            referencedColumns: ["id"]
          },
        ]
      }
      boletim_audit_logs: {
        Row: {
          acao: string
          ator_id: string | null
          ator_nome: string | null
          campo: string | null
          company_id: string
          created_at: string
          entidade: string
          entidade_id: string | null
          id: string
          ip_origem: string | null
          justificativa: string | null
          medicao_id: string | null
          valor_anterior: Json | null
          valor_novo: Json | null
        }
        Insert: {
          acao: string
          ator_id?: string | null
          ator_nome?: string | null
          campo?: string | null
          company_id: string
          created_at?: string
          entidade: string
          entidade_id?: string | null
          id?: string
          ip_origem?: string | null
          justificativa?: string | null
          medicao_id?: string | null
          valor_anterior?: Json | null
          valor_novo?: Json | null
        }
        Update: {
          acao?: string
          ator_id?: string | null
          ator_nome?: string | null
          campo?: string | null
          company_id?: string
          created_at?: string
          entidade?: string
          entidade_id?: string | null
          id?: string
          ip_origem?: string | null
          justificativa?: string | null
          medicao_id?: string | null
          valor_anterior?: Json | null
          valor_novo?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "boletim_audit_logs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "boletim_audit_logs_medicao_id_fkey"
            columns: ["medicao_id"]
            isOneToOne: false
            referencedRelation: "medicoes"
            referencedColumns: ["id"]
          },
        ]
      }
      cartas_proposta: {
        Row: {
          company_id: string
          condicoes_pagamento: string | null
          conteudo_html: string | null
          conteudo_md: string
          created_at: string
          created_by: string | null
          hash_sha256: string | null
          id: string
          prazo_execucao_dias: number | null
          proposta_id: string
          signature_request_id: string | null
          storage_path: string | null
          updated_at: string
          validade_dias: number | null
          versao: number
        }
        Insert: {
          company_id: string
          condicoes_pagamento?: string | null
          conteudo_html?: string | null
          conteudo_md: string
          created_at?: string
          created_by?: string | null
          hash_sha256?: string | null
          id?: string
          prazo_execucao_dias?: number | null
          proposta_id: string
          signature_request_id?: string | null
          storage_path?: string | null
          updated_at?: string
          validade_dias?: number | null
          versao?: number
        }
        Update: {
          company_id?: string
          condicoes_pagamento?: string | null
          conteudo_html?: string | null
          conteudo_md?: string
          created_at?: string
          created_by?: string | null
          hash_sha256?: string | null
          id?: string
          prazo_execucao_dias?: number | null
          proposta_id?: string
          signature_request_id?: string | null
          storage_path?: string | null
          updated_at?: string
          validade_dias?: number | null
          versao?: number
        }
        Relationships: [
          {
            foreignKeyName: "cartas_proposta_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cartas_proposta_proposta_id_fkey"
            columns: ["proposta_id"]
            isOneToOne: false
            referencedRelation: "propostas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cartas_proposta_signature_request_id_fkey"
            columns: ["signature_request_id"]
            isOneToOne: false
            referencedRelation: "signature_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      cats: {
        Row: {
          atestado_id: string | null
          atividades: string | null
          company_id: string
          conselho: string | null
          created_at: string
          data_emissao: string | null
          id: string
          nome_arquivo: string | null
          numero_cat: string
          observacoes: string | null
          responsavel_id: string | null
          storage_path: string | null
          tamanho_bytes: number | null
          uf: string | null
          updated_at: string
        }
        Insert: {
          atestado_id?: string | null
          atividades?: string | null
          company_id: string
          conselho?: string | null
          created_at?: string
          data_emissao?: string | null
          id?: string
          nome_arquivo?: string | null
          numero_cat: string
          observacoes?: string | null
          responsavel_id?: string | null
          storage_path?: string | null
          tamanho_bytes?: number | null
          uf?: string | null
          updated_at?: string
        }
        Update: {
          atestado_id?: string | null
          atividades?: string | null
          company_id?: string
          conselho?: string | null
          created_at?: string
          data_emissao?: string | null
          id?: string
          nome_arquivo?: string | null
          numero_cat?: string
          observacoes?: string | null
          responsavel_id?: string | null
          storage_path?: string | null
          tamanho_bytes?: number | null
          uf?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cats_atestado_id_fkey"
            columns: ["atestado_id"]
            isOneToOne: false
            referencedRelation: "atestados"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cats_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cats_responsavel_id_fkey"
            columns: ["responsavel_id"]
            isOneToOne: false
            referencedRelation: "responsaveis_tecnicos"
            referencedColumns: ["id"]
          },
        ]
      }
      centros_custo: {
        Row: {
          ativo: boolean
          codigo: string | null
          company_id: string
          created_at: string
          created_by: string | null
          descricao: string | null
          id: string
          nome: string
          ordem: number
          parent_id: string | null
          tipo: Database["public"]["Enums"]["centro_custo_tipo"]
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          codigo?: string | null
          company_id: string
          created_at?: string
          created_by?: string | null
          descricao?: string | null
          id?: string
          nome: string
          ordem?: number
          parent_id?: string | null
          tipo?: Database["public"]["Enums"]["centro_custo_tipo"]
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          codigo?: string | null
          company_id?: string
          created_at?: string
          created_by?: string | null
          descricao?: string | null
          id?: string
          nome?: string
          ordem?: number
          parent_id?: string | null
          tipo?: Database["public"]["Enums"]["centro_custo_tipo"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "centros_custo_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "centros_custo"
            referencedColumns: ["id"]
          },
        ]
      }
      certificate_checks: {
        Row: {
          certificate_type_id: string
          company_certificate_id: string | null
          company_id: string
          completed_at: string | null
          created_by: string | null
          duration_ms: number | null
          error_code: string | null
          error_message: string | null
          execution_mode: string
          http_status: number | null
          id: string
          provider: string | null
          provider_service_key: string | null
          raw_response_json: Json | null
          request_reference: string | null
          result_summary: string | null
          started_at: string
          status: string
          trigger_type: string
        }
        Insert: {
          certificate_type_id: string
          company_certificate_id?: string | null
          company_id: string
          completed_at?: string | null
          created_by?: string | null
          duration_ms?: number | null
          error_code?: string | null
          error_message?: string | null
          execution_mode: string
          http_status?: number | null
          id?: string
          provider?: string | null
          provider_service_key?: string | null
          raw_response_json?: Json | null
          request_reference?: string | null
          result_summary?: string | null
          started_at?: string
          status: string
          trigger_type: string
        }
        Update: {
          certificate_type_id?: string
          company_certificate_id?: string | null
          company_id?: string
          completed_at?: string | null
          created_by?: string | null
          duration_ms?: number | null
          error_code?: string | null
          error_message?: string | null
          execution_mode?: string
          http_status?: number | null
          id?: string
          provider?: string | null
          provider_service_key?: string | null
          raw_response_json?: Json | null
          request_reference?: string | null
          result_summary?: string | null
          started_at?: string
          status?: string
          trigger_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "certificate_checks_certificate_type_id_fkey"
            columns: ["certificate_type_id"]
            isOneToOne: false
            referencedRelation: "certificate_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "certificate_checks_company_certificate_id_fkey"
            columns: ["company_certificate_id"]
            isOneToOne: false
            referencedRelation: "company_certificates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "certificate_checks_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      certificate_types: {
        Row: {
          active: boolean
          automatic_enabled: boolean
          category: string
          city: string | null
          code: string
          created_at: string
          default_check_frequency_days: number
          default_warning_days: number
          description: string | null
          display_order: number
          id: string
          issuing_authority: string
          manual_upload_enabled: boolean
          name: string
          official_portal_url: string | null
          provider: string | null
          provider_service_key: string | null
          scope: string
          short_name: string
          state: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          automatic_enabled?: boolean
          category: string
          city?: string | null
          code: string
          created_at?: string
          default_check_frequency_days?: number
          default_warning_days?: number
          description?: string | null
          display_order?: number
          id?: string
          issuing_authority: string
          manual_upload_enabled?: boolean
          name: string
          official_portal_url?: string | null
          provider?: string | null
          provider_service_key?: string | null
          scope: string
          short_name: string
          state?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          automatic_enabled?: boolean
          category?: string
          city?: string | null
          code?: string
          created_at?: string
          default_check_frequency_days?: number
          default_warning_days?: number
          description?: string | null
          display_order?: number
          id?: string
          issuing_authority?: string
          manual_upload_enabled?: boolean
          name?: string
          official_portal_url?: string | null
          provider?: string | null
          provider_service_key?: string | null
          scope?: string
          short_name?: string
          state?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      certificate_versions: {
        Row: {
          api_provider: string | null
          authentication_code: string | null
          certificate_number: string | null
          company_certificate_id: string
          created_at: string
          created_by: string | null
          expiration_date: string | null
          file_hash: string | null
          file_name: string | null
          file_size: number | null
          id: string
          issue_date: string | null
          mime_type: string | null
          normalized_payload_json: Json | null
          provider_service_key: string | null
          raw_payload_json: Json | null
          source_type: string | null
          status: string | null
          status_message: string | null
          storage_path: string | null
          version_number: number
        }
        Insert: {
          api_provider?: string | null
          authentication_code?: string | null
          certificate_number?: string | null
          company_certificate_id: string
          created_at?: string
          created_by?: string | null
          expiration_date?: string | null
          file_hash?: string | null
          file_name?: string | null
          file_size?: number | null
          id?: string
          issue_date?: string | null
          mime_type?: string | null
          normalized_payload_json?: Json | null
          provider_service_key?: string | null
          raw_payload_json?: Json | null
          source_type?: string | null
          status?: string | null
          status_message?: string | null
          storage_path?: string | null
          version_number: number
        }
        Update: {
          api_provider?: string | null
          authentication_code?: string | null
          certificate_number?: string | null
          company_certificate_id?: string
          created_at?: string
          created_by?: string | null
          expiration_date?: string | null
          file_hash?: string | null
          file_name?: string | null
          file_size?: number | null
          id?: string
          issue_date?: string | null
          mime_type?: string | null
          normalized_payload_json?: Json | null
          provider_service_key?: string | null
          raw_payload_json?: Json | null
          source_type?: string | null
          status?: string | null
          status_message?: string | null
          storage_path?: string | null
          version_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "certificate_versions_company_certificate_id_fkey"
            columns: ["company_certificate_id"]
            isOneToOne: false
            referencedRelation: "company_certificates"
            referencedColumns: ["id"]
          },
        ]
      }
      companies: {
        Row: {
          active: boolean
          address: string | null
          city: string | null
          cnpj: string | null
          created_at: string
          id: string
          legal_name: string | null
          municipal_registration: string | null
          name: string
          owner_id: string
          state: string | null
          state_registration: string | null
          trade_name: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          address?: string | null
          city?: string | null
          cnpj?: string | null
          created_at?: string
          id?: string
          legal_name?: string | null
          municipal_registration?: string | null
          name?: string
          owner_id: string
          state?: string | null
          state_registration?: string | null
          trade_name?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          address?: string | null
          city?: string | null
          cnpj?: string | null
          created_at?: string
          id?: string
          legal_name?: string | null
          municipal_registration?: string | null
          name?: string
          owner_id?: string
          state?: string | null
          state_registration?: string | null
          trade_name?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      company_certificates: {
        Row: {
          api_provider: string | null
          authentication_code: string | null
          automatic_update_enabled: boolean
          certificate_number: string | null
          certificate_type_id: string
          company_id: string
          contrato_id: string | null
          created_at: string
          current_version_id: string | null
          expiration_date: string | null
          file_available: boolean
          id: string
          issue_date: string | null
          last_checked_at: string | null
          last_error_at: string | null
          last_error_message: string | null
          last_success_at: string | null
          manual_review_required: boolean
          next_check_at: string | null
          obra_id: string | null
          source_type: string | null
          status: string
          status_message: string | null
          updated_at: string
        }
        Insert: {
          api_provider?: string | null
          authentication_code?: string | null
          automatic_update_enabled?: boolean
          certificate_number?: string | null
          certificate_type_id: string
          company_id: string
          contrato_id?: string | null
          created_at?: string
          current_version_id?: string | null
          expiration_date?: string | null
          file_available?: boolean
          id?: string
          issue_date?: string | null
          last_checked_at?: string | null
          last_error_at?: string | null
          last_error_message?: string | null
          last_success_at?: string | null
          manual_review_required?: boolean
          next_check_at?: string | null
          obra_id?: string | null
          source_type?: string | null
          status?: string
          status_message?: string | null
          updated_at?: string
        }
        Update: {
          api_provider?: string | null
          authentication_code?: string | null
          automatic_update_enabled?: boolean
          certificate_number?: string | null
          certificate_type_id?: string
          company_id?: string
          contrato_id?: string | null
          created_at?: string
          current_version_id?: string | null
          expiration_date?: string | null
          file_available?: boolean
          id?: string
          issue_date?: string | null
          last_checked_at?: string | null
          last_error_at?: string | null
          last_error_message?: string | null
          last_success_at?: string | null
          manual_review_required?: boolean
          next_check_at?: string | null
          obra_id?: string | null
          source_type?: string | null
          status?: string
          status_message?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_certificates_certificate_type_id_fkey"
            columns: ["certificate_type_id"]
            isOneToOne: false
            referencedRelation: "certificate_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_certificates_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_certificates_contrato_id_fkey"
            columns: ["contrato_id"]
            isOneToOne: false
            referencedRelation: "contratos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_certificates_current_version_fk"
            columns: ["current_version_id"]
            isOneToOne: false
            referencedRelation: "certificate_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_certificates_obra_id_fkey"
            columns: ["obra_id"]
            isOneToOne: false
            referencedRelation: "obras"
            referencedColumns: ["id"]
          },
        ]
      }
      company_invites: {
        Row: {
          accepted_at: string | null
          company_id: string
          created_at: string
          email: string
          expires_at: string
          id: string
          invited_by: string
          role: Database["public"]["Enums"]["company_role"]
          token: string
        }
        Insert: {
          accepted_at?: string | null
          company_id: string
          created_at?: string
          email: string
          expires_at?: string
          id?: string
          invited_by: string
          role?: Database["public"]["Enums"]["company_role"]
          token?: string
        }
        Update: {
          accepted_at?: string | null
          company_id?: string
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          invited_by?: string
          role?: Database["public"]["Enums"]["company_role"]
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_invites_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      company_members: {
        Row: {
          company_id: string
          joined_at: string
          role: Database["public"]["Enums"]["company_role"]
          user_id: string
        }
        Insert: {
          company_id: string
          joined_at?: string
          role?: Database["public"]["Enums"]["company_role"]
          user_id: string
        }
        Update: {
          company_id?: string
          joined_at?: string
          role?: Database["public"]["Enums"]["company_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_members_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      company_signatarios: {
        Row: {
          ativo: boolean
          cargo: string | null
          company_id: string
          cpf: string | null
          created_at: string
          created_by: string | null
          email: string | null
          id: string
          nome: string
          observacoes: string | null
          telefone: string | null
          tipo: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          cargo?: string | null
          company_id: string
          cpf?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          id?: string
          nome: string
          observacoes?: string | null
          telefone?: string | null
          tipo?: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          cargo?: string | null
          company_id?: string
          cpf?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          id?: string
          nome?: string
          observacoes?: string | null
          telefone?: string | null
          tipo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_signatarios_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      company_workspaces: {
        Row: {
          company_id: string
          created_at: string
          updated_at: string
          workspace: Json
        }
        Insert: {
          company_id: string
          created_at?: string
          updated_at?: string
          workspace?: Json
        }
        Update: {
          company_id?: string
          created_at?: string
          updated_at?: string
          workspace?: Json
        }
        Relationships: [
          {
            foreignKeyName: "company_workspaces_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: true
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      compliance_alerts: {
        Row: {
          alert_type: string
          certificate_type_id: string | null
          company_certificate_id: string | null
          company_id: string
          created_at: string
          id: string
          message: string | null
          read: boolean
          resolved: boolean
          resolved_at: string | null
          severity: string
          title: string
        }
        Insert: {
          alert_type: string
          certificate_type_id?: string | null
          company_certificate_id?: string | null
          company_id: string
          created_at?: string
          id?: string
          message?: string | null
          read?: boolean
          resolved?: boolean
          resolved_at?: string | null
          severity: string
          title: string
        }
        Update: {
          alert_type?: string
          certificate_type_id?: string | null
          company_certificate_id?: string | null
          company_id?: string
          created_at?: string
          id?: string
          message?: string | null
          read?: boolean
          resolved?: boolean
          resolved_at?: string | null
          severity?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "compliance_alerts_certificate_type_id_fkey"
            columns: ["certificate_type_id"]
            isOneToOne: false
            referencedRelation: "certificate_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "compliance_alerts_company_certificate_id_fkey"
            columns: ["company_certificate_id"]
            isOneToOne: false
            referencedRelation: "company_certificates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "compliance_alerts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      compliance_audit_logs: {
        Row: {
          action: string
          company_id: string | null
          created_at: string
          description: string | null
          entity_id: string | null
          entity_type: string
          id: string
          metadata_json: Json | null
          user_id: string | null
        }
        Insert: {
          action: string
          company_id?: string | null
          created_at?: string
          description?: string | null
          entity_id?: string | null
          entity_type: string
          id?: string
          metadata_json?: Json | null
          user_id?: string | null
        }
        Update: {
          action?: string
          company_id?: string | null
          created_at?: string
          description?: string | null
          entity_id?: string | null
          entity_type?: string
          id?: string
          metadata_json?: Json | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "compliance_audit_logs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      composicoes_proprias: {
        Row: {
          ativo: boolean
          centro_custo_id: string | null
          codigo: string
          company_id: string
          created_at: string
          created_by: string | null
          custo_total: number
          descricao: string
          id: string
          observacoes: string | null
          unidade: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          centro_custo_id?: string | null
          codigo: string
          company_id: string
          created_at?: string
          created_by?: string | null
          custo_total?: number
          descricao: string
          id?: string
          observacoes?: string | null
          unidade?: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          centro_custo_id?: string | null
          codigo?: string
          company_id?: string
          created_at?: string
          created_by?: string | null
          custo_total?: number
          descricao?: string
          id?: string
          observacoes?: string | null
          unidade?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "composicoes_proprias_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "centros_custo"
            referencedColumns: ["id"]
          },
        ]
      }
      composicoes_proprias_insumos: {
        Row: {
          coeficiente: number
          company_id: string
          composicao_id: string
          created_at: string
          custo_unitario: number
          descricao: string
          id: string
          insumo_id: string | null
          ordem: number
          unidade: string | null
          updated_at: string
        }
        Insert: {
          coeficiente?: number
          company_id: string
          composicao_id: string
          created_at?: string
          custo_unitario?: number
          descricao: string
          id?: string
          insumo_id?: string | null
          ordem?: number
          unidade?: string | null
          updated_at?: string
        }
        Update: {
          coeficiente?: number
          company_id?: string
          composicao_id?: string
          created_at?: string
          custo_unitario?: number
          descricao?: string
          id?: string
          insumo_id?: string | null
          ordem?: number
          unidade?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "composicoes_proprias_insumos_composicao_id_fkey"
            columns: ["composicao_id"]
            isOneToOne: false
            referencedRelation: "composicoes_proprias"
            referencedColumns: ["id"]
          },
        ]
      }
      contrato_eventos: {
        Row: {
          company_id: string
          contrato_id: string
          created_at: string
          created_by: string | null
          data_evento: string
          data_fim: string | null
          descricao: string
          documento_hash: string | null
          documento_url: string | null
          id: string
          impacto_prazo_dias: number | null
          impacto_valor: number | null
          metadata: Json
          responsabilidade: string | null
          tipo: string
          updated_at: string
        }
        Insert: {
          company_id: string
          contrato_id: string
          created_at?: string
          created_by?: string | null
          data_evento: string
          data_fim?: string | null
          descricao: string
          documento_hash?: string | null
          documento_url?: string | null
          id?: string
          impacto_prazo_dias?: number | null
          impacto_valor?: number | null
          metadata?: Json
          responsabilidade?: string | null
          tipo: string
          updated_at?: string
        }
        Update: {
          company_id?: string
          contrato_id?: string
          created_at?: string
          created_by?: string | null
          data_evento?: string
          data_fim?: string | null
          descricao?: string
          documento_hash?: string | null
          documento_url?: string | null
          id?: string
          impacto_prazo_dias?: number | null
          impacto_valor?: number | null
          metadata?: Json
          responsabilidade?: string | null
          tipo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "contrato_eventos_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contrato_eventos_contrato_id_fkey"
            columns: ["contrato_id"]
            isOneToOne: false
            referencedRelation: "contratos"
            referencedColumns: ["id"]
          },
        ]
      }
      contratos: {
        Row: {
          cnpj_orgao: string | null
          company_id: string
          created_at: string
          created_by: string | null
          data_assinatura: string | null
          data_base: string | null
          data_fim_vigencia: string | null
          data_inicio_vigencia: string | null
          formula_reajuste: string | null
          id: string
          indice_principal: string | null
          metadata: Json
          modalidade: string | null
          numero: string
          objeto: string | null
          obra_id: string | null
          orgao_contratante: string | null
          origem: string
          periodicidade_reajuste: string | null
          processo_administrativo: string | null
          regime_execucao: string | null
          status: string
          updated_at: string
          valor_atualizado: number | null
          valor_original: number | null
        }
        Insert: {
          cnpj_orgao?: string | null
          company_id: string
          created_at?: string
          created_by?: string | null
          data_assinatura?: string | null
          data_base?: string | null
          data_fim_vigencia?: string | null
          data_inicio_vigencia?: string | null
          formula_reajuste?: string | null
          id?: string
          indice_principal?: string | null
          metadata?: Json
          modalidade?: string | null
          numero: string
          objeto?: string | null
          obra_id?: string | null
          orgao_contratante?: string | null
          origem?: string
          periodicidade_reajuste?: string | null
          processo_administrativo?: string | null
          regime_execucao?: string | null
          status?: string
          updated_at?: string
          valor_atualizado?: number | null
          valor_original?: number | null
        }
        Update: {
          cnpj_orgao?: string | null
          company_id?: string
          created_at?: string
          created_by?: string | null
          data_assinatura?: string | null
          data_base?: string | null
          data_fim_vigencia?: string | null
          data_inicio_vigencia?: string | null
          formula_reajuste?: string | null
          id?: string
          indice_principal?: string | null
          metadata?: Json
          modalidade?: string | null
          numero?: string
          objeto?: string | null
          obra_id?: string | null
          orgao_contratante?: string | null
          origem?: string
          periodicidade_reajuste?: string | null
          processo_administrativo?: string | null
          regime_execucao?: string | null
          status?: string
          updated_at?: string
          valor_atualizado?: number | null
          valor_original?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "contratos_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contratos_obra_id_fkey"
            columns: ["obra_id"]
            isOneToOne: false
            referencedRelation: "obras"
            referencedColumns: ["id"]
          },
        ]
      }
      cronograma_etapas: {
        Row: {
          codigo: string | null
          company_id: string
          created_at: string
          cronograma_id: string
          descricao: string
          id: string
          ordem: number
          peso_percent: number
          updated_at: string
          valor_etapa: number
        }
        Insert: {
          codigo?: string | null
          company_id: string
          created_at?: string
          cronograma_id: string
          descricao: string
          id?: string
          ordem?: number
          peso_percent?: number
          updated_at?: string
          valor_etapa?: number
        }
        Update: {
          codigo?: string | null
          company_id?: string
          created_at?: string
          cronograma_id?: string
          descricao?: string
          id?: string
          ordem?: number
          peso_percent?: number
          updated_at?: string
          valor_etapa?: number
        }
        Relationships: [
          {
            foreignKeyName: "cronograma_etapas_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cronograma_etapas_cronograma_id_fkey"
            columns: ["cronograma_id"]
            isOneToOne: false
            referencedRelation: "cronogramas"
            referencedColumns: ["id"]
          },
        ]
      }
      cronograma_periodos: {
        Row: {
          company_id: string
          created_at: string
          cronograma_id: string
          etapa_id: string
          id: string
          percent_fisico: number
          percent_realizado: number | null
          periodo_idx: number
          updated_at: string
          valor_financeiro: number
          valor_realizado: number | null
        }
        Insert: {
          company_id: string
          created_at?: string
          cronograma_id: string
          etapa_id: string
          id?: string
          percent_fisico?: number
          percent_realizado?: number | null
          periodo_idx: number
          updated_at?: string
          valor_financeiro?: number
          valor_realizado?: number | null
        }
        Update: {
          company_id?: string
          created_at?: string
          cronograma_id?: string
          etapa_id?: string
          id?: string
          percent_fisico?: number
          percent_realizado?: number | null
          periodo_idx?: number
          updated_at?: string
          valor_financeiro?: number
          valor_realizado?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "cronograma_periodos_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cronograma_periodos_cronograma_id_fkey"
            columns: ["cronograma_id"]
            isOneToOne: false
            referencedRelation: "cronogramas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cronograma_periodos_etapa_id_fkey"
            columns: ["etapa_id"]
            isOneToOne: false
            referencedRelation: "cronograma_etapas"
            referencedColumns: ["id"]
          },
        ]
      }
      cronogramas: {
        Row: {
          company_id: string
          contrato_id: string | null
          created_at: string
          created_by: string | null
          data_inicio: string | null
          descricao: string | null
          id: string
          is_baseline: boolean
          nome: string
          numero_periodos: number
          obra_id: string | null
          observacoes: string | null
          parent_id: string | null
          prazo_dias: number | null
          proposta_id: string | null
          status: string
          unidade_periodo: string
          updated_at: string
          valor_total: number
          versao: number
        }
        Insert: {
          company_id: string
          contrato_id?: string | null
          created_at?: string
          created_by?: string | null
          data_inicio?: string | null
          descricao?: string | null
          id?: string
          is_baseline?: boolean
          nome: string
          numero_periodos?: number
          obra_id?: string | null
          observacoes?: string | null
          parent_id?: string | null
          prazo_dias?: number | null
          proposta_id?: string | null
          status?: string
          unidade_periodo?: string
          updated_at?: string
          valor_total?: number
          versao?: number
        }
        Update: {
          company_id?: string
          contrato_id?: string | null
          created_at?: string
          created_by?: string | null
          data_inicio?: string | null
          descricao?: string | null
          id?: string
          is_baseline?: boolean
          nome?: string
          numero_periodos?: number
          obra_id?: string | null
          observacoes?: string | null
          parent_id?: string | null
          prazo_dias?: number | null
          proposta_id?: string | null
          status?: string
          unidade_periodo?: string
          updated_at?: string
          valor_total?: number
          versao?: number
        }
        Relationships: [
          {
            foreignKeyName: "cronogramas_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cronogramas_contrato_id_fkey"
            columns: ["contrato_id"]
            isOneToOne: false
            referencedRelation: "contratos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cronogramas_obra_id_fkey"
            columns: ["obra_id"]
            isOneToOne: false
            referencedRelation: "obras"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cronogramas_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "cronogramas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cronogramas_proposta_id_fkey"
            columns: ["proposta_id"]
            isOneToOne: false
            referencedRelation: "propostas"
            referencedColumns: ["id"]
          },
        ]
      }
      declaracoes_licitacao: {
        Row: {
          company_id: string
          conteudo: string
          created_at: string
          created_by: string | null
          data_emissao: string
          edital_id: string | null
          id: string
          observacoes: string | null
          oportunidade_id: string | null
          procuracao_id: string | null
          signatario_id: string | null
          tipo: string
          titulo: string
          updated_at: string
        }
        Insert: {
          company_id: string
          conteudo: string
          created_at?: string
          created_by?: string | null
          data_emissao?: string
          edital_id?: string | null
          id?: string
          observacoes?: string | null
          oportunidade_id?: string | null
          procuracao_id?: string | null
          signatario_id?: string | null
          tipo: string
          titulo: string
          updated_at?: string
        }
        Update: {
          company_id?: string
          conteudo?: string
          created_at?: string
          created_by?: string | null
          data_emissao?: string
          edital_id?: string | null
          id?: string
          observacoes?: string | null
          oportunidade_id?: string | null
          procuracao_id?: string | null
          signatario_id?: string | null
          tipo?: string
          titulo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "declaracoes_licitacao_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "declaracoes_licitacao_edital_id_fkey"
            columns: ["edital_id"]
            isOneToOne: false
            referencedRelation: "editais"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "declaracoes_licitacao_oportunidade_id_fkey"
            columns: ["oportunidade_id"]
            isOneToOne: false
            referencedRelation: "oportunidades"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "declaracoes_licitacao_procuracao_id_fkey"
            columns: ["procuracao_id"]
            isOneToOne: false
            referencedRelation: "procuracoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "declaracoes_licitacao_signatario_id_fkey"
            columns: ["signatario_id"]
            isOneToOne: false
            referencedRelation: "company_signatarios"
            referencedColumns: ["id"]
          },
        ]
      }
      document_templates: {
        Row: {
          ativo: boolean
          categoria: string
          company_id: string
          conteudo: string
          created_at: string
          created_by: string | null
          descricao: string | null
          id: string
          nome: string
          updated_at: string
          variaveis: Json
        }
        Insert: {
          ativo?: boolean
          categoria?: string
          company_id: string
          conteudo?: string
          created_at?: string
          created_by?: string | null
          descricao?: string | null
          id?: string
          nome: string
          updated_at?: string
          variaveis?: Json
        }
        Update: {
          ativo?: boolean
          categoria?: string
          company_id?: string
          conteudo?: string
          created_at?: string
          created_by?: string | null
          descricao?: string | null
          id?: string
          nome?: string
          updated_at?: string
          variaveis?: Json
        }
        Relationships: [
          {
            foreignKeyName: "document_templates_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      dossie_itens: {
        Row: {
          company_id: string
          created_at: string
          descricao: string | null
          dossie_id: string
          id: string
          ordem: number
          ref_id: string | null
          ref_table: string | null
          storage_path: string | null
          tipo: string
          titulo: string
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          descricao?: string | null
          dossie_id: string
          id?: string
          ordem?: number
          ref_id?: string | null
          ref_table?: string | null
          storage_path?: string | null
          tipo: string
          titulo: string
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          descricao?: string | null
          dossie_id?: string
          id?: string
          ordem?: number
          ref_id?: string | null
          ref_table?: string | null
          storage_path?: string | null
          tipo?: string
          titulo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "dossie_itens_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dossie_itens_dossie_id_fkey"
            columns: ["dossie_id"]
            isOneToOne: false
            referencedRelation: "dossies"
            referencedColumns: ["id"]
          },
        ]
      }
      dossies: {
        Row: {
          company_id: string
          contrato_id: string | null
          created_at: string
          created_by: string | null
          descricao: string | null
          edital_id: string | null
          escopo: string
          id: string
          nome: string
          observacoes: string | null
          oportunidade_id: string | null
          status: string
          updated_at: string
        }
        Insert: {
          company_id: string
          contrato_id?: string | null
          created_at?: string
          created_by?: string | null
          descricao?: string | null
          edital_id?: string | null
          escopo?: string
          id?: string
          nome: string
          observacoes?: string | null
          oportunidade_id?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          company_id?: string
          contrato_id?: string | null
          created_at?: string
          created_by?: string | null
          descricao?: string | null
          edital_id?: string | null
          escopo?: string
          id?: string
          nome?: string
          observacoes?: string | null
          oportunidade_id?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "dossies_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dossies_contrato_id_fkey"
            columns: ["contrato_id"]
            isOneToOne: false
            referencedRelation: "contratos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dossies_edital_id_fkey"
            columns: ["edital_id"]
            isOneToOne: false
            referencedRelation: "editais"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dossies_oportunidade_id_fkey"
            columns: ["oportunidade_id"]
            isOneToOne: false
            referencedRelation: "oportunidades"
            referencedColumns: ["id"]
          },
        ]
      }
      editais: {
        Row: {
          company_id: string
          created_at: string
          created_by: string | null
          data_abertura: string | null
          ia_erro: string | null
          ia_modelo: string | null
          ia_processado_em: string | null
          id: string
          modalidade: string | null
          numero_edital: string | null
          objeto: string | null
          oportunidade_id: string | null
          orgao: string | null
          origem: string
          resumo_ia: string | null
          status: string
          titulo: string
          updated_at: string
          url_origem: string | null
          valor_estimado: number | null
        }
        Insert: {
          company_id: string
          created_at?: string
          created_by?: string | null
          data_abertura?: string | null
          ia_erro?: string | null
          ia_modelo?: string | null
          ia_processado_em?: string | null
          id?: string
          modalidade?: string | null
          numero_edital?: string | null
          objeto?: string | null
          oportunidade_id?: string | null
          orgao?: string | null
          origem?: string
          resumo_ia?: string | null
          status?: string
          titulo: string
          updated_at?: string
          url_origem?: string | null
          valor_estimado?: number | null
        }
        Update: {
          company_id?: string
          created_at?: string
          created_by?: string | null
          data_abertura?: string | null
          ia_erro?: string | null
          ia_modelo?: string | null
          ia_processado_em?: string | null
          id?: string
          modalidade?: string | null
          numero_edital?: string | null
          objeto?: string | null
          oportunidade_id?: string | null
          orgao?: string | null
          origem?: string
          resumo_ia?: string | null
          status?: string
          titulo?: string
          updated_at?: string
          url_origem?: string | null
          valor_estimado?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "editais_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "editais_oportunidade_id_fkey"
            columns: ["oportunidade_id"]
            isOneToOne: false
            referencedRelation: "oportunidades"
            referencedColumns: ["id"]
          },
        ]
      }
      edital_checklist: {
        Row: {
          categoria: string
          company_id: string
          created_at: string
          edital_id: string
          id: string
          obrigatorio: boolean
          observacoes: string | null
          ordem: number
          pagina_referencia: number | null
          requisito: string
          status: string
          trecho_edital: string | null
          updated_at: string
        }
        Insert: {
          categoria: string
          company_id: string
          created_at?: string
          edital_id: string
          id?: string
          obrigatorio?: boolean
          observacoes?: string | null
          ordem?: number
          pagina_referencia?: number | null
          requisito: string
          status?: string
          trecho_edital?: string | null
          updated_at?: string
        }
        Update: {
          categoria?: string
          company_id?: string
          created_at?: string
          edital_id?: string
          id?: string
          obrigatorio?: boolean
          observacoes?: string | null
          ordem?: number
          pagina_referencia?: number | null
          requisito?: string
          status?: string
          trecho_edital?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "edital_checklist_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "edital_checklist_edital_id_fkey"
            columns: ["edital_id"]
            isOneToOne: false
            referencedRelation: "editais"
            referencedColumns: ["id"]
          },
        ]
      }
      edital_checklist_vinculos: {
        Row: {
          checklist_item_id: string
          company_id: string
          created_at: string
          created_by: string | null
          documento_id: string
          id: string
        }
        Insert: {
          checklist_item_id: string
          company_id: string
          created_at?: string
          created_by?: string | null
          documento_id: string
          id?: string
        }
        Update: {
          checklist_item_id?: string
          company_id?: string
          created_at?: string
          created_by?: string | null
          documento_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "edital_checklist_vinculos_checklist_item_id_fkey"
            columns: ["checklist_item_id"]
            isOneToOne: false
            referencedRelation: "edital_checklist"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "edital_checklist_vinculos_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "edital_checklist_vinculos_documento_id_fkey"
            columns: ["documento_id"]
            isOneToOne: false
            referencedRelation: "biblioteca_documentos"
            referencedColumns: ["id"]
          },
        ]
      }
      edital_chunks: {
        Row: {
          chunk_index: number
          company_id: string
          conteudo: string
          created_at: string
          documento_id: string
          edital_id: string
          embedding: string | null
          id: string
          pagina: number | null
        }
        Insert: {
          chunk_index: number
          company_id: string
          conteudo: string
          created_at?: string
          documento_id: string
          edital_id: string
          embedding?: string | null
          id?: string
          pagina?: number | null
        }
        Update: {
          chunk_index?: number
          company_id?: string
          conteudo?: string
          created_at?: string
          documento_id?: string
          edital_id?: string
          embedding?: string | null
          id?: string
          pagina?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "edital_chunks_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "edital_chunks_documento_id_fkey"
            columns: ["documento_id"]
            isOneToOne: false
            referencedRelation: "edital_documentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "edital_chunks_edital_id_fkey"
            columns: ["edital_id"]
            isOneToOne: false
            referencedRelation: "editais"
            referencedColumns: ["id"]
          },
        ]
      }
      edital_documentos: {
        Row: {
          company_id: string
          created_at: string
          edital_id: string
          id: string
          mime_type: string | null
          nome_arquivo: string
          paginas: number | null
          storage_path: string
          tamanho_bytes: number | null
          texto_extraido: string | null
          texto_por_pagina: Json | null
          tipo: string
        }
        Insert: {
          company_id: string
          created_at?: string
          edital_id: string
          id?: string
          mime_type?: string | null
          nome_arquivo: string
          paginas?: number | null
          storage_path: string
          tamanho_bytes?: number | null
          texto_extraido?: string | null
          texto_por_pagina?: Json | null
          tipo?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          edital_id?: string
          id?: string
          mime_type?: string | null
          nome_arquivo?: string
          paginas?: number | null
          storage_path?: string
          tamanho_bytes?: number | null
          texto_extraido?: string | null
          texto_por_pagina?: Json | null
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "edital_documentos_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "edital_documentos_edital_id_fkey"
            columns: ["edital_id"]
            isOneToOne: false
            referencedRelation: "editais"
            referencedColumns: ["id"]
          },
        ]
      }
      equipamentos: {
        Row: {
          ativo: boolean
          company_id: string
          created_at: string
          created_by: string | null
          custo_hora: number
          custo_hora_extra: number | null
          descricao: string | null
          id: string
          nome: string
          observacoes: string | null
          tipo: string | null
          unidade: string | null
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          company_id: string
          created_at?: string
          created_by?: string | null
          custo_hora?: number
          custo_hora_extra?: number | null
          descricao?: string | null
          id?: string
          nome: string
          observacoes?: string | null
          tipo?: string | null
          unidade?: string | null
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          company_id?: string
          created_at?: string
          created_by?: string | null
          custo_hora?: number
          custo_hora_extra?: number | null
          descricao?: string | null
          id?: string
          nome?: string
          observacoes?: string | null
          tipo?: string | null
          unidade?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      equipe_membros: {
        Row: {
          company_id: string
          created_at: string
          equipe_id: string
          funcionario_id: string
          id: string
        }
        Insert: {
          company_id: string
          created_at?: string
          equipe_id: string
          funcionario_id: string
          id?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          equipe_id?: string
          funcionario_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "equipe_membros_equipe_id_fkey"
            columns: ["equipe_id"]
            isOneToOne: false
            referencedRelation: "equipes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "equipe_membros_funcionario_id_fkey"
            columns: ["funcionario_id"]
            isOneToOne: false
            referencedRelation: "funcionarios"
            referencedColumns: ["id"]
          },
        ]
      }
      equipes: {
        Row: {
          ativo: boolean
          company_id: string
          created_at: string
          descricao: string | null
          encarregado_id: string | null
          id: string
          nome: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          company_id: string
          created_at?: string
          descricao?: string | null
          encarregado_id?: string | null
          id?: string
          nome: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          company_id?: string
          created_at?: string
          descricao?: string | null
          encarregado_id?: string | null
          id?: string
          nome?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "equipes_encarregado_id_fkey"
            columns: ["encarregado_id"]
            isOneToOne: false
            referencedRelation: "funcionarios"
            referencedColumns: ["id"]
          },
        ]
      }
      estoque_movimentos: {
        Row: {
          apontamento_id: string | null
          centro_custo: string | null
          centro_custo_id: string | null
          company_id: string
          created_at: string
          created_by: string | null
          data_movimento: string
          frente_servico: string | null
          id: string
          insumo_id: string
          item_codigo: string | null
          item_descricao: string | null
          nota_fiscal_id: string | null
          nota_fiscal_item_id: string | null
          obra_id: string | null
          observacoes: string | null
          origem: string
          quantidade: number
          tipo: string
          updated_at: string
          valor_total: number
          valor_unitario: number
        }
        Insert: {
          apontamento_id?: string | null
          centro_custo?: string | null
          centro_custo_id?: string | null
          company_id: string
          created_at?: string
          created_by?: string | null
          data_movimento?: string
          frente_servico?: string | null
          id?: string
          insumo_id: string
          item_codigo?: string | null
          item_descricao?: string | null
          nota_fiscal_id?: string | null
          nota_fiscal_item_id?: string | null
          obra_id?: string | null
          observacoes?: string | null
          origem?: string
          quantidade: number
          tipo: string
          updated_at?: string
          valor_total?: number
          valor_unitario?: number
        }
        Update: {
          apontamento_id?: string | null
          centro_custo?: string | null
          centro_custo_id?: string | null
          company_id?: string
          created_at?: string
          created_by?: string | null
          data_movimento?: string
          frente_servico?: string | null
          id?: string
          insumo_id?: string
          item_codigo?: string | null
          item_descricao?: string | null
          nota_fiscal_id?: string | null
          nota_fiscal_item_id?: string | null
          obra_id?: string | null
          observacoes?: string | null
          origem?: string
          quantidade?: number
          tipo?: string
          updated_at?: string
          valor_total?: number
          valor_unitario?: number
        }
        Relationships: [
          {
            foreignKeyName: "estoque_movimentos_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "centros_custo"
            referencedColumns: ["id"]
          },
        ]
      }
      funcionarios: {
        Row: {
          ativo: boolean
          company_id: string
          cpf: string | null
          created_at: string
          custo_hora: number | null
          data_admissao: string | null
          data_demissao: string | null
          funcao_id: string | null
          id: string
          matricula: string | null
          nome: string
          observacoes: string | null
          salario_mensal: number | null
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          company_id: string
          cpf?: string | null
          created_at?: string
          custo_hora?: number | null
          data_admissao?: string | null
          data_demissao?: string | null
          funcao_id?: string | null
          id?: string
          matricula?: string | null
          nome: string
          observacoes?: string | null
          salario_mensal?: number | null
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          company_id?: string
          cpf?: string | null
          created_at?: string
          custo_hora?: number | null
          data_admissao?: string | null
          data_demissao?: string | null
          funcao_id?: string | null
          id?: string
          matricula?: string | null
          nome?: string
          observacoes?: string | null
          salario_mensal?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "funcionarios_funcao_id_fkey"
            columns: ["funcao_id"]
            isOneToOne: false
            referencedRelation: "funcoes_mao_obra"
            referencedColumns: ["id"]
          },
        ]
      }
      funcoes_mao_obra: {
        Row: {
          ativo: boolean
          company_id: string
          created_at: string
          custo_hora_base: number
          descricao: string | null
          encargos_percentual: number
          id: string
          nome: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          company_id: string
          created_at?: string
          custo_hora_base?: number
          descricao?: string | null
          encargos_percentual?: number
          id?: string
          nome: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          company_id?: string
          created_at?: string
          custo_hora_base?: number
          descricao?: string | null
          encargos_percentual?: number
          id?: string
          nome?: string
          updated_at?: string
        }
        Relationships: []
      }
      historico_importacoes_sinapi: {
        Row: {
          arquivo: string | null
          company_id: string
          created_at: string
          data_importacao: string
          detalhes: Json | null
          id: string
          novos_registros: number
          registros_atualizados: number
          registros_com_erro: number
          registros_ignorados: number
          status: string
          total_registros: number
          usuario_id: string | null
          versao_sinapi: string | null
        }
        Insert: {
          arquivo?: string | null
          company_id: string
          created_at?: string
          data_importacao?: string
          detalhes?: Json | null
          id?: string
          novos_registros?: number
          registros_atualizados?: number
          registros_com_erro?: number
          registros_ignorados?: number
          status?: string
          total_registros?: number
          usuario_id?: string | null
          versao_sinapi?: string | null
        }
        Update: {
          arquivo?: string | null
          company_id?: string
          created_at?: string
          data_importacao?: string
          detalhes?: Json | null
          id?: string
          novos_registros?: number
          registros_atualizados?: number
          registros_com_erro?: number
          registros_ignorados?: number
          status?: string
          total_registros?: number
          usuario_id?: string | null
          versao_sinapi?: string | null
        }
        Relationships: []
      }
      indices_economicos: {
        Row: {
          company_id: string
          created_at: string
          created_by: string | null
          fonte: string | null
          id: string
          indice: string
          mes_referencia: string
          updated_at: string
          valor_percentual: number
        }
        Insert: {
          company_id: string
          created_at?: string
          created_by?: string | null
          fonte?: string | null
          id?: string
          indice: string
          mes_referencia: string
          updated_at?: string
          valor_percentual: number
        }
        Update: {
          company_id?: string
          created_at?: string
          created_by?: string | null
          fonte?: string | null
          id?: string
          indice?: string
          mes_referencia?: string
          updated_at?: string
          valor_percentual?: number
        }
        Relationships: [
          {
            foreignKeyName: "indices_economicos_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      insumo_aliases: {
        Row: {
          cnpj_fornecedor: string | null
          codigo_fornecedor: string | null
          company_id: string
          created_at: string
          descricao_alternativa: string
          fornecedor: string | null
          id: string
          insumo_id: string
          origem: string
        }
        Insert: {
          cnpj_fornecedor?: string | null
          codigo_fornecedor?: string | null
          company_id: string
          created_at?: string
          descricao_alternativa: string
          fornecedor?: string | null
          id?: string
          insumo_id: string
          origem?: string
        }
        Update: {
          cnpj_fornecedor?: string | null
          codigo_fornecedor?: string | null
          company_id?: string
          created_at?: string
          descricao_alternativa?: string
          fornecedor?: string | null
          id?: string
          insumo_id?: string
          origem?: string
        }
        Relationships: [
          {
            foreignKeyName: "insumo_aliases_insumo_id_fkey"
            columns: ["insumo_id"]
            isOneToOne: false
            referencedRelation: "insumos_mestre"
            referencedColumns: ["id"]
          },
        ]
      }
      insumo_categorias: {
        Row: {
          company_id: string
          created_at: string
          id: string
          nome: string
          ordem: number
          parent_id: string | null
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          nome: string
          ordem?: number
          parent_id?: string | null
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          nome?: string
          ordem?: number
          parent_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "insumo_categorias_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "insumo_categorias"
            referencedColumns: ["id"]
          },
        ]
      }
      insumos_mestre: {
        Row: {
          ativo: boolean
          categoria_id: string | null
          codigo: string | null
          codigo_interno: string | null
          company_id: string
          created_at: string
          created_by: string | null
          descricao: string
          descricao_completa: string | null
          especificacao_tecnica: string | null
          id: string
          imagem_url: string | null
          informacoes_gerais: string | null
          ncm: string | null
          normas_tecnicas: string | null
          observacoes: string | null
          sinapi_codigo: string | null
          unidade_id: string | null
          updated_at: string
          updated_by: string | null
          versao_sinapi: string | null
        }
        Insert: {
          ativo?: boolean
          categoria_id?: string | null
          codigo?: string | null
          codigo_interno?: string | null
          company_id: string
          created_at?: string
          created_by?: string | null
          descricao: string
          descricao_completa?: string | null
          especificacao_tecnica?: string | null
          id?: string
          imagem_url?: string | null
          informacoes_gerais?: string | null
          ncm?: string | null
          normas_tecnicas?: string | null
          observacoes?: string | null
          sinapi_codigo?: string | null
          unidade_id?: string | null
          updated_at?: string
          updated_by?: string | null
          versao_sinapi?: string | null
        }
        Update: {
          ativo?: boolean
          categoria_id?: string | null
          codigo?: string | null
          codigo_interno?: string | null
          company_id?: string
          created_at?: string
          created_by?: string | null
          descricao?: string
          descricao_completa?: string | null
          especificacao_tecnica?: string | null
          id?: string
          imagem_url?: string | null
          informacoes_gerais?: string | null
          ncm?: string | null
          normas_tecnicas?: string | null
          observacoes?: string | null
          sinapi_codigo?: string | null
          unidade_id?: string | null
          updated_at?: string
          updated_by?: string | null
          versao_sinapi?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "insumos_mestre_categoria_id_fkey"
            columns: ["categoria_id"]
            isOneToOne: false
            referencedRelation: "insumo_categorias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "insumos_mestre_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "unidades_medida"
            referencedColumns: ["id"]
          },
        ]
      }
      integration_settings: {
        Row: {
          created_at: string
          endpoint_base_url: string | null
          id: string
          last_health_check_at: string | null
          last_health_check_status: string | null
          notes: string | null
          production_enabled: boolean
          provider: string
          sandbox_mode: boolean
          token_configured: boolean
          updated_at: string
        }
        Insert: {
          created_at?: string
          endpoint_base_url?: string | null
          id?: string
          last_health_check_at?: string | null
          last_health_check_status?: string | null
          notes?: string | null
          production_enabled?: boolean
          provider: string
          sandbox_mode?: boolean
          token_configured?: boolean
          updated_at?: string
        }
        Update: {
          created_at?: string
          endpoint_base_url?: string | null
          id?: string
          last_health_check_at?: string | null
          last_health_check_status?: string | null
          notes?: string | null
          production_enabled?: boolean
          provider?: string
          sandbox_mode?: boolean
          token_configured?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      medicao_itens: {
        Row: {
          company_id: string
          created_at: string
          descricao: string
          id: string
          is_etapa: boolean
          item_codigo: string
          item_codigo_pai: string | null
          justificativa: string | null
          medicao_id: string
          nivel: number | null
          obra_atividade_id: string | null
          orcamento_item_id: string | null
          ordem: number
          pct_executado: number
          qtd_acum_anterior: number
          qtd_acum_atual: number
          qtd_contratada: number
          qtd_periodo: number
          status_calc: string
          tipo: string | null
          unidade: string | null
          updated_at: string
          valor_acum_anterior: number
          valor_acum_atual: number
          valor_periodo: number
          valor_unitario: number
        }
        Insert: {
          company_id: string
          created_at?: string
          descricao: string
          id?: string
          is_etapa?: boolean
          item_codigo: string
          item_codigo_pai?: string | null
          justificativa?: string | null
          medicao_id: string
          nivel?: number | null
          obra_atividade_id?: string | null
          orcamento_item_id?: string | null
          ordem?: number
          pct_executado?: number
          qtd_acum_anterior?: number
          qtd_acum_atual?: number
          qtd_contratada?: number
          qtd_periodo?: number
          status_calc?: string
          tipo?: string | null
          unidade?: string | null
          updated_at?: string
          valor_acum_anterior?: number
          valor_acum_atual?: number
          valor_periodo?: number
          valor_unitario?: number
        }
        Update: {
          company_id?: string
          created_at?: string
          descricao?: string
          id?: string
          is_etapa?: boolean
          item_codigo?: string
          item_codigo_pai?: string | null
          justificativa?: string | null
          medicao_id?: string
          nivel?: number | null
          obra_atividade_id?: string | null
          orcamento_item_id?: string | null
          ordem?: number
          pct_executado?: number
          qtd_acum_anterior?: number
          qtd_acum_atual?: number
          qtd_contratada?: number
          qtd_periodo?: number
          status_calc?: string
          tipo?: string | null
          unidade?: string | null
          updated_at?: string
          valor_acum_anterior?: number
          valor_acum_atual?: number
          valor_periodo?: number
          valor_unitario?: number
        }
        Relationships: [
          {
            foreignKeyName: "medicao_itens_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "medicao_itens_medicao_id_fkey"
            columns: ["medicao_id"]
            isOneToOne: false
            referencedRelation: "medicoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "medicao_itens_obra_atividade_id_fkey"
            columns: ["obra_atividade_id"]
            isOneToOne: false
            referencedRelation: "obra_atividades"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "medicao_itens_orcamento_item_id_fkey"
            columns: ["orcamento_item_id"]
            isOneToOne: false
            referencedRelation: "orcamento_itens"
            referencedColumns: ["id"]
          },
        ]
      }
      medicoes: {
        Row: {
          aprovada_em: string | null
          aprovada_por: string | null
          company_id: string
          contrato_id: string
          created_at: string
          created_by: string | null
          data_medicao: string | null
          enviada_em: string | null
          enviada_por: string | null
          id: string
          metadata: Json
          motivo_rejeicao: string | null
          numero: number
          numero_bm: string | null
          obra_id: string | null
          observacoes: string | null
          percentual_fisico: number
          periodo_fim: string
          periodo_inicio: string
          rejeitada_em: string | null
          rejeitada_por: string | null
          snapshot_itens: Json
          status: string
          updated_at: string
          valor_acumulado: number
          valor_executado: number
          versao_orcamento_id: string | null
        }
        Insert: {
          aprovada_em?: string | null
          aprovada_por?: string | null
          company_id: string
          contrato_id: string
          created_at?: string
          created_by?: string | null
          data_medicao?: string | null
          enviada_em?: string | null
          enviada_por?: string | null
          id?: string
          metadata?: Json
          motivo_rejeicao?: string | null
          numero: number
          numero_bm?: string | null
          obra_id?: string | null
          observacoes?: string | null
          percentual_fisico?: number
          periodo_fim: string
          periodo_inicio: string
          rejeitada_em?: string | null
          rejeitada_por?: string | null
          snapshot_itens?: Json
          status?: string
          updated_at?: string
          valor_acumulado?: number
          valor_executado?: number
          versao_orcamento_id?: string | null
        }
        Update: {
          aprovada_em?: string | null
          aprovada_por?: string | null
          company_id?: string
          contrato_id?: string
          created_at?: string
          created_by?: string | null
          data_medicao?: string | null
          enviada_em?: string | null
          enviada_por?: string | null
          id?: string
          metadata?: Json
          motivo_rejeicao?: string | null
          numero?: number
          numero_bm?: string | null
          obra_id?: string | null
          observacoes?: string | null
          percentual_fisico?: number
          periodo_fim?: string
          periodo_inicio?: string
          rejeitada_em?: string | null
          rejeitada_por?: string | null
          snapshot_itens?: Json
          status?: string
          updated_at?: string
          valor_acumulado?: number
          valor_executado?: number
          versao_orcamento_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "medicoes_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "medicoes_contrato_id_fkey"
            columns: ["contrato_id"]
            isOneToOne: false
            referencedRelation: "contratos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "medicoes_obra_id_fkey"
            columns: ["obra_id"]
            isOneToOne: false
            referencedRelation: "obras"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "medicoes_versao_orcamento_id_fkey"
            columns: ["versao_orcamento_id"]
            isOneToOne: false
            referencedRelation: "orcamento_versoes"
            referencedColumns: ["id"]
          },
        ]
      }
      nfe_item_apropriacoes: {
        Row: {
          centro_custo: string | null
          centro_custo_id: string | null
          company_id: string
          created_at: string
          created_by: string | null
          descricao_insumo: string
          frente_servico: string | null
          id: string
          insumo_id: string | null
          item_codigo: string
          item_descricao: string | null
          local_aplicacao: string | null
          nota_fiscal_id: string
          nota_fiscal_item_id: string
          obra_id: string
          quantidade: number
          responsavel: string | null
          unidade: string | null
          updated_at: string
          valor_total: number
          valor_unitario: number
        }
        Insert: {
          centro_custo?: string | null
          centro_custo_id?: string | null
          company_id: string
          created_at?: string
          created_by?: string | null
          descricao_insumo: string
          frente_servico?: string | null
          id?: string
          insumo_id?: string | null
          item_codigo: string
          item_descricao?: string | null
          local_aplicacao?: string | null
          nota_fiscal_id: string
          nota_fiscal_item_id: string
          obra_id: string
          quantidade?: number
          responsavel?: string | null
          unidade?: string | null
          updated_at?: string
          valor_total?: number
          valor_unitario?: number
        }
        Update: {
          centro_custo?: string | null
          centro_custo_id?: string | null
          company_id?: string
          created_at?: string
          created_by?: string | null
          descricao_insumo?: string
          frente_servico?: string | null
          id?: string
          insumo_id?: string | null
          item_codigo?: string
          item_descricao?: string | null
          local_aplicacao?: string | null
          nota_fiscal_id?: string
          nota_fiscal_item_id?: string
          obra_id?: string
          quantidade?: number
          responsavel?: string | null
          unidade?: string | null
          updated_at?: string
          valor_total?: number
          valor_unitario?: number
        }
        Relationships: [
          {
            foreignKeyName: "nfe_item_apropriacoes_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "centros_custo"
            referencedColumns: ["id"]
          },
        ]
      }
      nota_fiscal_itens: {
        Row: {
          cfop: string | null
          codigo_produto: string | null
          company_id: string
          created_at: string
          descricao: string
          id: string
          insumo_id: string | null
          item_codigo: string | null
          item_descricao: string | null
          match_status: string
          ncm: string | null
          nota_fiscal_id: string
          numero_item: number
          obra_id: string | null
          quantidade: number
          unidade: string | null
          updated_at: string
          valor_desconto: number | null
          valor_frete: number | null
          valor_total: number
          valor_unitario: number
        }
        Insert: {
          cfop?: string | null
          codigo_produto?: string | null
          company_id: string
          created_at?: string
          descricao: string
          id?: string
          insumo_id?: string | null
          item_codigo?: string | null
          item_descricao?: string | null
          match_status?: string
          ncm?: string | null
          nota_fiscal_id: string
          numero_item: number
          obra_id?: string | null
          quantidade?: number
          unidade?: string | null
          updated_at?: string
          valor_desconto?: number | null
          valor_frete?: number | null
          valor_total?: number
          valor_unitario?: number
        }
        Update: {
          cfop?: string | null
          codigo_produto?: string | null
          company_id?: string
          created_at?: string
          descricao?: string
          id?: string
          insumo_id?: string | null
          item_codigo?: string | null
          item_descricao?: string | null
          match_status?: string
          ncm?: string | null
          nota_fiscal_id?: string
          numero_item?: number
          obra_id?: string | null
          quantidade?: number
          unidade?: string | null
          updated_at?: string
          valor_desconto?: number | null
          valor_frete?: number | null
          valor_total?: number
          valor_unitario?: number
        }
        Relationships: [
          {
            foreignKeyName: "nota_fiscal_itens_insumo_id_fkey"
            columns: ["insumo_id"]
            isOneToOne: false
            referencedRelation: "insumos_mestre"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nota_fiscal_itens_nota_fiscal_id_fkey"
            columns: ["nota_fiscal_id"]
            isOneToOne: false
            referencedRelation: "notas_fiscais"
            referencedColumns: ["id"]
          },
        ]
      }
      notas_fiscais: {
        Row: {
          chave_acesso: string
          company_id: string
          created_at: string
          data_emissao: string | null
          data_entrada: string | null
          destinatario_cnpj: string | null
          destinatario_nome: string | null
          emitente_cnpj: string | null
          emitente_ie: string | null
          emitente_nome: string | null
          emitente_uf: string | null
          id: string
          imported_by: string | null
          manifestacao_data: string | null
          manifestacao_justificativa: string | null
          manifestacao_por: string | null
          manifestacao_tipo: string | null
          modelo: string | null
          natureza_operacao: string | null
          numero: string
          obra_id: string | null
          observacoes: string | null
          serie: string | null
          status: string
          updated_at: string
          valor_desconto: number | null
          valor_frete: number | null
          valor_icms: number | null
          valor_ipi: number | null
          valor_outras: number | null
          valor_produtos: number | null
          valor_total: number | null
          xml_content: string | null
        }
        Insert: {
          chave_acesso: string
          company_id: string
          created_at?: string
          data_emissao?: string | null
          data_entrada?: string | null
          destinatario_cnpj?: string | null
          destinatario_nome?: string | null
          emitente_cnpj?: string | null
          emitente_ie?: string | null
          emitente_nome?: string | null
          emitente_uf?: string | null
          id?: string
          imported_by?: string | null
          manifestacao_data?: string | null
          manifestacao_justificativa?: string | null
          manifestacao_por?: string | null
          manifestacao_tipo?: string | null
          modelo?: string | null
          natureza_operacao?: string | null
          numero: string
          obra_id?: string | null
          observacoes?: string | null
          serie?: string | null
          status?: string
          updated_at?: string
          valor_desconto?: number | null
          valor_frete?: number | null
          valor_icms?: number | null
          valor_ipi?: number | null
          valor_outras?: number | null
          valor_produtos?: number | null
          valor_total?: number | null
          xml_content?: string | null
        }
        Update: {
          chave_acesso?: string
          company_id?: string
          created_at?: string
          data_emissao?: string | null
          data_entrada?: string | null
          destinatario_cnpj?: string | null
          destinatario_nome?: string | null
          emitente_cnpj?: string | null
          emitente_ie?: string | null
          emitente_nome?: string | null
          emitente_uf?: string | null
          id?: string
          imported_by?: string | null
          manifestacao_data?: string | null
          manifestacao_justificativa?: string | null
          manifestacao_por?: string | null
          manifestacao_tipo?: string | null
          modelo?: string | null
          natureza_operacao?: string | null
          numero?: string
          obra_id?: string | null
          observacoes?: string | null
          serie?: string | null
          status?: string
          updated_at?: string
          valor_desconto?: number | null
          valor_frete?: number | null
          valor_icms?: number | null
          valor_ipi?: number | null
          valor_outras?: number | null
          valor_produtos?: number | null
          valor_total?: number | null
          xml_content?: string | null
        }
        Relationships: []
      }
      notification_rules: {
        Row: {
          active: boolean
          certificate_type_id: string | null
          company_id: string
          created_at: string
          id: string
          notify_on_error: boolean
          notify_on_expired: boolean
          notify_on_status_change: boolean
          updated_at: string
          warning_days: number
        }
        Insert: {
          active?: boolean
          certificate_type_id?: string | null
          company_id: string
          created_at?: string
          id?: string
          notify_on_error?: boolean
          notify_on_expired?: boolean
          notify_on_status_change?: boolean
          updated_at?: string
          warning_days: number
        }
        Update: {
          active?: boolean
          certificate_type_id?: string | null
          company_id?: string
          created_at?: string
          id?: string
          notify_on_error?: boolean
          notify_on_expired?: boolean
          notify_on_status_change?: boolean
          updated_at?: string
          warning_days?: number
        }
        Relationships: [
          {
            foreignKeyName: "notification_rules_certificate_type_id_fkey"
            columns: ["certificate_type_id"]
            isOneToOne: false
            referencedRelation: "certificate_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notification_rules_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string | null
          company_id: string
          created_at: string
          id: string
          kind: string
          link: string | null
          read_at: string | null
          title: string
          user_id: string | null
        }
        Insert: {
          body?: string | null
          company_id: string
          created_at?: string
          id?: string
          kind: string
          link?: string | null
          read_at?: string | null
          title: string
          user_id?: string | null
        }
        Update: {
          body?: string | null
          company_id?: string
          created_at?: string
          id?: string
          kind?: string
          link?: string | null
          read_at?: string | null
          title?: string
          user_id?: string | null
        }
        Relationships: []
      }
      obra_analise_snapshots: {
        Row: {
          avanco: number
          company_id: string
          confiabilidade: string
          created_at: string
          data_projetada: string | null
          data_snapshot: string
          desvio: number | null
          fator_aceleracao: number | null
          id: string
          num_criticas: number
          obra_id: string
          payload: Json
          prazo_consumido: number | null
          risco: Database["public"]["Enums"]["analise_risco"]
          ritmo_atual: number | null
          ritmo_necessario: number | null
          saldo_executar: number | null
          updated_at: string
          valor_executado: number | null
        }
        Insert: {
          avanco?: number
          company_id: string
          confiabilidade?: string
          created_at?: string
          data_projetada?: string | null
          data_snapshot?: string
          desvio?: number | null
          fator_aceleracao?: number | null
          id?: string
          num_criticas?: number
          obra_id: string
          payload?: Json
          prazo_consumido?: number | null
          risco?: Database["public"]["Enums"]["analise_risco"]
          ritmo_atual?: number | null
          ritmo_necessario?: number | null
          saldo_executar?: number | null
          updated_at?: string
          valor_executado?: number | null
        }
        Update: {
          avanco?: number
          company_id?: string
          confiabilidade?: string
          created_at?: string
          data_projetada?: string | null
          data_snapshot?: string
          desvio?: number | null
          fator_aceleracao?: number | null
          id?: string
          num_criticas?: number
          obra_id?: string
          payload?: Json
          prazo_consumido?: number | null
          risco?: Database["public"]["Enums"]["analise_risco"]
          ritmo_atual?: number | null
          ritmo_necessario?: number | null
          saldo_executar?: number | null
          updated_at?: string
          valor_executado?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "obra_analise_snapshots_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "obra_analise_snapshots_obra_id_fkey"
            columns: ["obra_id"]
            isOneToOne: false
            referencedRelation: "obras"
            referencedColumns: ["id"]
          },
        ]
      }
      obra_atividade_dependencias: {
        Row: {
          company_id: string
          created_at: string
          created_by: string | null
          defasagem_dias: number
          id: string
          obra_id: string
          obrigatoria: boolean
          observacao: string | null
          percentual_minimo: number
          predecessora_id: string
          sucessora_id: string
          tipo: string
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          created_by?: string | null
          defasagem_dias?: number
          id?: string
          obra_id: string
          obrigatoria?: boolean
          observacao?: string | null
          percentual_minimo?: number
          predecessora_id: string
          sucessora_id: string
          tipo?: string
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          created_by?: string | null
          defasagem_dias?: number
          id?: string
          obra_id?: string
          obrigatoria?: boolean
          observacao?: string | null
          percentual_minimo?: number
          predecessora_id?: string
          sucessora_id?: string
          tipo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "obra_atividade_dependencias_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "obra_atividade_dependencias_obra_id_fkey"
            columns: ["obra_id"]
            isOneToOne: false
            referencedRelation: "obras"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "obra_atividade_dependencias_predecessora_id_fkey"
            columns: ["predecessora_id"]
            isOneToOne: false
            referencedRelation: "obra_atividades"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "obra_atividade_dependencias_sucessora_id_fkey"
            columns: ["sucessora_id"]
            isOneToOne: false
            referencedRelation: "obra_atividades"
            referencedColumns: ["id"]
          },
        ]
      }
      obra_atividade_eventos: {
        Row: {
          atividade_id: string | null
          autor_id: string | null
          company_id: string
          created_at: string
          id: string
          obra_id: string
          payload: Json
          tipo: string
        }
        Insert: {
          atividade_id?: string | null
          autor_id?: string | null
          company_id: string
          created_at?: string
          id?: string
          obra_id: string
          payload?: Json
          tipo: string
        }
        Update: {
          atividade_id?: string | null
          autor_id?: string | null
          company_id?: string
          created_at?: string
          id?: string
          obra_id?: string
          payload?: Json
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "obra_atividade_eventos_atividade_id_fkey"
            columns: ["atividade_id"]
            isOneToOne: false
            referencedRelation: "obra_atividades"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "obra_atividade_eventos_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "obra_atividade_eventos_obra_id_fkey"
            columns: ["obra_id"]
            isOneToOne: false
            referencedRelation: "obras"
            referencedColumns: ["id"]
          },
        ]
      }
      obra_atividades: {
        Row: {
          baseline_fim: string | null
          baseline_inicio: string | null
          bloqueia_atividades: string[] | null
          codigo_interno: string | null
          company_id: string
          created_at: string
          created_by: string | null
          data_prevista_fim: string | null
          data_prevista_inicio: string | null
          data_real_fim: string | null
          data_real_inicio: string | null
          descricao: string
          etapa: string | null
          id: string
          impedimento: string | null
          is_group: boolean
          item_codigo: string
          item_hierarquico: string | null
          metadata: Json
          obra_id: string
          observacoes: string | null
          ordem: number | null
          percentual_concluido: number
          peso: number | null
          predecessoras: Json | null
          prioridade: Database["public"]["Enums"]["atividade_prioridade"]
          prontidao: Json | null
          quantidade: number | null
          responsavel_id: string | null
          responsavel_nome: string | null
          status: Database["public"]["Enums"]["atividade_status"]
          unidade: string | null
          updated_at: string
          valor: number | null
        }
        Insert: {
          baseline_fim?: string | null
          baseline_inicio?: string | null
          bloqueia_atividades?: string[] | null
          codigo_interno?: string | null
          company_id: string
          created_at?: string
          created_by?: string | null
          data_prevista_fim?: string | null
          data_prevista_inicio?: string | null
          data_real_fim?: string | null
          data_real_inicio?: string | null
          descricao: string
          etapa?: string | null
          id?: string
          impedimento?: string | null
          is_group?: boolean
          item_codigo: string
          item_hierarquico?: string | null
          metadata?: Json
          obra_id: string
          observacoes?: string | null
          ordem?: number | null
          percentual_concluido?: number
          peso?: number | null
          predecessoras?: Json | null
          prioridade?: Database["public"]["Enums"]["atividade_prioridade"]
          prontidao?: Json | null
          quantidade?: number | null
          responsavel_id?: string | null
          responsavel_nome?: string | null
          status?: Database["public"]["Enums"]["atividade_status"]
          unidade?: string | null
          updated_at?: string
          valor?: number | null
        }
        Update: {
          baseline_fim?: string | null
          baseline_inicio?: string | null
          bloqueia_atividades?: string[] | null
          codigo_interno?: string | null
          company_id?: string
          created_at?: string
          created_by?: string | null
          data_prevista_fim?: string | null
          data_prevista_inicio?: string | null
          data_real_fim?: string | null
          data_real_inicio?: string | null
          descricao?: string
          etapa?: string | null
          id?: string
          impedimento?: string | null
          is_group?: boolean
          item_codigo?: string
          item_hierarquico?: string | null
          metadata?: Json
          obra_id?: string
          observacoes?: string | null
          ordem?: number | null
          percentual_concluido?: number
          peso?: number | null
          predecessoras?: Json | null
          prioridade?: Database["public"]["Enums"]["atividade_prioridade"]
          prontidao?: Json | null
          quantidade?: number | null
          responsavel_id?: string | null
          responsavel_nome?: string | null
          status?: Database["public"]["Enums"]["atividade_status"]
          unidade?: string | null
          updated_at?: string
          valor?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "obra_atividades_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "obra_atividades_obra_id_fkey"
            columns: ["obra_id"]
            isOneToOne: false
            referencedRelation: "obras"
            referencedColumns: ["id"]
          },
        ]
      }
      obras: {
        Row: {
          cidade: string | null
          cliente: string | null
          cnpj_cliente: string | null
          codigo: string | null
          company_id: string
          created_at: string
          created_by: string | null
          data_fim_prevista: string | null
          data_inicio: string | null
          endereco: string | null
          id: string
          legacy_obra_id: string | null
          metadata: Json
          nome: string
          origem: string
          status: string
          uf: string | null
          updated_at: string
          valor_contratado: number | null
        }
        Insert: {
          cidade?: string | null
          cliente?: string | null
          cnpj_cliente?: string | null
          codigo?: string | null
          company_id: string
          created_at?: string
          created_by?: string | null
          data_fim_prevista?: string | null
          data_inicio?: string | null
          endereco?: string | null
          id?: string
          legacy_obra_id?: string | null
          metadata?: Json
          nome: string
          origem?: string
          status?: string
          uf?: string | null
          updated_at?: string
          valor_contratado?: number | null
        }
        Update: {
          cidade?: string | null
          cliente?: string | null
          cnpj_cliente?: string | null
          codigo?: string | null
          company_id?: string
          created_at?: string
          created_by?: string | null
          data_fim_prevista?: string | null
          data_inicio?: string | null
          endereco?: string | null
          id?: string
          legacy_obra_id?: string | null
          metadata?: Json
          nome?: string
          origem?: string
          status?: string
          uf?: string | null
          updated_at?: string
          valor_contratado?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "obras_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      oportunidade_alertas: {
        Row: {
          acao_realizada: boolean
          company_id: string
          created_at: string
          descricao: string | null
          destinatarios_email: string | null
          enviado_via_email: boolean
          enviado_via_whatsapp: boolean
          id: string
          lido_em: string | null
          oportunidade_id: string | null
          status: string
          tipo: string
          titulo: string
          updated_at: string
          urgencia: string
        }
        Insert: {
          acao_realizada?: boolean
          company_id: string
          created_at?: string
          descricao?: string | null
          destinatarios_email?: string | null
          enviado_via_email?: boolean
          enviado_via_whatsapp?: boolean
          id?: string
          lido_em?: string | null
          oportunidade_id?: string | null
          status?: string
          tipo: string
          titulo: string
          updated_at?: string
          urgencia?: string
        }
        Update: {
          acao_realizada?: boolean
          company_id?: string
          created_at?: string
          descricao?: string | null
          destinatarios_email?: string | null
          enviado_via_email?: boolean
          enviado_via_whatsapp?: boolean
          id?: string
          lido_em?: string | null
          oportunidade_id?: string | null
          status?: string
          tipo?: string
          titulo?: string
          updated_at?: string
          urgencia?: string
        }
        Relationships: [
          {
            foreignKeyName: "oportunidade_alertas_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "oportunidade_alertas_oportunidade_id_fkey"
            columns: ["oportunidade_id"]
            isOneToOne: false
            referencedRelation: "oportunidades"
            referencedColumns: ["id"]
          },
        ]
      }
      oportunidade_filtros: {
        Row: {
          ativo: boolean
          company_id: string
          created_at: string
          created_by: string | null
          id: string
          modalidades: string[]
          nome: string
          palavras_chave: string[]
          ufs: string[]
          updated_at: string
          valor_max: number | null
          valor_min: number | null
        }
        Insert: {
          ativo?: boolean
          company_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          modalidades?: string[]
          nome: string
          palavras_chave?: string[]
          ufs?: string[]
          updated_at?: string
          valor_max?: number | null
          valor_min?: number | null
        }
        Update: {
          ativo?: boolean
          company_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          modalidades?: string[]
          nome?: string
          palavras_chave?: string[]
          ufs?: string[]
          updated_at?: string
          valor_max?: number | null
          valor_min?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "oportunidade_filtros_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      oportunidade_pipeline_eventos: {
        Row: {
          actor_user_id: string | null
          company_id: string
          created_at: string
          id: string
          metadata: Json
          motivo: string | null
          oportunidade_id: string
          situacao_anterior: string | null
          situacao_nova: string
        }
        Insert: {
          actor_user_id?: string | null
          company_id: string
          created_at?: string
          id?: string
          metadata?: Json
          motivo?: string | null
          oportunidade_id: string
          situacao_anterior?: string | null
          situacao_nova: string
        }
        Update: {
          actor_user_id?: string | null
          company_id?: string
          created_at?: string
          id?: string
          metadata?: Json
          motivo?: string | null
          oportunidade_id?: string
          situacao_anterior?: string | null
          situacao_nova?: string
        }
        Relationships: [
          {
            foreignKeyName: "oportunidade_pipeline_eventos_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "oportunidade_pipeline_eventos_oportunidade_id_fkey"
            columns: ["oportunidade_id"]
            isOneToOne: false
            referencedRelation: "oportunidades"
            referencedColumns: ["id"]
          },
        ]
      }
      oportunidades: {
        Row: {
          ano_compra: number | null
          anotacoes: string | null
          company_id: string
          created_at: string
          created_by: string | null
          data_abertura_propostas: string | null
          data_encerramento_propostas: string | null
          data_publicacao: string | null
          escore_aderencia: number | null
          fonte: string
          id: string
          link_edital: string | null
          link_sistema_origem: string | null
          modalidade: string | null
          modo_disputa: string | null
          municipio: string | null
          numero_compra: string | null
          objeto: string | null
          orgao_cnpj: string | null
          orgao_nome: string | null
          pncp_id: string | null
          prioridade: string | null
          raw: Json
          responsavel_user_id: string | null
          situacao: string
          uf: string | null
          unidade_nome: string | null
          updated_at: string
          valor_estimado: number | null
        }
        Insert: {
          ano_compra?: number | null
          anotacoes?: string | null
          company_id: string
          created_at?: string
          created_by?: string | null
          data_abertura_propostas?: string | null
          data_encerramento_propostas?: string | null
          data_publicacao?: string | null
          escore_aderencia?: number | null
          fonte?: string
          id?: string
          link_edital?: string | null
          link_sistema_origem?: string | null
          modalidade?: string | null
          modo_disputa?: string | null
          municipio?: string | null
          numero_compra?: string | null
          objeto?: string | null
          orgao_cnpj?: string | null
          orgao_nome?: string | null
          pncp_id?: string | null
          prioridade?: string | null
          raw?: Json
          responsavel_user_id?: string | null
          situacao?: string
          uf?: string | null
          unidade_nome?: string | null
          updated_at?: string
          valor_estimado?: number | null
        }
        Update: {
          ano_compra?: number | null
          anotacoes?: string | null
          company_id?: string
          created_at?: string
          created_by?: string | null
          data_abertura_propostas?: string | null
          data_encerramento_propostas?: string | null
          data_publicacao?: string | null
          escore_aderencia?: number | null
          fonte?: string
          id?: string
          link_edital?: string | null
          link_sistema_origem?: string | null
          modalidade?: string | null
          modo_disputa?: string | null
          municipio?: string | null
          numero_compra?: string | null
          objeto?: string | null
          orgao_cnpj?: string | null
          orgao_nome?: string | null
          pncp_id?: string | null
          prioridade?: string | null
          raw?: Json
          responsavel_user_id?: string | null
          situacao?: string
          uf?: string | null
          unidade_nome?: string | null
          updated_at?: string
          valor_estimado?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "oportunidades_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      orcamento_itens: {
        Row: {
          company_id: string
          created_at: string
          descricao: string
          id: string
          item_codigo: string
          item_codigo_pai: string | null
          nivel: number
          obra_id: string
          observacoes: string | null
          ordem: number
          qtd_contratada: number
          sinapi_codigo: string | null
          tipo: string
          total_contratado_cents: number
          unidade: string | null
          updated_at: string
          valor_unitario_cents: number
          versao_id: string
        }
        Insert: {
          company_id: string
          created_at?: string
          descricao: string
          id?: string
          item_codigo: string
          item_codigo_pai?: string | null
          nivel?: number
          obra_id: string
          observacoes?: string | null
          ordem?: number
          qtd_contratada?: number
          sinapi_codigo?: string | null
          tipo?: string
          total_contratado_cents?: number
          unidade?: string | null
          updated_at?: string
          valor_unitario_cents?: number
          versao_id: string
        }
        Update: {
          company_id?: string
          created_at?: string
          descricao?: string
          id?: string
          item_codigo?: string
          item_codigo_pai?: string | null
          nivel?: number
          obra_id?: string
          observacoes?: string | null
          ordem?: number
          qtd_contratada?: number
          sinapi_codigo?: string | null
          tipo?: string
          total_contratado_cents?: number
          unidade?: string | null
          updated_at?: string
          valor_unitario_cents?: number
          versao_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "orcamento_itens_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orcamento_itens_obra_id_fkey"
            columns: ["obra_id"]
            isOneToOne: false
            referencedRelation: "obras"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orcamento_itens_versao_id_fkey"
            columns: ["versao_id"]
            isOneToOne: false
            referencedRelation: "orcamento_versoes"
            referencedColumns: ["id"]
          },
        ]
      }
      orcamento_versoes: {
        Row: {
          company_id: string
          congelada_em: string | null
          congelada_por: string | null
          contrato_id: string | null
          created_at: string
          created_by: string | null
          descricao: string | null
          id: string
          numero_versao: number
          obra_id: string
          observacoes: string | null
          origem: string
          origem_arquivo: string | null
          status: string
          updated_at: string
          valor_total_cents: number
        }
        Insert: {
          company_id: string
          congelada_em?: string | null
          congelada_por?: string | null
          contrato_id?: string | null
          created_at?: string
          created_by?: string | null
          descricao?: string | null
          id?: string
          numero_versao: number
          obra_id: string
          observacoes?: string | null
          origem?: string
          origem_arquivo?: string | null
          status?: string
          updated_at?: string
          valor_total_cents?: number
        }
        Update: {
          company_id?: string
          congelada_em?: string | null
          congelada_por?: string | null
          contrato_id?: string | null
          created_at?: string
          created_by?: string | null
          descricao?: string | null
          id?: string
          numero_versao?: number
          obra_id?: string
          observacoes?: string | null
          origem?: string
          origem_arquivo?: string | null
          status?: string
          updated_at?: string
          valor_total_cents?: number
        }
        Relationships: [
          {
            foreignKeyName: "orcamento_versoes_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orcamento_versoes_contrato_id_fkey"
            columns: ["contrato_id"]
            isOneToOne: false
            referencedRelation: "contratos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orcamento_versoes_obra_id_fkey"
            columns: ["obra_id"]
            isOneToOne: false
            referencedRelation: "obras"
            referencedColumns: ["id"]
          },
        ]
      }
      parametros_financeiros: {
        Row: {
          cofins_percent: number
          company_id: string
          created_at: string
          csll_percent: number
          encargos_mao_obra_percent: number
          id: string
          irpj_percent: number
          iss_percent: number
          lucro_pretendido_percent: number
          pis_percent: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          cofins_percent?: number
          company_id: string
          created_at?: string
          csll_percent?: number
          encargos_mao_obra_percent?: number
          id?: string
          irpj_percent?: number
          iss_percent?: number
          lucro_pretendido_percent?: number
          pis_percent?: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          cofins_percent?: number
          company_id?: string
          created_at?: string
          csll_percent?: number
          encargos_mao_obra_percent?: number
          id?: string
          irpj_percent?: number
          iss_percent?: number
          lucro_pretendido_percent?: number
          pis_percent?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      pncp_coleta_historico: {
        Row: {
          company_id: string
          created_at: string
          data_coleta: string
          filtro_id: string | null
          id: string
          mensagem_erro: string | null
          novos_alertas: number
          status: string
          tempo_execucao_ms: number | null
          total_atualizados: number
          total_encontrados: number
          total_novos: number
          total_removidos: number
        }
        Insert: {
          company_id: string
          created_at?: string
          data_coleta?: string
          filtro_id?: string | null
          id?: string
          mensagem_erro?: string | null
          novos_alertas?: number
          status: string
          tempo_execucao_ms?: number | null
          total_atualizados?: number
          total_encontrados?: number
          total_novos?: number
          total_removidos?: number
        }
        Update: {
          company_id?: string
          created_at?: string
          data_coleta?: string
          filtro_id?: string | null
          id?: string
          mensagem_erro?: string | null
          novos_alertas?: number
          status?: string
          tempo_execucao_ms?: number | null
          total_atualizados?: number
          total_encontrados?: number
          total_novos?: number
          total_removidos?: number
        }
        Relationships: [
          {
            foreignKeyName: "pncp_coleta_historico_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pncp_coleta_historico_filtro_id_fkey"
            columns: ["filtro_id"]
            isOneToOne: false
            referencedRelation: "oportunidade_filtros"
            referencedColumns: ["id"]
          },
        ]
      }
      pncp_configuracoes: {
        Row: {
          alertar_via_email: boolean
          alertar_via_whatsapp: boolean
          company_id: string
          created_at: string
          criar_edital: boolean
          criar_proposta_automatico: boolean
          emails_alerta: string | null
          endpoint_api: string
          filtro_categoria_economica: string | null
          filtro_estado: string | null
          filtro_modalidade: string | null
          frequencia_coleta_horas: number
          id: string
          observacoes: string | null
          proxima_coleta: string | null
          status: string
          ultima_coleta: string | null
          updated_at: string
        }
        Insert: {
          alertar_via_email?: boolean
          alertar_via_whatsapp?: boolean
          company_id: string
          created_at?: string
          criar_edital?: boolean
          criar_proposta_automatico?: boolean
          emails_alerta?: string | null
          endpoint_api?: string
          filtro_categoria_economica?: string | null
          filtro_estado?: string | null
          filtro_modalidade?: string | null
          frequencia_coleta_horas?: number
          id?: string
          observacoes?: string | null
          proxima_coleta?: string | null
          status?: string
          ultima_coleta?: string | null
          updated_at?: string
        }
        Update: {
          alertar_via_email?: boolean
          alertar_via_whatsapp?: boolean
          company_id?: string
          created_at?: string
          criar_edital?: boolean
          criar_proposta_automatico?: boolean
          emails_alerta?: string | null
          endpoint_api?: string
          filtro_categoria_economica?: string | null
          filtro_estado?: string | null
          filtro_modalidade?: string | null
          frequencia_coleta_horas?: number
          id?: string
          observacoes?: string | null
          proxima_coleta?: string | null
          status?: string
          ultima_coleta?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pncp_configuracoes_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: true
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      portal_perfis: {
        Row: {
          ativo: boolean
          casas_decimais_preco: number
          casas_decimais_qtd: number
          codigo: string | null
          company_id: string
          created_at: string
          created_by: string | null
          encoding: string
          exige_assinatura_digital: boolean
          exige_planilha_modelo: boolean
          formato_preferido: string
          id: string
          max_chars_descricao: number | null
          nome: string
          observacoes: string | null
          separador_decimal: string
          separador_milhar: string
          updated_at: string
          url_portal: string | null
        }
        Insert: {
          ativo?: boolean
          casas_decimais_preco?: number
          casas_decimais_qtd?: number
          codigo?: string | null
          company_id: string
          created_at?: string
          created_by?: string | null
          encoding?: string
          exige_assinatura_digital?: boolean
          exige_planilha_modelo?: boolean
          formato_preferido?: string
          id?: string
          max_chars_descricao?: number | null
          nome: string
          observacoes?: string | null
          separador_decimal?: string
          separador_milhar?: string
          updated_at?: string
          url_portal?: string | null
        }
        Update: {
          ativo?: boolean
          casas_decimais_preco?: number
          casas_decimais_qtd?: number
          codigo?: string | null
          company_id?: string
          created_at?: string
          created_by?: string | null
          encoding?: string
          exige_assinatura_digital?: boolean
          exige_planilha_modelo?: boolean
          formato_preferido?: string
          id?: string
          max_chars_descricao?: number | null
          nome?: string
          observacoes?: string | null
          separador_decimal?: string
          separador_milhar?: string
          updated_at?: string
          url_portal?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "portal_perfis_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      portal_protocolos: {
        Row: {
          company_id: string
          comprovante_path: string | null
          created_at: string
          created_by: string | null
          data_envio: string
          edital_id: string | null
          id: string
          numero_protocolo: string | null
          observacoes: string | null
          oportunidade_id: string | null
          portal_id: string | null
          proposta_id: string | null
          status: string
          updated_at: string
        }
        Insert: {
          company_id: string
          comprovante_path?: string | null
          created_at?: string
          created_by?: string | null
          data_envio?: string
          edital_id?: string | null
          id?: string
          numero_protocolo?: string | null
          observacoes?: string | null
          oportunidade_id?: string | null
          portal_id?: string | null
          proposta_id?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          company_id?: string
          comprovante_path?: string | null
          created_at?: string
          created_by?: string | null
          data_envio?: string
          edital_id?: string | null
          id?: string
          numero_protocolo?: string | null
          observacoes?: string | null
          oportunidade_id?: string | null
          portal_id?: string | null
          proposta_id?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "portal_protocolos_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "portal_protocolos_edital_id_fkey"
            columns: ["edital_id"]
            isOneToOne: false
            referencedRelation: "editais"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "portal_protocolos_oportunidade_id_fkey"
            columns: ["oportunidade_id"]
            isOneToOne: false
            referencedRelation: "oportunidades"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "portal_protocolos_portal_id_fkey"
            columns: ["portal_id"]
            isOneToOne: false
            referencedRelation: "portal_perfis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "portal_protocolos_proposta_id_fkey"
            columns: ["proposta_id"]
            isOneToOne: false
            referencedRelation: "propostas"
            referencedColumns: ["id"]
          },
        ]
      }
      procuracoes: {
        Row: {
          arquivo_path: string | null
          cartorio: string | null
          company_id: string
          created_at: string
          created_by: string | null
          data_outorga: string
          data_validade: string | null
          escopo: Json
          id: string
          numero: string | null
          observacoes: string | null
          poderes_especificos: string | null
          poderes_gerais: boolean
          revogada_em: string | null
          revogada_motivo: string | null
          signatario_id: string
          status: string
          substabelecimento: boolean
          tipo: string
          updated_at: string
        }
        Insert: {
          arquivo_path?: string | null
          cartorio?: string | null
          company_id: string
          created_at?: string
          created_by?: string | null
          data_outorga: string
          data_validade?: string | null
          escopo?: Json
          id?: string
          numero?: string | null
          observacoes?: string | null
          poderes_especificos?: string | null
          poderes_gerais?: boolean
          revogada_em?: string | null
          revogada_motivo?: string | null
          signatario_id: string
          status?: string
          substabelecimento?: boolean
          tipo?: string
          updated_at?: string
        }
        Update: {
          arquivo_path?: string | null
          cartorio?: string | null
          company_id?: string
          created_at?: string
          created_by?: string | null
          data_outorga?: string
          data_validade?: string | null
          escopo?: Json
          id?: string
          numero?: string | null
          observacoes?: string | null
          poderes_especificos?: string | null
          poderes_gerais?: boolean
          revogada_em?: string | null
          revogada_motivo?: string | null
          signatario_id?: string
          status?: string
          substabelecimento?: boolean
          tipo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "procuracoes_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "procuracoes_signatario_id_fkey"
            columns: ["signatario_id"]
            isOneToOne: false
            referencedRelation: "company_signatarios"
            referencedColumns: ["id"]
          },
        ]
      }
      proposta_itens: {
        Row: {
          codigo: string | null
          company_id: string
          composicao_id: string | null
          created_at: string
          descricao: string
          id: string
          insumo_id: string | null
          item_pai_id: string | null
          observacao: string | null
          ordem: number
          preco_total: number | null
          preco_unitario: number
          proposta_id: string
          quantidade: number
          unidade: string | null
          updated_at: string
        }
        Insert: {
          codigo?: string | null
          company_id: string
          composicao_id?: string | null
          created_at?: string
          descricao: string
          id?: string
          insumo_id?: string | null
          item_pai_id?: string | null
          observacao?: string | null
          ordem?: number
          preco_total?: number | null
          preco_unitario?: number
          proposta_id: string
          quantidade?: number
          unidade?: string | null
          updated_at?: string
        }
        Update: {
          codigo?: string | null
          company_id?: string
          composicao_id?: string | null
          created_at?: string
          descricao?: string
          id?: string
          insumo_id?: string | null
          item_pai_id?: string | null
          observacao?: string | null
          ordem?: number
          preco_total?: number | null
          preco_unitario?: number
          proposta_id?: string
          quantidade?: number
          unidade?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "proposta_itens_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proposta_itens_composicao_id_fkey"
            columns: ["composicao_id"]
            isOneToOne: false
            referencedRelation: "composicoes_proprias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proposta_itens_insumo_id_fkey"
            columns: ["insumo_id"]
            isOneToOne: false
            referencedRelation: "insumos_mestre"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proposta_itens_item_pai_id_fkey"
            columns: ["item_pai_id"]
            isOneToOne: false
            referencedRelation: "proposta_itens"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proposta_itens_proposta_id_fkey"
            columns: ["proposta_id"]
            isOneToOne: false
            referencedRelation: "propostas"
            referencedColumns: ["id"]
          },
        ]
      }
      proposta_readequacao_residuos: {
        Row: {
          codigo: string | null
          company_id: string
          created_at: string
          delta_valor: number | null
          descricao: string
          id: string
          item_origem_id: string | null
          item_readequado_id: string | null
          justificativa: string | null
          preco_origem: number
          preco_readequado: number
          proposta_origem_id: string
          proposta_readequada_id: string
          qtd_origem: number
          qtd_readequada: number
          unidade: string | null
        }
        Insert: {
          codigo?: string | null
          company_id: string
          created_at?: string
          delta_valor?: number | null
          descricao: string
          id?: string
          item_origem_id?: string | null
          item_readequado_id?: string | null
          justificativa?: string | null
          preco_origem?: number
          preco_readequado?: number
          proposta_origem_id: string
          proposta_readequada_id: string
          qtd_origem?: number
          qtd_readequada?: number
          unidade?: string | null
        }
        Update: {
          codigo?: string | null
          company_id?: string
          created_at?: string
          delta_valor?: number | null
          descricao?: string
          id?: string
          item_origem_id?: string | null
          item_readequado_id?: string | null
          justificativa?: string | null
          preco_origem?: number
          preco_readequado?: number
          proposta_origem_id?: string
          proposta_readequada_id?: string
          qtd_origem?: number
          qtd_readequada?: number
          unidade?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "proposta_readequacao_residuos_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proposta_readequacao_residuos_item_origem_id_fkey"
            columns: ["item_origem_id"]
            isOneToOne: false
            referencedRelation: "proposta_itens"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proposta_readequacao_residuos_item_readequado_id_fkey"
            columns: ["item_readequado_id"]
            isOneToOne: false
            referencedRelation: "proposta_itens"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proposta_readequacao_residuos_proposta_origem_id_fkey"
            columns: ["proposta_origem_id"]
            isOneToOne: false
            referencedRelation: "propostas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proposta_readequacao_residuos_proposta_readequada_id_fkey"
            columns: ["proposta_readequada_id"]
            isOneToOne: false
            referencedRelation: "propostas"
            referencedColumns: ["id"]
          },
        ]
      }
      propostas: {
        Row: {
          ai_meta: Json
          bdi_percent: number | null
          company_id: string
          created_at: string
          created_by: string | null
          cronograma: string | null
          data_referencia: string | null
          diferenciais: string | null
          edital_id: string | null
          encargos_percent: number | null
          equipe_tecnica: string | null
          id: string
          metodologia: string | null
          observacoes: string | null
          prazo_execucao_dias: number | null
          proposta_origem_id: string | null
          resumo_executivo: string | null
          status: string
          tipo: string
          titulo: string
          updated_at: string
          valor_itens: number | null
          valor_proposto: number | null
          valor_total: number | null
        }
        Insert: {
          ai_meta?: Json
          bdi_percent?: number | null
          company_id: string
          created_at?: string
          created_by?: string | null
          cronograma?: string | null
          data_referencia?: string | null
          diferenciais?: string | null
          edital_id?: string | null
          encargos_percent?: number | null
          equipe_tecnica?: string | null
          id?: string
          metodologia?: string | null
          observacoes?: string | null
          prazo_execucao_dias?: number | null
          proposta_origem_id?: string | null
          resumo_executivo?: string | null
          status?: string
          tipo?: string
          titulo: string
          updated_at?: string
          valor_itens?: number | null
          valor_proposto?: number | null
          valor_total?: number | null
        }
        Update: {
          ai_meta?: Json
          bdi_percent?: number | null
          company_id?: string
          created_at?: string
          created_by?: string | null
          cronograma?: string | null
          data_referencia?: string | null
          diferenciais?: string | null
          edital_id?: string | null
          encargos_percent?: number | null
          equipe_tecnica?: string | null
          id?: string
          metodologia?: string | null
          observacoes?: string | null
          prazo_execucao_dias?: number | null
          proposta_origem_id?: string | null
          resumo_executivo?: string | null
          status?: string
          tipo?: string
          titulo?: string
          updated_at?: string
          valor_itens?: number | null
          valor_proposto?: number | null
          valor_total?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "propostas_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "propostas_edital_id_fkey"
            columns: ["edital_id"]
            isOneToOne: false
            referencedRelation: "editais"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "propostas_proposta_origem_id_fkey"
            columns: ["proposta_origem_id"]
            isOneToOne: false
            referencedRelation: "propostas"
            referencedColumns: ["id"]
          },
        ]
      }
      rdo_equipamentos: {
        Row: {
          company_id: string
          created_at: string
          equipamento: string
          horas_operadas: number
          horas_paradas: number
          id: string
          observacao: string | null
          rdo_id: string
        }
        Insert: {
          company_id: string
          created_at?: string
          equipamento: string
          horas_operadas?: number
          horas_paradas?: number
          id?: string
          observacao?: string | null
          rdo_id: string
        }
        Update: {
          company_id?: string
          created_at?: string
          equipamento?: string
          horas_operadas?: number
          horas_paradas?: number
          id?: string
          observacao?: string | null
          rdo_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "rdo_equipamentos_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rdo_equipamentos_rdo_id_fkey"
            columns: ["rdo_id"]
            isOneToOne: false
            referencedRelation: "rdos"
            referencedColumns: ["id"]
          },
        ]
      }
      rdo_equipes: {
        Row: {
          company_id: string
          created_at: string
          funcao: string
          horas_trabalhadas: number
          id: string
          observacao: string | null
          quantidade: number
          rdo_id: string
        }
        Insert: {
          company_id: string
          created_at?: string
          funcao: string
          horas_trabalhadas?: number
          id?: string
          observacao?: string | null
          quantidade?: number
          rdo_id: string
        }
        Update: {
          company_id?: string
          created_at?: string
          funcao?: string
          horas_trabalhadas?: number
          id?: string
          observacao?: string | null
          quantidade?: number
          rdo_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "rdo_equipes_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rdo_equipes_rdo_id_fkey"
            columns: ["rdo_id"]
            isOneToOne: false
            referencedRelation: "rdos"
            referencedColumns: ["id"]
          },
        ]
      }
      rdo_fotos: {
        Row: {
          categoria: string
          company_id: string
          created_at: string
          file_name: string
          id: string
          legenda: string | null
          mime_type: string | null
          rdo_id: string
          size_bytes: number | null
          storage_path: string
          updated_at: string
          uploaded_by: string | null
        }
        Insert: {
          categoria?: string
          company_id: string
          created_at?: string
          file_name: string
          id?: string
          legenda?: string | null
          mime_type?: string | null
          rdo_id: string
          size_bytes?: number | null
          storage_path: string
          updated_at?: string
          uploaded_by?: string | null
        }
        Update: {
          categoria?: string
          company_id?: string
          created_at?: string
          file_name?: string
          id?: string
          legenda?: string | null
          mime_type?: string | null
          rdo_id?: string
          size_bytes?: number | null
          storage_path?: string
          updated_at?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rdo_fotos_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rdo_fotos_rdo_id_fkey"
            columns: ["rdo_id"]
            isOneToOne: false
            referencedRelation: "rdos"
            referencedColumns: ["id"]
          },
        ]
      }
      rdo_ocorrencias: {
        Row: {
          company_id: string
          created_at: string
          descricao: string
          id: string
          rdo_id: string
          severidade: string | null
          tipo: string
        }
        Insert: {
          company_id: string
          created_at?: string
          descricao: string
          id?: string
          rdo_id: string
          severidade?: string | null
          tipo: string
        }
        Update: {
          company_id?: string
          created_at?: string
          descricao?: string
          id?: string
          rdo_id?: string
          severidade?: string | null
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "rdo_ocorrencias_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rdo_ocorrencias_rdo_id_fkey"
            columns: ["rdo_id"]
            isOneToOne: false
            referencedRelation: "rdos"
            referencedColumns: ["id"]
          },
        ]
      }
      rdos: {
        Row: {
          atividades_executadas: string | null
          clima_manha: string | null
          clima_noite: string | null
          clima_tarde: string | null
          company_id: string
          condicao_trabalho: string | null
          created_at: string
          created_by: string | null
          data: string
          efetivo_total: number
          id: string
          metadata: Json
          obra_id: string
          observacoes: string | null
          status: string
          updated_at: string
        }
        Insert: {
          atividades_executadas?: string | null
          clima_manha?: string | null
          clima_noite?: string | null
          clima_tarde?: string | null
          company_id: string
          condicao_trabalho?: string | null
          created_at?: string
          created_by?: string | null
          data: string
          efetivo_total?: number
          id?: string
          metadata?: Json
          obra_id: string
          observacoes?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          atividades_executadas?: string | null
          clima_manha?: string | null
          clima_noite?: string | null
          clima_tarde?: string | null
          company_id?: string
          condicao_trabalho?: string | null
          created_at?: string
          created_by?: string | null
          data?: string
          efetivo_total?: number
          id?: string
          metadata?: Json
          obra_id?: string
          observacoes?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "rdos_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rdos_obra_id_fkey"
            columns: ["obra_id"]
            isOneToOne: false
            referencedRelation: "obras"
            referencedColumns: ["id"]
          },
        ]
      }
      reajustes_contratuais: {
        Row: {
          aplicado_em: string | null
          company_id: string
          contrato_id: string
          created_at: string
          created_by: string | null
          data_aplicacao: string | null
          id: string
          indice: string
          metadata: Json
          numero: number
          observacoes: string | null
          percentual_acumulado: number
          periodo_fim: string
          periodo_inicio: string
          status: string
          updated_at: string
          valor_base: number
          valor_reajuste: number
        }
        Insert: {
          aplicado_em?: string | null
          company_id: string
          contrato_id: string
          created_at?: string
          created_by?: string | null
          data_aplicacao?: string | null
          id?: string
          indice: string
          metadata?: Json
          numero: number
          observacoes?: string | null
          percentual_acumulado: number
          periodo_fim: string
          periodo_inicio: string
          status?: string
          updated_at?: string
          valor_base: number
          valor_reajuste: number
        }
        Update: {
          aplicado_em?: string | null
          company_id?: string
          contrato_id?: string
          created_at?: string
          created_by?: string | null
          data_aplicacao?: string | null
          id?: string
          indice?: string
          metadata?: Json
          numero?: number
          observacoes?: string | null
          percentual_acumulado?: number
          periodo_fim?: string
          periodo_inicio?: string
          status?: string
          updated_at?: string
          valor_base?: number
          valor_reajuste?: number
        }
        Relationships: [
          {
            foreignKeyName: "reajustes_contratuais_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reajustes_contratuais_contrato_id_fkey"
            columns: ["contrato_id"]
            isOneToOne: false
            referencedRelation: "contratos"
            referencedColumns: ["id"]
          },
        ]
      }
      responsaveis_tecnicos: {
        Row: {
          ativo: boolean
          company_id: string
          conselho: string | null
          cpf: string | null
          created_at: string
          email: string | null
          formacao: string | null
          id: string
          nome: string
          numero_registro: string | null
          observacoes: string | null
          telefone: string | null
          uf_registro: string | null
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          company_id: string
          conselho?: string | null
          cpf?: string | null
          created_at?: string
          email?: string | null
          formacao?: string | null
          id?: string
          nome: string
          numero_registro?: string | null
          observacoes?: string | null
          telefone?: string | null
          uf_registro?: string | null
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          company_id?: string
          conselho?: string | null
          cpf?: string | null
          created_at?: string
          email?: string | null
          formacao?: string | null
          id?: string
          nome?: string
          numero_registro?: string | null
          observacoes?: string | null
          telefone?: string | null
          uf_registro?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "responsaveis_tecnicos_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      signature_events: {
        Row: {
          created_at: string
          created_by: string | null
          event_description: string | null
          event_type: string
          external_event_id: string | null
          id: string
          payload: Json | null
          signature_request_id: string
          signer_id: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          event_description?: string | null
          event_type: string
          external_event_id?: string | null
          id?: string
          payload?: Json | null
          signature_request_id: string
          signer_id?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          event_description?: string | null
          event_type?: string
          external_event_id?: string | null
          id?: string
          payload?: Json | null
          signature_request_id?: string
          signer_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "signature_events_signature_request_id_fkey"
            columns: ["signature_request_id"]
            isOneToOne: false
            referencedRelation: "signature_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "signature_events_signer_id_fkey"
            columns: ["signer_id"]
            isOneToOne: false
            referencedRelation: "signature_signers"
            referencedColumns: ["id"]
          },
        ]
      }
      signature_fields: {
        Row: {
          created_at: string
          field_type: string
          id: string
          page: number
          relative_position_bottom: number
          relative_position_left: number
          relative_size_x: number
          relative_size_y: number
          signature_request_id: string
          signer_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          field_type?: string
          id?: string
          page?: number
          relative_position_bottom: number
          relative_position_left: number
          relative_size_x: number
          relative_size_y: number
          signature_request_id: string
          signer_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          field_type?: string
          id?: string
          page?: number
          relative_position_bottom?: number
          relative_position_left?: number
          relative_size_x?: number
          relative_size_y?: number
          signature_request_id?: string
          signer_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "signature_fields_signature_request_id_fkey"
            columns: ["signature_request_id"]
            isOneToOne: false
            referencedRelation: "signature_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "signature_fields_signer_id_fkey"
            columns: ["signer_id"]
            isOneToOne: false
            referencedRelation: "signature_signers"
            referencedColumns: ["id"]
          },
        ]
      }
      signature_requests: {
        Row: {
          authentication_mode: string
          canceled_at: string | null
          cancellation_reason: string | null
          company_id: string
          contrato_id: string | null
          created_at: string
          created_by: string | null
          document_folder: string
          document_name: string
          document_path: string
          error_message: string | null
          expiration_date: string | null
          id: string
          obra_id: string
          original_file_hash: string | null
          sandbox: boolean
          signed_at: string | null
          signed_file_hash: string | null
          signed_file_path: string | null
          status: string
          updated_at: string
          version: number
          zapsign_document_token: string | null
          zapsign_open_id: string | null
        }
        Insert: {
          authentication_mode?: string
          canceled_at?: string | null
          cancellation_reason?: string | null
          company_id: string
          contrato_id?: string | null
          created_at?: string
          created_by?: string | null
          document_folder: string
          document_name: string
          document_path: string
          error_message?: string | null
          expiration_date?: string | null
          id?: string
          obra_id: string
          original_file_hash?: string | null
          sandbox?: boolean
          signed_at?: string | null
          signed_file_hash?: string | null
          signed_file_path?: string | null
          status?: string
          updated_at?: string
          version?: number
          zapsign_document_token?: string | null
          zapsign_open_id?: string | null
        }
        Update: {
          authentication_mode?: string
          canceled_at?: string | null
          cancellation_reason?: string | null
          company_id?: string
          contrato_id?: string | null
          created_at?: string
          created_by?: string | null
          document_folder?: string
          document_name?: string
          document_path?: string
          error_message?: string | null
          expiration_date?: string | null
          id?: string
          obra_id?: string
          original_file_hash?: string | null
          sandbox?: boolean
          signed_at?: string | null
          signed_file_hash?: string | null
          signed_file_path?: string | null
          status?: string
          updated_at?: string
          version?: number
          zapsign_document_token?: string | null
          zapsign_open_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "signature_requests_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "signature_requests_contrato_id_fkey"
            columns: ["contrato_id"]
            isOneToOne: false
            referencedRelation: "contratos"
            referencedColumns: ["id"]
          },
        ]
      }
      signature_settings: {
        Row: {
          automatic_email: boolean
          automatic_whatsapp: boolean
          company_id: string
          created_at: string
          default_auth_mode: string
          environment: string
          id: string
          last_connection_test_at: string | null
          last_connection_test_status: string | null
          last_webhook_received_at: string | null
          manual_whatsapp_enabled: boolean
          reminder_channel: string
          reminder_enabled: boolean
          reminder_interval_days: number
          reminder_max_count: number
          updated_at: string
          webhook_configured: boolean
        }
        Insert: {
          automatic_email?: boolean
          automatic_whatsapp?: boolean
          company_id: string
          created_at?: string
          default_auth_mode?: string
          environment?: string
          id?: string
          last_connection_test_at?: string | null
          last_connection_test_status?: string | null
          last_webhook_received_at?: string | null
          manual_whatsapp_enabled?: boolean
          reminder_channel?: string
          reminder_enabled?: boolean
          reminder_interval_days?: number
          reminder_max_count?: number
          updated_at?: string
          webhook_configured?: boolean
        }
        Update: {
          automatic_email?: boolean
          automatic_whatsapp?: boolean
          company_id?: string
          created_at?: string
          default_auth_mode?: string
          environment?: string
          id?: string
          last_connection_test_at?: string | null
          last_connection_test_status?: string | null
          last_webhook_received_at?: string | null
          manual_whatsapp_enabled?: boolean
          reminder_channel?: string
          reminder_enabled?: boolean
          reminder_interval_days?: number
          reminder_max_count?: number
          updated_at?: string
          webhook_configured?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "signature_settings_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: true
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      signature_signers: {
        Row: {
          auth_mode: string
          company: string | null
          cpf: string | null
          created_at: string
          custom_message: string | null
          email: string | null
          id: string
          last_reminder_at: string | null
          last_shared_at: string | null
          mandatory: boolean
          name: string
          phone_country: string | null
          phone_number: string | null
          refusal_reason: string | null
          refused_at: string | null
          reminder_count: number
          role: string | null
          send_automatic_email: boolean
          send_automatic_whatsapp: boolean
          signature_request_id: string
          signed_at: string | null
          signing_order: number | null
          status: string
          updated_at: string
          zapsign_sign_url: string | null
          zapsign_signer_token: string | null
        }
        Insert: {
          auth_mode?: string
          company?: string | null
          cpf?: string | null
          created_at?: string
          custom_message?: string | null
          email?: string | null
          id?: string
          last_reminder_at?: string | null
          last_shared_at?: string | null
          mandatory?: boolean
          name: string
          phone_country?: string | null
          phone_number?: string | null
          refusal_reason?: string | null
          refused_at?: string | null
          reminder_count?: number
          role?: string | null
          send_automatic_email?: boolean
          send_automatic_whatsapp?: boolean
          signature_request_id: string
          signed_at?: string | null
          signing_order?: number | null
          status?: string
          updated_at?: string
          zapsign_sign_url?: string | null
          zapsign_signer_token?: string | null
        }
        Update: {
          auth_mode?: string
          company?: string | null
          cpf?: string | null
          created_at?: string
          custom_message?: string | null
          email?: string | null
          id?: string
          last_reminder_at?: string | null
          last_shared_at?: string | null
          mandatory?: boolean
          name?: string
          phone_country?: string | null
          phone_number?: string | null
          refusal_reason?: string | null
          refused_at?: string | null
          reminder_count?: number
          role?: string | null
          send_automatic_email?: boolean
          send_automatic_whatsapp?: boolean
          signature_request_id?: string
          signed_at?: string | null
          signing_order?: number | null
          status?: string
          updated_at?: string
          zapsign_sign_url?: string | null
          zapsign_signer_token?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "signature_signers_signature_request_id_fkey"
            columns: ["signature_request_id"]
            isOneToOne: false
            referencedRelation: "signature_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      signature_templates: {
        Row: {
          company_id: string
          created_at: string
          created_by: string | null
          custom_message: string | null
          default_auth_mode: string | null
          description: string | null
          document_folder: string | null
          expiration_days: number | null
          id: string
          name: string
          placements: Json
          signers: Json
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          created_by?: string | null
          custom_message?: string | null
          default_auth_mode?: string | null
          description?: string | null
          document_folder?: string | null
          expiration_days?: number | null
          id?: string
          name: string
          placements?: Json
          signers?: Json
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          created_by?: string | null
          custom_message?: string | null
          default_auth_mode?: string | null
          description?: string | null
          document_folder?: string | null
          expiration_days?: number | null
          id?: string
          name?: string
          placements?: Json
          signers?: Json
          updated_at?: string
        }
        Relationships: []
      }
      unidades_medida: {
        Row: {
          company_id: string
          created_at: string
          descricao: string
          fator_conversao: number
          id: string
          sigla: string
          unidade_base_id: string | null
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          descricao: string
          fator_conversao?: number
          id?: string
          sigla: string
          unidade_base_id?: string | null
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          descricao?: string
          fator_conversao?: number
          id?: string
          sigla?: string
          unidade_base_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "unidades_medida_unidade_base_id_fkey"
            columns: ["unidade_base_id"]
            isOneToOne: false
            referencedRelation: "unidades_medida"
            referencedColumns: ["id"]
          },
        ]
      }
      user_workspaces: {
        Row: {
          created_at: string
          updated_at: string
          user_id: string
          workspace: Json
        }
        Insert: {
          created_at?: string
          updated_at?: string
          user_id: string
          workspace?: Json
        }
        Update: {
          created_at?: string
          updated_at?: string
          user_id?: string
          workspace?: Json
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      accept_company_invite: { Args: { _token: string }; Returns: string }
      calcular_saldo_insumo: {
        Args: { _company: string; _insumo: string; _obra?: string }
        Returns: {
          saldo: number
          ultimo_movimento: string
          valor_medio: number
        }[]
      }
      categorizar_descricao: { Args: { _desc: string }; Returns: string }
      current_company_id: { Args: never; Returns: string }
      current_user_company: { Args: never; Returns: string }
      get_company_member_emails: {
        Args: { _company: string }
        Returns: {
          email: string
          user_id: string
        }[]
      }
      get_invite_info: {
        Args: { _token: string }
        Returns: {
          accepted: boolean
          company_id: string
          company_name: string
          email: string
          expires_at: string
          role: Database["public"]["Enums"]["company_role"]
        }[]
      }
      has_company_role:
        | { Args: { _company_id: string; _roles: string[] }; Returns: boolean }
        | {
            Args: {
              _company: string
              _role: Database["public"]["Enums"]["company_role"]
              _user: string
            }
            Returns: boolean
          }
      import_sinapi_batch: {
        Args: { _company: string; _rows: Json; _versao: string }
        Returns: Json
      }
      is_company_member:
        | { Args: { _company_id: string }; Returns: boolean }
        | { Args: { _company: string; _user: string }; Returns: boolean }
      log_audit_event: {
        Args: {
          _acao: string
          _company_id: string
          _entidade?: string
          _entidade_id?: string
          _erro?: string
          _justificativa?: string
          _modulo: string
          _payload_antes?: Json
          _payload_depois?: Json
          _resultado?: string
        }
        Returns: string
      }
      match_edital_chunks: {
        Args: {
          p_edital_id: string
          p_match_count?: number
          p_query_embedding: string
        }
        Returns: {
          chunk_index: number
          conteudo: string
          documento_id: string
          id: string
          pagina: number
          similarity: number
        }[]
      }
      recalc_cronograma_totals: {
        Args: { p_cronograma_id: string }
        Returns: undefined
      }
      recalc_proposta_totals: {
        Args: { p_proposta_id: string }
        Returns: undefined
      }
      registrar_entrada_nfe: {
        Args: { _nota_id: string; _obra_id?: string }
        Returns: number
      }
      search_insumos: {
        Args: {
          _categoria?: string
          _company: string
          _ncm?: string
          _page?: number
          _page_size?: number
          _q?: string
          _unidade?: string
        }
        Returns: {
          ativo: boolean
          categoria_id: string
          categoria_nome: string
          codigo: string
          descricao: string
          especificacao_tecnica: string
          id: string
          imagem_url: string
          ncm: string
          normas_tecnicas: string
          sinapi_codigo: string
          total_count: number
          unidade_id: string
          unidade_sigla: string
          updated_at: string
          versao_sinapi: string
        }[]
      }
      seed_centros_custo_base: {
        Args: { _company: string }
        Returns: undefined
      }
      seed_equipamentos_base: { Args: { _company: string }; Returns: undefined }
      seed_funcoes_base: { Args: { _company: string }; Returns: undefined }
      seed_insumos_base: { Args: { _company: string }; Returns: undefined }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
    }
    Enums: {
      analise_risco: "baixo" | "moderado" | "alto" | "critico"
      atividade_prioridade: "baixa" | "media" | "alta" | "critica"
      atividade_status:
        | "nao_iniciada"
        | "em_andamento"
        | "concluida"
        | "paralisada"
      centro_custo_tipo:
        | "administracao"
        | "mao_obra"
        | "materiais"
        | "equipamentos"
        | "terceiros"
        | "indiretos"
        | "outros"
      company_role: "admin" | "member" | "editor"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      analise_risco: ["baixo", "moderado", "alto", "critico"],
      atividade_prioridade: ["baixa", "media", "alta", "critica"],
      atividade_status: [
        "nao_iniciada",
        "em_andamento",
        "concluida",
        "paralisada",
      ],
      centro_custo_tipo: [
        "administracao",
        "mao_obra",
        "materiais",
        "equipamentos",
        "terceiros",
        "indiretos",
        "outros",
      ],
      company_role: ["admin", "member", "editor"],
    },
  },
} as const
