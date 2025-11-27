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
    
    // Create email from username for Supabase Auth
    const email = `${username.toLowerCase()}@tivoo.internal`;

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

    // Create Supabase Auth user first
    const { data: authData, error: authError } = await supabaseClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

    if (authError) {
      console.error("Auth creation error:", authError);
      return new Response(
        JSON.stringify({
          success: false,
          error: "حدث خطأ في إنشاء الحساب",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create profile with auth user id
    const { data: newUser, error: insertError } = await supabaseClient
      .from("profiles")
      .insert({
        id: authData.user.id,
        username: username.toLowerCase(),
        password_hash: passwordHash,
        display_name: displayName || username,
      })
      .select()
      .single();

    if (insertError) {
      // If profile creation fails, delete auth user
      await supabaseClient.auth.admin.deleteUser(authData.user.id);
      throw insertError;
    }

    // Create default user role
    await supabaseClient.from("user_roles").insert({
      user_id: newUser.id,
      role: "user",
    });

    // Sign in to create session
    const { data: sessionData, error: signInError } = await supabaseClient.auth.signInWithPassword({
      email,
      password,
    });

    if (signInError) {
      console.error("Sign in error:", signInError);
    }

    return new Response(
      JSON.stringify({
        success: true,
        user: newUser,
        session: sessionData?.session || null,
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
