import React, { useState, useEffect } from 'react';
import { useLanguage } from '../../LanguageContext';
import { GitBranch, Link2, Unlink, X, Loader2, CheckCircle2, AlertTriangle, Eye, EyeOff, Box, Building2, UtilityPole, Waypoints, Users, Cable } from 'lucide-react';
import * as projectService from '../../services/projectService';
import { InheritedElementsConfig, DEFAULT_INHERITED_ELEMENTS } from '../../types';
import { CustomSelect } from '../common/CustomSelect';

interface ProjectSummary {
    id: string;
    name: string;
    parentProjectId?: string | null;
    counts?: { childProjects?: number };
}

interface ParentProjectSettingsProps {
    isOpen: boolean;
    onClose: () => void;
    currentProjectId: string;
    currentProjectName: string;
    parentProjectId: string | null;
    inheritedElements: InheritedElementsConfig;
    projects: ProjectSummary[];
    onParentChanged: (parentProjectId: string | null, inheritedElements: InheritedElementsConfig) => void;
}

const ELEMENT_KEYS: { key: keyof InheritedElementsConfig; labelKey: string; icon: React.ReactNode }[] = [
    { key: 'backbone', labelKey: 'Backbone', icon: <Waypoints className="w-3.5 h-3.5" /> },
    { key: 'poles', labelKey: 'Postes', icon: <UtilityPole className="w-3.5 h-3.5" /> },
    { key: 'cables', labelKey: 'Cabos', icon: <Cable className="w-3.5 h-3.5" /> },
    { key: 'ctos', labelKey: 'CTOs', icon: <Box className="w-3.5 h-3.5" /> },
    { key: 'ceos', labelKey: 'CEOs', icon: <Box className="w-3.5 h-3.5" /> },
    { key: 'pops', labelKey: 'POPs', icon: <Building2 className="w-3.5 h-3.5" /> },
    { key: 'customers', labelKey: 'Clientes', icon: <Users className="w-3.5 h-3.5" /> },
];

export const ParentProjectSettings: React.FC<ParentProjectSettingsProps> = ({
    isOpen,
    onClose,
    currentProjectId,
    currentProjectName,
    parentProjectId,
    inheritedElements,
    projects,
    onParentChanged,
}) => {
    const { t } = useLanguage();
    const [selectedParentId, setSelectedParentId] = useState<string | null>(parentProjectId);
    const [config, setConfig] = useState<InheritedElementsConfig>({ ...DEFAULT_INHERITED_ELEMENTS, ...inheritedElements });
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);

    useEffect(() => {
        setSelectedParentId(parentProjectId);
        setConfig({ ...DEFAULT_INHERITED_ELEMENTS, ...inheritedElements });
        setError(null);
        setSuccess(false);
    }, [parentProjectId, inheritedElements, isOpen]);

    if (!isOpen) return null;

    const availableParents = projects.filter(p => {
        if (p.id === currentProjectId) return false;
        if (p.parentProjectId) return false;
        if ((p.counts?.childProjects || 0) > 0 && p.id !== parentProjectId) {
            return p.id === parentProjectId;
        }
        return true;
    });

    const selectOptions = [
        { value: '', label: t('base_project_none') },
        ...availableParents.map(p => ({ value: p.id, label: p.name }))
    ];

    const handleSave = async () => {
        setSaving(true);
        setError(null);
        setSuccess(false);
        try {
            await projectService.setParentProject(currentProjectId, selectedParentId, config);
            setSuccess(true);
            onParentChanged(selectedParentId, config);
            setTimeout(() => setSuccess(false), 2000);
        } catch (err: any) {
            setError(err?.response?.data?.error || t('base_project_save_error'));
        } finally {
            setSaving(false);
        }
    };

    const handleUnlink = async () => {
        setSaving(true);
        setError(null);
        try {
            await projectService.setParentProject(currentProjectId, null);
            setSelectedParentId(null);
            setConfig({ ...DEFAULT_INHERITED_ELEMENTS });
            onParentChanged(null, DEFAULT_INHERITED_ELEMENTS);
            setSuccess(true);
            setTimeout(() => setSuccess(false), 2000);
        } catch (err: any) {
            setError(err?.response?.data?.error || t('base_project_unlink_error'));
        } finally {
            setSaving(false);
        }
    };

    const toggleElement = (key: keyof InheritedElementsConfig) => {
        setConfig(prev => ({ ...prev, [key]: !prev[key] }));
    };

    const hasChanges = selectedParentId !== parentProjectId || JSON.stringify(config) !== JSON.stringify(inheritedElements);

    return (
        <div className="fixed inset-0 z-[3000] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in" onClick={onClose}>
            <div className="bg-white dark:bg-[#1a1d23] border border-slate-200 dark:border-slate-700 rounded-xl w-full max-w-md shadow-2xl flex flex-col" onClick={e => e.stopPropagation()}>

                {/* Header */}
                <div className="p-4 bg-gradient-to-r from-emerald-500/10 to-transparent border-b border-slate-200 dark:border-slate-700/30 flex items-center justify-between shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                            <GitBranch className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                        </div>
                        <div>
                            <h3 className="text-sm font-bold text-slate-800 dark:text-white">{t('base_project')}</h3>
                            <p className="text-[10px] text-slate-400">{t('base_project_subtitle')}</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-1.5 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors">
                        <X className="w-5 h-5 text-slate-400" />
                    </button>
                </div>

                {/* Body */}
                <div className="p-4 space-y-4">

                    {/* Selector */}
                    <CustomSelect
                        label={t('base_project_label')}
                        value={selectedParentId || ''}
                        onChange={(val) => {
                            setSelectedParentId(val || null);
                            setError(null);
                        }}
                        options={selectOptions}
                        placeholder={t('base_project_select_placeholder')}
                        searchPlaceholder={t('base_project_search')}
                        showSearch={availableParents.length > 5}
                    />

                    {/* Inheritance Toggles */}
                    {selectedParentId && (
                        <div>
                            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                                {t('base_project_inherited_elements')}
                            </label>
                            <div className="flex flex-wrap gap-1.5">
                                {ELEMENT_KEYS.map(({ key, labelKey, icon }) => {
                                    const active = config[key];
                                    return (
                                        <button
                                            key={key}
                                            onClick={() => toggleElement(key)}
                                            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-[11px] font-bold transition-all ${
                                                active
                                                    ? 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/30 text-emerald-700 dark:text-emerald-400'
                                                    : 'bg-slate-50 dark:bg-[#22262e] border-slate-200 dark:border-slate-700/30 text-slate-400 dark:text-slate-500 line-through'
                                            }`}
                                        >
                                            <span className={active ? 'text-emerald-500' : 'text-slate-300 dark:text-slate-600'}>{icon}</span>
                                            {labelKey}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* Current link info */}
                    {parentProjectId && (
                        <div className="flex items-center justify-between p-2.5 bg-emerald-50 dark:bg-emerald-500/5 border border-emerald-200 dark:border-emerald-500/20 rounded-lg">
                            <div className="flex items-center gap-2 text-xs font-bold text-emerald-700 dark:text-emerald-300">
                                <Link2 className="w-3.5 h-3.5" />
                                <span>{t('base_project_linked_to', { name: projects.find(p => p.id === parentProjectId)?.name || t('base_project') })}</span>
                            </div>
                            <button
                                onClick={handleUnlink}
                                disabled={saving}
                                className="flex items-center gap-1 px-2 py-1 text-[10px] font-bold text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-md transition-colors"
                            >
                                <Unlink className="w-3 h-3" /> {t('base_project_unlink')}
                            </button>
                        </div>
                    )}

                    {/* Feedback */}
                    {error && (
                        <div className="flex items-center gap-2 p-2.5 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 rounded-lg text-xs font-medium text-red-600 dark:text-red-400">
                            <AlertTriangle className="w-3.5 h-3.5 shrink-0" /> {error}
                        </div>
                    )}
                    {success && (
                        <div className="flex items-center gap-2 p-2.5 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 rounded-lg text-xs font-medium text-emerald-600 dark:text-emerald-400 animate-in fade-in">
                            <CheckCircle2 className="w-3.5 h-3.5" /> {t('base_project_save_success')}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-3 border-t border-slate-100 dark:border-slate-700/30 flex items-center justify-end gap-2 shrink-0">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-xs font-bold text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                    >
                        {t('cancel')}
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={saving || !hasChanges}
                        className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-bold rounded-lg transition-colors shadow-sm shadow-emerald-900/10 flex items-center gap-1.5"
                    >
                        {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                        {t('saved') || 'Salvar'}
                    </button>
                </div>

            </div>
        </div>
    );
};
