'use client';

import { CandidateTable } from '@/components/CandidateTable';
import { EvaluationPreviewModal } from '@/components/EvaluationPreviewModal';
import { LoadingOverlay, LoadingType } from '@/components/LoadingOverlay';
import { LoginPage } from '@/components/LoginPage';
import { Navbar } from '@/components/Navbar';
import { SettingsModal } from '@/components/SettingsModal';
import { StatsCard } from '@/components/StatsCard';
import { CandidateEvaluationResult, CandidateRow } from '@/lib/types';
import { Bot, FileSpreadsheet, FileUp, Sparkles, UploadCloud } from 'lucide-react';
import React, { useEffect, useRef, useState } from 'react';

export default function DashboardPage() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [isAuthChecked, setIsAuthChecked] = useState<boolean>(false);

  // Candidates state
  const [candidates, setCandidates] = useState<CandidateRow[]>([]);
  const [apiKey, setApiKey] = useState<string>('');
  const [isAutoConnected, setIsAutoConnected] = useState<boolean>(false);
  const [autoMode, setAutoMode] = useState<boolean>(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [isUploading, setIsUploading] = useState<boolean>(false);

  // Background Loading Overlay State
  const [loadingState, setLoadingState] = useState<{
    isOpen: boolean;
    type: LoadingType;
    message?: string;
    subMessage?: string;
  }>({
    isOpen: false,
    type: null,
  });

  // Preview Modal state
  const [previewCandidate, setPreviewCandidate] = useState<CandidateRow | null>(null);
  const [previewEvalResult, setPreviewEvalResult] = useState<CandidateEvaluationResult | null>(null);
  const [producedCount, setProducedCount] = useState<number>(0);
  const [isPreviewOpen, setIsPreviewOpen] = useState<boolean>(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Check login session & auto-connect Claude API key on initial mount
  useEffect(() => {
    const authStatus = localStorage.getItem('certiflow_auth');
    if (authStatus === 'true') {
      setIsAuthenticated(true);
    }
    setIsAuthChecked(true);

    fetch('/api/settings')
      .then((res) => res.json())
      .then((data) => {
        if (data.hasEnvKey) {
          setIsAutoConnected(true);
        }
      })
      .catch(() => {});
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('certiflow_auth');
    setIsAuthenticated(false);
  };

  // Toggle GENERER_MAINTENANT checkbox
  const handleToggleGenererMaintenant = (id: string) => {
    setCandidates((prev) =>
      prev.map((c) => (c.id === id ? { ...c, generer_maintenant: !c.generer_maintenant } : c))
    );
  };

  // Upload EDOF.xlsx
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setLoadingState({
      isOpen: true,
      type: 'UPLOAD',
      message: `Analyse de ${file.name} en cours...`,
      subMessage: 'Extraction et consolidation des données depuis l’onglet AUTOMATISATION...',
    });

    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      const text = await res.text();
      const data = text ? JSON.parse(text) : {};

      if (res.ok && data.candidates) {
        setCandidates(data.candidates);
      } else {
        alert(data.error || 'Erreur lors de l’analyse du fichier EDOF.xlsx');
      }
    } catch (err: any) {
      alert('Échec de la connexion lors de l’envoi du fichier.');
    } finally {
      setIsUploading(false);
      setLoadingState({ isOpen: false, type: null });
    }
  };

  // Generate single candidate document package
  const handleGenerateCandidate = async (candidate: CandidateRow) => {
    setIsGenerating(true);
    setLoadingState({
      isOpen: true,
      type: 'GENERATE',
      message: `Génération pour ${candidate.prenom} ${candidate.nom}...`,
      subMessage: `Évaluation Claude AI et remplissage des 11 modèles Word (.DOCX) pour ${candidate.code_certif}...`,
    });

    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ candidate, apiKey }),
      });

      const text = await res.text();
      const data = text ? JSON.parse(text) : {};

      if (res.ok && data.success) {
        setPreviewCandidate(candidate);
        setPreviewEvalResult(data.evalResult);
        setProducedCount(data.producedCount);
        setIsPreviewOpen(true);

        // Reset GENERER_MAINTENANT checkbox per section 8.3 specification
        setCandidates((prev) =>
          prev.map((c) => (c.id === candidate.id ? { ...c, generer_maintenant: false } : c))
        );
      } else {
        alert(data.error || 'Échec de la génération des documents.');
      }
    } catch (err) {
      alert('Erreur réseau lors de la génération des documents.');
    } finally {
      setIsGenerating(false);
      setLoadingState({ isOpen: false, type: null });
    }
  };

  // Instant in-browser ZIP generation
  const handleBatchGenerate = async (selectedCandidates: CandidateRow[]) => {
    if (selectedCandidates.length === 0) return;

    setIsGenerating(true);
    setLoadingState({
      isOpen: true,
      type: 'DOWNLOAD',
      message: `Compilation du package ZIP (${selectedCandidates.length} candidat${selectedCandidates.length > 1 ? 's' : ''})...`,
      subMessage: 'Organisation des dossiers et compression des fichiers Word certifiants...',
    });

    try {
      const res = await fetch('/api/download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ candidates: selectedCandidates, apiKey }),
      });

      const data = await res.json();
      if (res.ok && data.base64Zip) {
        const binaryString = window.atob(data.base64Zip);
        const len = binaryString.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }

        const blob = new Blob([bytes], { type: 'application/zip' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = data.filename || 'Dossiers_Certification.zip';
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(url);
      } else {
        alert(data.error || 'Erreur lors de la préparation du fichier ZIP.');
      }
    } catch (err) {
      alert('Erreur réseau lors du téléchargement du package ZIP.');
    } finally {
      setIsGenerating(false);
      setLoadingState({ isOpen: false, type: null });
    }
  };

  // Sync to Google Drive
  const handleDriveSync = async (candidate: CandidateRow) => {
    setLoadingState({
      isOpen: true,
      type: 'DRIVE_SYNC',
      message: `Synchronisation vers Google Drive...`,
      subMessage: `Envoi direct des fichiers de ${candidate.prenom} ${candidate.nom} vers votre Shared Drive "Automatisation Project"...`,
    });

    try {
      const res = await fetch('/api/drive', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ candidate, apiKey }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        alert(`Succès! ${data.count} documents synchronisés sur Google Drive.`);
      } else {
        alert(`Drive Sync: ${data.error || 'Erreur lors de la synchronisation.'}`);
      }
    } catch (err) {
      alert('Erreur réseau lors de la synchronisation vers Google Drive.');
    } finally {
      setLoadingState({ isOpen: false, type: null });
    }
  };

  if (!isAuthChecked) {
    return null; // Avoid layout flicker during auth check
  }

  // Render Login Page if not authenticated
  if (!isAuthenticated) {
    return <LoginPage onLoginSuccess={() => setIsAuthenticated(true)} />;
  }

  // Stats computation
  const totalCount = candidates.length;
  const readyCount = candidates.filter((c) => c.pret_pour_generation).length;
  const incompleteCount = candidates.filter((c) => !c.pret_pour_generation).length;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      <Navbar
        hasApiKey={isAutoConnected || Boolean(apiKey.trim())}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onUploadClick={() => fileInputRef.current?.click()}
        autoMode={autoMode}
        onToggleAutoMode={() => setAutoMode(!autoMode)}
        onLogout={handleLogout}
      />

      <input
        ref={fileInputRef}
        type="file"
        accept=".xlsx,.xls"
        onChange={handleFileUpload}
        className="hidden"
      />

      {/* Global Background Process Loading Overlay */}
      <LoadingOverlay
        isOpen={loadingState.isOpen}
        type={loadingState.type}
        message={loadingState.message}
        subMessage={loadingState.subMessage}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto p-6">
        {/* Banner header */}
        <div className="mb-6 bg-gradient-to-r from-slate-900 via-slate-900 to-slate-950 border border-slate-800 rounded-2xl p-6 shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2 mb-2">
              <span className="text-xs font-bold text-teal-400 uppercase tracking-widest bg-teal-500/10 border border-teal-500/20 px-3 py-1 rounded-full flex items-center gap-1.5">
                <Sparkles className="h-3 w-3 text-teal-400" /> Spécifications V1.0 — Claude AI Engine Auto-Connecté
              </span>
            </div>
            <h2 className="text-2xl font-extrabold text-white">
              Gestionnaire des Dossiers d'Évaluation & Certifications
            </h2>
            <p className="text-xs text-slate-400 mt-1 max-w-2xl leading-relaxed">
              Importation directe de l’onglet <strong className="text-slate-200">AUTOMATISATION</strong> de votre fichier EDOF.xlsx. 
              Remplissage automatisé de vos 80 modèles originaux (.DOCX) situés dans <code className="bg-slate-800 text-teal-300 px-1.5 py-0.5 rounded">F:\Office\Hedar_project\Templates</code> via l'API Claude Anthropic.
            </p>
          </div>

          <div className="flex items-center space-x-3">
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              className="flex items-center space-x-2 bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-500 hover:to-emerald-500 text-white font-bold text-xs px-5 py-2.5 rounded-xl shadow-lg transition-all active:scale-95 disabled:opacity-50"
            >
              <FileUp className="h-4 w-4" />
              <span>{isUploading ? 'Chargement EDOF...' : 'Charger EDOF.xlsx'}</span>
            </button>
          </div>
        </div>

        {/* Dashboard Stats */}
        <StatsCard
          total={totalCount}
          ready={readyCount}
          incomplete={incompleteCount}
          generated={0}
        />

        {/* Main Content Area: Empty State or Candidate Grid */}
        {candidates.length === 0 ? (
          <div className="bg-slate-900/60 border-2 border-dashed border-slate-800 rounded-3xl p-12 text-center shadow-2xl flex flex-col items-center justify-center my-6">
            <div className="w-16 h-16 bg-teal-500/10 border border-teal-500/20 rounded-2xl flex items-center justify-center text-teal-400 mb-4 shadow-inner">
              <FileSpreadsheet className="h-8 w-8" />
            </div>
            <h3 className="text-xl font-bold text-white mb-1">Aucune donnée candidat chargée</h3>
            <p className="text-xs text-slate-400 max-w-md leading-relaxed mb-6">
              Veuillez charger votre fichier Excel officiel <strong className="text-slate-200">EDOF.xlsx</strong>.
              Le système extraira automatiquement les informations de l'onglet <span className="text-teal-400 font-semibold">AUTOMATISATION</span> et remplira tous vos modèles Word (.DOCX) avec l'IA.
            </p>
            <div className="flex items-center gap-3">
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
                className="flex items-center space-x-2 bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-500 hover:to-emerald-500 text-white font-bold text-xs px-6 py-3 rounded-xl shadow-xl transition-all active:scale-95"
              >
                <UploadCloud className="h-4.5 w-4.5" />
                <span>Sélectionner EDOF.xlsx</span>
              </button>
            </div>
            <div className="mt-8 pt-6 border-t border-slate-800/80 flex items-center space-x-6 text-[11px] text-slate-500">
              <span className="flex items-center gap-1.5">
                <Bot className="h-3.5 w-3.5 text-teal-400" /> API Claude Auto-Connectée
              </span>
              <span>•</span>
              <span>80 Modèles Word Détectés</span>
              <span>•</span>
              <span>Conforme Qualiopi & RS</span>
            </div>
          </div>
        ) : (
          <CandidateTable
            candidates={candidates}
            onToggleGenererMaintenant={handleToggleGenererMaintenant}
            onGenerateCandidate={handleGenerateCandidate}
            onBatchGenerate={handleBatchGenerate}
            isGenerating={isGenerating}
          />
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-900 text-center text-[11px] text-slate-500 py-4 mt-auto">
        CertiFlow AutoFill V1.0 — Proforma Institut & Proskills Institut © {new Date().getFullYear()} — Conformité Qualiopi & Répertoire Spécifique
      </footer>

      {/* Settings Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        apiKey={apiKey}
        onSaveApiKey={(key) => setApiKey(key)}
        isAutoConnected={isAutoConnected}
      />

      {/* Evaluation Preview Modal */}
      <EvaluationPreviewModal
        isOpen={isPreviewOpen}
        onClose={() => setIsPreviewOpen(false)}
        candidate={previewCandidate}
        evalResult={previewEvalResult}
        producedCount={producedCount}
        onDownloadPackage={() => {
          if (previewCandidate) handleBatchGenerate([previewCandidate]);
        }}
        onSyncDrive={() => {
          if (previewCandidate) handleDriveSync(previewCandidate);
        }}
      />
    </div>
  );
}
