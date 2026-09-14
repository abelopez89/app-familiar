// Tipos escritos a mano para el schema `hogar`, siguiendo la forma que
// generaría `supabase gen types` (no se ejecuta ese comando en este
// entorno porque no tenemos acceso de escritura a la base remota).
// Actualizar manualmente cuando cambie una migración.

export type Database = {
  hogar: {
    Tables: {
      families: {
        Row: {
          id: string;
          name: string;
          timezone: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          timezone?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          timezone?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      family_members: {
        Row: {
          id: string;
          family_id: string;
          user_id: string | null;
          email: string | null;
          display_name: string;
          color: string;
          role: "adulto" | "menor";
          can_login: boolean;
          birth_date: string | null;
          telegram_user_id: number | null;
          calendar_token: string;
          is_active: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          family_id: string;
          user_id?: string | null;
          email?: string | null;
          display_name: string;
          color?: string;
          role?: "adulto" | "menor";
          can_login?: boolean;
          birth_date?: string | null;
          telegram_user_id?: number | null;
          calendar_token?: string;
          is_active?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          family_id?: string;
          user_id?: string | null;
          email?: string | null;
          display_name?: string;
          color?: string;
          role?: "adulto" | "menor";
          can_login?: boolean;
          birth_date?: string | null;
          telegram_user_id?: number | null;
          calendar_token?: string;
          is_active?: boolean;
          created_at?: string;
        };
        Relationships: [];
      };
      product_categories: {
        Row: {
          id: string;
          family_id: string;
          name: string;
          sort_order: number;
          icon: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          family_id: string;
          name: string;
          sort_order?: number;
          icon?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          family_id?: string;
          name?: string;
          sort_order?: number;
          icon?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      shopping_templates: {
        Row: {
          id: string;
          family_id: string;
          name: string;
          description: string | null;
          icon: string | null;
          is_default: boolean;
          sort_order: number;
          is_active: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          family_id: string;
          name: string;
          description?: string | null;
          icon?: string | null;
          is_default?: boolean;
          sort_order?: number;
          is_active?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          family_id?: string;
          name?: string;
          description?: string | null;
          icon?: string | null;
          is_default?: boolean;
          sort_order?: number;
          is_active?: boolean;
          created_at?: string;
        };
        Relationships: [];
      };
      template_items: {
        Row: {
          id: string;
          template_id: string;
          family_id: string;
          name: string;
          category_id: string | null;
          default_quantity: number;
          unit: string;
          is_staple: boolean;
          notes: string | null;
          sort_order: number;
          is_active: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          template_id: string;
          family_id: string;
          name: string;
          category_id?: string | null;
          default_quantity?: number;
          unit?: string;
          is_staple?: boolean;
          notes?: string | null;
          sort_order?: number;
          is_active?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          template_id?: string;
          family_id?: string;
          name?: string;
          category_id?: string | null;
          default_quantity?: number;
          unit?: string;
          is_staple?: boolean;
          notes?: string | null;
          sort_order?: number;
          is_active?: boolean;
          created_at?: string;
        };
        Relationships: [];
      };
      shopping_lists: {
        Row: {
          id: string;
          family_id: string;
          name: string | null;
          shopping_date: string;
          status: "abierta" | "en_curso" | "cerrada";
          store: string | null;
          source_template_ids: string[] | null;
          total_amount: number | null;
          created_by: string | null;
          closed_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          family_id: string;
          name?: string | null;
          shopping_date?: string;
          status?: "abierta" | "en_curso" | "cerrada";
          store?: string | null;
          source_template_ids?: string[] | null;
          total_amount?: number | null;
          created_by?: string | null;
          closed_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          family_id?: string;
          name?: string | null;
          shopping_date?: string;
          status?: "abierta" | "en_curso" | "cerrada";
          store?: string | null;
          source_template_ids?: string[] | null;
          total_amount?: number | null;
          created_by?: string | null;
          closed_at?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      shopping_list_items: {
        Row: {
          id: string;
          list_id: string;
          family_id: string;
          template_item_id: string | null;
          name: string;
          category_id: string | null;
          category_name: string | null;
          quantity: number;
          unit: string;
          notes: string | null;
          is_checked: boolean;
          checked_at: string | null;
          checked_by: string | null;
          unit_price: number | null;
          sort_order: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          list_id: string;
          family_id: string;
          template_item_id?: string | null;
          name: string;
          category_id?: string | null;
          category_name?: string | null;
          quantity?: number;
          unit?: string;
          notes?: string | null;
          is_checked?: boolean;
          checked_at?: string | null;
          checked_by?: string | null;
          unit_price?: number | null;
          sort_order?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          list_id?: string;
          family_id?: string;
          template_item_id?: string | null;
          name?: string;
          category_id?: string | null;
          category_name?: string | null;
          quantity?: number;
          unit?: string;
          notes?: string | null;
          is_checked?: boolean;
          checked_at?: string | null;
          checked_by?: string | null;
          unit_price?: number | null;
          sort_order?: number;
          created_at?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

export type Family = Database["hogar"]["Tables"]["families"]["Row"];
export type FamilyMember = Database["hogar"]["Tables"]["family_members"]["Row"];
export type ProductCategory = Database["hogar"]["Tables"]["product_categories"]["Row"];
export type ShoppingTemplate = Database["hogar"]["Tables"]["shopping_templates"]["Row"];
export type TemplateItem = Database["hogar"]["Tables"]["template_items"]["Row"];
export type ShoppingList = Database["hogar"]["Tables"]["shopping_lists"]["Row"];
export type ShoppingListItem = Database["hogar"]["Tables"]["shopping_list_items"]["Row"];
