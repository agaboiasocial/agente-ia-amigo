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
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      accounts: {
        Row: {
          created_at: string | null
          domain: string | null
          features: Json | null
          id: string
          locale: string | null
          name: string
          status: string | null
        }
        Insert: {
          created_at?: string | null
          domain?: string | null
          features?: Json | null
          id?: string
          locale?: string | null
          name: string
          status?: string | null
        }
        Update: {
          created_at?: string | null
          domain?: string | null
          features?: Json | null
          id?: string
          locale?: string | null
          name?: string
          status?: string | null
        }
        Relationships: []
      }
      agents: {
        Row: {
          auth_user_id: string | null
          avatar_url: string | null
          created_at: string | null
          custom_role_id: string | null
          email: string
          id: string
          last_seen_at: string | null
          name: string
          role: string | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          auth_user_id?: string | null
          avatar_url?: string | null
          created_at?: string | null
          custom_role_id?: string | null
          email: string
          id?: string
          last_seen_at?: string | null
          name: string
          role?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          auth_user_id?: string | null
          avatar_url?: string | null
          created_at?: string | null
          custom_role_id?: string | null
          email?: string
          id?: string
          last_seen_at?: string | null
          name?: string
          role?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_custom_role"
            columns: ["custom_role_id"]
            isOneToOne: false
            referencedRelation: "custom_roles"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          action_type: string | null
          agent_id: string | null
          agent_name: string | null
          contact_id: string | null
          conversation_id: string | null
          created_at: string | null
          details: Json | null
          id: string
          ip_address: string | null
        }
        Insert: {
          action: string
          action_type?: string | null
          agent_id?: string | null
          agent_name?: string | null
          contact_id?: string | null
          conversation_id?: string | null
          created_at?: string | null
          details?: Json | null
          id?: string
          ip_address?: string | null
        }
        Update: {
          action?: string
          action_type?: string | null
          agent_id?: string | null
          agent_name?: string | null
          contact_id?: string | null
          conversation_id?: string | null
          created_at?: string | null
          details?: Json | null
          id?: string
          ip_address?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_logs_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_logs_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      automations: {
        Row: {
          actions: Json
          created_at: string | null
          description: string | null
          id: string
          is_active: boolean | null
          name: string
          trigger_event: string
          trigger_label_id: string | null
        }
        Insert: {
          actions?: Json
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          trigger_event: string
          trigger_label_id?: string | null
        }
        Update: {
          actions?: Json
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          trigger_event?: string
          trigger_label_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "automations_trigger_label_id_fkey"
            columns: ["trigger_label_id"]
            isOneToOne: false
            referencedRelation: "labels"
            referencedColumns: ["id"]
          },
        ]
      }
      campaigns: {
        Row: {
          audience_filter: Json | null
          channel: string | null
          completed_at: string | null
          created_at: string | null
          description: string | null
          id: string
          message_template: string | null
          n8n_workflow_url: string | null
          name: string
          scheduled_at: string | null
          stats: Json | null
          status: string | null
        }
        Insert: {
          audience_filter?: Json | null
          channel?: string | null
          completed_at?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          message_template?: string | null
          n8n_workflow_url?: string | null
          name: string
          scheduled_at?: string | null
          stats?: Json | null
          status?: string | null
        }
        Update: {
          audience_filter?: Json | null
          channel?: string | null
          completed_at?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          message_template?: string | null
          n8n_workflow_url?: string | null
          name?: string
          scheduled_at?: string | null
          stats?: Json | null
          status?: string | null
        }
        Relationships: []
      }
      canned_responses: {
        Row: {
          agent_id: string | null
          content: string
          created_at: string | null
          id: string
          is_global: boolean | null
          short_code: string
        }
        Insert: {
          agent_id?: string | null
          content: string
          created_at?: string | null
          id?: string
          is_global?: boolean | null
          short_code: string
        }
        Update: {
          agent_id?: string | null
          content?: string
          created_at?: string | null
          id?: string
          is_global?: boolean | null
          short_code?: string
        }
        Relationships: [
          {
            foreignKeyName: "canned_responses_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
        ]
      }
      contact_tasks: {
        Row: {
          agent_id: string | null
          contact_id: string | null
          created_at: string | null
          description: string | null
          due_date: string | null
          id: string
          is_completed: boolean | null
          priority: string | null
          task_type: string | null
          title: string
          updated_at: string | null
        }
        Insert: {
          agent_id?: string | null
          contact_id?: string | null
          created_at?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          is_completed?: boolean | null
          priority?: string | null
          task_type?: string | null
          title: string
          updated_at?: string | null
        }
        Update: {
          agent_id?: string | null
          contact_id?: string | null
          created_at?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          is_completed?: boolean | null
          priority?: string | null
          task_type?: string | null
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contact_tasks_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contact_tasks_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      contacts: {
        Row: {
          channel: string | null
          created_at: string | null
          custom_attributes: Json | null
          email: string | null
          id: string
          name: string
          phone_number: string | null
          profile_pic: string | null
          tags: string[] | null
          updated_at: string | null
        }
        Insert: {
          channel?: string | null
          created_at?: string | null
          custom_attributes?: Json | null
          email?: string | null
          id?: string
          name: string
          phone_number?: string | null
          profile_pic?: string | null
          tags?: string[] | null
          updated_at?: string | null
        }
        Update: {
          channel?: string | null
          created_at?: string | null
          custom_attributes?: Json | null
          email?: string | null
          id?: string
          name?: string
          phone_number?: string | null
          profile_pic?: string | null
          tags?: string[] | null
          updated_at?: string | null
        }
        Relationships: []
      }
      conversation_labels: {
        Row: {
          conversation_id: string | null
          created_at: string | null
          id: string
          label_id: string | null
        }
        Insert: {
          conversation_id?: string | null
          created_at?: string | null
          id?: string
          label_id?: string | null
        }
        Update: {
          conversation_id?: string | null
          created_at?: string | null
          id?: string
          label_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "conversation_labels_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversation_labels_label_id_fkey"
            columns: ["label_id"]
            isOneToOne: false
            referencedRelation: "labels"
            referencedColumns: ["id"]
          },
        ]
      }
      conversations: {
        Row: {
          assigned_agent_id: string | null
          assigned_team_id: string | null
          channel: string | null
          contact_id: string | null
          created_at: string | null
          custom_attributes: Json | null
          first_reply_at: string | null
          id: string
          inbox_id: string | null
          instance_name: string | null
          last_message: string | null
          last_message_at: string | null
          priority: string | null
          resolved_at: string | null
          sla_status: string | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          assigned_agent_id?: string | null
          assigned_team_id?: string | null
          channel?: string | null
          contact_id?: string | null
          created_at?: string | null
          custom_attributes?: Json | null
          first_reply_at?: string | null
          id?: string
          inbox_id?: string | null
          instance_name?: string | null
          last_message?: string | null
          last_message_at?: string | null
          priority?: string | null
          resolved_at?: string | null
          sla_status?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          assigned_agent_id?: string | null
          assigned_team_id?: string | null
          channel?: string | null
          contact_id?: string | null
          created_at?: string | null
          custom_attributes?: Json | null
          first_reply_at?: string | null
          id?: string
          inbox_id?: string | null
          instance_name?: string | null
          last_message?: string | null
          last_message_at?: string | null
          priority?: string | null
          resolved_at?: string | null
          sla_status?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "conversations_assigned_agent_id_fkey"
            columns: ["assigned_agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_assigned_team_id_fkey"
            columns: ["assigned_team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_instance_name_fkey"
            columns: ["instance_name"]
            isOneToOne: false
            referencedRelation: "whatsapp_instances"
            referencedColumns: ["instance_name"]
          },
          {
            foreignKeyName: "fk_inbox"
            columns: ["inbox_id"]
            isOneToOne: false
            referencedRelation: "inboxes"
            referencedColumns: ["id"]
          },
        ]
      }
      custom_attribute_definitions: {
        Row: {
          applies_to: string
          attribute_type: string
          created_at: string | null
          description: string | null
          id: string
          is_required: boolean | null
          key: string
          list_options: string[] | null
          name: string
          show_in_sidebar: boolean | null
        }
        Insert: {
          applies_to: string
          attribute_type: string
          created_at?: string | null
          description?: string | null
          id?: string
          is_required?: boolean | null
          key: string
          list_options?: string[] | null
          name: string
          show_in_sidebar?: boolean | null
        }
        Update: {
          applies_to?: string
          attribute_type?: string
          created_at?: string | null
          description?: string | null
          id?: string
          is_required?: boolean | null
          key?: string
          list_options?: string[] | null
          name?: string
          show_in_sidebar?: boolean | null
        }
        Relationships: []
      }
      custom_roles: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          is_default: boolean | null
          name: string
          permissions: Json | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_default?: boolean | null
          name: string
          permissions?: Json | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_default?: boolean | null
          name?: string
          permissions?: Json | null
        }
        Relationships: []
      }
      inbox_agents: {
        Row: {
          agent_id: string | null
          id: string
          inbox_id: string | null
        }
        Insert: {
          agent_id?: string | null
          id?: string
          inbox_id?: string | null
        }
        Update: {
          agent_id?: string | null
          id?: string
          inbox_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inbox_agents_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inbox_agents_inbox_id_fkey"
            columns: ["inbox_id"]
            isOneToOne: false
            referencedRelation: "inboxes"
            referencedColumns: ["id"]
          },
        ]
      }
      inbox_members: {
        Row: {
          created_at: string
          id: string
          inbox_id: string
          team_id: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          inbox_id: string
          team_id?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          inbox_id?: string
          team_id?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      inboxes: {
        Row: {
          away_message: string | null
          business_hours: Json | null
          channel: string
          channel_config: Json | null
          created_at: string | null
          greeting_message: string | null
          id: string
          instance_name: string | null
          name: string
          status: string | null
        }
        Insert: {
          away_message?: string | null
          business_hours?: Json | null
          channel: string
          channel_config?: Json | null
          created_at?: string | null
          greeting_message?: string | null
          id?: string
          instance_name?: string | null
          name: string
          status?: string | null
        }
        Update: {
          away_message?: string | null
          business_hours?: Json | null
          channel?: string
          channel_config?: Json | null
          created_at?: string | null
          greeting_message?: string | null
          id?: string
          instance_name?: string | null
          name?: string
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inboxes_instance_name_fkey"
            columns: ["instance_name"]
            isOneToOne: false
            referencedRelation: "whatsapp_instances"
            referencedColumns: ["instance_name"]
          },
        ]
      }
      interacoes_cidadao: {
        Row: {
          canal: string
          categoria: string
          contexto: string | null
          created_at: string
          descricao_problema: string | null
          id: string
          intencao: string
          interesse: string | null
          lead_qualificado: string | null
          nome: string | null
          origem: string | null
          pergunta: string
          prioridade: string | null
          problema: string | null
          resposta_agente: string | null
          session_id: string | null
          status: string | null
          tags: string | null
          whatsapp: string | null
        }
        Insert: {
          canal: string
          categoria: string
          contexto?: string | null
          created_at?: string
          descricao_problema?: string | null
          id?: string
          intencao: string
          interesse?: string | null
          lead_qualificado?: string | null
          nome?: string | null
          origem?: string | null
          pergunta: string
          prioridade?: string | null
          problema?: string | null
          resposta_agente?: string | null
          session_id?: string | null
          status?: string | null
          tags?: string | null
          whatsapp?: string | null
        }
        Update: {
          canal?: string
          categoria?: string
          contexto?: string | null
          created_at?: string
          descricao_problema?: string | null
          id?: string
          intencao?: string
          interesse?: string | null
          lead_qualificado?: string | null
          nome?: string | null
          origem?: string | null
          pergunta?: string
          prioridade?: string | null
          problema?: string | null
          resposta_agente?: string | null
          session_id?: string | null
          status?: string | null
          tags?: string | null
          whatsapp?: string | null
        }
        Relationships: []
      }
      labels: {
        Row: {
          color: string | null
          created_at: string | null
          description: string | null
          id: string
          name: string
          show_in_sidebar: boolean | null
        }
        Insert: {
          color?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          name: string
          show_in_sidebar?: boolean | null
        }
        Update: {
          color?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          name?: string
          show_in_sidebar?: boolean | null
        }
        Relationships: []
      }
      macros: {
        Row: {
          actions: Json
          agent_id: string | null
          created_at: string | null
          description: string | null
          id: string
          is_global: boolean | null
          name: string
        }
        Insert: {
          actions?: Json
          agent_id?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          is_global?: boolean | null
          name: string
        }
        Update: {
          actions?: Json
          agent_id?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          is_global?: boolean | null
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "macros_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          agent_id: string | null
          contact_id: string | null
          content: string | null
          conversation_id: string | null
          created_at: string | null
          id: string
          instance_name: string | null
          is_from_contact: boolean | null
          is_private: boolean | null
          media_url: string | null
          message_id: string | null
          message_type: string | null
          raw_data: Json | null
          sender_name: string | null
        }
        Insert: {
          agent_id?: string | null
          contact_id?: string | null
          content?: string | null
          conversation_id?: string | null
          created_at?: string | null
          id?: string
          instance_name?: string | null
          is_from_contact?: boolean | null
          is_private?: boolean | null
          media_url?: string | null
          message_id?: string | null
          message_type?: string | null
          raw_data?: Json | null
          sender_name?: string | null
        }
        Update: {
          agent_id?: string | null
          contact_id?: string | null
          content?: string | null
          conversation_id?: string | null
          created_at?: string | null
          id?: string
          instance_name?: string | null
          is_from_contact?: boolean | null
          is_private?: boolean | null
          media_url?: string | null
          message_id?: string | null
          message_type?: string | null
          raw_data?: Json | null
          sender_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "messages_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_initials: string | null
          created_at: string
          display_name: string
          id: string
          online: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_initials?: string | null
          created_at?: string
          display_name: string
          id?: string
          online?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_initials?: string | null
          created_at?: string
          display_name?: string
          id?: string
          online?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      quick_replies: {
        Row: {
          created_at: string
          id: string
          message: string
          shortcut: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          message: string
          shortcut: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          message?: string
          shortcut?: string
          updated_at?: string
        }
        Relationships: []
      }
      sla_rules: {
        Row: {
          business_hours_only: boolean | null
          created_at: string | null
          first_response_time: number
          id: string
          is_active: boolean | null
          name: string
          priority: string | null
          resolution_time: number
        }
        Insert: {
          business_hours_only?: boolean | null
          created_at?: string | null
          first_response_time?: number
          id?: string
          is_active?: boolean | null
          name: string
          priority?: string | null
          resolution_time?: number
        }
        Update: {
          business_hours_only?: boolean | null
          created_at?: string | null
          first_response_time?: number
          id?: string
          is_active?: boolean | null
          name?: string
          priority?: string | null
          resolution_time?: number
        }
        Relationships: []
      }
      support_tickets: {
        Row: {
          agent_id: string | null
          attachment_url: string | null
          category: string | null
          created_at: string | null
          description: string
          id: string
          priority: string | null
          status: string | null
          subject: string
          updated_at: string | null
        }
        Insert: {
          agent_id?: string | null
          attachment_url?: string | null
          category?: string | null
          created_at?: string | null
          description: string
          id?: string
          priority?: string | null
          status?: string | null
          subject: string
          updated_at?: string | null
        }
        Update: {
          agent_id?: string | null
          attachment_url?: string | null
          category?: string | null
          created_at?: string | null
          description?: string
          id?: string
          priority?: string | null
          status?: string | null
          subject?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "support_tickets_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
        ]
      }
      team_members: {
        Row: {
          agent_id: string | null
          created_at: string | null
          id: string
          role_in_team: string | null
          team_id: string | null
        }
        Insert: {
          agent_id?: string | null
          created_at?: string | null
          id?: string
          role_in_team?: string | null
          team_id?: string | null
        }
        Update: {
          agent_id?: string | null
          created_at?: string | null
          id?: string
          role_in_team?: string | null
          team_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "team_members_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_members_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      teams: {
        Row: {
          allow_self_assign: boolean | null
          auto_assign: boolean | null
          created_at: string | null
          description: string | null
          id: string
          name: string
          status: string | null
        }
        Insert: {
          allow_self_assign?: boolean | null
          auto_assign?: boolean | null
          created_at?: string | null
          description?: string | null
          id?: string
          name: string
          status?: string | null
        }
        Update: {
          allow_self_assign?: boolean | null
          auto_assign?: boolean | null
          created_at?: string | null
          description?: string | null
          id?: string
          name?: string
          status?: string | null
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      whatsapp_instances: {
        Row: {
          created_at: string | null
          id: string
          instance_name: string
          phone_number: string | null
          profile_name: string | null
          profile_pic: string | null
          qr_code: string | null
          settings: Json | null
          status: string | null
          updated_at: string | null
          webhook_url: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          instance_name: string
          phone_number?: string | null
          profile_name?: string | null
          profile_pic?: string | null
          qr_code?: string | null
          settings?: Json | null
          status?: string | null
          updated_at?: string | null
          webhook_url?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          instance_name?: string
          phone_number?: string | null
          profile_name?: string | null
          profile_pic?: string | null
          qr_code?: string | null
          settings?: Json | null
          status?: string | null
          updated_at?: string | null
          webhook_url?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      process_whatsapp_connection: {
        Args: {
          p_instance: string
          p_phone: string
          p_profile_name: string
          p_state: string
        }
        Returns: undefined
      }
      process_whatsapp_message: {
        Args: {
          p_content: string
          p_from_me: boolean
          p_instance: string
          p_media_url: string
          p_message_id: string
          p_message_type: string
          p_phone: string
          p_push_name: string
          p_raw: Json
        }
        Returns: string
      }
    }
    Enums: {
      app_role: "admin" | "agente"
      team_role:
        | "coordenador"
        | "gerente"
        | "secretario"
        | "agente"
        | "administrador"
        | "financeiro"
        | "corretor"
        | "corretora"
        | "marketing"
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
      app_role: ["admin", "agente"],
      team_role: [
        "coordenador",
        "gerente",
        "secretario",
        "agente",
        "administrador",
        "financeiro",
        "corretor",
        "corretora",
        "marketing",
      ],
    },
  },
} as const
