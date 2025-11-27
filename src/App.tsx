import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import Auth from "./pages/Auth";
import Chats from "./pages/Chats";
import Profile from "./pages/Profile";
import UserProfile from "./pages/UserProfile";
import UserSearch from "./pages/UserSearch";
import Chat from "./pages/Chat";
import Stories from "./pages/Stories";
import Posts from "./pages/Posts";
import Admin from "./pages/Admin";
import Banned from "./pages/Banned";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <AuthProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Chats />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/profile/:id" element={<UserProfile />} />
            <Route path="/search" element={<UserSearch />} />
            <Route path="/chat/:id" element={<Chat />} />
            <Route path="/stories" element={<Stories />} />
            <Route path="/posts" element={<Posts />} />
            <Route path="/admin" element={<Admin />} />
            <Route path="/banned" element={<Banned />} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
