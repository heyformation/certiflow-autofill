'use client';

import { CandidateEvaluationResult, CandidateRow } from '@/lib/types';
import { Award, CheckCircle2, CloudUpload, Download, Loader2, X } from 'lucide-react';
import React, { useState } from 'react';

interface EvaluationPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  candidate: CandidateRow | null;
  evalResult: CandidateEvaluationResult | null;
  producedCount: number;
  onDownloadPackage: () => void;
  onSyncDrive?: () => void;
}

export const EvaluationPreviewModal: React.FC<EvaluationPreviewModalProps> = ({
  isOpen,
  onClose,
  candidate,
  evalResult,
  producedCount,
  onDownloadPackage,
  onSyncDrive,
}) => {
  const [isSyncingDrive, setIsSyncingDrive] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  if (!isOpen || !candidate || !evalResult) return null;

  const handleDriveSyncClick = async () => {
    if (!onSyncDrive || isSyncingDrive) return;
    setIsSyncingDrive(true);
    try {
      await onSyncDrive();
    } finally {
      setIsSyncingDrive(false);
    }
  };

  const handleDownloadClick = async () => {
    if (isDownloading) return;
    setIsDownloading(true);
    try {
      await onDownloadPackage();
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-3xl w-full p-6 shadow-2xl relative max-h-[90vh] overflow-y-auto">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="flex items-center space-x-3 mb-4">
          <div className="p-3 bg-emerald-500/10 rounded-xl text-emerald-400">
            <CheckCircle2 className="h-6 w-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white leading-tight">
              Génération Réussie — {candidate.prenom} {candidate.nom}
            </h2>
            <p className="text-xs text-slate-400">
              {candidate.organisme} — {candidate.code_certif} ({candidate.formation})
            </p>
          </div>
        </div>

        {/* Scores Summary Banner */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-6">
          <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 text-center">
            <p className="text-[11px] text-slate-400 font-medium">Test Positionnement</p>
            <p className="text-xl font-bold text-blue-400 mt-0.5">
              {evalResult.testPositionnement.totalScore} / 20
            </p>
            <p className="text-[10px] text-slate-500">{evalResult.testPositionnement.scorePercentage}% de réussite</p>
          </div>

          <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 text-center">
            <p className="text-[11px] text-slate-400 font-medium">Grille d'Évaluation</p>
            <p className="text-xl font-bold text-teal-400 mt-0.5">
              {evalResult.grilleEvaluation.totalScore60} / 60
            </p>
            <p className="text-[10px] text-slate-500">
              Converti: {evalResult.grilleEvaluation.convertedScore20} / 20
            </p>
          </div>

          <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 text-center">
            <p className="text-[11px] text-slate-400 font-medium">Mention PV de Jury</p>
            <div className="flex items-center justify-center space-x-1 mt-0.5">
              <Award className="h-5 w-5 text-emerald-400" />
              <span className="text-xl font-bold text-emerald-400">ADMIS</span>
            </div>
            <p className="text-[10px] text-emerald-500/80 font-medium">100% Réussite Garantie</p>
          </div>
        </div>

        {/* Theme Correlation Breakdown */}
        <div className="mb-6">
          <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
            Profil Thématique Corrélation IA (Échelle 1–5)
          </h3>
          <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-3">
            {evalResult.themeProfiles.map((t) => (
              <div key={t.themeId} className="text-xs">
                <div className="flex justify-between text-slate-200 font-medium mb-1">
                  <span>{t.themeTitle}</span>
                  <span className="text-teal-400 font-bold">{t.level} / 5</span>
                </div>
                <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                  <div
                    className="bg-gradient-to-r from-teal-500 to-emerald-400 h-full rounded-full transition-all"
                    style={{ width: `${(t.level / 5) * 100}%` }}
                  ></div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Action Buttons: Instant Download & Google Drive Sync */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t border-slate-800">
          <span className="text-xs text-slate-400 font-medium">
            {producedCount} documents générés prêts
          </span>
          <div className="flex items-center space-x-3">
            {onSyncDrive && (
              <button
                onClick={handleDriveSyncClick}
                disabled={isSyncingDrive || isDownloading}
                className="flex items-center space-x-2 bg-slate-800 hover:bg-slate-700 text-teal-300 font-semibold text-xs px-4 py-2.5 rounded-xl border border-slate-700 transition-all active:scale-95 disabled:opacity-50"
              >
                {isSyncingDrive ? (
                  <Loader2 className="h-4 w-4 text-teal-400 animate-spin" />
                ) : (
                  <CloudUpload className="h-4 w-4 text-teal-400" />
                )}
                <span>{isSyncingDrive ? 'Synchro Drive...' : 'Envoyer vers Google Drive'}</span>
              </button>
            )}

            <button
              onClick={handleDownloadClick}
              disabled={isDownloading || isSyncingDrive}
              className="flex items-center space-x-2 bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-500 hover:to-emerald-500 text-white font-bold text-xs px-5 py-2.5 rounded-xl shadow-lg transition-all active:scale-95 disabled:opacity-50"
            >
              {isDownloading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Download className="h-4 w-4" />
              )}
              <span>{isDownloading ? 'Téléchargement...' : 'Télécharger (.ZIP)'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
