
import React, { useState, useCallback } from 'react';
import { useMapEvents, Polyline } from 'react-leaflet';
import L from 'leaflet';
import { useLanguage } from '../../LanguageContext';

interface CustomerDropDrawerProps {
    drawingState: {
        customerId: string;
        startLat: number;
        startLng: number;
        points: L.LatLng[];
    } | null;
    onUpdatePoints: (points: L.LatLng[]) => void;
    onCancel: () => void;
    onComplete: (ctoId: string) => void; // Triggered when CTO is clicked
}

export const CustomerDropDrawer: React.FC<CustomerDropDrawerProps> = ({ drawingState, onUpdatePoints, onCancel }) => {
    const { t } = useLanguage();
    const [cursorPosition, setCursorPosition] = useState<L.LatLng | null>(null);

    useMapEvents({
        mousemove(e) {
            if (drawingState) {
                setCursorPosition(e.latlng);
            }
        },
        click(e) {
            if (drawingState) {
                // Add point to path
                const newPoints = [...(drawingState.points || []), e.latlng];
                onUpdatePoints(newPoints);
            }
        },
        contextmenu(e) {
            if (drawingState) {
                L.DomEvent.preventDefault(e as any);
                onCancel();
            }
        },
        keydown(e) {
            if (drawingState && e.originalEvent.key === 'Escape') {
                onCancel();
            }
        }
    });

    if (!drawingState) return null;

    // Construct path: Start -> [Waypoints] -> Cursor
    const startPoint = L.latLng(drawingState.startLat, drawingState.startLng);
    const waypoints = drawingState.points || [];

    const displayPath = [startPoint, ...waypoints];
    if (cursorPosition) {
        displayPath.push(cursorPosition);
    }

    return (
        <>
            <Polyline
                positions={displayPath}
                pathOptions={{
                    color: '#000000',
                    weight: 1,
                    opacity: 1.0,
                    dashArray: 'none'
                }}
            />
            {cursorPosition && (
                <div style={{
                    position: 'fixed',
                    top: 80,
                    left: '50%',
                    transform: 'translateX(-50%)',
                    zIndex: 1000,
                    backgroundColor: 'rgba(0, 0, 0, 0.7)',
                    color: 'white',
                    padding: '8px 16px',
                    borderRadius: '20px',
                    pointerEvents: 'none',
                    fontWeight: 'bold',
                    backdropFilter: 'blur(4px)'
                }}>
                    {t('draw_drop_instruction')} - {waypoints.length > 0 ? t('select_cto_drop') : t('draw_drop_instruction')}
                    <div className="text-xs font-normal opacity-75 text-center mt-1">
                        {t('right_click_cancel')}
                    </div>
                </div>
            )}
        </>
    );
};
