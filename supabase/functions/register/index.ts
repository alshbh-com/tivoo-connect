import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { username, password, displayName } = await req.json();

    // Validate username format
    const usernameRegex = /^[a-zA-Z0-9]+$/;
    if (!usernameRegex.test(username)) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "اسم المستخدم يجب أن يحتوي على حروف إنجليزية وأرقام فقط، بدون مسافات",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate password
    if (password.length < 8) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "كلمة المرور يجب أن تكون 8 أحرف على الأقل",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const hasLetters = /[a-zA-Z]/.test(password);
    const hasNumbers = /[0-9]/.test(password);
    if (!hasLetters || !hasNumbers) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "كلمة المرور يجب أن تحتوي على حروف إنجليزية وأرقام",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Check if username exists
    const { data: existingUser } = await supabaseClient
      .from("profiles")
      .select("username")
      .eq("username", username.toLowerCase())
      .single();

    if (existingUser) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "هذا اليوزر موجود بالفعل، يرجى اختيار اسم مستخدم آخر",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Hash password using Web Crypto API
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const passwordHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

    // Create profile
    const { data: newUser, error: insertError } = await supabaseClient
      .from("profiles")
      .insert({
        username: username.toLowerCase(),
        password_hash: passwordHash,
        display_name: displayName || username,
      })
      .select()
      .single();

    if (insertError) {
      throw insertError;
    }

    // Create default user role
    await supabaseClient.from("user_roles").insert({
      user_id: newUser.id,
      role: "user",
    });

    return new Response(
      JSON.stringify({
        success: true,
        user: newUser,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Registration error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: "حدث خطأ أثناء إنشاء الحساب",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
