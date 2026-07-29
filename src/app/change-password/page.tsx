'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/use-auth';
import AuthGuard from '@/components/layout/auth-guard';
import { Shield, Key, Eye, EyeOff, Loader2, Check, X, AlertTriangle } from 'lucide-react';

export default function ChangePasswordPage() {
    return (
        <AuthGuard>
            <ChangePasswordForm />
        </AuthGuard>
    );
}

function ChangePasswordForm() {
    const { user } = useAuth();
    const router = useRouter();
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);

    // Validation checks
    const hasMinLength = password.length >= 8;
    const hasUppercase = /[A-Z]/.test(password);
    const hasLowercase = /[a-z]/.test(password);
    const hasNumber = /[0-9]/.test(password);
    const hasSpecial = /[^A-Za-z0-9]/.test(password);
    const passwordsMatch = password === confirmPassword && password.length > 0;

    const strengthScore = [
        hasMinLength,
        hasUppercase,
        hasLowercase,
        hasNumber,
        hasSpecial
    ].filter(Boolean).length;

    const getStrengthLabel = () => {
        if (password.length === 0) return { label: 'Empty', color: 'bg-muted text-muted-foreground' };
        if (strengthScore <= 2) return { label: 'Weak', color: 'bg-red-500 text-white' };
        if (strengthScore <= 4) return { label: 'Moderate', color: 'bg-amber-500 text-white' };
        return { label: 'Strong', color: 'bg-emerald-500 text-white' };
    };

    const isFormValid = hasMinLength && hasUppercase && hasLowercase && hasNumber && hasSpecial && passwordsMatch;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!isFormValid || !user) return;

        setLoading(true);
        setError(null);

        try {
            // 1. Update Supabase Auth Password
            const { error: authError } = await supabase.auth.updateUser({
                password: password
            });

            if (authError) throw authError;

            // 2. Set must_change_password to false in user_profiles
            const { error: profileError } = await supabase
                .from('user_profiles')
                .update({ must_change_password: false })
                .eq('uid', user.uid);

            if (profileError) throw profileError;

            // 3. Audit log (best-effort; do not block password change if RLS denies insert)
            try {
                await supabase.from('audit_logs').insert([{
                    action: 'PASSWORD_CHANGED',
                    performed_by: user.uid,
                    performed_by_name: user.email || 'User',
                    target_user_id: user.uid,
                    details: {
                        message: 'User changed password after temporary credential enforcement'
                    }
                }]);
            } catch {
                // Ignore audit insert failures (e.g., RLS restrictions)
            }

            setSuccess(true);
            
            // Redirect after 2 seconds
            setTimeout(() => {
                router.push('/dashboard');
            }, 2000);

        } catch (err: any) {
            console.error('Password change failed:', err);
            setError(err.message || 'Failed to update password. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="relative min-h-screen flex items-center justify-center bg-slate-950 overflow-hidden font-sans">
            {/* Ambient Background Glows */}
            <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-indigo-500/10 rounded-full blur-[100px] animate-pulse"></div>
            <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-violet-500/10 rounded-full blur-[100px] animate-pulse duration-5000"></div>

            <div className="relative w-full max-w-lg p-8 mx-4">
                {/* Visual Glassmorphic Container */}
                <div className="w-full bg-slate-900/60 backdrop-blur-xl border border-slate-800/80 rounded-2xl p-8 shadow-2xl">
                    <div className="flex flex-col items-center mb-8">
                        <div className="p-3 bg-gradient-to-tr from-indigo-500 to-violet-600 rounded-xl shadow-lg shadow-indigo-500/20 mb-4 animate-bounce duration-3000">
                            <Shield className="h-8 w-8 text-white" />
                        </div>
                        <h2 className="text-2xl font-bold tracking-tight text-white text-center">
                            Reset Temporary Password
                        </h2>
                        <p className="mt-2 text-sm text-slate-400 text-center max-w-sm">
                            Your account is currently using a temporary password. Please establish a secure new password to access the platform.
                        </p>
                    </div>

                    {success ? (
                        <div className="flex flex-col items-center justify-center py-6 text-center animate-fade-in">
                            <div className="h-16 w-16 bg-emerald-500/10 border border-emerald-500/20 rounded-full flex items-center justify-center text-emerald-400 mb-4">
                                <Check className="h-8 w-8" />
                            </div>
                            <h3 className="text-lg font-semibold text-white">Password Updated Successfully!</h3>
                            <p className="text-sm text-slate-400 mt-2">
                                Preparing your dashboard environment. Redirecting now...
                            </p>
                            <Loader2 className="h-6 w-6 text-indigo-400 animate-spin mt-6" />
                        </div>
                    ) : (
                        <form onSubmit={handleSubmit} className="space-y-6">
                            {error && (
                                <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg flex items-start gap-3 text-red-200 text-sm">
                                    <AlertTriangle className="h-5 w-5 text-red-400 shrink-0 mt-0.5" />
                                    <span>{error}</span>
                                </div>
                            )}

                            {/* Email Display */}
                            <div>
                                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                                    Account Email
                                </label>
                                <div className="w-full px-4 py-3 bg-slate-950/50 border border-slate-800 rounded-lg text-slate-400 text-sm flex items-center gap-3">
                                    <div className="w-2 h-2 rounded-full bg-indigo-500"></div>
                                    {user?.email}
                                </div>
                            </div>

                            {/* New Password */}
                            <div>
                                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                                    New Password
                                </label>
                                <div className="relative">
                                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                                        <Key className="h-4 w-4" />
                                    </div>
                                    <input
                                        type={showPassword ? 'text' : 'password'}
                                        required
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        placeholder="••••••••"
                                        className="w-full pl-10 pr-10 py-3 bg-slate-950/40 border border-slate-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-lg text-white text-sm outline-none transition-all placeholder:text-slate-600"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-500 hover:text-slate-300 transition-colors"
                                    >
                                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                    </button>
                                </div>

                                {/* Dynamic Strength Bar */}
                                {password.length > 0 && (
                                    <div className="mt-3 space-y-2">
                                        <div className="flex justify-between items-center text-xs">
                                            <span className="text-slate-400">Password Strength:</span>
                                            <span className={`px-2 py-0.5 rounded-full font-medium ${getStrengthLabel().color}`}>
                                                {getStrengthLabel().label}
                                            </span>
                                        </div>
                                        <div className="h-1 w-full bg-slate-800 rounded-full overflow-hidden">
                                            <div
                                                className={`h-full transition-all duration-300 ${
                                                    strengthScore <= 2
                                                        ? 'bg-red-500'
                                                        : strengthScore <= 4
                                                        ? 'bg-amber-500'
                                                        : 'bg-emerald-500'
                                                }`}
                                                style={{ width: `${(strengthScore / 5) * 100}%` }}
                                            ></div>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Confirm Password */}
                            <div>
                                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                                    Confirm New Password
                                </label>
                                <div className="relative">
                                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                                        <Key className="h-4 w-4" />
                                    </div>
                                    <input
                                        type={showPassword ? 'text' : 'password'}
                                        required
                                        value={confirmPassword}
                                        onChange={(e) => setConfirmPassword(e.target.value)}
                                        placeholder="••••••••"
                                        className="w-full pl-10 pr-4 py-3 bg-slate-950/40 border border-slate-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-lg text-white text-sm outline-none transition-all placeholder:text-slate-600"
                                    />
                                </div>
                            </div>

                            {/* Validation Indicators */}
                            <div className="p-4 bg-slate-950/30 border border-slate-800/60 rounded-xl space-y-2.5">
                                <div className="flex items-center gap-2.5 text-xs">
                                    {hasMinLength ? (
                                        <Check className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                                    ) : (
                                        <X className="h-3.5 w-3.5 text-slate-600 shrink-0" />
                                    )}
                                    <span className={hasMinLength ? 'text-slate-300' : 'text-slate-500'}>
                                        At least 8 characters long
                                    </span>
                                </div>
                                <div className="flex items-center gap-2.5 text-xs">
                                    {hasUppercase ? (
                                        <Check className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                                    ) : (
                                        <X className="h-3.5 w-3.5 text-slate-600 shrink-0" />
                                    )}
                                    <span className={hasUppercase ? 'text-slate-300' : 'text-slate-500'}>
                                        At least one uppercase letter (A-Z)
                                    </span>
                                </div>
                                <div className="flex items-center gap-2.5 text-xs">
                                    {hasLowercase ? (
                                        <Check className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                                    ) : (
                                        <X className="h-3.5 w-3.5 text-slate-600 shrink-0" />
                                    )}
                                    <span className={hasLowercase ? 'text-slate-300' : 'text-slate-500'}>
                                        At least one lowercase letter (a-z)
                                    </span>
                                </div>
                                <div className="flex items-center gap-2.5 text-xs">
                                    {hasNumber ? (
                                        <Check className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                                    ) : (
                                        <X className="h-3.5 w-3.5 text-slate-600 shrink-0" />
                                    )}
                                    <span className={hasNumber ? 'text-slate-300' : 'text-slate-500'}>
                                        At least one number (0-9)
                                    </span>
                                </div>
                                <div className="flex items-center gap-2.5 text-xs">
                                    {hasSpecial ? (
                                        <Check className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                                    ) : (
                                        <X className="h-3.5 w-3.5 text-slate-600 shrink-0" />
                                    )}
                                    <span className={hasSpecial ? 'text-slate-300' : 'text-slate-500'}>
                                        At least one special character (!@#$ etc.)
                                    </span>
                                </div>
                                <div className="h-px bg-slate-800/60 my-2"></div>
                                <div className="flex items-center gap-2.5 text-xs">
                                    {passwordsMatch ? (
                                        <Check className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                                    ) : (
                                        <X className="h-3.5 w-3.5 text-slate-600 shrink-0" />
                                    )}
                                    <span className={passwordsMatch ? 'text-slate-300' : 'text-slate-500'}>
                                        Passwords match exactly
                                    </span>
                                </div>
                            </div>

                            {/* Submit Button */}
                            <button
                                type="submit"
                                disabled={loading || !isFormValid}
                                className="w-full py-3 bg-gradient-to-r from-indigo-500 to-violet-600 hover:from-indigo-600 hover:to-violet-700 disabled:from-indigo-500/40 disabled:to-violet-600/40 text-white rounded-lg font-medium text-sm transition-all shadow-lg hover:shadow-indigo-500/20 shadow-indigo-500/5 disabled:shadow-none flex items-center justify-center gap-2"
                            >
                                {loading ? (
                                    <>
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                        Updating Security Profile...
                                    </>
                                ) : (
                                    'Update and Proceed'
                                )}
                            </button>
                        </form>
                    )}
                </div>
            </div>
        </div>
    );
}
