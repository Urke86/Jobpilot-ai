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
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
      activities: {
        Row: {
          activity_type: Database["public"]["Enums"]["activity_type"]
          created_at: string
          description: string | null
          entity_id: string | null
          entity_type: Database["public"]["Enums"]["activity_entity_type"]
          id: string
          metadata: Json
          title: string
          user_id: string
        }
        Insert: {
          activity_type: Database["public"]["Enums"]["activity_type"]
          created_at?: string
          description?: string | null
          entity_id?: string | null
          entity_type: Database["public"]["Enums"]["activity_entity_type"]
          id?: string
          metadata?: Json
          title: string
          user_id: string
        }
        Update: {
          activity_type?: Database["public"]["Enums"]["activity_type"]
          created_at?: string
          description?: string | null
          entity_id?: string | null
          entity_type?: Database["public"]["Enums"]["activity_entity_type"]
          id?: string
          metadata?: Json
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      ai_conversations: {
        Row: {
          context_application_id: string | null
          context_job_id: string | null
          context_type: string
          created_at: string
          id: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          context_application_id?: string | null
          context_job_id?: string | null
          context_type?: string
          created_at?: string
          id?: string
          title?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          context_application_id?: string | null
          context_job_id?: string | null
          context_type?: string
          created_at?: string
          id?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_conversations_context_application_id_fkey"
            columns: ["context_application_id"]
            isOneToOne: false
            referencedRelation: "applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_conversations_context_job_id_fkey"
            columns: ["context_job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_messages: {
        Row: {
          content: string
          conversation_id: string
          created_at: string
          id: string
          metadata: Json
          role: Database["public"]["Enums"]["ai_message_role"]
          user_id: string
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string
          id?: string
          metadata?: Json
          role: Database["public"]["Enums"]["ai_message_role"]
          user_id: string
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string
          id?: string
          metadata?: Json
          role?: Database["public"]["Enums"]["ai_message_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "ai_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      application_artifacts: {
        Row: {
          application_id: string
          artifact_type: Database["public"]["Enums"]["artifact_type"]
          content: string
          created_at: string
          id: string
          metadata: Json
          updated_at: string
          user_id: string
          version: number
        }
        Insert: {
          application_id: string
          artifact_type: Database["public"]["Enums"]["artifact_type"]
          content: string
          created_at?: string
          id?: string
          metadata?: Json
          updated_at?: string
          user_id: string
          version?: number
        }
        Update: {
          application_id?: string
          artifact_type?: Database["public"]["Enums"]["artifact_type"]
          content?: string
          created_at?: string
          id?: string
          metadata?: Json
          updated_at?: string
          user_id?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "application_artifacts_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "applications"
            referencedColumns: ["id"]
          },
        ]
      }
      applications: {
        Row: {
          application_date: string
          contact_email: string | null
          contact_person: string | null
          cover_letter: string | null
          created_at: string
          cv_version: string | null
          follow_up_date: string | null
          id: string
          job_id: string
          notes: string | null
          portfolio_sent: boolean
          questionnaire_answers: Json
          salary_currency: string
          salary_expectation: number | null
          stage: Database["public"]["Enums"]["application_stage"]
          updated_at: string
          user_id: string
        }
        Insert: {
          application_date?: string
          contact_email?: string | null
          contact_person?: string | null
          cover_letter?: string | null
          created_at?: string
          cv_version?: string | null
          follow_up_date?: string | null
          id?: string
          job_id: string
          notes?: string | null
          portfolio_sent?: boolean
          questionnaire_answers?: Json
          salary_currency?: string
          salary_expectation?: number | null
          stage?: Database["public"]["Enums"]["application_stage"]
          updated_at?: string
          user_id: string
        }
        Update: {
          application_date?: string
          contact_email?: string | null
          contact_person?: string | null
          cover_letter?: string | null
          created_at?: string
          cv_version?: string | null
          follow_up_date?: string | null
          id?: string
          job_id?: string
          notes?: string | null
          portfolio_sent?: boolean
          questionnaire_answers?: Json
          salary_currency?: string
          salary_expectation?: number | null
          stage?: Database["public"]["Enums"]["application_stage"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "applications_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      companies: {
        Row: {
          ai_focus: string | null
          careers_url: string | null
          company_size: string | null
          created_at: string
          id: string
          industry: string | null
          name: string
          notes: string | null
          updated_at: string
          user_id: string
          website: string | null
        }
        Insert: {
          ai_focus?: string | null
          careers_url?: string | null
          company_size?: string | null
          created_at?: string
          id?: string
          industry?: string | null
          name: string
          notes?: string | null
          updated_at?: string
          user_id: string
          website?: string | null
        }
        Update: {
          ai_focus?: string | null
          careers_url?: string | null
          company_size?: string | null
          created_at?: string
          id?: string
          industry?: string | null
          name?: string
          notes?: string | null
          updated_at?: string
          user_id?: string
          website?: string | null
        }
        Relationships: []
      }
      contacts: {
        Row: {
          company_id: string
          created_at: string
          email: string | null
          id: string
          linkedin_url: string | null
          name: string
          notes: string | null
          role: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          company_id: string
          created_at?: string
          email?: string | null
          id?: string
          linkedin_url?: string | null
          name: string
          notes?: string | null
          role?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          company_id?: string
          created_at?: string
          email?: string | null
          id?: string
          linkedin_url?: string | null
          name?: string
          notes?: string | null
          role?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "contacts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      job_analysis: {
        Row: {
          ai_tools_fit_score: number | null
          analysis_version: string
          created_at: string
          experience_fit_score: number | null
          gaps: Json
          id: string
          job_id: string
          metadata: Json
          overall_match_score: number
          product_fit_score: number | null
          reasoning_summary: string | null
          recommendation: Database["public"]["Enums"]["analysis_recommendation"]
          remote_fit_score: number | null
          risks: Json
          strengths: Json
          technical_fit_score: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          ai_tools_fit_score?: number | null
          analysis_version?: string
          created_at?: string
          experience_fit_score?: number | null
          gaps?: Json
          id?: string
          job_id: string
          metadata?: Json
          overall_match_score: number
          product_fit_score?: number | null
          reasoning_summary?: string | null
          recommendation: Database["public"]["Enums"]["analysis_recommendation"]
          remote_fit_score?: number | null
          risks?: Json
          strengths?: Json
          technical_fit_score?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          ai_tools_fit_score?: number | null
          analysis_version?: string
          created_at?: string
          experience_fit_score?: number | null
          gaps?: Json
          id?: string
          job_id?: string
          metadata?: Json
          overall_match_score?: number
          product_fit_score?: number | null
          reasoning_summary?: string | null
          recommendation?: Database["public"]["Enums"]["analysis_recommendation"]
          remote_fit_score?: number | null
          risks?: Json
          strengths?: Json
          technical_fit_score?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "job_analysis_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      jobs: {
        Row: {
          company_id: string | null
          company_name_snapshot: string
          created_at: string
          date_discovered: string
          deadline: string | null
          employment_type: Database["public"]["Enums"]["employment_type"]
          id: string
          ingestion_metadata: Json
          job_description: string | null
          job_title: string
          job_url: string | null
          location: string | null
          remote_scope: Database["public"]["Enums"]["remote_scope"]
          salary_currency: string
          salary_max: number | null
          salary_min: number | null
          source: string | null
          status: Database["public"]["Enums"]["job_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          company_id?: string | null
          company_name_snapshot: string
          created_at?: string
          date_discovered?: string
          deadline?: string | null
          employment_type?: Database["public"]["Enums"]["employment_type"]
          id?: string
          ingestion_metadata?: Json
          job_description?: string | null
          job_title: string
          job_url?: string | null
          location?: string | null
          remote_scope?: Database["public"]["Enums"]["remote_scope"]
          salary_currency?: string
          salary_max?: number | null
          salary_min?: number | null
          source?: string | null
          status?: Database["public"]["Enums"]["job_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          company_id?: string | null
          company_name_snapshot?: string
          created_at?: string
          date_discovered?: string
          deadline?: string | null
          employment_type?: Database["public"]["Enums"]["employment_type"]
          id?: string
          ingestion_metadata?: Json
          job_description?: string | null
          job_title?: string
          job_url?: string | null
          location?: string | null
          remote_scope?: Database["public"]["Enums"]["remote_scope"]
          salary_currency?: string
          salary_max?: number | null
          salary_min?: number | null
          source?: string | null
          status?: Database["public"]["Enums"]["job_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "jobs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          full_name: string | null
          headline: string | null
          id: string
          location: string | null
          master_cv_text: string | null
          portfolio_summary: string | null
          remote_preference: Database["public"]["Enums"]["remote_preference"]
          salary_currency: string
          salary_min: number | null
          target_roles: string[]
          timezone: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          full_name?: string | null
          headline?: string | null
          id?: string
          location?: string | null
          master_cv_text?: string | null
          portfolio_summary?: string | null
          remote_preference?: Database["public"]["Enums"]["remote_preference"]
          salary_currency?: string
          salary_min?: number | null
          target_roles?: string[]
          timezone?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          full_name?: string | null
          headline?: string | null
          id?: string
          location?: string | null
          master_cv_text?: string | null
          portfolio_summary?: string | null
          remote_preference?: Database["public"]["Enums"]["remote_preference"]
          salary_currency?: string
          salary_min?: number | null
          target_roles?: string[]
          timezone?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_integrations: {
        Row: {
          access_token_cipher: string | null
          created_at: string
          expires_at: string | null
          id: string
          metadata: Json
          provider: Database["public"]["Enums"]["integration_provider"]
          provider_account_email: string | null
          refresh_token_cipher: string | null
          scopes: string[]
          token_iv: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          access_token_cipher?: string | null
          created_at?: string
          expires_at?: string | null
          id?: string
          metadata?: Json
          provider: Database["public"]["Enums"]["integration_provider"]
          provider_account_email?: string | null
          refresh_token_cipher?: string | null
          scopes?: string[]
          token_iv?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          access_token_cipher?: string | null
          created_at?: string
          expires_at?: string | null
          id?: string
          metadata?: Json
          provider?: Database["public"]["Enums"]["integration_provider"]
          provider_account_email?: string | null
          refresh_token_cipher?: string | null
          scopes?: string[]
          token_iv?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      job_emails: {
        Row: {
          application_id: string | null
          body_text: string | null
          classification: Database["public"]["Enums"]["email_classification"]
          company_id: string | null
          confidence_score: number | null
          created_at: string
          extracted_data: Json
          gmail_message_id: string
          gmail_thread_id: string | null
          id: string
          job_id: string | null
          match_status: Database["public"]["Enums"]["email_match_status"]
          metadata: Json
          needs_action: boolean
          processed_at: string | null
          received_at: string | null
          recipients: Json
          sender_email: string | null
          sender_name: string | null
          snippet: string | null
          subject: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          application_id?: string | null
          body_text?: string | null
          classification?: Database["public"]["Enums"]["email_classification"]
          company_id?: string | null
          confidence_score?: number | null
          created_at?: string
          extracted_data?: Json
          gmail_message_id: string
          gmail_thread_id?: string | null
          id?: string
          job_id?: string | null
          match_status?: Database["public"]["Enums"]["email_match_status"]
          metadata?: Json
          needs_action?: boolean
          processed_at?: string | null
          received_at?: string | null
          recipients?: Json
          sender_email?: string | null
          sender_name?: string | null
          snippet?: string | null
          subject?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          application_id?: string | null
          body_text?: string | null
          classification?: Database["public"]["Enums"]["email_classification"]
          company_id?: string | null
          confidence_score?: number | null
          created_at?: string
          extracted_data?: Json
          gmail_message_id?: string
          gmail_thread_id?: string | null
          id?: string
          job_id?: string | null
          match_status?: Database["public"]["Enums"]["email_match_status"]
          metadata?: Json
          needs_action?: boolean
          processed_at?: string | null
          received_at?: string | null
          recipients?: Json
          sender_email?: string | null
          sender_name?: string | null
          snippet?: string | null
          subject?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      application_events: {
        Row: {
          application_id: string
          created_at: string
          ends_at: string | null
          event_type: Database["public"]["Enums"]["application_event_type"]
          external_event_id: string | null
          id: string
          meeting_url: string | null
          metadata: Json
          provider: string
          starts_at: string | null
          timezone: string | null
          title: string | null
          user_id: string
        }
        Insert: {
          application_id: string
          created_at?: string
          ends_at?: string | null
          event_type?: Database["public"]["Enums"]["application_event_type"]
          external_event_id?: string | null
          id?: string
          meeting_url?: string | null
          metadata?: Json
          provider?: string
          starts_at?: string | null
          timezone?: string | null
          title?: string | null
          user_id: string
        }
        Update: {
          application_id?: string
          created_at?: string
          ends_at?: string | null
          event_type?: Database["public"]["Enums"]["application_event_type"]
          external_event_id?: string | null
          id?: string
          meeting_url?: string | null
          metadata?: Json
          provider?: string
          starts_at?: string | null
          timezone?: string | null
          title?: string | null
          user_id?: string
        }
        Relationships: []
      }
      prompt_versions: {
        Row: {
          id: string
          feature: Database["public"]["Enums"]["ai_feature"]
          version: string
          description: string | null
          system_prompt: string
          changelog: string | null
          is_active: boolean
          created_at: string
        }
        Insert: {
          id?: string
          feature: Database["public"]["Enums"]["ai_feature"]
          version: string
          description?: string | null
          system_prompt?: string
          changelog?: string | null
          is_active?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          feature?: Database["public"]["Enums"]["ai_feature"]
          version?: string
          description?: string | null
          system_prompt?: string
          changelog?: string | null
          is_active?: boolean
          created_at?: string
        }
        Relationships: []
      }
      ai_generations: {
        Row: {
          id: string
          user_id: string
          feature: Database["public"]["Enums"]["ai_feature"]
          provider: string
          model: string | null
          prompt_version: string | null
          status: Database["public"]["Enums"]["ai_generation_status"]
          input_tokens: number | null
          output_tokens: number | null
          total_tokens: number | null
          estimated_cost_usd: number | null
          latency_ms: number | null
          error_code: string | null
          error_message: string | null
          source_table: string | null
          source_id: string | null
          metadata: Json
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          feature: Database["public"]["Enums"]["ai_feature"]
          provider?: string
          model?: string | null
          prompt_version?: string | null
          status?: Database["public"]["Enums"]["ai_generation_status"]
          input_tokens?: number | null
          output_tokens?: number | null
          total_tokens?: number | null
          estimated_cost_usd?: number | null
          latency_ms?: number | null
          error_code?: string | null
          error_message?: string | null
          source_table?: string | null
          source_id?: string | null
          metadata?: Json
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          feature?: Database["public"]["Enums"]["ai_feature"]
          provider?: string
          model?: string | null
          prompt_version?: string | null
          status?: Database["public"]["Enums"]["ai_generation_status"]
          input_tokens?: number | null
          output_tokens?: number | null
          total_tokens?: number | null
          estimated_cost_usd?: number | null
          latency_ms?: number | null
          error_code?: string | null
          error_message?: string | null
          source_table?: string | null
          source_id?: string | null
          metadata?: Json
          created_at?: string
        }
        Relationships: []
      }
      ai_evaluations: {
        Row: {
          id: string
          user_id: string
          generation_id: string
          evaluator: string
          score: number
          result: Json
          explanation: string | null
          metadata: Json
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          generation_id: string
          evaluator?: string
          score: number
          result?: Json
          explanation?: string | null
          metadata?: Json
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          generation_id?: string
          evaluator?: string
          score?: number
          result?: Json
          explanation?: string | null
          metadata?: Json
          created_at?: string
        }
        Relationships: []
      }
      ai_observability_alerts: {
        Row: {
          id: string
          user_id: string
          kind: Database["public"]["Enums"]["ai_alert_kind"]
          severity: Database["public"]["Enums"]["ai_alert_severity"]
          title: string
          message: string
          metric_value: number | null
          threshold_value: number | null
          acknowledged_at: string | null
          metadata: Json
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          kind: Database["public"]["Enums"]["ai_alert_kind"]
          severity?: Database["public"]["Enums"]["ai_alert_severity"]
          title: string
          message: string
          metric_value?: number | null
          threshold_value?: number | null
          acknowledged_at?: string | null
          metadata?: Json
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          kind?: Database["public"]["Enums"]["ai_alert_kind"]
          severity?: Database["public"]["Enums"]["ai_alert_severity"]
          title?: string
          message?: string
          metric_value?: number | null
          threshold_value?: number | null
          acknowledged_at?: string | null
          metadata?: Json
          created_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      current_user_id: { Args: never; Returns: string }
    }
    Enums: {
      activity_entity_type:
        | "profile"
        | "company"
        | "contact"
        | "job"
        | "job_analysis"
        | "application"
        | "application_artifact"
        | "system"
        | "ai_conversation"
        | "job_email"
        | "user_integration"
        | "application_event"
        | "ai_generation"
      activity_type:
        | "job_discovered"
        | "job_status_changed"
        | "application_created"
        | "application_stage_changed"
        | "analysis_completed"
        | "artifact_created"
        | "company_added"
        | "contact_added"
        | "note_added"
        | "custom"
        | "assistant_started"
        | "gmail_connected"
        | "gmail_synced"
        | "gmail_disconnected"
        | "hiring_email_linked"
        | "stage_accepted_from_email"
        | "interview_event_created"
        | "ai_generation_recorded"
        | "ai_evaluation_submitted"
        | "ai_alert_raised"
      ai_alert_kind:
        | "daily_spend_exceeded"
        | "latency_elevated"
        | "failure_rate_elevated"
        | "cost_trend_up"
        | "eval_score_declining"
        | "custom"
      ai_alert_severity: "info" | "warning" | "critical"
      ai_feature:
        | "analyze_job"
        | "assistant"
        | "cv_recommendations"
        | "cv_summary"
        | "cover_letter"
        | "questionnaire"
        | "linkedin_message"
        | "follow_up"
        | "interview_questions"
        | "interview_answers"
        | "company_research"
        | "gmail_classification"
        | "custom"
      ai_generation_status:
        | "success"
        | "error"
        | "validation_failed"
        | "rate_limited"
        | "provider_error"
        | "cancelled"
      ai_message_role: "user" | "assistant" | "system"
      analysis_recommendation: "apply" | "consider" | "skip"
      application_event_type:
        | "interview"
        | "assessment_deadline"
        | "follow_up"
        | "other"
      application_stage:
        | "preparing"
        | "applied"
        | "questionnaire"
        | "interview"
        | "assignment"
        | "offer"
        | "rejected"
        | "withdrawn"
      artifact_type:
        | "cv_recommendations"
        | "cv_summary"
        | "cover_letter"
        | "questionnaire_answer"
        | "linkedin_message"
        | "follow_up"
        | "interview_questions"
        | "interview_answers"
        | "company_research"
        | "custom"
      email_classification:
        | "recruiter_outreach"
        | "application_confirmation"
        | "questionnaire"
        | "assessment"
        | "interview_invitation"
        | "interview_followup"
        | "rejection"
        | "offer"
        | "general_hiring_message"
        | "unrelated"
        | "pending"
      email_match_status: "matched" | "suggested_match" | "unmatched"
      employment_type:
        | "full_time"
        | "part_time"
        | "contract"
        | "temporary"
        | "internship"
        | "unknown"
      integration_provider: "google"
      job_status:
        | "new"
        | "analyzing"
        | "reviewed"
        | "shortlisted"
        | "skipped"
        | "applied"
        | "archived"
      remote_preference: "onsite" | "hybrid" | "remote" | "flexible" | "unknown"
      remote_scope:
        | "onsite"
        | "hybrid"
        | "remote_country"
        | "remote_europe"
        | "remote_emea"
        | "remote_global"
        | "unknown"
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
      activity_entity_type: [
        "profile",
        "company",
        "contact",
        "job",
        "job_analysis",
        "application",
        "application_artifact",
        "system",
        "ai_conversation",
        "job_email",
        "user_integration",
        "application_event",
        "ai_generation",
      ],
      activity_type: [
        "job_discovered",
        "job_status_changed",
        "application_created",
        "application_stage_changed",
        "analysis_completed",
        "artifact_created",
        "company_added",
        "contact_added",
        "note_added",
        "custom",
        "assistant_started",
        "gmail_connected",
        "gmail_synced",
        "gmail_disconnected",
        "hiring_email_linked",
        "stage_accepted_from_email",
        "interview_event_created",
        "ai_generation_recorded",
        "ai_evaluation_submitted",
        "ai_alert_raised",
      ],
      ai_alert_kind: [
        "daily_spend_exceeded",
        "latency_elevated",
        "failure_rate_elevated",
        "cost_trend_up",
        "eval_score_declining",
        "custom",
      ],
      ai_alert_severity: ["info", "warning", "critical"],
      ai_feature: [
        "analyze_job",
        "assistant",
        "cv_recommendations",
        "cv_summary",
        "cover_letter",
        "questionnaire",
        "linkedin_message",
        "follow_up",
        "interview_questions",
        "interview_answers",
        "company_research",
        "gmail_classification",
        "custom",
      ],
      ai_generation_status: [
        "success",
        "error",
        "validation_failed",
        "rate_limited",
        "provider_error",
        "cancelled",
      ],
      ai_message_role: ["user", "assistant", "system"],
      analysis_recommendation: ["apply", "consider", "skip"],
      application_event_type: [
        "interview",
        "assessment_deadline",
        "follow_up",
        "other",
      ],
      application_stage: [
        "preparing",
        "applied",
        "questionnaire",
        "interview",
        "assignment",
        "offer",
        "rejected",
        "withdrawn",
      ],
      artifact_type: [
        "cv_recommendations",
        "cv_summary",
        "cover_letter",
        "questionnaire_answer",
        "linkedin_message",
        "follow_up",
        "interview_questions",
        "interview_answers",
        "company_research",
        "custom",
      ],
      email_classification: [
        "recruiter_outreach",
        "application_confirmation",
        "questionnaire",
        "assessment",
        "interview_invitation",
        "interview_followup",
        "rejection",
        "offer",
        "general_hiring_message",
        "unrelated",
        "pending",
      ],
      email_match_status: ["matched", "suggested_match", "unmatched"],
      employment_type: [
        "full_time",
        "part_time",
        "contract",
        "temporary",
        "internship",
        "unknown",
      ],
      integration_provider: ["google"],
      job_status: [
        "new",
        "analyzing",
        "reviewed",
        "shortlisted",
        "skipped",
        "applied",
        "archived",
      ],
      remote_preference: ["onsite", "hybrid", "remote", "flexible", "unknown"],
      remote_scope: [
        "onsite",
        "hybrid",
        "remote_country",
        "remote_europe",
        "remote_emea",
        "remote_global",
        "unknown",
      ],
    },
  },
} as const
