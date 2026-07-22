'use client';

import { Bot, Eye, EyeOff, KeyRound, Lock, ShieldCheck, Sparkles, User } from 'lucide-react';
import React, { useState } from 'react';

interface LoginPageProps {
  onLoginSuccess: () => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onLoginSuccess }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setIsSubmitting(true);

    setTimeout(() => {
      if (username.trim() === 'admin' && password === 'Certiflow@2026') {
        localStorage.setItem('certiflow_auth', 'true');
        onLoginSuccess();
      } else {
        setErrorMsg('Identifiant ou mot de passe incorrect.');
        setIsSubmitting(false);
      }
    }, 400);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4 relative overflow-hidden font-sans">
      {/* Dynamic Background Glow & Gradient Circles */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-teal-500/10 rounded-full blur-[120px] pointer-events-none"></div>
      <div className="absolute bottom-10 right-10 w-96 h-96 bg-emerald-500/10 rounded-full blur-[100px] pointer-events-none"></div>

      <div className="max-w-md w-full relative z-10">
        {/* Logo & Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-tr from-teal-500 to-emerald-400 rounded-2xl shadow-xl shadow-teal-500/20 mb-4 ring-8 ring-teal-500/10">
            <Bot className="h-8 w-8 text-slate-950" />
          </div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight flex items-center justify-center gap-2">
            CertiFlow <span className="text-teal-400 font-medium text-lg">AutoFill</span>
          </h1>
          <p className="text-xs text-slate-400 mt-2">
            Plateforme Automatisée de Génération des Dossiers de Certification
          </p>
          <div className="mt-3 inline-flex items-center gap-1.5 text-[11px] text-teal-400/90 bg-teal-500/10 border border-teal-500/20 px-3 py-1 rounded-full">
            <ShieldCheck className="h-3.5 w-3.5" />
            <span>Proforma Institut & Proskills Institut</span>
          </div>
        </div>

        {/* Login Card */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-8 shadow-2xl backdrop-blur-xl relative">
          <form onSubmit={handleSubmit} className="space-y-5">
            {errorMsg && (
              <div className="bg-red-500/10 border border-red-500/30 text-red-300 text-xs px-4 py-3 rounded-xl flex items-center space-x-2 animate-shake">
                <span className="font-semibold">{errorMsg}</span>
              </div>
            )}

            {/* Username Input */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5 uppercase tracking-wider">
                Identifiant (ID)
              </label>
              <div className="relative">
                <User className="absolute left-3.5 top-3 h-4 w-4 text-slate-500" />
                <input
                  type="text"
                  required
                  placeholder="admin"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 text-slate-100 text-sm rounded-xl pl-10 pr-4 py-2.5 focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500 transition-all placeholder:text-slate-600"
                />
              </div>
            </div>

            {/* Password Input */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5 uppercase tracking-wider">
                Mot de passe
              </label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-3 h-4 w-4 text-slate-500" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  placeholder="••••••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 text-slate-100 text-sm rounded-xl pl-10 pr-10 py-2.5 focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500 transition-all placeholder:text-slate-600"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-3 text-slate-500 hover:text-slate-300 transition-colors"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {/* Credentials Hint Card */}
            <div className="bg-slate-950/80 border border-slate-800/80 rounded-xl p-3 text-[11px] text-slate-400 flex items-center justify-between">
              <span className="text-slate-400 font-medium">Identifiants d'accès :</span>
              <code className="bg-slate-900 border border-slate-800 text-teal-300 px-2 py-0.5 rounded font-mono font-bold">
                admin / Certiflow@2026
              </code>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-400 hover:to-emerald-400 text-slate-950 font-bold text-sm py-3 rounded-xl shadow-lg shadow-teal-500/20 transition-all active:scale-[0.99] disabled:opacity-50 flex items-center justify-center space-x-2"
            >
              <KeyRound className="h-4 w-4" />
              <span>{isSubmitting ? 'Connexion en cours...' : 'Se Connecter au Dashboard'}</span>
            </button>
          </form>
        </div>

        {/* Footer info */}
        <p className="text-center text-[11px] text-slate-500 mt-6">
          CertiFlow AutoFill V1.0 — Accès sécurisé Administrateur
        </p>
      </div>
    </div>
  );
};
