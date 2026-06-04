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
      companies: {
        Row: {
          created_at: string
          id: string
          name: string
          owner_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name?: string
          owner_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          owner_id?: string
          updated_at?: string
        }
        Relationships: []
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
      has_company_role: {
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
      is_company_member: {
        Args: { _company: string; _user: string }
        Returns: boolean
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
