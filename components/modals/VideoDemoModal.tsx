import React from 'react';
import { X, Play, Monitor, Layers, Map as MapIcon, Database, Video as VideoIcon } from 'lucide-react';
import * as saasService from '../../services/saasService';
import { useLanguage } from '../../LanguageContext';

interface Video {
    id: string;
    title: string;
    description: string;
    url: string; // Embed URL
    icon: string;
}

const ICON_MAP: Record<string, React.ReactNode> = {
    'Monitor': <Monitor className="w-5 h-5" />,
    'MapIcon': <MapIcon className="w-5 h-5" />,
    'Layers': <Layers className="w-5 h-5" />,
    'Database': <Database className="w-5 h-5" />,
    'Video': <VideoIcon className="w-5 h-5" />,
};



interface VideoDemoModalProps {
    isOpen: boolean;
    onClose: () => void;
    supportPhone?: string | null;
}

export const VideoDemoModal: React.FC<VideoDemoModalProps> = ({ isOpen, onClose, supportPhone }) => {
    const { t } = useLanguage();
    const [videos, setVideos] = React.useState<Video[]>([]);
    const [selectedVideo, setSelectedVideo] = React.useState<Video | null>(null);
    const [loading, setLoading] = React.useState(true);

    React.useEffect(() => {
        if (isOpen) {
            const fetchVideos = async () => {
                setLoading(true);
                try {
                    const data = await saasService.getPublicDemoVideos();
                    setVideos(data);
                    if (data.length > 0) {
                        setSelectedVideo(data[0]);
                    }
                } catch (error) {
                    console.error('Failed to fetch demo videos', error);
                } finally {
                    setLoading(false);
                }
            };
            fetchVideos();
        }
    }, [isOpen]);

    if (!isOpen) return null;


    return (
        <div className="fixed inset-0 z-[5000] flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-sm animate-in fade-in duration-300">
            <div className="bg-slate-900 rounded-3xl shadow-2xl w-full max-w-6xl overflow-hidden border border-slate-800 flex flex-col md:flex-row h-[90vh] md:h-[80vh]">

                {/* Sidebar - Video Selection */}
                <div className="w-full md:w-80 bg-slate-950 border-b md:border-b-0 md:border-r border-slate-800 flex flex-col overflow-hidden">
                    <div className="p-6 border-b border-slate-800 flex justify-between items-center">
                        <div>
                            <h2 className="text-xl font-bold text-white">{t('demo_modal_title')}</h2>
                            <p className="text-xs text-slate-500 uppercase tracking-widest font-bold mt-1">{t('demo_modal_subtitle')}</p>
                        </div>
                        <button onClick={onClose} className="md:hidden p-2 hover:bg-slate-900 rounded-xl text-slate-400">
                            <X className="w-6 h-6" />
                        </button>
                    </div>

                    <div className="flex-1 overflow-y-auto p-4 space-y-2">
                        {loading ? (
                            <div className="flex items-center justify-center h-40">
                                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500"></div>
                            </div>
                        ) : videos.length > 0 ? (
                            videos.map((video) => (
                                <button
                                    key={video.id}
                                    onClick={() => setSelectedVideo(video)}
                                    className={`w-full p-4 rounded-2xl flex items-start gap-4 transition-all text-left ${selectedVideo?.id === video.id
                                        ? 'bg-emerald-500/10 border border-emerald-500/50 text-emerald-400'
                                        : 'hover:bg-slate-900 border border-transparent text-slate-400 hover:text-slate-300'
                                        }`}
                                >
                                    <div className={`p-2 rounded-lg ${selectedVideo?.id === video.id ? 'bg-emerald-500 text-white' : 'bg-slate-800'}`}>
                                        {ICON_MAP[video.icon] || <VideoIcon className="w-5 h-5" />}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <h3 className="font-bold text-sm truncate">{video.title}</h3>
                                        <p className="text-xs opacity-60 line-clamp-2 mt-1 leading-relaxed">{video.description}</p>
                                    </div>
                                </button>
                            ))
                        ) : (
                            <p className="text-center text-slate-500 mt-10">{t('demo_modal_no_videos')}</p>
                        )}
                    </div>

                    <div className="p-6 bg-slate-950 border-t border-slate-800 hidden md:block">
                        <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold text-center">
                            {t('demo_modal_footer')}
                        </p>
                    </div>
                </div>

                {/* Main Player Area */}
                <div className="flex-1 flex flex-col bg-slate-900 relative">
                    <button
                        onClick={onClose}
                        className="absolute top-6 right-6 z-10 p-2 bg-slate-950/50 hover:bg-slate-800 rounded-full text-white transition-colors hidden md:block border border-slate-700/50 backdrop-blur-md"
                    >
                        <X className="w-6 h-6" />
                    </button>

                    <div className="flex-1 p-6 flex flex-col items-center justify-center">
                        <div className="w-full h-full rounded-2xl overflow-hidden bg-black shadow-2xl border border-slate-800 relative group">
                            {selectedVideo ? (
                                <iframe
                                    src={selectedVideo.url}
                                    title={selectedVideo.title}
                                    className="w-full h-full"
                                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                    allowFullScreen
                                ></iframe>
                            ) : (
                                <div className="flex items-center justify-center h-full text-slate-500">
                                    {t('demo_modal_select_msg')}
                                </div>
                            )}
                        </div>

                        <div className="w-full mt-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
                            <div>
                                <h1 className="text-2xl font-bold text-white flex items-center gap-3">
                                    <Play className="w-6 h-6 text-emerald-500 fill-emerald-500" />
                                    {selectedVideo?.title || t('demo_modal_select_msg')}
                                </h1>
                                <p className="text-slate-400 mt-2 max-w-2xl">
                                    {selectedVideo?.description}
                                </p>
                            </div>

                            <button
                                className="px-6 py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold transition-all shadow-lg shadow-emerald-600/20 whitespace-nowrap"
                                onClick={() => {
                                    const rawPhone = supportPhone || '55XXXXXXXXXXX';
                                    const sanitizedPhone = rawPhone.replace(/\D/g, '');
                                    window.open(`https://api.whatsapp.com/send?phone=${sanitizedPhone}&text=Olá, vi o vídeo de demonstração e gostaria de saber mais!`, '_blank');
                                }}
                            >
                                {t('demo_modal_cta')}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
