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
      alarms_settings: {
        Row: {
          accion_vinculada: string | null
          activa: boolean
          created_at: string
          dias_semana: string[]
          hora_programada: string
          id: string
          tipo_alarma: string
          user_id: string
        }
        Insert: {
          accion_vinculada?: string | null
          activa?: boolean
          created_at?: string
          dias_semana?: string[]
          hora_programada: string
          id?: string
          tipo_alarma: string
          user_id: string
        }
        Update: {
          accion_vinculada?: string | null
          activa?: boolean
          created_at?: string
          dias_semana?: string[]
          hora_programada?: string
          id?: string
          tipo_alarma?: string
          user_id?: string
        }
        Relationships: []
      }
      check_ins: {
        Row: {
          created_at: string
          energia: number | null
          estado_emocional: string
          foco_dia: string | null
          gratitud: string | null
          id: string
          notas: string | null
          tipo_checkin: string
          user_id: string
        }
        Insert: {
          created_at?: string
          energia?: number | null
          estado_emocional: string
          foco_dia?: string | null
          gratitud?: string | null
          id?: string
          notas?: string | null
          tipo_checkin: string
          user_id: string
        }
        Update: {
          created_at?: string
          energia?: number | null
          estado_emocional?: string
          foco_dia?: string | null
          gratitud?: string | null
          id?: string
          notas?: string | null
          tipo_checkin?: string
          user_id?: string
        }
        Relationships: []
      }
      mental_gym_stats: {
        Row: {
          completado: boolean
          created_at: string
          detalle: Json | null
          duracion_minutos: number
          id: string
          tipo_ejercicio: string
          user_id: string
        }
        Insert: {
          completado?: boolean
          created_at?: string
          detalle?: Json | null
          duracion_minutos?: number
          id?: string
          tipo_ejercicio: string
          user_id: string
        }
        Update: {
          completado?: boolean
          created_at?: string
          detalle?: Json | null
          duracion_minutos?: number
          id?: string
          tipo_ejercicio?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string | null
          id: string
          updated_at: string
          voz_preferida: string | null
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          id: string
          updated_at?: string
          voz_preferida?: string | null
        }
        Update: {
          created_at?: string
          display_name?: string | null
          id?: string
          updated_at?: string
          voz_preferida?: string | null
        }
        Relationships: []
      }
      saved_meditations: {
        Row: {
          audio_url: string | null
          created_at: string
          duracion_minutos: number
          guion_texto: string | null
          id: string
          metodologia: string
          objetivo: string | null
          titulo: string
          user_id: string
        }
        Insert: {
          audio_url?: string | null
          created_at?: string
          duracion_minutos: number
          guion_texto?: string | null
          id?: string
          metodologia: string
          objetivo?: string | null
          titulo: string
          user_id: string
        }
        Update: {
          audio_url?: string | null
          created_at?: string
          duracion_minutos?: number
          guion_texto?: string | null
          id?: string
          metodologia?: string
          objetivo?: string | null
          titulo?: string
          user_id?: string
        }
        Relationships: []
      }
      vital_soundtrack: {
        Row: {
          artista: string | null
          categoria_momento: string
          created_at: string
          id: string
          nombre_cancion: string
          url_enlace: string
          user_id: string
        }
        Insert: {
          artista?: string | null
          categoria_momento: string
          created_at?: string
          id?: string
          nombre_cancion: string
          url_enlace: string
          user_id: string
        }
        Update: {
          artista?: string | null
          categoria_momento?: string
          created_at?: string
          id?: string
          nombre_cancion?: string
          url_enlace?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
