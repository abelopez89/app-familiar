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
      events: {
        Row: {
          id: string;
          family_id: string;
          title: string;
          description: string | null;
          category: "escolar" | "medico" | "familiar" | "cumpleanos" | "otro";
          starts_at: string;
          ends_at: string | null;
          all_day: boolean;
          location: string | null;
          recurrence: "weekly" | "monthly" | "yearly" | null;
          recurrence_until: string | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          family_id: string;
          title: string;
          description?: string | null;
          category?: "escolar" | "medico" | "familiar" | "cumpleanos" | "otro";
          starts_at: string;
          ends_at?: string | null;
          all_day?: boolean;
          location?: string | null;
          recurrence?: "weekly" | "monthly" | "yearly" | null;
          recurrence_until?: string | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          family_id?: string;
          title?: string;
          description?: string | null;
          category?: "escolar" | "medico" | "familiar" | "cumpleanos" | "otro";
          starts_at?: string;
          ends_at?: string | null;
          all_day?: boolean;
          location?: string | null;
          recurrence?: "weekly" | "monthly" | "yearly" | null;
          recurrence_until?: string | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      event_participants: {
        Row: {
          event_id: string;
          member_id: string;
          family_id: string;
        };
        Insert: {
          event_id: string;
          member_id: string;
          family_id: string;
        };
        Update: {
          event_id?: string;
          member_id?: string;
          family_id?: string;
        };
        Relationships: [];
      };
      event_reminders: {
        Row: {
          id: string;
          event_id: string;
          family_id: string;
          offset_minutes: number;
          channel: "calendar" | "telegram";
          target_member: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          event_id: string;
          family_id: string;
          offset_minutes: number;
          channel?: "calendar" | "telegram";
          target_member?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          event_id?: string;
          family_id?: string;
          offset_minutes?: number;
          channel?: "calendar" | "telegram";
          target_member?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      telegram_link_codes: {
        Row: {
          code: string;
          member_id: string;
          family_id: string;
          expires_at: string;
          used_at: string | null;
          created_at: string;
        };
        Insert: {
          code: string;
          member_id: string;
          family_id: string;
          expires_at: string;
          used_at?: string | null;
          created_at?: string;
        };
        Update: {
          code?: string;
          member_id?: string;
          family_id?: string;
          expires_at?: string;
          used_at?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      reminder_deliveries: {
        Row: {
          reminder_id: string;
          occurrence_starts_at: string;
          member_id: string;
          sent_at: string;
        };
        Insert: {
          reminder_id: string;
          occurrence_starts_at: string;
          member_id: string;
          sent_at?: string;
        };
        Update: {
          reminder_id?: string;
          occurrence_starts_at?: string;
          member_id?: string;
          sent_at?: string;
        };
        Relationships: [];
      };
      assets: {
        Row: {
          id: string;
          family_id: string;
          name: string;
          asset_type: "electrodomestico" | "instalacion" | "vehiculo" | "otro";
          brand: string | null;
          model: string | null;
          location: string | null;
          purchased_at: string | null;
          warranty_until: string | null;
          warranty_notified_at: string | null;
          document_id: string | null;
          notes: string | null;
          is_active: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          family_id: string;
          name: string;
          asset_type?: "electrodomestico" | "instalacion" | "vehiculo" | "otro";
          brand?: string | null;
          model?: string | null;
          location?: string | null;
          purchased_at?: string | null;
          warranty_until?: string | null;
          warranty_notified_at?: string | null;
          document_id?: string | null;
          notes?: string | null;
          is_active?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          family_id?: string;
          name?: string;
          asset_type?: "electrodomestico" | "instalacion" | "vehiculo" | "otro";
          brand?: string | null;
          model?: string | null;
          location?: string | null;
          purchased_at?: string | null;
          warranty_until?: string | null;
          warranty_notified_at?: string | null;
          document_id?: string | null;
          notes?: string | null;
          is_active?: boolean;
          created_at?: string;
        };
        Relationships: [];
      };
      task_definitions: {
        Row: {
          id: string;
          family_id: string;
          title: string;
          description: string | null;
          asset_id: string | null;
          assigned_to: string | null;
          recurrence_every: number | null;
          recurrence_unit: "days" | "weeks" | "months" | "years" | null;
          recurrence_anchor: "completion" | "schedule";
          next_due_date: string;
          lead_days: number;
          notify_telegram: boolean;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          family_id: string;
          title: string;
          description?: string | null;
          asset_id?: string | null;
          assigned_to?: string | null;
          recurrence_every?: number | null;
          recurrence_unit?: "days" | "weeks" | "months" | "years" | null;
          recurrence_anchor?: "completion" | "schedule";
          next_due_date: string;
          lead_days?: number;
          notify_telegram?: boolean;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          family_id?: string;
          title?: string;
          description?: string | null;
          asset_id?: string | null;
          assigned_to?: string | null;
          recurrence_every?: number | null;
          recurrence_unit?: "days" | "weeks" | "months" | "years" | null;
          recurrence_anchor?: "completion" | "schedule";
          next_due_date?: string;
          lead_days?: number;
          notify_telegram?: boolean;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      task_instances: {
        Row: {
          id: string;
          definition_id: string;
          family_id: string;
          due_date: string;
          status: "pendiente" | "hecha" | "omitida";
          completed_at: string | null;
          completed_by: string | null;
          notes: string | null;
          cost: number | null;
          notified_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          definition_id: string;
          family_id: string;
          due_date: string;
          status?: "pendiente" | "hecha" | "omitida";
          completed_at?: string | null;
          completed_by?: string | null;
          notes?: string | null;
          cost?: number | null;
          notified_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          definition_id?: string;
          family_id?: string;
          due_date?: string;
          status?: "pendiente" | "hecha" | "omitida";
          completed_at?: string | null;
          completed_by?: string | null;
          notes?: string | null;
          cost?: number | null;
          notified_at?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      vehicles: {
        Row: {
          id: string;
          family_id: string;
          asset_id: string | null;
          name: string;
          plate: string | null;
          fuel_type: "nafta" | "diesel" | "flex" | "gnv";
          tank_capacity: number | null;
          initial_odometer: number | null;
          is_active: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          family_id: string;
          asset_id?: string | null;
          name: string;
          plate?: string | null;
          fuel_type?: "nafta" | "diesel" | "flex" | "gnv";
          tank_capacity?: number | null;
          initial_odometer?: number | null;
          is_active?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          family_id?: string;
          asset_id?: string | null;
          name?: string;
          plate?: string | null;
          fuel_type?: "nafta" | "diesel" | "flex" | "gnv";
          tank_capacity?: number | null;
          initial_odometer?: number | null;
          is_active?: boolean;
          created_at?: string;
        };
        Relationships: [];
      };
      fuel_logs: {
        Row: {
          id: string;
          family_id: string;
          vehicle_id: string;
          member_id: string | null;
          filled_at: string;
          odometer: number;
          liters: number;
          total_amount: number | null;
          price_per_liter: number | null;
          is_full_tank: boolean;
          resets_calculation: boolean;
          station: string | null;
          fuel_grade: string | null;
          notes: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          family_id: string;
          vehicle_id: string;
          member_id?: string | null;
          filled_at?: string;
          odometer: number;
          liters: number;
          total_amount?: number | null;
          is_full_tank?: boolean;
          resets_calculation?: boolean;
          station?: string | null;
          fuel_grade?: string | null;
          notes?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          family_id?: string;
          vehicle_id?: string;
          member_id?: string | null;
          filled_at?: string;
          odometer?: number;
          liters?: number;
          total_amount?: number | null;
          is_full_tank?: boolean;
          resets_calculation?: boolean;
          station?: string | null;
          fuel_grade?: string | null;
          notes?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      ensure_family_membership: {
        Args: Record<string, never>;
        Returns: void;
      };
    };
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
export type Event = Database["hogar"]["Tables"]["events"]["Row"];
export type EventParticipant = Database["hogar"]["Tables"]["event_participants"]["Row"];
export type EventReminder = Database["hogar"]["Tables"]["event_reminders"]["Row"];
export type TelegramLinkCode = Database["hogar"]["Tables"]["telegram_link_codes"]["Row"];
export type ReminderDelivery = Database["hogar"]["Tables"]["reminder_deliveries"]["Row"];
export type Asset = Database["hogar"]["Tables"]["assets"]["Row"];
export type TaskDefinition = Database["hogar"]["Tables"]["task_definitions"]["Row"];
export type TaskInstance = Database["hogar"]["Tables"]["task_instances"]["Row"];
export type EventCategory = Event["category"];
export type RecurrenceRule = NonNullable<Event["recurrence"]>;
export type AssetType = Asset["asset_type"];
export type TaskRecurrenceUnit = NonNullable<TaskDefinition["recurrence_unit"]>;
export type TaskRecurrenceAnchor = TaskDefinition["recurrence_anchor"];
export type TaskInstanceStatus = TaskInstance["status"];
export type Vehicle = Database["hogar"]["Tables"]["vehicles"]["Row"];
export type FuelLog = Database["hogar"]["Tables"]["fuel_logs"]["Row"];
export type FuelType = Vehicle["fuel_type"];
