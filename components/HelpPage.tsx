import React, { useEffect, useMemo, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import {
    Search, X, ArrowLeft, Play, HelpCircle, FileText, MessageSquare,
    MessageCircle, Mail, Phone, ChevronRight, Video as VideoIcon,
} from 'lucide-react';
import api from '../services/api';
import { useLanguage } from '../LanguageContext';

interface Faq { id: string; category: string; question: string; answer: string; order?: number }
interface Article { id: string; title: string; slug: string; category: string; content: string; order?: number }
interface Video { id: string; title: string; description?: string | null; url: string; icon?: string | null }
interface ContactInfo { email: string | null; phone: string | null; whatsapp: string | null }
interface HelpData { faqs: Faq[]; articles: Article[]; videos: Video[]; contact: ContactInfo }

type Tab = 'videos' | 'faq' | 'articles' | 'contact';

function groupByCategory<T extends { category: string; order?: number }>(items: T[]): [string, T[]][] {
    const map = new Map<string, { items: T[]; minOrder: number }>();
    items.forEach(it => {
        const ord = it.order ?? 0;
        const entry = map.get(it.category);
        if (entry) {
            entry.items.push(it);
            if (ord < entry.minOrder) entry.minOrder = ord;
        } else {
            map.set(it.category, { items: [it], minOrder: ord });
        }
    });
    return Array.from(map.entries())
        .sort((a, b) => a[1].minOrder - b[1].minOrder)
        .map(([cat, { items }]): [string, T[]] => [cat, items]);
}

function getYoutubeId(url: string): string | null {
    if (!url) return null;
    const m = url.match(/(?:youtube\.com\/(?:[^/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?/\s]{11})/);
    return m ? m[1] : null;
}

interface HelpPageProps { onClose: () => void }

export const HelpPage: React.FC<HelpPageProps> = ({ onClose: _onClose }) => {
    const { t } = useLanguage();
    const [data, setData] = useState<HelpData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [tab, setTab] = useState<Tab>('videos');
    const [search, setSearch] = useState('');
    const [openVideoId, setOpenVideoId] = useState<string | null>(null);
    const [openArticleSlug, setOpenArticleSlug] = useState<string | null>(null);
    const searchRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        let alive = true;
        api.get<HelpData>('/help/content')
            .then(r => { if (alive) setData(r.data); })
            .catch(() => { if (alive) setError(t('help_load_error') || 'Não foi possível carregar.'); })
            .finally(() => { if (alive) setLoading(false); });
        return () => { alive = false; };
    }, [t]);

    const switchTab = (next: Tab) => {
        setTab(next);
        setOpenVideoId(null);
        setOpenArticleSlug(null);
        setSearch('');
    };

    const openVideo = data?.videos.find(v => v.id === openVideoId) || null;
    const openArticle = data?.articles.find(a => a.slug === openArticleSlug) || null;

    return (
        <div className="h-full bg-[#f9fafb] dark:bg-[#0f1117] px-4 pb-4 pt-20 lg:p-8 overflow-y-auto">
            {loading ? (
                <LoadingSkeleton />
            ) : error ? (
                <ErrorState message={error} onRetry={() => window.location.reload()} />
            ) : data ? (
                <div className="space-y-6 animate-in fade-in duration-300">
                    <Header search={search} setSearch={setSearch} searchRef={searchRef} />
                    <Tabs tab={tab} setTab={switchTab} counts={{ videos: data.videos.length, faq: data.faqs.length, articles: data.articles.length, contact: 1 }} />

                    {openVideo ? (
                        <VideoPlayer video={openVideo} onBack={() => setOpenVideoId(null)} />
                    ) : openArticle ? (
                        <ArticleReader article={openArticle} all={data.articles} onBack={() => setOpenArticleSlug(null)} onOpen={slug => setOpenArticleSlug(slug)} />
                    ) : (
                        <TabBody
                            tab={tab}
                            data={data}
                            search={search.trim().toLowerCase()}
                            onOpenVideo={setOpenVideoId}
                            onOpenArticle={setOpenArticleSlug}
                        />
                    )}
                </div>
            ) : null}
        </div>
    );
};

// --- Header ---

const Header: React.FC<{
    search: string;
    setSearch: (s: string) => void;
    searchRef: React.RefObject<HTMLInputElement>;
}> = ({ search, setSearch, searchRef }) => (
    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <HelpCircle className="w-7 h-7 text-emerald-500 dark:text-emerald-400" />
                Central de Ajuda
            </h2>
            <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
                Tutoriais, dúvidas frequentes e contato direto com a gente.
            </p>
        </div>

        <div className="relative w-full sm:w-80 group">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 dark:text-slate-500 group-focus-within:text-emerald-500 transition-colors" />
            <input
                ref={searchRef}
                type="search"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Buscar nesta aba…"
                className="w-full bg-slate-100/80 dark:bg-[#22262e]/40 border border-slate-200/50 dark:border-slate-700/50 rounded-xl pl-9 pr-9 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all duration-300 placeholder:text-slate-400 shadow-sm"
                aria-label="Buscar na Central de Ajuda"
            />
            {search && (
                <button
                    onClick={() => setSearch('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-700 dark:hover:text-white rounded transition"
                    aria-label="Limpar busca"
                >
                    <X className="w-3.5 h-3.5" />
                </button>
            )}
        </div>
    </div>
);

// --- Tabs ---

const Tabs: React.FC<{
    tab: Tab;
    setTab: (t: Tab) => void;
    counts: { videos: number; faq: number; articles: number; contact: number };
}> = ({ tab, setTab, counts }) => {
    const items: { id: Tab; label: string; icon: any; count?: number }[] = [
        { id: 'videos', label: 'Tutoriais', icon: VideoIcon, count: counts.videos },
        { id: 'faq', label: 'FAQ', icon: HelpCircle, count: counts.faq },
        { id: 'articles', label: 'Artigos', icon: FileText, count: counts.articles },
        { id: 'contact', label: 'Contato', icon: MessageSquare },
    ];

    return (
        <div className="border-b border-slate-200 dark:border-slate-700/50 overflow-x-auto">
            <div className="flex items-center gap-1 min-w-max">
                {items.map(it => {
                    const active = tab === it.id;
                    return (
                        <button
                            key={it.id}
                            onClick={() => setTab(it.id)}
                            className={`flex items-center gap-2 px-4 py-3 text-sm font-bold border-b-2 -mb-px transition-colors ${
                                active
                                    ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400'
                                    : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                            }`}
                            aria-current={active ? 'page' : undefined}
                        >
                            <it.icon className="w-4 h-4" />
                            {it.label}
                            {it.count != null && (
                                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-extrabold ${
                                    active
                                        ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'
                                        : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
                                }`}>{it.count}</span>
                            )}
                        </button>
                    );
                })}
            </div>
        </div>
    );
};

// --- Tab Body ---

const TabBody: React.FC<{
    tab: Tab;
    data: HelpData;
    search: string;
    onOpenVideo: (id: string) => void;
    onOpenArticle: (slug: string) => void;
}> = ({ tab, data, search, onOpenVideo, onOpenArticle }) => {
    if (tab === 'videos') {
        const filtered = data.videos.filter(v =>
            !search || v.title.toLowerCase().includes(search) || (v.description || '').toLowerCase().includes(search)
        );
        return <VideosGrid videos={filtered} onOpen={onOpenVideo} totalEmpty={data.videos.length === 0} hasSearch={!!search} />;
    }
    if (tab === 'faq') {
        const filtered = data.faqs.filter(f =>
            !search || f.question.toLowerCase().includes(search) || f.answer.toLowerCase().includes(search) || f.category.toLowerCase().includes(search)
        );
        return <FaqList faqs={filtered} totalEmpty={data.faqs.length === 0} hasSearch={!!search} />;
    }
    if (tab === 'articles') {
        const filtered = data.articles.filter(a =>
            !search || a.title.toLowerCase().includes(search) || a.content.toLowerCase().includes(search) || a.category.toLowerCase().includes(search)
        );
        return <ArticlesList articles={filtered} onOpen={onOpenArticle} totalEmpty={data.articles.length === 0} hasSearch={!!search} />;
    }
    return <ContactPanel contact={data.contact} />;
};

// --- Videos ---

const VideosGrid: React.FC<{ videos: Video[]; onOpen: (id: string) => void; totalEmpty: boolean; hasSearch: boolean }> = ({ videos, onOpen, totalEmpty, hasSearch }) => {
    if (totalEmpty) return <EmptyState icon={VideoIcon} title="Nenhum vídeo ainda" subtitle="Os tutoriais aparecem aqui assim que forem publicados." />;
    if (videos.length === 0 && hasSearch) return <SearchEmpty />;
    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {videos.map(v => {
                const id = getYoutubeId(v.url);
                return (
                    <button
                        key={v.id}
                        onClick={() => onOpen(v.id)}
                        className="text-left bg-white dark:bg-[#22262e] border border-slate-200 dark:border-slate-700 rounded-2xl overflow-hidden hover:border-emerald-500 dark:hover:border-emerald-500 hover:shadow-lg transition group focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    >
                        <div className="aspect-video bg-slate-100 dark:bg-slate-800 relative overflow-hidden">
                            {id && (
                                <img
                                    src={`https://img.youtube.com/vi/${id}/hqdefault.jpg`}
                                    alt=""
                                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                    onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
                                />
                            )}
                            <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />
                            <div className="absolute inset-0 flex items-center justify-center">
                                <div className="w-14 h-14 bg-white/95 group-hover:bg-emerald-500 rounded-full flex items-center justify-center shadow-xl transition-colors">
                                    <Play className="w-5 h-5 text-emerald-600 group-hover:text-white fill-current ml-0.5 transition-colors" />
                                </div>
                            </div>
                        </div>
                        <div className="p-4">
                            <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-1 line-clamp-2">{v.title}</h3>
                            {v.description && <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2">{v.description}</p>}
                        </div>
                    </button>
                );
            })}
        </div>
    );
};

const VideoPlayer: React.FC<{ video: Video; onBack: () => void }> = ({ video, onBack }) => {
    const id = getYoutubeId(video.url);
    return (
        <div className="space-y-4">
            <BackBar onBack={onBack} label="Voltar para tutoriais" />
            <h3 className="text-xl font-bold text-slate-900 dark:text-white">{video.title}</h3>
            <div className="aspect-video bg-black rounded-2xl overflow-hidden shadow-xl max-w-4xl">
                {id ? (
                    <iframe
                        src={`https://www.youtube.com/embed/${id}?autoplay=1&rel=0`}
                        title={video.title}
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                        className="w-full h-full"
                    />
                ) : (
                    <video src={video.url} controls autoPlay className="w-full h-full" />
                )}
            </div>
            {video.description && (
                <p className="text-sm text-slate-600 dark:text-slate-300 whitespace-pre-line leading-relaxed max-w-4xl">
                    {video.description}
                </p>
            )}
        </div>
    );
};

// --- FAQ ---

const FaqList: React.FC<{ faqs: Faq[]; totalEmpty: boolean; hasSearch: boolean }> = ({ faqs, totalEmpty, hasSearch }) => {
    const [openId, setOpenId] = useState<string | null>(null);

    if (totalEmpty) return <EmptyState icon={HelpCircle} title="Nenhuma pergunta cadastrada" subtitle="As perguntas frequentes aparecem aqui assim que forem publicadas." />;
    if (faqs.length === 0 && hasSearch) return <SearchEmpty />;

    const byCategory = groupByCategory<Faq>(faqs);

    return (
        <div className="space-y-6">
            {byCategory.map(([cat, list]) => (
                <section key={cat}>
                    <h3 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">{cat}</h3>
                    <div className="bg-white dark:bg-[#22262e] border border-slate-200 dark:border-slate-700 rounded-2xl divide-y divide-slate-100 dark:divide-slate-800 overflow-hidden">
                        {list.map((f, idx) => {
                            const open = openId === f.id;
                            const isFirst = idx === 0;
                            const isLast = idx === list.length - 1;
                            const btnRounded = `${isFirst ? 'rounded-t-2xl' : ''} ${isLast && !open ? 'rounded-b-2xl' : ''}`;
                            return (
                                <div key={f.id}>
                                    <button
                                        onClick={() => setOpenId(open ? null : f.id)}
                                        className={`w-full text-left p-4 sm:p-5 flex items-center justify-between gap-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-emerald-500 ${btnRounded}`}
                                        aria-expanded={open}
                                    >
                                        <span className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">{f.question}</span>
                                        <ChevronRight className={`w-4 h-4 text-slate-400 shrink-0 transition-transform ${open ? 'rotate-90 text-emerald-500' : ''}`} />
                                    </button>
                                    <div
                                        className="grid transition-all duration-300 ease-out"
                                        style={{ gridTemplateRows: open ? '1fr' : '0fr' }}
                                    >
                                        <div className="overflow-hidden">
                                            <div className="px-4 sm:px-5 pb-5 pt-0">
                                                <p className="text-sm text-slate-600 dark:text-slate-300 whitespace-pre-line leading-relaxed">{f.answer}</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </section>
            ))}
        </div>
    );
};

// --- Articles ---

const ArticlesList: React.FC<{ articles: Article[]; onOpen: (slug: string) => void; totalEmpty: boolean; hasSearch: boolean }> = ({ articles, onOpen, totalEmpty, hasSearch }) => {
    if (totalEmpty) return <EmptyState icon={FileText} title="Nenhum artigo ainda" subtitle="Os guias aparecem aqui assim que forem publicados." />;
    if (articles.length === 0 && hasSearch) return <SearchEmpty />;

    const byCategory = groupByCategory<Article>(articles);

    return (
        <div className="space-y-6">
            {byCategory.map(([cat, list]) => (
                <section key={cat}>
                    <h3 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">{cat}</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {list.map(a => (
                            <button
                                key={a.id}
                                onClick={() => onOpen(a.slug)}
                                className="text-left bg-white dark:bg-[#22262e] border border-slate-200 dark:border-slate-700 rounded-xl p-4 sm:p-5 hover:border-emerald-500 dark:hover:border-emerald-500 hover:shadow-md transition group focus:outline-none focus:ring-2 focus:ring-emerald-500"
                            >
                                <div className="flex items-start gap-3">
                                    <div className="shrink-0 w-9 h-9 bg-violet-50 dark:bg-violet-900/20 text-violet-600 dark:text-violet-400 rounded-lg flex items-center justify-center">
                                        <FileText className="w-4 h-4" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <h4 className="text-sm font-bold text-slate-900 dark:text-white mb-1 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition">{a.title}</h4>
                                        <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2">
                                            {a.content.replace(/[#*`>\-]/g, '').slice(0, 120)}…
                                        </p>
                                    </div>
                                </div>
                            </button>
                        ))}
                    </div>
                </section>
            ))}
        </div>
    );
};

const ArticleReader: React.FC<{ article: Article; all: Article[]; onBack: () => void; onOpen: (slug: string) => void }> = ({ article, all, onBack, onOpen }) => {
    const related = useMemo(
        () => all.filter(a => a.category === article.category && a.id !== article.id).slice(0, 5),
        [article, all]
    );

    return (
        <div className="space-y-4">
            <BackBar onBack={onBack} label="Voltar para artigos" />
            <div className="grid grid-cols-1 lg:grid-cols-[1fr_240px] gap-8">
                <article className="prose prose-slate dark:prose-invert prose-sm sm:prose-base max-w-none prose-headings:font-bold prose-h1:text-2xl prose-h2:text-xl prose-h3:text-base prose-a:text-emerald-600 dark:prose-a:text-emerald-400 prose-code:bg-slate-100 dark:prose-code:bg-slate-800 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:text-xs prose-code:before:content-none prose-code:after:content-none prose-blockquote:border-emerald-500 prose-blockquote:text-slate-600 dark:prose-blockquote:text-slate-300">
                    <div className="text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider mb-2 not-prose">{article.category}</div>
                    <h1 className="not-prose text-2xl font-bold text-slate-900 dark:text-white mb-4">{article.title}</h1>
                    <ReactMarkdown>{article.content}</ReactMarkdown>
                </article>
                {related.length > 0 && (
                    <aside className="lg:sticky lg:top-4 self-start">
                        <h3 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">Veja também</h3>
                        <nav className="space-y-1">
                            {related.map(r => (
                                <button
                                    key={r.id}
                                    onClick={() => onOpen(r.slug)}
                                    className="w-full text-left text-sm text-slate-600 dark:text-slate-300 hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition px-3 py-2 rounded-lg"
                                >
                                    {r.title}
                                </button>
                            ))}
                        </nav>
                    </aside>
                )}
            </div>
        </div>
    );
};

// --- Contact ---

const ContactPanel: React.FC<{ contact: ContactInfo }> = ({ contact }) => {
    const channels: { icon: any; label: string; value: string; href: string; color: string; external?: boolean }[] = [];
    if (contact.whatsapp) {
        const num = contact.whatsapp.replace(/\D/g, '');
        channels.push({ icon: MessageCircle, label: 'WhatsApp', value: contact.whatsapp, href: `https://wa.me/${num}`, color: 'emerald', external: true });
    }
    if (contact.email) {
        channels.push({ icon: Mail, label: 'E-mail', value: contact.email, href: `mailto:${contact.email}`, color: 'indigo' });
    }
    if (contact.phone) {
        const num = contact.phone.replace(/\D/g, '');
        channels.push({ icon: Phone, label: 'Telefone', value: contact.phone, href: `tel:${num}`, color: 'violet' });
    }

    if (channels.length === 0) {
        return <EmptyState icon={MessageSquare} title="Canais ainda não configurados" subtitle="Avise o time administrativo para cadastrar os canais de contato." />;
    }

    const tones: Record<string, string> = {
        emerald: 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400',
        indigo: 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400',
        violet: 'bg-violet-50 dark:bg-violet-900/20 text-violet-600 dark:text-violet-400',
    };

    return (
        <div>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-5">
                Escolha o canal que preferir — respondemos em horário comercial.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 max-w-4xl">
                {channels.map((c, i) => (
                    <a
                        key={i}
                        href={c.href}
                        target={c.external ? '_blank' : undefined}
                        rel="noopener noreferrer"
                        className="group bg-white dark:bg-[#22262e] border border-slate-200 dark:border-slate-700 rounded-2xl p-5 hover:border-emerald-500 dark:hover:border-emerald-500 hover:shadow-md transition focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    >
                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-3 ${tones[c.color]}`}>
                            <c.icon className="w-6 h-6" />
                        </div>
                        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">{c.label}</div>
                        <div className="text-sm font-bold text-slate-900 dark:text-white mb-2 break-all">{c.value}</div>
                        <div className="text-xs font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                            Iniciar conversa
                            <ChevronRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
                        </div>
                    </a>
                ))}
            </div>
        </div>
    );
};

// --- Shared ---

const BackBar: React.FC<{ onBack: () => void; label: string }> = ({ onBack, label }) => (
    <button
        onClick={onBack}
        className="flex items-center gap-1.5 text-xs font-bold text-slate-500 dark:text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 transition"
    >
        <ArrowLeft className="w-3.5 h-3.5" /> {label}
    </button>
);

const EmptyState: React.FC<{ icon: any; title: string; subtitle: string }> = ({ icon: Icon, title, subtitle }) => (
    <div className="text-center py-20 bg-white dark:bg-[#22262e] border border-dashed border-slate-300 dark:border-slate-700 rounded-2xl">
        <Icon className="w-12 h-12 text-slate-300 dark:text-slate-700 mx-auto mb-3" />
        <h3 className="text-base font-bold text-slate-700 dark:text-slate-200 mb-1">{title}</h3>
        <p className="text-sm text-slate-500 dark:text-slate-400 max-w-sm mx-auto">{subtitle}</p>
    </div>
);

const SearchEmpty: React.FC = () => (
    <div className="text-center py-16 bg-white dark:bg-[#22262e] border border-dashed border-slate-300 dark:border-slate-700 rounded-2xl">
        <Search className="w-10 h-10 text-slate-300 dark:text-slate-700 mx-auto mb-3" />
        <h3 className="text-sm font-bold text-slate-700 dark:text-slate-200 mb-1">Nenhum resultado nesta aba</h3>
        <p className="text-xs text-slate-500 dark:text-slate-400">Tente outra palavra ou troque de aba.</p>
    </div>
);

const ErrorState: React.FC<{ message: string; onRetry: () => void }> = ({ message, onRetry }) => (
    <div className="text-center py-20 mt-10">
        <h2 className="text-base font-bold text-red-600 dark:text-red-400 mb-2">{message}</h2>
        <button onClick={onRetry} className="text-sm font-bold text-emerald-600 dark:text-emerald-400 hover:underline">
            Tentar novamente
        </button>
    </div>
);

// --- Skeleton (espelha layout real: header + tabs + grid 3-col de cards) ---

const LoadingSkeleton: React.FC = () => (
    <div className="space-y-6 animate-pulse">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="space-y-2">
                <div className="h-7 w-56 bg-slate-200 dark:bg-slate-800 rounded-lg" />
                <div className="h-4 w-72 bg-slate-200 dark:bg-slate-800 rounded" />
            </div>
            <div className="h-10 w-full sm:w-80 bg-slate-200 dark:bg-slate-800 rounded-xl" />
        </div>

        {/* Tabs */}
        <div className="border-b border-slate-200 dark:border-slate-700/50">
            <div className="flex items-center gap-1">
                {[0, 1, 2, 3].map(i => (
                    <div key={i} className="h-11 w-28 bg-slate-200 dark:bg-slate-800 rounded-t-lg -mb-px" />
                ))}
            </div>
        </div>

        {/* Cards grid (espelha layout de vídeos / artigos) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[0, 1, 2, 3, 4, 5].map(i => (
                <div key={i} className="bg-white dark:bg-[#22262e] border border-slate-200 dark:border-slate-700 rounded-2xl overflow-hidden">
                    <div className="aspect-video bg-slate-200 dark:bg-slate-800" />
                    <div className="p-4 space-y-2">
                        <div className="h-4 w-3/4 bg-slate-200 dark:bg-slate-800 rounded" />
                        <div className="h-3 w-full bg-slate-200 dark:bg-slate-800 rounded" />
                        <div className="h-3 w-2/3 bg-slate-200 dark:bg-slate-800 rounded" />
                    </div>
                </div>
            ))}
        </div>
    </div>
);
