import React, { useState } from 'react';
import { supabase } from '@/api/base44Client';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const next = searchParams.get('next') || '/';

  const handleSubmit = async () => {
    setLoading(true);
    try {
      if (isSignUp) {
        const { error } = await supabase.auth.signUp({
          email, password,
          options: { data: { full_name: fullName } }
        });
        if (error) throw error;
        toast.success('Account created! Please check your email to verify.');
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        navigate(next);
      }
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}${next}` }
    });
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
      <div className="w-full max-w-sm bg-white rounded-2xl p-8 border border-slate-200 shadow-sm">
        <div className="flex items-center gap-2 mb-8">
          <div className="w-8 h-8 rounded-xl bg-orange-600 flex items-center justify-center">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path d="M3 10.5L12 3L21 10.5V21H15V15H9V21H3V10.5Z" fill="white"/>
            </svg>
          </div>
          <span className="font-bold text-xl text-slate-900">Homie</span>
        </div>

        <h2 className="text-xl font-bold text-slate-900 mb-1">{isSignUp ? 'Create account' : 'Welcome back'}</h2>
        <p className="text-sm text-slate-500 mb-6">{isSignUp ? 'Start finding your perfect home' : 'Sign in to continue'}</p>

        <div className="space-y-4">
          {isSignUp && (
            <div>
              <Label className="text-slate-700 text-sm mb-1.5 block">Full Name</Label>
              <Input value={fullName} onChange={e => setFullName(e.target.value)}
                placeholder="Your name" className="border-slate-200" />
            </div>
          )}
          <div>
            <Label className="text-slate-700 text-sm mb-1.5 block">Email</Label>
            <Input value={email} onChange={e => setEmail(e.target.value)}
              type="email" placeholder="you@email.com" className="border-slate-200" />
          </div>
          <div>
            <Label className="text-slate-700 text-sm mb-1.5 block">Password</Label>
            <Input value={password} onChange={e => setPassword(e.target.value)}
              type="password" placeholder="••••••••" className="border-slate-200"
              onKeyDown={e => e.key === 'Enter' && handleSubmit()} />
          </div>
        </div>

        <Button onClick={handleSubmit} disabled={loading}
          className="w-full mt-6 bg-orange-600 hover:bg-orange-500 h-11 font-semibold">
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : isSignUp ? 'Create Account' : 'Sign In'}
        </Button>

        <div className="relative my-4">
          <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-200" /></div>
          <div className="relative flex justify-center"><span className="bg-white px-3 text-xs text-slate-400">or</span></div>
        </div>

        <Button onClick={handleGoogle} variant="outline"
          className="w-full border-slate-200 text-slate-700 hover:bg-slate-50 h-11">
          Continue with Google
        </Button>

        <p className="text-center text-sm text-slate-500 mt-5">
          {isSignUp ? 'Already have an account?' : "Don't have an account?"}{' '}
          <button onClick={() => setIsSignUp(!isSignUp)} className="text-orange-600 hover:text-orange-500 font-medium">
            {isSignUp ? 'Sign in' : 'Sign up'}
          </button>
        </p>
      </div>
    </div>
  );
}
