export async function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!isConfiguredSupabaseUrl(url) || !isConfiguredSupabaseServiceKey(serviceKey)) return null;

  const { createClient } = await import("@supabase/supabase-js");
  const supabase = createClient(url, serviceKey, {
    auth: { persistSession: false }
  });

  // 测试Supabase连接，如果连接失败则返回null触发本地回退
  try {
    const { error } = await supabase.from("knowledge_documents").select("id").limit(1);
    if (error) {
      console.warn("Supabase连接测试失败，切换到本地模式:", error.message);
      return null;
    }
  } catch (error) {
    console.warn("Supabase连接异常，切换到本地模式:", error);
    return null;
  }

  return supabase;
}

function isConfiguredSupabaseUrl(value: string | undefined): value is string {
  if (!value || value.includes("your-project")) return false;

  try {
    const url = new URL(value);
    const isHostedSupabase = url.protocol === "https:" && url.hostname.endsWith(".supabase.co");
    const isLocalSupabase =
      url.protocol === "http:" && (url.hostname === "127.0.0.1" || url.hostname === "localhost");
    return isHostedSupabase || isLocalSupabase;
  } catch {
    return false;
  }
}

function isConfiguredSupabaseServiceKey(value: string | undefined): value is string {
  if (!value || value === "your-service-role-key") return false;
  return value.length > 20;
}
