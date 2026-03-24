// apiClient.js — Supabase + Groq powered API client for Homie
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// ─── AUTH ─────────────────────────────────────────────────────────────────────
const auth = {
  me: async () => {
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) throw new Error('Not authenticated');
    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();
    return { ...user, ...profile, id: user.id, email: user.email };
  },

  isAuthenticated: async () => {
    const { data: { session } } = await supabase.auth.getSession();
    return !!session;
  },

  redirectToLogin: (opts = {}) => {
    const next = typeof opts === 'string' ? opts : (opts?.next || '/');
    window.location.href = `/login?next=${encodeURIComponent(next)}`;
  },

  logout: async () => {
    await supabase.auth.signOut();
    window.location.href = '/';
  },

  updateMe: async (updates) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');
    const { error } = await supabase
      .from('profiles')
      .upsert({ id: user.id, ...updates });
    if (error) throw error;
  },
};

// ─── ENTITIES ─────────────────────────────────────────────────────────────────
const TABLE_MAP = {
  PropertyListing:  'listings',
  LifestyleProfile: 'lifestyle_profiles',
  Match:            'matches',
  Swipe:            'swipes',
  ChatMessage:      'chat_messages',
  PropertyNote:     'property_notes',
};

function makeEntity(tableName) {
  return {
    filter: async (filters = {}) => {
      let query = supabase.from(tableName).select('*');
      Object.entries(filters).forEach(([k, v]) => { query = query.eq(k, v); });
      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
    create: async (data) => {
      const { data: created, error } = await supabase.from(tableName).insert(data).select().single();
      if (error) throw error;
      return created;
    },
    update: async (id, data) => {
      const { data: updated, error } = await supabase.from(tableName).update(data).eq('id', id).select().single();
      if (error) throw error;
      return updated;
    },
    delete: async (id) => {
      const { error } = await supabase.from(tableName).delete().eq('id', id);
      if (error) throw error;
    },
  };
}

const entities = Object.fromEntries(
  Object.entries(TABLE_MAP).map(([name, table]) => [name, makeEntity(table)])
);

// ─── INTEGRATIONS ─────────────────────────────────────────────────────────────
const integrations = {
  Core: {
    InvokeLLM: async ({ prompt, messages = [] }) => {
      const res = await fetch("/api/wingman", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, messages }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "LLM error");
      return data.reply;
    },
    UploadFile: async ({ file }) => {
      const fileName = `${Date.now()}-${file.name}`;
      const { error } = await supabase.storage.from('uploads').upload(fileName, file);
      if (error) throw error;
      const { data: { publicUrl } } = supabase.storage.from('uploads').getPublicUrl(fileName);
      return { file_url: publicUrl };
    },
  },
};

// ─── FUNCTIONS ────────────────────────────────────────────────────────────────
const functions = {
  invoke: async (fnName, params) => {
    const res = await fetch(`/api/functions/${fnName}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Function error');
    return data;
  },
};

// ─── EXPORT ───────────────────────────────────────────────────────────────────
export const api = { auth, entities, integrations, functions };
