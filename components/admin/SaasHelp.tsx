import React, { useEffect, useMemo, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import {
    Plus, Edit2, Trash2, Power, Loader2, X, AlertCircle, HelpCircle,
    FileText, Eye, EyeOff,
} from 'lucide-react';
import {
    listHelpFaqs, createHelpFaq, updateHelpFaq, deleteHelpFaq,
    listHelpArticles, createHelpArticle, updateHelpArticle, deleteHelpArticle,
} from '../../services/saasService';
import { useLanguage } from '../../LanguageContext';

interface Faq {
    id: string;
    category: string;
    question: string;
    answer: string;
    order: number;
    active: boolean;
}
interface Article {
    id: string;
    title: string;
    slug: string;
    category: string;
    content: string;
    order: number;
    active: boolean;
}

type Tab = 'faqs' | 'articles';

export const SaasHelp: React.FC = () => {
    const { t } = useLanguage();
    const [tab, setTab] = useState<Tab>('faqs');
    const [faqs, setFaqs] = useState<Faq[]>([]);
    const [articles, setArticles] = useState<Article[]>([]);
    const [loading, setLoading] = useState(true);
    const [editingFaq, setEditingFaq] = useState<Faq | null>(null);
    const [editingArticle, setEditingArticle] = useState<Article | null>(null);
    const [creatingFaq, setCreatingFaq] = useState(false);
    const [creatingArticle, setCreatingArticle] = useState(false);

    const loadAll = async () => {
        setLoading(true);
        try {
            const [f, a] = await Promise.all([listHelpFaqs(), listHelpArticles()]);
            setFaqs(f);
            setArticles(a);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };
    useEffect(() => { loadAll(); }, []);

    const handleToggleFaq = async (f: Faq) => {
        try { await updateHelpFaq(f.id, { active: !f.active }); loadAll(); } catch (e) { console.error(e); }
    };
    const handleDeleteFaq = async (f: Faq) => {
        if (!window.confirm(`Excluir pergunta "${f.question}"?`)) return;
        try { await deleteHelpFaq(f.id); loadAll(); } catch (e) { console.error(e); }
    };
    const handleToggleArticle = async (a: Article) => {
        try { await updateHelpArticle(a.id, { active: !a.active }); loadAll(); } catch (e) { console.error(e); }
    };
    const handleDeleteArticle = async (a: Article) => {
        if (!window.confirm(`Excluir artigo "${a.title}"?`)) return;
        try { await deleteHelpArticle(a.id); loadAll(); } catch (e) { console.error(e); }
    };

    const faqsByCategory = useMemo(() => {
        const map = new Map<string, Faq[]>();
        faqs.forEach(f => {
            const arr = map.get(f.category) || [];
            arr.push(f);
            map.set(f.category, arr);
        });
        return map;
    }, [faqs]);

    const articlesByCategory = useMemo(() => {
        const map = new Map<string, Article[]>();
        articles.forEach(a => {
            const arr = map.get(a.category) || [];
            arr.push(a);
            map.set(a.category, arr);
        });
        return map;
    }, [articles]);

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h2 className="text-2xl font-bold text-slate-900 dark:text-white">{t('saas_help_title') || 'Página de Ajuda'}</h2>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                    {t('saas_help_desc') || 'Gerencie FAQs e artigos exibidos na área do cliente. Vídeos continuam na aba Vídeos.'}
                </p>
            </div>

            {/* Tabs */}
            <div className="flex items-center gap-1 border-b border-slate-200 dark:border-slate-700">
                {([
                    { id: 'faqs', label: 'FAQ', icon: HelpCircle, count: faqs.length },
                    { id: 'articles', label: 'Artigos', icon: FileText, count: articles.length },
                ] as const).map(t => (
                    <button
                        key={t.id}
                        onClick={() => setTab(t.id)}
                        className={`flex items-center gap-2 px-4 py-2.5 text-sm font-bold border-b-2 -mb-px transition-colors ${
                            tab === t.id
                                ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400'
                                : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                        }`}
                    >
                        <t.icon className="w-4 h-4" />
                        {t.label}
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                            tab === t.id
                                ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'
                                : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
                        }`}>{t.count}</span>
                    </button>
                ))}
                <div className="flex-1" />
                <button
                    onClick={() => tab === 'faqs' ? setCreatingFaq(true) : setCreatingArticle(true)}
                    className="flex items-center gap-2 px-4 py-2 mb-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-sm font-bold shadow-lg shadow-emerald-600/20 transition"
                >
                    <Plus className="w-4 h-4" />
                    {tab === 'faqs' ? 'Nova pergunta' : 'Novo artigo'}
                </button>
            </div>

            {/* Body */}
            {loading ? (
                <div className="flex items-center justify-center py-16 text-slate-400">
                    <Loader2 className="w-5 h-5 animate-spin mr-2" /> Carregando…
                </div>
            ) : tab === 'faqs' ? (
                faqs.length === 0 ? (
                    <EmptyState label="Nenhuma pergunta cadastrada. Clique em 'Nova pergunta'." icon={HelpCircle} />
                ) : (
                    <div className="space-y-6">
                        {Array.from(faqsByCategory.entries()).map(([category, list]) => (
                            <div key={category}>
                                <h3 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">{category}</h3>
                                <div className="space-y-2">
                                    {list.map(f => (
                                        <div key={f.id} className={`bg-white dark:bg-[#22262e] border border-slate-200 dark:border-slate-700 rounded-lg p-3 ${!f.active ? 'opacity-60' : ''}`}>
                                            <div className="flex items-start justify-between gap-3">
                                                <div className="flex-1 min-w-0">
                                                    <div className="font-bold text-sm text-slate-900 dark:text-white mb-1">{f.question}</div>
                                                    <div className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 whitespace-pre-line">{f.answer}</div>
                                                </div>
                                                <div className="flex items-center gap-1 shrink-0">
                                                    <button onClick={() => setEditingFaq(f)} title="Editar" className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded transition">
                                                        <Edit2 className="w-4 h-4" />
                                                    </button>
                                                    <button onClick={() => handleToggleFaq(f)} title={f.active ? 'Desativar' : 'Ativar'} className="p-1.5 text-slate-400 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/20 rounded transition">
                                                        {f.active ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                                                    </button>
                                                    <button onClick={() => handleDeleteFaq(f)} title="Excluir" className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition">
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                )
            ) : (
                articles.length === 0 ? (
                    <EmptyState label="Nenhum artigo cadastrado. Clique em 'Novo artigo'." icon={FileText} />
                ) : (
                    <div className="space-y-6">
                        {Array.from(articlesByCategory.entries()).map(([category, list]) => (
                            <div key={category}>
                                <h3 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">{category}</h3>
                                <div className="space-y-2">
                                    {list.map(a => (
                                        <div key={a.id} className={`bg-white dark:bg-[#22262e] border border-slate-200 dark:border-slate-700 rounded-lg p-3 ${!a.active ? 'opacity-60' : ''}`}>
                                            <div className="flex items-start justify-between gap-3">
                                                <div className="flex-1 min-w-0">
                                                    <div className="font-bold text-sm text-slate-900 dark:text-white">{a.title}</div>
                                                    <div className="text-[10px] text-slate-400 font-mono">{a.slug}</div>
                                                </div>
                                                <div className="flex items-center gap-1 shrink-0">
                                                    <button onClick={() => setEditingArticle(a)} title="Editar" className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded transition">
                                                        <Edit2 className="w-4 h-4" />
                                                    </button>
                                                    <button onClick={() => handleToggleArticle(a)} title={a.active ? 'Desativar' : 'Ativar'} className="p-1.5 text-slate-400 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/20 rounded transition">
                                                        {a.active ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                                                    </button>
                                                    <button onClick={() => handleDeleteArticle(a)} title="Excluir" className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition">
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                )
            )}

            {/* Modais */}
            {(creatingFaq || editingFaq) && (
                <FaqFormModal
                    faq={editingFaq}
                    onClose={() => { setCreatingFaq(false); setEditingFaq(null); }}
                    onSaved={() => { setCreatingFaq(false); setEditingFaq(null); loadAll(); }}
                />
            )}
            {(creatingArticle || editingArticle) && (
                <ArticleFormModal
                    article={editingArticle}
                    onClose={() => { setCreatingArticle(false); setEditingArticle(null); }}
                    onSaved={() => { setCreatingArticle(false); setEditingArticle(null); loadAll(); }}
                />
            )}
        </div>
    );
};

const FaqFormModal: React.FC<{ faq: Faq | null; onClose: () => void; onSaved: () => void }> = ({ faq, onClose, onSaved }) => {
    const isEdit = !!faq;
    const [category, setCategory] = useState(faq?.category || '');
    const [question, setQuestion] = useState(faq?.question || '');
    const [answer, setAnswer] = useState(faq?.answer || '');
    const [order, setOrder] = useState(faq?.order ?? 0);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const submit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!category.trim() || !question.trim() || !answer.trim()) {
            setError('Preencha todos os campos.');
            return;
        }
        setSaving(true);
        setError(null);
        try {
            const data = { category: category.trim(), question: question.trim(), answer: answer.trim(), order: Number(order) || 0 };
            if (isEdit && faq) await updateHelpFaq(faq.id, data);
            else await createHelpFaq(data);
            onSaved();
        } catch (e: any) {
            setError(e?.response?.data?.error || 'Erro ao salvar');
        } finally {
            setSaving(false);
        }
    };

    return (
        <ModalShell title={isEdit ? 'Editar pergunta' : 'Nova pergunta'} onClose={onClose}>
            <form onSubmit={submit} className="space-y-4 p-6">
                {error && <ErrorBox error={error} />}
                <div className="grid grid-cols-2 gap-3">
                    <Field label="Categoria *">
                        <input value={category} onChange={e => setCategory(e.target.value)} placeholder="Ex: Cobrança" className="form-input" autoFocus />
                    </Field>
                    <Field label="Ordem">
                        <input type="number" value={order} onChange={e => setOrder(Number(e.target.value))} className="form-input" />
                    </Field>
                </div>
                <Field label="Pergunta *">
                    <input value={question} onChange={e => setQuestion(e.target.value)} className="form-input" />
                </Field>
                <Field label="Resposta *">
                    <textarea value={answer} onChange={e => setAnswer(e.target.value)} rows={6} className="form-input resize-y" />
                </Field>
                <FormFooter onClose={onClose} saving={saving} isEdit={isEdit} />
            </form>
            <style>{formStyles}</style>
        </ModalShell>
    );
};

const ArticleFormModal: React.FC<{ article: Article | null; onClose: () => void; onSaved: () => void }> = ({ article, onClose, onSaved }) => {
    const isEdit = !!article;
    const [title, setTitle] = useState(article?.title || '');
    const [category, setCategory] = useState(article?.category || '');
    const [content, setContent] = useState(article?.content || '');
    const [order, setOrder] = useState(article?.order ?? 0);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [preview, setPreview] = useState(false);

    const submit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!title.trim() || !category.trim() || !content.trim()) {
            setError('Preencha todos os campos.');
            return;
        }
        setSaving(true);
        setError(null);
        try {
            const data = { title: title.trim(), category: category.trim(), content, order: Number(order) || 0 };
            if (isEdit && article) await updateHelpArticle(article.id, data);
            else await createHelpArticle(data);
            onSaved();
        } catch (e: any) {
            setError(e?.response?.data?.error || 'Erro ao salvar');
        } finally {
            setSaving(false);
        }
    };

    return (
        <ModalShell title={isEdit ? 'Editar artigo' : 'Novo artigo'} onClose={onClose} maxW="max-w-4xl">
            <form onSubmit={submit} className="space-y-4 p-6">
                {error && <ErrorBox error={error} />}
                <div className="grid grid-cols-3 gap-3">
                    <div className="col-span-2">
                        <Field label="Título *">
                            <input value={title} onChange={e => setTitle(e.target.value)} className="form-input" autoFocus />
                        </Field>
                    </div>
                    <Field label="Ordem">
                        <input type="number" value={order} onChange={e => setOrder(Number(e.target.value))} className="form-input" />
                    </Field>
                </div>
                <Field label="Categoria *">
                    <input value={category} onChange={e => setCategory(e.target.value)} placeholder="Ex: Começando, Projetos, Cobrança" className="form-input" />
                </Field>
                <div>
                    <div className="flex items-center justify-between mb-1.5">
                        <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                            Conteúdo (Markdown) *
                        </label>
                        <button type="button" onClick={() => setPreview(p => !p)} className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                            {preview ? '← Voltar editar' : 'Preview →'}
                        </button>
                    </div>
                    {preview ? (
                        <div className="min-h-[300px] p-4 bg-slate-50 dark:bg-[#22262e] border border-slate-200 dark:border-slate-700 rounded-lg prose prose-sm dark:prose-invert max-w-none">
                            <ReactMarkdown>{content || '_Vazio_'}</ReactMarkdown>
                        </div>
                    ) : (
                        <textarea
                            value={content}
                            onChange={e => setContent(e.target.value)}
                            rows={15}
                            placeholder={'# Título\n\nParágrafo de texto.\n\n## Subseção\n\n- Item 1\n- Item 2'}
                            className="form-input font-mono text-xs resize-y"
                        />
                    )}
                </div>
                <FormFooter onClose={onClose} saving={saving} isEdit={isEdit} />
            </form>
            <style>{formStyles}</style>
        </ModalShell>
    );
};

// --- Helpers ---

const ModalShell: React.FC<{ title: string; onClose: () => void; children: React.ReactNode; maxW?: string }> = ({ title, onClose, children, maxW = 'max-w-2xl' }) => (
    <div className="fixed inset-0 z-[3000] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
        <div className={`bg-white dark:bg-[#1a1d23] rounded-2xl shadow-2xl w-full ${maxW} border border-slate-200 dark:border-slate-700 my-8`}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-700">
                <h3 className="font-bold text-lg text-slate-900 dark:text-white">{title}</h3>
                <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-white">
                    <X className="w-5 h-5" />
                </button>
            </div>
            {children}
        </div>
    </div>
);

const Field: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
    <div>
        <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">{label}</label>
        {children}
    </div>
);

const ErrorBox: React.FC<{ error: string }> = ({ error }) => (
    <div className="flex items-start gap-2 text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900/50 rounded-lg px-3 py-2">
        <AlertCircle className="w-4 h-4 shrink-0" /> {error}
    </div>
);

const FormFooter: React.FC<{ onClose: () => void; saving: boolean; isEdit: boolean }> = ({ onClose, saving, isEdit }) => (
    <div className="flex justify-end gap-2 pt-2">
        <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition">
            Cancelar
        </button>
        <button type="submit" disabled={saving} className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold rounded-lg shadow-lg shadow-emerald-600/20 transition disabled:opacity-50 flex items-center gap-2">
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            {isEdit ? 'Salvar' : 'Criar'}
        </button>
    </div>
);

const EmptyState: React.FC<{ label: string; icon: any }> = ({ label, icon: Icon }) => (
    <div className="text-center py-16 bg-white dark:bg-[#22262e] border border-dashed border-slate-300 dark:border-slate-700 rounded-2xl">
        <Icon className="w-12 h-12 text-slate-300 dark:text-slate-700 mx-auto mb-3" />
        <p className="text-sm text-slate-500 dark:text-slate-400">{label}</p>
    </div>
);

const formStyles = `
.form-input {
    width: 100%;
    padding: 0.5rem 0.75rem;
    font-size: 0.875rem;
    background: white;
    border: 1px solid rgb(226 232 240);
    border-radius: 0.5rem;
    color: rgb(15 23 42);
    outline: none;
    transition: all 0.15s;
}
.form-input:focus {
    border-color: rgb(16 185 129);
    box-shadow: 0 0 0 3px rgb(16 185 129 / 0.1);
}
.dark .form-input {
    background: #22262e;
    border-color: rgb(51 65 85);
    color: white;
}
`;
