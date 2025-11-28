import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { create } from "https://deno.land/x/djwt@v2.8/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { username, password } = await req.json();
    
    // Create email from username for Supabase Auth
    const email = `${username.toLowerCase()}@tivoo.internal`;

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Get user IP
    const ipAddress = req.headers.get("x-forwarded-for") || "unknown";

    // Check failed login attempts in last 24 hours
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data: attempts } = await supabaseClient
      .from("login_attempts")
      .select("*")
      .eq("username", username.toLowerCase())
      .gte("attempt_time", oneDayAgo);

    if (attempts && attempts.length >= 7) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "تم تجاوز عدد المحاولات المسموح بها. الحساب مقفل مؤقتاً لمدة 24 ساعة",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get user
    const { data: user, error: userError } = await supabaseClient
      .from("profiles")
      .select("*")
      .eq("username", username.toLowerCase())
      .single();

    if (userError || !user) {
      // Log failed attempt
      await supabaseClient.from("login_attempts").insert({
        username: username.toLowerCase(),
        ip_address: ipAddress,
      });

      return new Response(
        JSON.stringify({
          success: false,
          error: "هذا اليوزر غير موجود — هل تريد إنشاء حساب جديد؟",
          userNotFound: true,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if banned
    if (user.is_banned) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "هذا الحساب محظور. يرجى التواصل مع الدعم",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify password using Web Crypto API
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const passwordHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    
    const passwordMatch = passwordHash === user.password_hash;

    if (!passwordMatch) {
      // Log failed attempt
      await supabaseClient.from("login_attempts").insert({
        username: username.toLowerCase(),
        ip_address: ipAddress,
      });

      return new Response(
        JSON.stringify({
          success: false,
          error: "كلمة المرور غير صحيحة",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Update or create Supabase Auth user
    const { data: existingUsers } = await supabaseClient.auth.admin.listUsers();
    const existingAuthUser = existingUsers?.users?.find(u => u.email === email);
    
    if (existingAuthUser) {
      // Update existing auth user's password
      await supabaseClient.auth.admin.updateUserById(existingAuthUser.id, {
        password: password,
        email_confirm: true,
      });
    } else {
      // Create new auth user
      await supabaseClient.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { username: username.toLowerCase() },
      });
    }

    // Sign in to get a real session
    const { data: authData, error: signInError } = await supabaseClient.auth.signInWithPassword({
      email,
      password,
    });

    if (signInError) {
      console.error("Sign in error:", signInError);
    }

    // Update last seen
    await supabaseClient
      .from("profiles")
      .update({ last_seen: new Date().toISOString() })
      .eq("id", user.id);

    // Clear old login attempts
    await supabaseClient
      .from("login_attempts")
      .delete()
      .eq("username", username.toLowerCase());

    return new Response(
      JSON.stringify({
        success: true,
        user: user,
        session: authData?.session || null,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Login error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: "حدث خطأ أثناء تسجيل الدخول",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
