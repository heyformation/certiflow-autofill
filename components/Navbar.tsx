'use client';

import { Key, Layers, LogOut, RefreshCw, Settings, Sparkles } from 'lucide-react';
import React from 'react';

interface NavbarProps {
  hasApiKey: boolean;
  onOpenSettings: () => void;
  onUploadClick: () => void;
  autoMode: boolean;
  onToggleAutoMode: () => void;
  onLogout?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  hasApiKey,
  onOpenSettings,
  onUploadClick,
  autoMode,
  onToggleAutoMode,
  onLogout,
}) => {
  return (
    <header className="sticky top-0 z-40 bg-slate-900/95 backdrop-blur border-b border-slate-800 text-white px-6 py-4 flex items-center justify-between shadow-xl">
      <div className="flex items-center space-x-3">
        <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-red-600 via-amber-600 to-teal-600 p-0.5 flex items-center justify-center shadow-lg">
          <div className="h-full w-full bg-slate-950 rounded-[10px] flex items-center justify-center">
            <Layers className="h-5 w-5 text-teal-400" />
          </div>
        </div>
        <div>
          <h1 className="font-bold text-lg leading-tight bg-clip-text text-transparent bg-gradient-to-r from-white via-slate-100 to-slate-400">
            CertiFlow AutoFill
          </h1>
          <p className="text-xs text-slate-400 font-medium">
            Proforma Institut & Proskills Institut — CréActifs Certifications
          </p>
        </div>
      </div>

      <div className="flex items-center space-x-4">
        {/* Auto Generation Toggle */}
        <button
          onClick={onToggleAutoMode}
          className={`flex items-center space-x-2 text-xs font-semibold px-3 py-1.5 rounded-full border transition-all ${
            autoMode
              ? 'bg-teal-500/10 text-teal-300 border-teal-500/30'
              : 'bg-slate-800 text-slate-400 border-slate-700'
          }`}
          title="Auto-génération dès la complétude atteinte"
        >
          <Sparkles className="h-3.5 w-3.5" />
          <span>Auto-mode: {autoMode ? 'ACTIF' : 'MANUEL'}</span>
        </button>

        {/* API Key Status Badge */}
        <div
          className={`flex items-center space-x-1.5 text-xs font-medium px-3 py-1.5 rounded-full border ${
            hasApiKey
              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
              : 'bg-amber-500/10 text-amber-300 border-amber-500/20'
          }`}
        >
          <Key className="h-3.5 w-3.5" />
          <span>{hasApiKey ? 'Claude API Connectée' : 'Mode Règles Simulation'}</span>
        </div>

        {/* Upload Excel Button */}
        <button
          onClick={onUploadClick}
          className="flex items-center space-x-2 bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-500 hover:to-emerald-500 text-white font-medium text-xs px-4 py-2 rounded-lg shadow-md transition-all active:scale-95"
        >
          <RefreshCw className="h-4 w-4" />
          <span>Importer EDOF.xlsx</span>
        </button>

        {/* Settings Button */}
        <button
          onClick={onOpenSettings}
          className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
          title="Paramètres API & Jury"
        >
          <Settings className="h-4 w-4" />
        </button>

        {/* Logout Button */}
        {onLogout && (
          <button
            onClick={onLogout}
            className="p-2 rounded-lg bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 transition-colors"
            title="Déconnexion"
          >
            <LogOut className="h-4 w-4" />
          </button>
        )}
      </div>
    </header>
  );
};
