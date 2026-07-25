'use client';

import { SheetAiAnalysisResult } from '@/lib/claude-engine';
import { AlertCircle, Bot, CheckCircle2, FileCheck, Layers, Sparkles, X } from 'lucide-react';
import React from 'react';

interface AiAnalysisModalProps {
  isOpen: boolean;
  onClose: () => void;
  analysis: SheetAiAnalysisResult | null;
  totalCandidates: number;
}

export const AiAnalysisModal: React.FC<AiAnalysisModalProps> = ({
  isOpen,
  onClose,
  analysis,
  totalCandidates,
}) => {
  if (!isOpen || !analysis) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fadeIn">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-3xl w-full overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-6 border-b border-slate-800 bg-slate-950/60 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-teal-500/10 border border-teal-500/20 rounded-2xl text-teal-400">
              <Bot className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-[10px] font-bold uppercase tracking-widest text-teal-400 bg-teal-500/10 px-2 py-0.5 rounded-full border border-teal-500/20 flex items-center gap-1">
                  <Sparkles className="h-3 w-3" /> Anthropic Claude AI Engine
                </span>
              </div>
              <h3 className="text-xl font-extrabold text-white mt-0.5">
                Rapport d'Analyse IA du Fichier EDOF
              </h3>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-slate-200">
          {/* Executive Summary Card */}
          <div className="bg-gradient-to-r from-slate-950 to-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-teal-400" /> Synthèse Exécutive IA
              </h4>
              <div className="flex items-center space-x-2 bg-slate-800/80 px-3 py-1 rounded-full border border-slate-700">
                <span className="text-xs text-slate-400 font-medium">Score Qualité Données:</span>
                <span className="text-xs font-bold text-teal-400">{analysis.qualityScore}%</span>
              </div>
            </div>
            <p className="text-xs leading-relaxed text-slate-300">
              {analysis.executiveSummary}
            </p>
          </div>

          {/* Dual Generation Mode Breakdown */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Classique Card */}
            <div className="bg-slate-950/60 border border-emerald-500/20 rounded-2xl p-4">
              <div className="flex items-center space-x-2 mb-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                <h5 className="text-xs font-bold text-emerald-300 uppercase tracking-wide">
                  Prêt Génération Classique
                </h5>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">
                {analysis.classiqueReadinessSummary}
              </p>
            </div>

            {/* WeDOF Card */}
            <div className="bg-slate-950/60 border border-indigo-500/20 rounded-2xl p-4">
              <div className="flex items-center space-x-2 mb-2">
                <FileCheck className="h-4 w-4 text-indigo-400" />
                <h5 className="text-xs font-bold text-indigo-300 uppercase tracking-wide">
                  Prêt Génération WeDOF
                </h5>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">
                {analysis.wedofReadinessSummary}
              </p>
            </div>
          </div>

          {/* Audit Documents Incomplets */}
          <div className="bg-slate-950/40 border border-slate-800 rounded-2xl p-5">
            <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-3 flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-amber-400" /> Audit des Pièces & Justificatifs Manquants
            </h4>
            <div className="grid grid-cols-3 gap-3 mb-3 text-center">
              <div className="bg-slate-900/80 p-3 rounded-xl border border-slate-800">
                <div className="text-lg font-bold text-amber-400">
                  {analysis.documentAudit.missingCinCount}
                </div>
                <div className="text-[10px] text-slate-400 mt-0.5">CIN non validée</div>
              </div>
              <div className="bg-slate-900/80 p-3 rounded-xl border border-slate-800">
                <div className="text-lg font-bold text-amber-400">
                  {analysis.documentAudit.missingCvCount}
                </div>
                <div className="text-[10px] text-slate-400 mt-0.5">CV manquant</div>
              </div>
              <div className="bg-slate-900/80 p-3 rounded-xl border border-slate-800">
                <div className="text-lg font-bold text-amber-400">
                  {analysis.documentAudit.missingDatesCount}
                </div>
                <div className="text-[10px] text-slate-400 mt-0.5">Dates incomplètes</div>
              </div>
            </div>
            <p className="text-xs text-slate-400 italic">
              {analysis.documentAudit.notes}
            </p>
          </div>

          {/* Recommendations List */}
          <div className="bg-teal-950/20 border border-teal-500/20 rounded-2xl p-5">
            <h4 className="text-xs font-bold text-teal-300 uppercase tracking-wider mb-3 flex items-center gap-2">
              <Layers className="h-4 w-4 text-teal-400" /> Recommandations Stratégiques Anthropic IA
            </h4>
            <ul className="space-y-2 text-xs text-slate-300">
              {analysis.recommendations.map((rec, index) => (
                <li key={index} className="flex items-start gap-2">
                  <span className="text-teal-400 font-bold">•</span>
                  <span>{rec}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Footer */}
        <div className="p-5 border-t border-slate-800 bg-slate-950/60 flex items-center justify-between">
          <span className="text-[11px] text-slate-500">
            Analyse générée en temps réel pour {totalCandidates} candidats par Anthropic Claude.
          </span>
          <button
            onClick={onClose}
            className="bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs px-5 py-2.5 rounded-xl border border-slate-700 transition-colors"
          >
            Fermer le Rapport
          </button>
        </div>
      </div>
    </div>
  );
};
