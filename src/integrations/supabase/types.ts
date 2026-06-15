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
      friendships: {
        Row: {
          addressee_id: string
          created_at: string
          id: string
          requester_id: string
          status: string
        }
        Insert: {
          addressee_id: string
          created_at?: string
          id?: string
          requester_id: string
          status?: string
        }
        Update: {
          addressee_id?: string
          created_at?: string
          id?: string
          requester_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "friendships_addressee_id_fkey"
            columns: ["addressee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "friendships_addressee_id_fkey"
            columns: ["addressee_id"]
            isOneToOne: false
            referencedRelation: "profiles_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "friendships_requester_id_fkey"
            columns: ["requester_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "friendships_requester_id_fkey"
            columns: ["requester_id"]
            isOneToOne: false
            referencedRelation: "profiles_public"
            referencedColumns: ["id"]
          },
        ]
      }
      game_participants: {
        Row: {
          game_id: string
          id: string
          joined_at: string
          status: string
          user_id: string
        }
        Insert: {
          game_id: string
          id?: string
          joined_at?: string
          status?: string
          user_id: string
        }
        Update: {
          game_id?: string
          id?: string
          joined_at?: string
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "game_participants_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
        ]
      }
      game_reviews: {
        Row: {
          comment: string | null
          created_at: string
          game_id: string
          id: string
          rating: number
          reviewer_id: string
        }
        Insert: {
          comment?: string | null
          created_at?: string
          game_id: string
          id?: string
          rating: number
          reviewer_id: string
        }
        Update: {
          comment?: string | null
          created_at?: string
          game_id?: string
          id?: string
          rating?: number
          reviewer_id?: string
        }
        Relationships: []
      }
      games: {
        Row: {
          created_at: string
          description: string | null
          duration_min: number
          host_id: string
          id: string
          latitude: number
          location: unknown
          longitude: number
          price_cents: number
          slots_total: number
          sport_id: string
          starts_at: string
          status: string
          title: string
          urgency: Database["public"]["Enums"]["game_urgency"]
          venue_id: string | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          duration_min?: number
          host_id: string
          id?: string
          latitude: number
          location?: unknown
          longitude: number
          price_cents?: number
          slots_total?: number
          sport_id: string
          starts_at: string
          status?: string
          title: string
          urgency?: Database["public"]["Enums"]["game_urgency"]
          venue_id?: string | null
        }
        Update: {
          created_at?: string
          description?: string | null
          duration_min?: number
          host_id?: string
          id?: string
          latitude?: number
          location?: unknown
          longitude?: number
          price_cents?: number
          slots_total?: number
          sport_id?: string
          starts_at?: string
          status?: string
          title?: string
          urgency?: Database["public"]["Enums"]["game_urgency"]
          venue_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "games_sport_id_fkey"
            columns: ["sport_id"]
            isOneToOne: false
            referencedRelation: "sports"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "games_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          content: string
          created_at: string
          game_id: string
          id: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          game_id: string
          id?: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          game_id?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
        ]
      }
      player_reviews: {
        Row: {
          comment: string | null
          created_at: string
          game_id: string
          id: string
          rating: number
          reviewee_id: string
          reviewer_id: string
        }
        Insert: {
          comment?: string | null
          created_at?: string
          game_id: string
          id?: string
          rating: number
          reviewee_id: string
          reviewer_id: string
        }
        Update: {
          comment?: string | null
          created_at?: string
          game_id?: string
          id?: string
          rating?: number
          reviewee_id?: string
          reviewer_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          city: string | null
          created_at: string
          display_name: string
          dominant_side: string | null
          favorite_sport_id: string | null
          height_cm: number | null
          id: string
          latitude: number | null
          longitude: number | null
          points: number
          skill_level: string | null
          sponsor_brand: string | null
          sport_ids: string[]
          sport_positions: Json
          updated_at: string
          weight_kg: number | null
          years_playing: string | null
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          city?: string | null
          created_at?: string
          display_name: string
          dominant_side?: string | null
          favorite_sport_id?: string | null
          height_cm?: number | null
          id: string
          latitude?: number | null
          longitude?: number | null
          points?: number
          skill_level?: string | null
          sponsor_brand?: string | null
          sport_ids?: string[]
          sport_positions?: Json
          updated_at?: string
          weight_kg?: number | null
          years_playing?: string | null
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          city?: string | null
          created_at?: string
          display_name?: string
          dominant_side?: string | null
          favorite_sport_id?: string | null
          height_cm?: number | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          points?: number
          skill_level?: string | null
          sponsor_brand?: string | null
          sport_ids?: string[]
          sport_positions?: Json
          updated_at?: string
          weight_kg?: number | null
          years_playing?: string | null
        }
        Relationships: []
      }
      sports: {
        Row: {
          avg_rating: number | null
          created_at: string
          emoji: string
          id: string
          name: string
          slug: string
          total_reviews: number | null
        }
        Insert: {
          avg_rating?: number | null
          created_at?: string
          emoji?: string
          id?: string
          name: string
          slug: string
          total_reviews?: number | null
        }
        Update: {
          avg_rating?: number | null
          created_at?: string
          emoji?: string
          id?: string
          name?: string
          slug?: string
          total_reviews?: number | null
        }
        Relationships: []
      }
      venues: {
        Row: {
          address: string | null
          created_at: string
          created_by: string
          id: string
          latitude: number
          longitude: number
          name: string
          notes: string | null
        }
        Insert: {
          address?: string | null
          created_at?: string
          created_by: string
          id?: string
          latitude: number
          longitude: number
          name: string
          notes?: string | null
        }
        Update: {
          address?: string | null
          created_at?: string
          created_by?: string
          id?: string
          latitude?: number
          longitude?: number
          name?: string
          notes?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      profiles_public: {
        Row: {
          avatar_url: string | null
          bio: string | null
          display_name: string | null
          id: string | null
          points: number | null
          skill_level: string | null
          sponsor_brand: string | null
          sport_ids: string[] | null
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          display_name?: string | null
          id?: string | null
          points?: number | null
          skill_level?: string | null
          sponsor_brand?: string | null
          sport_ids?: string[] | null
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          display_name?: string | null
          id?: string | null
          points?: number | null
          skill_level?: string | null
          sponsor_brand?: string | null
          sport_ids?: string[] | null
        }
        Relationships: []
      }
    }
    Functions: {
      is_game_participant: {
        Args: { _game_id: string; _user_id: string }
        Returns: boolean
      }
      nearby_games: {
        Args: { radius_meters?: number; user_location: unknown }
        Returns: {
          distance_meters: number
          host_id: string
          id: string
          latitude: number
          longitude: number
          price_cents: number
          slots_total: number
          sport_id: string
          starts_at: string
          status: string
          title: string
          urgency: Database["public"]["Enums"]["game_urgency"]
          venue_id: string
        }[]
      }
    }
    Enums: {
      game_urgency: "relaxado" | "normal" | "urgente"
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
      game_urgency: ["relaxado", "normal", "urgente"],
    },
  },
} as const
