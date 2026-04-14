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
      appointments: {
        Row: {
          appointment_date: string
          appointment_time: string
          clinic_id: string
          created_at: string
          doctor_id: string | null
          duration_minutes: number | null
          id: string
          notes: string | null
          patient_id: string
          provider_id: string | null
          scheduled_at: string | null
          status: string | null
          type: string | null
          updated_at: string
        }
        Insert: {
          appointment_date: string
          appointment_time: string
          clinic_id: string
          created_at?: string
          doctor_id?: string | null
          duration_minutes?: number | null
          id?: string
          notes?: string | null
          patient_id: string
          provider_id?: string | null
          scheduled_at?: string | null
          status?: string | null
          type?: string | null
          updated_at?: string
        }
        Update: {
          appointment_date?: string
          appointment_time?: string
          clinic_id?: string
          created_at?: string
          doctor_id?: string | null
          duration_minutes?: number | null
          id?: string
          notes?: string | null
          patient_id?: string
          provider_id?: string | null
          scheduled_at?: string | null
          status?: string | null
          type?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "appointments_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_log: {
        Row: {
          action: string
          clinic_id: string
          created_at: string
          details: Json | null
          id: string
          record_id: string | null
          table_name: string | null
          user_id: string | null
          user_name: string | null
        }
        Insert: {
          action: string
          clinic_id: string
          created_at?: string
          details?: Json | null
          id?: string
          record_id?: string | null
          table_name?: string | null
          user_id?: string | null
          user_name?: string | null
        }
        Update: {
          action?: string
          clinic_id?: string
          created_at?: string
          details?: Json | null
          id?: string
          record_id?: string | null
          table_name?: string | null
          user_id?: string | null
          user_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_log_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      campaigns: {
        Row: {
          clinic_id: string
          content: string | null
          created_at: string
          id: string
          name: string
          sent_at: string | null
          status: string
          subject: string | null
          type: string
          updated_at: string
        }
        Insert: {
          clinic_id: string
          content?: string | null
          created_at?: string
          id?: string
          name: string
          sent_at?: string | null
          status?: string
          subject?: string | null
          type?: string
          updated_at?: string
        }
        Update: {
          clinic_id?: string
          content?: string | null
          created_at?: string
          id?: string
          name?: string
          sent_at?: string | null
          status?: string
          subject?: string | null
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaigns_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      clinic_settings: {
        Row: {
          clinic_id: string
          created_at: string
          id: string
          setting_key: string
          setting_value: string | null
          updated_at: string
        }
        Insert: {
          clinic_id: string
          created_at?: string
          id?: string
          setting_key: string
          setting_value?: string | null
          updated_at?: string
        }
        Update: {
          clinic_id?: string
          created_at?: string
          id?: string
          setting_key?: string
          setting_value?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "clinic_settings_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      clinics: {
        Row: {
          address: string | null
          created_at: string
          email: string | null
          facebook_url: string | null
          google_maps_url: string | null
          id: string
          instagram_url: string | null
          logo_url: string | null
          name: string
          phone: string | null
          subscription_plan: string | null
          tiktok_url: string | null
          twitter_url: string | null
          updated_at: string
          website: string | null
        }
        Insert: {
          address?: string | null
          created_at?: string
          email?: string | null
          facebook_url?: string | null
          google_maps_url?: string | null
          id?: string
          instagram_url?: string | null
          logo_url?: string | null
          name: string
          phone?: string | null
          subscription_plan?: string | null
          tiktok_url?: string | null
          twitter_url?: string | null
          updated_at?: string
          website?: string | null
        }
        Update: {
          address?: string | null
          created_at?: string
          email?: string | null
          facebook_url?: string | null
          google_maps_url?: string | null
          id?: string
          instagram_url?: string | null
          logo_url?: string | null
          name?: string
          phone?: string | null
          subscription_plan?: string | null
          tiktok_url?: string | null
          twitter_url?: string | null
          updated_at?: string
          website?: string | null
        }
        Relationships: []
      }
      consent_forms: {
        Row: {
          clinic_id: string
          consent_type: string
          consented_at: string | null
          created_at: string
          form_content: string | null
          guardian_name: string | null
          id: string
          is_minor: boolean | null
          patient_id: string
          procedure_name: string
          signature_data: string | null
          witnessed_by: string | null
        }
        Insert: {
          clinic_id: string
          consent_type?: string
          consented_at?: string | null
          created_at?: string
          form_content?: string | null
          guardian_name?: string | null
          id?: string
          is_minor?: boolean | null
          patient_id: string
          procedure_name: string
          signature_data?: string | null
          witnessed_by?: string | null
        }
        Update: {
          clinic_id?: string
          consent_type?: string
          consented_at?: string | null
          created_at?: string
          form_content?: string | null
          guardian_name?: string | null
          id?: string
          is_minor?: boolean | null
          patient_id?: string
          procedure_name?: string
          signature_data?: string | null
          witnessed_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "consent_forms_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consent_forms_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      consultation_logs: {
        Row: {
          appointment_id: string | null
          billing_at: string | null
          checkin_at: string | null
          clinic_id: string
          consultation_end: string | null
          consultation_start: string | null
          created_at: string
          doctor_id: string
          id: string
          notes: string | null
          patient_id: string
          payment_at: string | null
          procedure_end: string | null
          procedure_start: string | null
          procedure_type: string | null
          updated_at: string
        }
        Insert: {
          appointment_id?: string | null
          billing_at?: string | null
          checkin_at?: string | null
          clinic_id: string
          consultation_end?: string | null
          consultation_start?: string | null
          created_at?: string
          doctor_id: string
          id?: string
          notes?: string | null
          patient_id: string
          payment_at?: string | null
          procedure_end?: string | null
          procedure_start?: string | null
          procedure_type?: string | null
          updated_at?: string
        }
        Update: {
          appointment_id?: string | null
          billing_at?: string | null
          checkin_at?: string | null
          clinic_id?: string
          consultation_end?: string | null
          consultation_start?: string | null
          created_at?: string
          doctor_id?: string
          id?: string
          notes?: string | null
          patient_id?: string
          payment_at?: string | null
          procedure_end?: string | null
          procedure_start?: string | null
          procedure_type?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "consultation_logs_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consultation_logs_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consultation_logs_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consultation_logs_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_todos: {
        Row: {
          clinic_id: string
          completed_at: string | null
          created_at: string
          dismissed_at: string | null
          id: string
          message: string
          patient_id: string | null
          patient_name: string | null
          patient_phone: string | null
          priority: string
          reference_id: string | null
          reference_table: string | null
          status: string
          task_type: string
        }
        Insert: {
          clinic_id: string
          completed_at?: string | null
          created_at?: string
          dismissed_at?: string | null
          id?: string
          message: string
          patient_id?: string | null
          patient_name?: string | null
          patient_phone?: string | null
          priority?: string
          reference_id?: string | null
          reference_table?: string | null
          status?: string
          task_type: string
        }
        Update: {
          clinic_id?: string
          completed_at?: string | null
          created_at?: string
          dismissed_at?: string | null
          id?: string
          message?: string
          patient_id?: string | null
          patient_name?: string | null
          patient_phone?: string | null
          priority?: string
          reference_id?: string | null
          reference_table?: string | null
          status?: string
          task_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "daily_todos_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_todos_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      discount_coupons: {
        Row: {
          clinic_id: string
          code: string
          created_at: string
          description: string | null
          discount_type: string
          discount_value: number
          id: string
          is_active: boolean
          max_uses: number | null
          updated_at: string
          used_count: number
          valid_from: string | null
          valid_until: string | null
        }
        Insert: {
          clinic_id: string
          code: string
          created_at?: string
          description?: string | null
          discount_type?: string
          discount_value?: number
          id?: string
          is_active?: boolean
          max_uses?: number | null
          updated_at?: string
          used_count?: number
          valid_from?: string | null
          valid_until?: string | null
        }
        Update: {
          clinic_id?: string
          code?: string
          created_at?: string
          description?: string | null
          discount_type?: string
          discount_value?: number
          id?: string
          is_active?: boolean
          max_uses?: number | null
          updated_at?: string
          used_count?: number
          valid_from?: string | null
          valid_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "discount_coupons_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      doctor_chairs: {
        Row: {
          available_days: string[] | null
          chair_label: string
          clinic_id: string
          created_at: string
          doctor_id: string
          id: string
        }
        Insert: {
          available_days?: string[] | null
          chair_label: string
          clinic_id: string
          created_at?: string
          doctor_id: string
          id?: string
        }
        Update: {
          available_days?: string[] | null
          chair_label?: string
          clinic_id?: string
          created_at?: string
          doctor_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "doctor_chairs_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "doctor_chairs_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      expenses: {
        Row: {
          amount: number
          category: string | null
          clinic_id: string
          created_at: string
          description: string | null
          expense_date: string | null
          id: string
        }
        Insert: {
          amount: number
          category?: string | null
          clinic_id: string
          created_at?: string
          description?: string | null
          expense_date?: string | null
          id?: string
        }
        Update: {
          amount?: number
          category?: string | null
          clinic_id?: string
          created_at?: string
          description?: string | null
          expense_date?: string | null
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "expenses_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      insurance_claims: {
        Row: {
          approved_amount: number | null
          claim_amount: number | null
          claim_number: string | null
          clinic_id: string
          created_at: string
          id: string
          insurer_name: string
          invoice_id: string | null
          notes: string | null
          patient_id: string
          policy_number: string | null
          pre_auth_amount: number | null
          pre_auth_status: string | null
          rejection_reason: string | null
          settled_at: string | null
          settlement_amount: number | null
          status: string
          submitted_at: string | null
          updated_at: string
        }
        Insert: {
          approved_amount?: number | null
          claim_amount?: number | null
          claim_number?: string | null
          clinic_id: string
          created_at?: string
          id?: string
          insurer_name: string
          invoice_id?: string | null
          notes?: string | null
          patient_id: string
          policy_number?: string | null
          pre_auth_amount?: number | null
          pre_auth_status?: string | null
          rejection_reason?: string | null
          settled_at?: string | null
          settlement_amount?: number | null
          status?: string
          submitted_at?: string | null
          updated_at?: string
        }
        Update: {
          approved_amount?: number | null
          claim_amount?: number | null
          claim_number?: string | null
          clinic_id?: string
          created_at?: string
          id?: string
          insurer_name?: string
          invoice_id?: string | null
          notes?: string | null
          patient_id?: string
          policy_number?: string | null
          pre_auth_amount?: number | null
          pre_auth_status?: string | null
          rejection_reason?: string | null
          settled_at?: string | null
          settlement_amount?: number | null
          status?: string
          submitted_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "insurance_claims_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "insurance_claims_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "insurance_claims_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_items: {
        Row: {
          category: string | null
          clinic_id: string
          created_at: string
          expiry_date: string | null
          id: string
          min_stock_level: number | null
          name: string
          quantity: number | null
          supplier: string | null
          unit: string | null
          unit_cost: number | null
          updated_at: string
        }
        Insert: {
          category?: string | null
          clinic_id: string
          created_at?: string
          expiry_date?: string | null
          id?: string
          min_stock_level?: number | null
          name: string
          quantity?: number | null
          supplier?: string | null
          unit?: string | null
          unit_cost?: number | null
          updated_at?: string
        }
        Update: {
          category?: string | null
          clinic_id?: string
          created_at?: string
          expiry_date?: string | null
          id?: string
          min_stock_level?: number | null
          name?: string
          quantity?: number | null
          supplier?: string | null
          unit?: string | null
          unit_cost?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_items_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_transactions: {
        Row: {
          created_at: string
          id: string
          inventory_item_id: string
          notes: string | null
          quantity_changed: number
          transaction_type: string
        }
        Insert: {
          created_at?: string
          id?: string
          inventory_item_id: string
          notes?: string | null
          quantity_changed?: number
          transaction_type?: string
        }
        Update: {
          created_at?: string
          id?: string
          inventory_item_id?: string
          notes?: string | null
          quantity_changed?: number
          transaction_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_transactions_inventory_item_id_fkey"
            columns: ["inventory_item_id"]
            isOneToOne: false
            referencedRelation: "inventory_items"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_items: {
        Row: {
          created_at: string
          description: string
          id: string
          invoice_id: string
          quantity: number | null
          total: number
          unit_price: number
        }
        Insert: {
          created_at?: string
          description: string
          id?: string
          invoice_id: string
          quantity?: number | null
          total?: number
          unit_price: number
        }
        Update: {
          created_at?: string
          description?: string
          id?: string
          invoice_id?: string
          quantity?: number | null
          total?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "invoice_items_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          amount: number
          balance: number | null
          clinic_id: string
          coupon_code: string | null
          created_at: string
          discount: number | null
          discount_percent: number | null
          due_date: string | null
          id: string
          invoice_date: string | null
          invoice_number: string | null
          notes: string | null
          paid_amount: number
          paid_at: string | null
          patient_id: string
          payment_method: string | null
          status: string | null
          subtotal: number | null
          tax: number | null
          tax_amount: number | null
          tax_rate: number | null
          total: number
          updated_at: string
        }
        Insert: {
          amount?: number
          balance?: number | null
          clinic_id: string
          coupon_code?: string | null
          created_at?: string
          discount?: number | null
          discount_percent?: number | null
          due_date?: string | null
          id?: string
          invoice_date?: string | null
          invoice_number?: string | null
          notes?: string | null
          paid_amount?: number
          paid_at?: string | null
          patient_id: string
          payment_method?: string | null
          status?: string | null
          subtotal?: number | null
          tax?: number | null
          tax_amount?: number | null
          tax_rate?: number | null
          total?: number
          updated_at?: string
        }
        Update: {
          amount?: number
          balance?: number | null
          clinic_id?: string
          coupon_code?: string | null
          created_at?: string
          discount?: number | null
          discount_percent?: number | null
          due_date?: string | null
          id?: string
          invoice_date?: string | null
          invoice_number?: string | null
          notes?: string | null
          paid_amount?: number
          paid_at?: string | null
          patient_id?: string
          payment_method?: string | null
          status?: string | null
          subtotal?: number | null
          tax?: number | null
          tax_amount?: number | null
          tax_rate?: number | null
          total?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoices_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      lab_directory: {
        Row: {
          clinic_id: string
          contact_person: string | null
          created_at: string
          default_cost: number | null
          default_tat_days: number | null
          id: string
          lab_name: string
          notes: string | null
          phone: string | null
          speciality: string | null
          updated_at: string
          whatsapp: string | null
        }
        Insert: {
          clinic_id: string
          contact_person?: string | null
          created_at?: string
          default_cost?: number | null
          default_tat_days?: number | null
          id?: string
          lab_name: string
          notes?: string | null
          phone?: string | null
          speciality?: string | null
          updated_at?: string
          whatsapp?: string | null
        }
        Update: {
          clinic_id?: string
          contact_person?: string | null
          created_at?: string
          default_cost?: number | null
          default_tat_days?: number | null
          id?: string
          lab_name?: string
          notes?: string | null
          phone?: string | null
          speciality?: string | null
          updated_at?: string
          whatsapp?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lab_directory_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      lab_orders: {
        Row: {
          actual_delivery_date: string | null
          clinic_id: string
          cost: number | null
          created_at: string
          expected_date: string | null
          fitted_date: string | null
          id: string
          item_description: string
          lab_directory_id: string | null
          lab_name: string | null
          notes: string | null
          patient_id: string
          received_date: string | null
          sent_date: string | null
          shade: string | null
          special_instructions: string | null
          status: string
          tooth_treatment_id: string | null
          updated_at: string
          work_type: string | null
        }
        Insert: {
          actual_delivery_date?: string | null
          clinic_id: string
          cost?: number | null
          created_at?: string
          expected_date?: string | null
          fitted_date?: string | null
          id?: string
          item_description: string
          lab_directory_id?: string | null
          lab_name?: string | null
          notes?: string | null
          patient_id: string
          received_date?: string | null
          sent_date?: string | null
          shade?: string | null
          special_instructions?: string | null
          status?: string
          tooth_treatment_id?: string | null
          updated_at?: string
          work_type?: string | null
        }
        Update: {
          actual_delivery_date?: string | null
          clinic_id?: string
          cost?: number | null
          created_at?: string
          expected_date?: string | null
          fitted_date?: string | null
          id?: string
          item_description?: string
          lab_directory_id?: string | null
          lab_name?: string | null
          notes?: string | null
          patient_id?: string
          received_date?: string | null
          sent_date?: string | null
          shade?: string | null
          special_instructions?: string | null
          status?: string
          tooth_treatment_id?: string | null
          updated_at?: string
          work_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lab_orders_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lab_orders_lab_directory_id_fkey"
            columns: ["lab_directory_id"]
            isOneToOne: false
            referencedRelation: "lab_directory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lab_orders_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lab_orders_tooth_treatment_id_fkey"
            columns: ["tooth_treatment_id"]
            isOneToOne: false
            referencedRelation: "tooth_treatments"
            referencedColumns: ["id"]
          },
        ]
      }
      leads: {
        Row: {
          assigned_to: string | null
          clinic_id: string
          converted_patient_id: string | null
          created_at: string
          email: string | null
          follow_up_date: string | null
          full_name: string
          id: string
          interested_in: string | null
          notes: string | null
          phone: string | null
          source: string | null
          status: string
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          clinic_id: string
          converted_patient_id?: string | null
          created_at?: string
          email?: string | null
          follow_up_date?: string | null
          full_name: string
          id?: string
          interested_in?: string | null
          notes?: string | null
          phone?: string | null
          source?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          clinic_id?: string
          converted_patient_id?: string | null
          created_at?: string
          email?: string | null
          follow_up_date?: string | null
          full_name?: string
          id?: string
          interested_in?: string | null
          notes?: string | null
          phone?: string | null
          source?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "leads_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_converted_patient_id_fkey"
            columns: ["converted_patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      membership_plans: {
        Row: {
          amount: number
          benefits: string[] | null
          clinic_id: string
          created_at: string
          discount_percent: number | null
          duration_months: number
          id: string
          plan_name: string
          updated_at: string
        }
        Insert: {
          amount?: number
          benefits?: string[] | null
          clinic_id: string
          created_at?: string
          discount_percent?: number | null
          duration_months?: number
          id?: string
          plan_name: string
          updated_at?: string
        }
        Update: {
          amount?: number
          benefits?: string[] | null
          clinic_id?: string
          created_at?: string
          discount_percent?: number | null
          duration_months?: number
          id?: string
          plan_name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "membership_plans_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      memberships: {
        Row: {
          amount: number
          benefits: Json | null
          clinic_id: string
          created_at: string
          end_date: string | null
          id: string
          patient_id: string
          plan_name: string
          plan_type: string | null
          start_date: string
          status: string
          updated_at: string
        }
        Insert: {
          amount?: number
          benefits?: Json | null
          clinic_id: string
          created_at?: string
          end_date?: string | null
          id?: string
          patient_id: string
          plan_name?: string
          plan_type?: string | null
          start_date?: string
          status?: string
          updated_at?: string
        }
        Update: {
          amount?: number
          benefits?: Json | null
          clinic_id?: string
          created_at?: string
          end_date?: string | null
          id?: string
          patient_id?: string
          plan_name?: string
          plan_type?: string | null
          start_date?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "memberships_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "memberships_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      ortho_aligner_cases: {
        Row: {
          aligner_brand: string | null
          change_interval_days: number | null
          compliance_hours_per_day: number | null
          created_at: string
          current_lower_aligner: number | null
          current_upper_aligner: number | null
          id: string
          ortho_case_id: string
          total_lower_aligners: number | null
          total_upper_aligners: number | null
          updated_at: string
        }
        Insert: {
          aligner_brand?: string | null
          change_interval_days?: number | null
          compliance_hours_per_day?: number | null
          created_at?: string
          current_lower_aligner?: number | null
          current_upper_aligner?: number | null
          id?: string
          ortho_case_id: string
          total_lower_aligners?: number | null
          total_upper_aligners?: number | null
          updated_at?: string
        }
        Update: {
          aligner_brand?: string | null
          change_interval_days?: number | null
          compliance_hours_per_day?: number | null
          created_at?: string
          current_lower_aligner?: number | null
          current_upper_aligner?: number | null
          id?: string
          ortho_case_id?: string
          total_lower_aligners?: number | null
          total_upper_aligners?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ortho_aligner_cases_ortho_case_id_fkey"
            columns: ["ortho_case_id"]
            isOneToOne: false
            referencedRelation: "ortho_cases"
            referencedColumns: ["id"]
          },
        ]
      }
      ortho_aligner_refinements: {
        Row: {
          aligner_case_id: string
          created_at: string
          id: string
          lower_aligners: number | null
          notes: string | null
          refinement_number: number | null
          upper_aligners: number | null
        }
        Insert: {
          aligner_case_id: string
          created_at?: string
          id?: string
          lower_aligners?: number | null
          notes?: string | null
          refinement_number?: number | null
          upper_aligners?: number | null
        }
        Update: {
          aligner_case_id?: string
          created_at?: string
          id?: string
          lower_aligners?: number | null
          notes?: string | null
          refinement_number?: number | null
          upper_aligners?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "ortho_aligner_refinements_aligner_case_id_fkey"
            columns: ["aligner_case_id"]
            isOneToOne: false
            referencedRelation: "ortho_aligner_cases"
            referencedColumns: ["id"]
          },
        ]
      }
      ortho_cases: {
        Row: {
          actual_end_date: string | null
          case_start_date: string | null
          case_type: string | null
          clinic_id: string
          created_at: string
          diagnosis: string | null
          doctor_id: string | null
          estimated_duration_months: number | null
          estimated_end_date: string | null
          id: string
          malocclusion_class: string | null
          notes: string | null
          orthodontist_id: string | null
          patient_id: string
          pre_treatment_checklist: Json | null
          skeletal_pattern: string | null
          start_date: string | null
          status: string | null
          total_cost: number | null
          total_estimated_cost: number | null
          treatment_plan: string | null
          updated_at: string
        }
        Insert: {
          actual_end_date?: string | null
          case_start_date?: string | null
          case_type?: string | null
          clinic_id: string
          created_at?: string
          diagnosis?: string | null
          doctor_id?: string | null
          estimated_duration_months?: number | null
          estimated_end_date?: string | null
          id?: string
          malocclusion_class?: string | null
          notes?: string | null
          orthodontist_id?: string | null
          patient_id: string
          pre_treatment_checklist?: Json | null
          skeletal_pattern?: string | null
          start_date?: string | null
          status?: string | null
          total_cost?: number | null
          total_estimated_cost?: number | null
          treatment_plan?: string | null
          updated_at?: string
        }
        Update: {
          actual_end_date?: string | null
          case_start_date?: string | null
          case_type?: string | null
          clinic_id?: string
          created_at?: string
          diagnosis?: string | null
          doctor_id?: string | null
          estimated_duration_months?: number | null
          estimated_end_date?: string | null
          id?: string
          malocclusion_class?: string | null
          notes?: string | null
          orthodontist_id?: string | null
          patient_id?: string
          pre_treatment_checklist?: Json | null
          skeletal_pattern?: string | null
          start_date?: string | null
          status?: string | null
          total_cost?: number | null
          total_estimated_cost?: number | null
          treatment_plan?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ortho_cases_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ortho_cases_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ortho_cases_orthodontist_id_fkey"
            columns: ["orthodontist_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ortho_cases_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      ortho_cephalometrics: {
        Row: {
          anb: number | null
          created_at: string
          fma: number | null
          id: string
          impa: number | null
          l1_to_nb_angle: number | null
          l1_to_nb_mm: number | null
          ortho_case_id: string
          overbite: number | null
          overjet: number | null
          record_date: string | null
          record_type: string | null
          sna: number | null
          snb: number | null
          u1_to_na_angle: number | null
          u1_to_na_mm: number | null
          wits_appraisal: number | null
        }
        Insert: {
          anb?: number | null
          created_at?: string
          fma?: number | null
          id?: string
          impa?: number | null
          l1_to_nb_angle?: number | null
          l1_to_nb_mm?: number | null
          ortho_case_id: string
          overbite?: number | null
          overjet?: number | null
          record_date?: string | null
          record_type?: string | null
          sna?: number | null
          snb?: number | null
          u1_to_na_angle?: number | null
          u1_to_na_mm?: number | null
          wits_appraisal?: number | null
        }
        Update: {
          anb?: number | null
          created_at?: string
          fma?: number | null
          id?: string
          impa?: number | null
          l1_to_nb_angle?: number | null
          l1_to_nb_mm?: number | null
          ortho_case_id?: string
          overbite?: number | null
          overjet?: number | null
          record_date?: string | null
          record_type?: string | null
          sna?: number | null
          snb?: number | null
          u1_to_na_angle?: number | null
          u1_to_na_mm?: number | null
          wits_appraisal?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "ortho_cephalometrics_ortho_case_id_fkey"
            columns: ["ortho_case_id"]
            isOneToOne: false
            referencedRelation: "ortho_cases"
            referencedColumns: ["id"]
          },
        ]
      }
      ortho_consent_forms: {
        Row: {
          created_at: string
          form_content: string | null
          form_type: string
          guardian_name: string | null
          id: string
          is_minor: boolean | null
          ortho_case_id: string
          signed_at: string | null
        }
        Insert: {
          created_at?: string
          form_content?: string | null
          form_type: string
          guardian_name?: string | null
          id?: string
          is_minor?: boolean | null
          ortho_case_id: string
          signed_at?: string | null
        }
        Update: {
          created_at?: string
          form_content?: string | null
          form_type?: string
          guardian_name?: string | null
          id?: string
          is_minor?: boolean | null
          ortho_case_id?: string
          signed_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ortho_consent_forms_ortho_case_id_fkey"
            columns: ["ortho_case_id"]
            isOneToOne: false
            referencedRelation: "ortho_cases"
            referencedColumns: ["id"]
          },
        ]
      }
      ortho_debond_records: {
        Row: {
          band_removal: boolean | null
          bonded_retainer_placed: boolean | null
          bracket_removal: boolean | null
          created_at: string
          debond_date: string
          id: string
          impressions_taken: boolean | null
          notes: string | null
          ortho_case_id: string
          retainer_delivery_date: string | null
          retainer_instructions_given: boolean | null
          retainer_type: string | null
          retention_schedule: Json | null
        }
        Insert: {
          band_removal?: boolean | null
          bonded_retainer_placed?: boolean | null
          bracket_removal?: boolean | null
          created_at?: string
          debond_date: string
          id?: string
          impressions_taken?: boolean | null
          notes?: string | null
          ortho_case_id: string
          retainer_delivery_date?: string | null
          retainer_instructions_given?: boolean | null
          retainer_type?: string | null
          retention_schedule?: Json | null
        }
        Update: {
          band_removal?: boolean | null
          bonded_retainer_placed?: boolean | null
          bracket_removal?: boolean | null
          created_at?: string
          debond_date?: string
          id?: string
          impressions_taken?: boolean | null
          notes?: string | null
          ortho_case_id?: string
          retainer_delivery_date?: string | null
          retainer_instructions_given?: boolean | null
          retainer_type?: string | null
          retention_schedule?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "ortho_debond_records_ortho_case_id_fkey"
            columns: ["ortho_case_id"]
            isOneToOne: false
            referencedRelation: "ortho_cases"
            referencedColumns: ["id"]
          },
        ]
      }
      ortho_financial_milestones: {
        Row: {
          amount: number
          created_at: string
          due_date: string | null
          id: string
          milestone_name: string
          ortho_case_id: string
          paid_date: string | null
          status: string | null
        }
        Insert: {
          amount?: number
          created_at?: string
          due_date?: string | null
          id?: string
          milestone_name: string
          ortho_case_id: string
          paid_date?: string | null
          status?: string | null
        }
        Update: {
          amount?: number
          created_at?: string
          due_date?: string | null
          id?: string
          milestone_name?: string
          ortho_case_id?: string
          paid_date?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ortho_financial_milestones_ortho_case_id_fkey"
            columns: ["ortho_case_id"]
            isOneToOne: false
            referencedRelation: "ortho_cases"
            referencedColumns: ["id"]
          },
        ]
      }
      ortho_ipr_log: {
        Row: {
          created_at: string
          id: string
          mm_removed: number
          ortho_case_id: string
          tooth_number: number
          visit_date: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          mm_removed: number
          ortho_case_id: string
          tooth_number: number
          visit_date?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          mm_removed?: number
          ortho_case_id?: string
          tooth_number?: number
          visit_date?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ortho_ipr_log_ortho_case_id_fkey"
            columns: ["ortho_case_id"]
            isOneToOne: false
            referencedRelation: "ortho_cases"
            referencedColumns: ["id"]
          },
        ]
      }
      ortho_photo_records: {
        Row: {
          consent_for_education: boolean | null
          created_at: string
          id: string
          ortho_case_id: string
          photo_category: string | null
          photo_type: string
          photo_url: string
          record_date: string | null
          visit_number: number | null
        }
        Insert: {
          consent_for_education?: boolean | null
          created_at?: string
          id?: string
          ortho_case_id: string
          photo_category?: string | null
          photo_type: string
          photo_url: string
          record_date?: string | null
          visit_number?: number | null
        }
        Update: {
          consent_for_education?: boolean | null
          created_at?: string
          id?: string
          ortho_case_id?: string
          photo_category?: string | null
          photo_type?: string
          photo_url?: string
          record_date?: string | null
          visit_number?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "ortho_photo_records_ortho_case_id_fkey"
            columns: ["ortho_case_id"]
            isOneToOne: false
            referencedRelation: "ortho_cases"
            referencedColumns: ["id"]
          },
        ]
      }
      ortho_treatment_phases: {
        Row: {
          completed_at: string | null
          created_at: string
          description: string | null
          estimated_cost: number | null
          estimated_visits: number | null
          id: string
          notes: string | null
          ortho_case_id: string
          phase_name: string
          phase_number: number | null
          started_at: string | null
          status: string | null
          visit_interval_weeks: number | null
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          description?: string | null
          estimated_cost?: number | null
          estimated_visits?: number | null
          id?: string
          notes?: string | null
          ortho_case_id: string
          phase_name: string
          phase_number?: number | null
          started_at?: string | null
          status?: string | null
          visit_interval_weeks?: number | null
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          description?: string | null
          estimated_cost?: number | null
          estimated_visits?: number | null
          id?: string
          notes?: string | null
          ortho_case_id?: string
          phase_name?: string
          phase_number?: number | null
          started_at?: string | null
          status?: string | null
          visit_interval_weeks?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "ortho_treatment_phases_ortho_case_id_fkey"
            columns: ["ortho_case_id"]
            isOneToOne: false
            referencedRelation: "ortho_cases"
            referencedColumns: ["id"]
          },
        ]
      }
      ortho_visits: {
        Row: {
          auxiliaries_used: string[] | null
          bracket_arch: string | null
          bracket_issues: string | null
          bracket_prescription: string | null
          bracket_slot: string | null
          case_id: string
          clinical_photos_taken: boolean | null
          created_at: string
          elastic_instructions_given: boolean | null
          id: string
          next_appointment_interval_weeks: number | null
          next_visit_date: string | null
          notes: string | null
          ortho_case_id: string | null
          progress_notes: string | null
          visit_date: string
          visit_number: number | null
          wire_change: boolean | null
          wire_lower: string | null
          wire_upper: string | null
        }
        Insert: {
          auxiliaries_used?: string[] | null
          bracket_arch?: string | null
          bracket_issues?: string | null
          bracket_prescription?: string | null
          bracket_slot?: string | null
          case_id: string
          clinical_photos_taken?: boolean | null
          created_at?: string
          elastic_instructions_given?: boolean | null
          id?: string
          next_appointment_interval_weeks?: number | null
          next_visit_date?: string | null
          notes?: string | null
          ortho_case_id?: string | null
          progress_notes?: string | null
          visit_date: string
          visit_number?: number | null
          wire_change?: boolean | null
          wire_lower?: string | null
          wire_upper?: string | null
        }
        Update: {
          auxiliaries_used?: string[] | null
          bracket_arch?: string | null
          bracket_issues?: string | null
          bracket_prescription?: string | null
          bracket_slot?: string | null
          case_id?: string
          clinical_photos_taken?: boolean | null
          created_at?: string
          elastic_instructions_given?: boolean | null
          id?: string
          next_appointment_interval_weeks?: number | null
          next_visit_date?: string | null
          notes?: string | null
          ortho_case_id?: string | null
          progress_notes?: string | null
          visit_date?: string
          visit_number?: number | null
          wire_change?: boolean | null
          wire_lower?: string | null
          wire_upper?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ortho_visits_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "ortho_cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ortho_visits_ortho_case_id_fkey"
            columns: ["ortho_case_id"]
            isOneToOne: false
            referencedRelation: "ortho_cases"
            referencedColumns: ["id"]
          },
        ]
      }
      patient_communications: {
        Row: {
          clinic_id: string
          content: string | null
          created_at: string
          direction: string | null
          id: string
          patient_id: string
          sent_by: string | null
          status: string | null
          subject: string | null
          type: string
        }
        Insert: {
          clinic_id: string
          content?: string | null
          created_at?: string
          direction?: string | null
          id?: string
          patient_id: string
          sent_by?: string | null
          status?: string | null
          subject?: string | null
          type: string
        }
        Update: {
          clinic_id?: string
          content?: string | null
          created_at?: string
          direction?: string | null
          id?: string
          patient_id?: string
          sent_by?: string | null
          status?: string | null
          subject?: string | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "patient_communications_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patient_communications_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patient_communications_sent_by_fkey"
            columns: ["sent_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      patient_documents: {
        Row: {
          category: string | null
          clinic_id: string
          created_at: string
          file_name: string
          file_type: string | null
          file_url: string
          id: string
          notes: string | null
          patient_id: string
          uploaded_by: string | null
        }
        Insert: {
          category?: string | null
          clinic_id: string
          created_at?: string
          file_name: string
          file_type?: string | null
          file_url: string
          id?: string
          notes?: string | null
          patient_id: string
          uploaded_by?: string | null
        }
        Update: {
          category?: string | null
          clinic_id?: string
          created_at?: string
          file_name?: string
          file_type?: string | null
          file_url?: string
          id?: string
          notes?: string | null
          patient_id?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "patient_documents_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patient_documents_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patient_documents_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      patients: {
        Row: {
          address: string | null
          age: number | null
          allergies: string | null
          blood_group: string | null
          clinic_id: string
          created_at: string
          date_of_birth: string | null
          email: string | null
          full_name: string
          gender: string | null
          id: string
          medical_history: string | null
          notes: string | null
          op_number: string | null
          phone: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          age?: number | null
          allergies?: string | null
          blood_group?: string | null
          clinic_id: string
          created_at?: string
          date_of_birth?: string | null
          email?: string | null
          full_name: string
          gender?: string | null
          id?: string
          medical_history?: string | null
          notes?: string | null
          op_number?: string | null
          phone?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          age?: number | null
          allergies?: string | null
          blood_group?: string | null
          clinic_id?: string
          created_at?: string
          date_of_birth?: string | null
          email?: string | null
          full_name?: string
          gender?: string | null
          id?: string
          medical_history?: string | null
          notes?: string | null
          op_number?: string | null
          phone?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "patients_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          clinic_id: string
          created_at: string
          id: string
          invoice_id: string | null
          notes: string | null
          patient_id: string
          payment_date: string | null
          payment_method: string | null
          reference_number: string | null
        }
        Insert: {
          amount?: number
          clinic_id: string
          created_at?: string
          id?: string
          invoice_id?: string | null
          notes?: string | null
          patient_id: string
          payment_date?: string | null
          payment_method?: string | null
          reference_number?: string | null
        }
        Update: {
          amount?: number
          clinic_id?: string
          created_at?: string
          id?: string
          invoice_id?: string | null
          notes?: string | null
          patient_id?: string
          payment_date?: string | null
          payment_method?: string | null
          reference_number?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payments_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      prescription_items: {
        Row: {
          condition: string | null
          cost: number | null
          created_at: string
          id: string
          notes: string | null
          prescription_id: string | null
          tooth_number: number | null
          treatment: string | null
          treatment_status: string | null
        }
        Insert: {
          condition?: string | null
          cost?: number | null
          created_at?: string
          id?: string
          notes?: string | null
          prescription_id?: string | null
          tooth_number?: number | null
          treatment?: string | null
          treatment_status?: string | null
        }
        Update: {
          condition?: string | null
          cost?: number | null
          created_at?: string
          id?: string
          notes?: string | null
          prescription_id?: string | null
          tooth_number?: number | null
          treatment?: string | null
          treatment_status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "prescription_items_prescription_id_fkey"
            columns: ["prescription_id"]
            isOneToOne: false
            referencedRelation: "prescriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      prescriptions: {
        Row: {
          alignment_condition: string | null
          chart_type: string | null
          chief_complaint: string | null
          clinic_id: string
          created_at: string
          diagnosis_notes: string | null
          gum_condition: string | null
          id: string
          medications: Json | null
          patient_id: string
          status: string | null
          treatment_plan: string | null
          updated_at: string
        }
        Insert: {
          alignment_condition?: string | null
          chart_type?: string | null
          chief_complaint?: string | null
          clinic_id: string
          created_at?: string
          diagnosis_notes?: string | null
          gum_condition?: string | null
          id?: string
          medications?: Json | null
          patient_id: string
          status?: string | null
          treatment_plan?: string | null
          updated_at?: string
        }
        Update: {
          alignment_condition?: string | null
          chart_type?: string | null
          chief_complaint?: string | null
          clinic_id?: string
          created_at?: string
          diagnosis_notes?: string | null
          gum_condition?: string | null
          id?: string
          medications?: Json | null
          patient_id?: string
          status?: string | null
          treatment_plan?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "prescriptions_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prescriptions_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          clinic_id: string | null
          created_at: string
          full_name: string | null
          id: string
          phone: string | null
          role: string | null
          specialization: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          clinic_id?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          phone?: string | null
          role?: string | null
          specialization?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          clinic_id?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          phone?: string | null
          role?: string | null
          specialization?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      queue_tokens: {
        Row: {
          appointment_id: string | null
          called_at: string | null
          clinic_id: string
          completed_at: string | null
          counter_number: string | null
          created_at: string
          id: string
          notes: string | null
          patient_id: string | null
          priority: string | null
          provider_id: string | null
          queue_date: string | null
          status: string | null
          token_number: number
        }
        Insert: {
          appointment_id?: string | null
          called_at?: string | null
          clinic_id: string
          completed_at?: string | null
          counter_number?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          patient_id?: string | null
          priority?: string | null
          provider_id?: string | null
          queue_date?: string | null
          status?: string | null
          token_number: number
        }
        Update: {
          appointment_id?: string | null
          called_at?: string | null
          clinic_id?: string
          completed_at?: string | null
          counter_number?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          patient_id?: string | null
          priority?: string | null
          provider_id?: string | null
          queue_date?: string | null
          status?: string | null
          token_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "queue_tokens_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "queue_tokens_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "queue_tokens_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "queue_tokens_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      recall_reminders: {
        Row: {
          clinic_id: string
          created_at: string
          due_date: string
          id: string
          last_visit_date: string | null
          notes: string | null
          patient_id: string
          reminder_type: string
          sent_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          clinic_id: string
          created_at?: string
          due_date: string
          id?: string
          last_visit_date?: string | null
          notes?: string | null
          patient_id: string
          reminder_type?: string
          sent_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          clinic_id?: string
          created_at?: string
          due_date?: string
          id?: string
          last_visit_date?: string | null
          notes?: string | null
          patient_id?: string
          reminder_type?: string
          sent_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "recall_reminders_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recall_reminders_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      referrals: {
        Row: {
          clinic_id: string
          converted_patient_id: string | null
          created_at: string
          id: string
          referred_name: string
          referred_phone: string | null
          referring_patient_id: string | null
          reward_amount: number | null
          reward_status: string | null
          reward_type: string | null
          status: string
        }
        Insert: {
          clinic_id: string
          converted_patient_id?: string | null
          created_at?: string
          id?: string
          referred_name: string
          referred_phone?: string | null
          referring_patient_id?: string | null
          reward_amount?: number | null
          reward_status?: string | null
          reward_type?: string | null
          status?: string
        }
        Update: {
          clinic_id?: string
          converted_patient_id?: string | null
          created_at?: string
          id?: string
          referred_name?: string
          referred_phone?: string | null
          referring_patient_id?: string | null
          reward_amount?: number | null
          reward_status?: string | null
          reward_type?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "referrals_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "referrals_converted_patient_id_fkey"
            columns: ["converted_patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "referrals_referring_patient_id_fkey"
            columns: ["referring_patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      reviews: {
        Row: {
          clinic_id: string
          created_at: string
          feedback: string | null
          google_review_completed: boolean | null
          google_review_sent: boolean | null
          id: string
          patient_id: string | null
          rating: number
          response: string | null
        }
        Insert: {
          clinic_id: string
          created_at?: string
          feedback?: string | null
          google_review_completed?: boolean | null
          google_review_sent?: boolean | null
          id?: string
          patient_id?: string | null
          rating?: number
          response?: string | null
        }
        Update: {
          clinic_id?: string
          created_at?: string
          feedback?: string | null
          google_review_completed?: boolean | null
          google_review_sent?: boolean | null
          id?: string
          patient_id?: string | null
          rating?: number
          response?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reviews_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_attendance: {
        Row: {
          attendance_date: string
          check_in: string | null
          check_out: string | null
          clinic_id: string
          created_at: string
          id: string
          leave_type: string | null
          notes: string | null
          profile_id: string
          status: string
        }
        Insert: {
          attendance_date?: string
          check_in?: string | null
          check_out?: string | null
          clinic_id: string
          created_at?: string
          id?: string
          leave_type?: string | null
          notes?: string | null
          profile_id: string
          status?: string
        }
        Update: {
          attendance_date?: string
          check_in?: string | null
          check_out?: string | null
          clinic_id?: string
          created_at?: string
          id?: string
          leave_type?: string | null
          notes?: string | null
          profile_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_attendance_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_attendance_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      tooth_conditions: {
        Row: {
          condition_name: string
          created_at: string
          id: string
          notes: string | null
          severity: string | null
          surface: string | null
          tooth_record_id: string
        }
        Insert: {
          condition_name: string
          created_at?: string
          id?: string
          notes?: string | null
          severity?: string | null
          surface?: string | null
          tooth_record_id: string
        }
        Update: {
          condition_name?: string
          created_at?: string
          id?: string
          notes?: string | null
          severity?: string | null
          surface?: string | null
          tooth_record_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tooth_conditions_tooth_record_id_fkey"
            columns: ["tooth_record_id"]
            isOneToOne: false
            referencedRelation: "tooth_records"
            referencedColumns: ["id"]
          },
        ]
      }
      tooth_records: {
        Row: {
          clinic_id: string
          created_at: string
          id: string
          notes: string | null
          patient_id: string
          status: string | null
          tooth_number: number
          updated_at: string
        }
        Insert: {
          clinic_id: string
          created_at?: string
          id?: string
          notes?: string | null
          patient_id: string
          status?: string | null
          tooth_number: number
          updated_at?: string
        }
        Update: {
          clinic_id?: string
          created_at?: string
          id?: string
          notes?: string | null
          patient_id?: string
          status?: string | null
          tooth_number?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tooth_records_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tooth_records_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      tooth_treatments: {
        Row: {
          cost: number | null
          created_at: string
          id: string
          notes: string | null
          performed_at: string | null
          performed_by: string | null
          status: string | null
          tooth_record_id: string
          treatment_name: string
          updated_at: string
        }
        Insert: {
          cost?: number | null
          created_at?: string
          id?: string
          notes?: string | null
          performed_at?: string | null
          performed_by?: string | null
          status?: string | null
          tooth_record_id: string
          treatment_name: string
          updated_at?: string
        }
        Update: {
          cost?: number | null
          created_at?: string
          id?: string
          notes?: string | null
          performed_at?: string | null
          performed_by?: string | null
          status?: string | null
          tooth_record_id?: string
          treatment_name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tooth_treatments_performed_by_fkey"
            columns: ["performed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tooth_treatments_tooth_record_id_fkey"
            columns: ["tooth_record_id"]
            isOneToOne: false
            referencedRelation: "tooth_records"
            referencedColumns: ["id"]
          },
        ]
      }
      treatment_material_mappings: {
        Row: {
          clinic_id: string | null
          created_at: string
          id: string
          inventory_item_id: string
          quantity_needed: number | null
          quantity_used: number | null
          treatment_name: string | null
          treatment_pricing_id: string
        }
        Insert: {
          clinic_id?: string | null
          created_at?: string
          id?: string
          inventory_item_id: string
          quantity_needed?: number | null
          quantity_used?: number | null
          treatment_name?: string | null
          treatment_pricing_id: string
        }
        Update: {
          clinic_id?: string | null
          created_at?: string
          id?: string
          inventory_item_id?: string
          quantity_needed?: number | null
          quantity_used?: number | null
          treatment_name?: string | null
          treatment_pricing_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "treatment_material_mappings_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "treatment_material_mappings_inventory_item_id_fkey"
            columns: ["inventory_item_id"]
            isOneToOne: false
            referencedRelation: "inventory_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "treatment_material_mappings_treatment_pricing_id_fkey"
            columns: ["treatment_pricing_id"]
            isOneToOne: false
            referencedRelation: "treatment_pricing"
            referencedColumns: ["id"]
          },
        ]
      }
      treatment_plan_items: {
        Row: {
          created_at: string
          estimated_cost: number | null
          id: string
          notes: string | null
          procedure_name: string
          scheduled_date: string | null
          selected_option: string | null
          sort_order: number | null
          status: string
          tooth_number: number | null
          treatment_options: Json | null
          treatment_plan_id: string
          treatment_type: string | null
        }
        Insert: {
          created_at?: string
          estimated_cost?: number | null
          id?: string
          notes?: string | null
          procedure_name: string
          scheduled_date?: string | null
          selected_option?: string | null
          sort_order?: number | null
          status?: string
          tooth_number?: number | null
          treatment_options?: Json | null
          treatment_plan_id: string
          treatment_type?: string | null
        }
        Update: {
          created_at?: string
          estimated_cost?: number | null
          id?: string
          notes?: string | null
          procedure_name?: string
          scheduled_date?: string | null
          selected_option?: string | null
          sort_order?: number | null
          status?: string
          tooth_number?: number | null
          treatment_options?: Json | null
          treatment_plan_id?: string
          treatment_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "treatment_plan_items_treatment_plan_id_fkey"
            columns: ["treatment_plan_id"]
            isOneToOne: false
            referencedRelation: "treatment_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      treatment_plans: {
        Row: {
          accepted_at: string | null
          approved_at: string | null
          approved_by: string | null
          clinic_id: string
          created_at: string
          doctor_notes: string | null
          id: string
          notes: string | null
          patient_id: string
          plan_name: string
          presented_at: string | null
          signature_url: string | null
          status: string
          total_estimated_cost: number | null
          updated_at: string
        }
        Insert: {
          accepted_at?: string | null
          approved_at?: string | null
          approved_by?: string | null
          clinic_id: string
          created_at?: string
          doctor_notes?: string | null
          id?: string
          notes?: string | null
          patient_id: string
          plan_name?: string
          presented_at?: string | null
          signature_url?: string | null
          status?: string
          total_estimated_cost?: number | null
          updated_at?: string
        }
        Update: {
          accepted_at?: string | null
          approved_at?: string | null
          approved_by?: string | null
          clinic_id?: string
          created_at?: string
          doctor_notes?: string | null
          id?: string
          notes?: string | null
          patient_id?: string
          plan_name?: string
          presented_at?: string | null
          signature_url?: string | null
          status?: string
          total_estimated_cost?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "treatment_plans_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "treatment_plans_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "treatment_plans_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      treatment_pricing: {
        Row: {
          base_price: number | null
          category: string | null
          clinic_id: string
          created_at: string
          description: string | null
          id: string
          price: number
          treatment_name: string
          updated_at: string
        }
        Insert: {
          base_price?: number | null
          category?: string | null
          clinic_id: string
          created_at?: string
          description?: string | null
          id?: string
          price: number
          treatment_name: string
          updated_at?: string
        }
        Update: {
          base_price?: number | null
          category?: string | null
          clinic_id?: string
          created_at?: string
          description?: string | null
          id?: string
          price?: number
          treatment_name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "treatment_pricing_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      vendors: {
        Row: {
          category: string | null
          clinic_id: string
          contact_name: string | null
          created_at: string
          email: string | null
          gpay_id: string | null
          gst_number: string | null
          id: string
          name: string
          notes: string | null
          phone: string | null
          remarks: string | null
          total_business: number | null
          total_orders: number | null
          total_paid: number | null
        }
        Insert: {
          category?: string | null
          clinic_id: string
          contact_name?: string | null
          created_at?: string
          email?: string | null
          gpay_id?: string | null
          gst_number?: string | null
          id?: string
          name: string
          notes?: string | null
          phone?: string | null
          remarks?: string | null
          total_business?: number | null
          total_orders?: number | null
          total_paid?: number | null
        }
        Update: {
          category?: string | null
          clinic_id?: string
          contact_name?: string | null
          created_at?: string
          email?: string | null
          gpay_id?: string | null
          gst_number?: string | null
          id?: string
          name?: string
          notes?: string | null
          phone?: string | null
          remarks?: string | null
          total_business?: number | null
          total_orders?: number | null
          total_paid?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "vendors_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_logs: {
        Row: {
          clinic_id: string
          created_at: string
          error_message: string | null
          id: string
          message_body: string | null
          patient_id: string
          phone: string | null
          sent_at: string
          status: string
          template_name: string
        }
        Insert: {
          clinic_id: string
          created_at?: string
          error_message?: string | null
          id?: string
          message_body?: string | null
          patient_id: string
          phone?: string | null
          sent_at?: string
          status?: string
          template_name: string
        }
        Update: {
          clinic_id?: string
          created_at?: string
          error_message?: string | null
          id?: string
          message_body?: string | null
          patient_id?: string
          phone?: string | null
          sent_at?: string
          status?: string
          template_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_logs_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_logs_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_templates: {
        Row: {
          clinic_id: string
          created_at: string
          enabled: boolean
          id: string
          message_body: string
          template_name: string
          template_type: string
          timing_offset_hours: number
          updated_at: string
        }
        Insert: {
          clinic_id: string
          created_at?: string
          enabled?: boolean
          id?: string
          message_body: string
          template_name: string
          template_type?: string
          timing_offset_hours?: number
          updated_at?: string
        }
        Update: {
          clinic_id?: string
          created_at?: string
          enabled?: boolean
          id?: string
          message_body?: string
          template_name?: string
          template_type?: string
          timing_offset_hours?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_templates_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      create_clinic_for_user: {
        Args: {
          p_address?: string
          p_email?: string
          p_name: string
          p_phone?: string
        }
        Returns: string
      }
      deduct_inventory: {
        Args: { p_item_id: string; p_quantity: number }
        Returns: undefined
      }
      get_next_token_number: {
        Args: { p_clinic_id: string; p_date: string }
        Returns: number
      }
      get_user_clinic_id: { Args: never; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user"
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
      app_role: ["admin", "moderator", "user"],
    },
  },
} as const
