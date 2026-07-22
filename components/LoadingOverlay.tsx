'use client';

import { Bot, CloudUpload, Download, FileSpreadsheet, Loader2, Sparkles } from 'lucide-react';
import React from 'react';

export type LoadingType = 'UPLOAD' | 'GENERATE' | 'DOWNLOAD' | 'DRIVE_SYNC' | null;

interface LoadingOverlayProps {
  isOpen: boolean;
  type: LoadingType;
  message?: string;
  subMessage?: string;
}

export const LoadingOverlay: React.FC<LoadingOverlayProps> = ({
  isOpen,
  type,
  message,
  subMessage,
}) => {
  if (!isOpen || !type) return null;

  const getIcon = () => {
    switch (type) {
      case 'UPLOAD':
        return <FileSpreadsheet className="h-8 w-8 text-teal-400 animate-pulse" />;
      case 'GENERATE':
        return <Sparkles className="h-8 w-8 text-teal-400 animate-spin" />;
      case 'DOWNLOAD':
        return <Download className="h-8 w-8 text-emerald-400 animate-bounce" />;
      case 'DRIVE_SYNC':
        return <CloudUpload className="h-8 w-8 text-blue-400 animate-pulse" />;
      default:
        return <Loader2 className="h-8 w-8 text-teal-400 animate-spin" />;
    }
  };

  const getDefaultTitle = () => {
    switch (type) {
      case 'UPLOAD':
        return "Analyse et Extraction d'EDOF.xlsx";
      case 'GENERATE':
        return "Génération IA & Remplissage Word (.DOCX)";
      case 'DOWNLOAD':
        return "Préparation du Package ZIP";
      case 'DRIVE_SYNC':
        return "Synchronisation Google Drive";
      default:
        return "Traitement en cours...";
    }
  };

  const getDefaultSubMessage = () => {
    switch (type) {
      case 'UPLOAD':
        return "Extraction automatique des données candidats depuis l'onglet AUTOMATISATION...";
      case 'GENERATE':
        return "Claude AI évalue le parcours du candidat et complète les 11 modèles Word (.DOCX)...";
      case 'DOWNLOAD':
        return "Compression et organisation des dossiers de certification...";
      case 'DRIVE_SYNC':
        return "Envoi direct des fichiers vers votre Shared Drive Google Workspace...";
      default:
        return "Veuillez patienter pendant l'exécution du traitement...";
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4 transition-all">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-md w-full p-8 shadow-2xl flex flex-col items-center justify-center text-center relative overflow-hidden">
        {/* Animated background glow */}
        <div className="absolute -top-24 -left-24 w-48 h-48 bg-teal-500/10 rounded-full blur-3xl pointer-events-none"></div>
        <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none"></div>

        {/* Icon & Loader */}
        <div className="relative mb-6">
          <div className="w-20 h-20 bg-slate-950 border border-slate-800 rounded-2xl flex items-center justify-center shadow-inner relative">
            {getIcon()}
          </div>
          <div className="absolute -bottom-2 -right-2 bg-teal-500 p-1.5 rounded-full text-slate-950 shadow-md">
            <Loader2 className="h-4 w-4 animate-spin" />
          </div>
        </div>

        {/* Status Messages */}
        <h3 className="text-lg font-bold text-white mb-2 leading-snug">
          {message || getDefaultTitle()}
        </h3>
        <p className="text-xs text-slate-400 leading-relaxed max-w-xs mb-6">
          {subMessage || getDefaultSubMessage()}
        </p>

        {/* Progress Badge */}
        <div className="bg-slate-950 border border-slate-800/80 px-4 py-2 rounded-xl flex items-center space-x-2 text-[11px] text-teal-400 font-medium">
          <Bot className="h-3.5 w-3.5 text-teal-400" />
          <span>Traitement automatique actif</span>
        </div>
      </div>
    </div>
  );
};
