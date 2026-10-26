/* Supabase connection settings.
   Find both values in your Supabase dashboard: Project Settings -> API.
   The anon (public) key is SAFE to ship in client code — your data is protected
   by the Row Level Security policies in supabase/schema.sql, not by hiding this key.
   NEVER put the service_role key here.

   Leave the placeholders as-is to run Psyche Core in its original offline,
   no-account mode. */
window.PSYCHE_CONFIG = {
  SUPABASE_URL: 'https://gxojovnqxjymyrfwpanj.supabase.co',
  SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd4b2pvdm5xeGp5bXlyZndwYW5qIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTIyNDkwMDYsImV4cCI6MjEwNzgyNTAwNn0.bc8ztwhN682tC8hGbpmIReHIIT859r-9uBRc2Vzmtig'
};
