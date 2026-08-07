'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import React, { useState, useEffect, Suspense } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ArrowRight, Loader2, Mail, Lock, Eye, EyeOff, ShieldCheck, Globe, Building2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/lib/supabase';
import Image from 'next/image';
import { useAuth } from '@/hooks/use-auth';
import { useAppTransition } from '@/contexts/AppTransitionContext';

function LoginForm() {
  const { user, loading } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const { startTransition } = useAppTransition();

  // Removed auto-redirect to dashboard when opening the link per user request

  useEffect(() => {
    if (searchParams.get('loggedOut')) {
      toast({ title: 'Logged Out', description: 'You have been successfully logged out.' });
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, [searchParams, toast, router]);

  const handleLogin = async () => {
    setIsLoading(true);
    try {
      const hour = new Date().getHours();
      const greeting = hour < 12 ? 'Good morning' : hour < 15 ? 'Good afternoon' : 'Good evening';

      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;
      if (!data.session) throw new Error('No session returned from login');

      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ access_token: data.session.access_token }),
      });

      if (!response.ok) {
         const errData = await response.json().catch(() => null);
         throw new Error(errData?.error || 'Failed to set session');
      }

      // Mark as a fresh active session in the current tab
      sessionStorage.setItem('is_logged_in', 'true');

      toast({ 
        title: `${greeting}!\nLogin Successful`, 
        description: 'Welcome back to D BIZ OFFICE.', 
        variant: 'success',
        duration: 60000
      });
      startTransition();
      router.push('/dashboard');
    } catch (error: any) {
      console.error(error);
      let description = 'Invalid credentials. Please try again.';
      if (error.message) {
        description = error.message;
      }
      toast({ title: 'Login Failed', description, variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="relative h-screen w-full flex items-center justify-center p-4 sm:p-6 overflow-hidden">

      {/* High-Resolution Architectural Background */}
      <div className="absolute inset-0 z-0">
        <Image
          src="https://images.unsplash.com/photo-1497215728101-856f4ea42174?auto=format&fit=crop&q=80&w=2000"
          alt="Office Background"
          fill
          className="object-cover"
          priority
        />
        {/* Complex Overlay: Dark gradient + Light tint */}
        <div className="absolute inset-0 bg-slate-950/40 backdrop-blur-[2px]" />
        <div className="absolute inset-0 bg-gradient-to-br from-blue-900/40 via-transparent to-slate-950/80" />
      </div>

      {/* Corporate Metadata (Top Right) */}
      <div className="absolute top-6 right-6 hidden lg:flex items-center gap-6 text-white/60">
        <div className="flex items-center gap-2">
          <Globe className="w-4 h-4" />
          <span className="text-[10px] font-bold uppercase tracking-widest">Global Network</span>
        </div>
        <div className="flex items-center gap-2">
          <Building2 className="w-4 h-4" />
          <span className="text-[10px] font-bold uppercase tracking-widest">Enterprise HQ</span>
        </div>
      </div>

      {/* Ultra-Glass Form Card */}
      <div className="relative z-10 w-full max-w-[440px] animate-in fade-in zoom-in-95 slide-in-from-bottom-10 duration-1000">

        {/* Decorative Ring behind card */}
        <div className="absolute -inset-0.5 bg-gradient-to-br from-white/20 via-transparent to-white/5 rounded-[3rem] blur-[1px] opacity-30" />

        <div className="bg-white/10 backdrop-blur-[40px] border border-white/20 p-8 sm:p-10 rounded-[3rem] shadow-[0_32px_64px_-16px_rgba(0,0,0,0.5)] flex flex-col items-center">

          {/* Logo Branding */}
          <div className="mb-6 text-center">
            <div className="inline-block relative group">
              <div className="absolute -inset-4 bg-blue-500/20 rounded-full blur-2xl opacity-0 group-hover:opacity-100 transition duration-1000" />
              <div className="w-24 h-24 rounded-[2rem] overflow-hidden shadow-2xl border border-white/30 transform hover:scale-110 transition-transform duration-500 relative bg-white/5">
                <Image src="/imgfav.png" alt="Logo" width={96} height={96} className="object-cover w-full h-full" priority />
              </div>
            </div>
            <h1 className="mt-4 text-2xl font-bold text-white tracking-tight">D BIZ OFFICE</h1>
            <p className="text-blue-300/80 text-[10px] font-black uppercase tracking-[0.4em] mt-1">Executive Portal</p>
          </div>

          <div className="w-full space-y-6">
            <div className="text-center">
              <h2 className="text-lg font-semibold text-white/90">Authentication Required</h2>
              <p className="text-slate-400 text-xs mt-1">Please enter your secure credentials.</p>
            </div>

            <form onSubmit={(e) => { e.preventDefault(); handleLogin(); }} className="space-y-4">
              <div className="space-y-3">
                {/* Email Input */}
                <div className="space-y-1">
                  <Label htmlFor="email" className="text-white/60 text-[10px] font-black uppercase tracking-widest ml-1">Work Email</Label>
                  <div className="relative">
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-white/30 pointer-events-none z-10" />
                    <Input
                      id="email"
                      type="email"
                      placeholder="admin@dbiz.com"
                      className="pl-12 h-12 bg-white/5 border-white/10 rounded-2xl focus:bg-white/10 focus:ring-4 focus:ring-blue-500/20 focus:border-white/30 transition-all font-medium text-white placeholder:text-white/20"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                    />
                  </div>
                </div>

                {/* Password Input */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between ml-1">
                    <Label htmlFor="password" className="text-white/60 text-[10px] font-black uppercase tracking-widest">Access Key</Label>
                    <Link href="#" className="text-[10px] font-black text-blue-400 hover:text-blue-300 uppercase tracking-widest transition-colors">Recover</Link>
                  </div>
                  <div className="relative">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-white/30 pointer-events-none z-10" />
                    <Input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="••••••••"
                      className="pl-12 pr-12 h-12 bg-white/5 border-white/10 rounded-2xl focus:bg-white/10 focus:ring-4 focus:ring-blue-500/20 focus:border-white/30 transition-all font-medium text-white placeholder:text-white/20"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-white/30 hover:text-white transition-colors focus:outline-none z-20"
                    >
                      {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                    </button>
                  </div>
                </div>
              </div>

              <Button 
                type="submit" 
                className="w-full h-12 text-base font-bold bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg hover:shadow-primary/25 transition-all duration-300 rounded-xl"
                disabled={isLoading}
              >
                {isLoading ? (
                  <div className="flex items-center gap-2">
                    <Loader2 className="h-5 w-5 animate-spin" />
                    <span>Signing In...</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <span>Login</span> <ArrowRight className="h-5 w-5" />
                  </div>
                )}
              </Button>
            </form>
          </div>

          {/* Trust Indicators */}
          <div className="mt-8 w-full pt-6 border-t border-white/10 flex flex-col items-center gap-4">
            <div className="flex items-center gap-6">
              <ShieldCheck className="w-5 h-5 text-white/20" />
              <div className="w-[1px] h-3 bg-white/10" />
              <div className="flex items-center gap-2 text-white/40">
                <span className="text-[10px] font-black uppercase tracking-widest">Secure session management active</span>
              </div>
            </div>
            <p className="text-[10px] text-white/20 font-medium uppercase tracking-[0.2em]">© {new Date().getFullYear()} D BIZ Global Core</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="flex h-screen w-full items-center justify-center bg-slate-950">
        <Loader2 className="h-10 w-10 animate-spin text-white/20" />
      </div>
    }>
      <LoginForm />
    </Suspense>
  );
}
