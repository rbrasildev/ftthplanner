import React, { useMemo, useRef, useEffect } from 'react';
import { Marker, Tooltip } from 'react-leaflet';
import L from 'leaflet';
import { Customer } from '../../types';
import { renderToString } from 'react-dom/server';
import { Home } from 'lucide-react';

// Cache for icons
const iconCache = new Map<string, L.DivIcon>();

const createCustomerIcon = (status: string, isSelected: boolean, connectionStatus?: string | null) => {
    const key = `cust-${status}-${isSelected}-${connectionStatus || 'none'}`;

    if (iconCache.has(key)) return iconCache.get(key)!;

    let color = status === 'ACTIVE' ? '#22c55e' : (status === 'SUSPENDED' ? '#eab308' : '#ef4444');

    // connectionStatus overrides the default status color
    if (connectionStatus === 'online') color = '#22c55e';
    else if (connectionStatus === 'offline') color = '#ef4444';

    // Render the Lucide icon to string
    const iconHtml = renderToString(<Home color="white" size={10} />);

    const icon = L.divIcon({
        className: 'custom-customer-icon',
        html: `
            <div style="
                position: relative;
                background-color: ${color};
                border: 2px solid ${isSelected ? '#ffffff' : 'rgba(255,255,255,0.8)'};
                border-radius: 50%;
                width: 18px;
                height: 18px;
                display: flex;
                align-items: center;
                justify-content: center;
                box-shadow: 0 2px 4px rgba(0,0,0,0.5);
                ${isSelected ? 'transform: scale(1.2); box-shadow: 0 0 0 4px rgba(34, 197, 94, 0.4);' : ''}
            ">
                ${iconHtml}
            </div>
        `,
        iconSize: [18, 18],
        iconAnchor: [9, 9]
    });

    iconCache.set(key, icon);
    return icon;
};

// Individual customer marker - memoized to avoid re-render when parent callbacks change
const CustomerMarkerItem = React.memo(({ customer, isSelected, onCustomerClick, onContextMenu }: {
    customer: Customer;
    isSelected: boolean;
    onCustomerClick: (customer: Customer) => void;
    onContextMenu?: (e: L.LeafletMouseEvent, customer: Customer) => void;
}) => {
    const icon = useMemo(() =>
        createCustomerIcon(customer.status, isSelected, customer.connectionStatus),
        [customer.status, isSelected, customer.connectionStatus]
    );

    // Stable event handlers using refs - prevents Marker re-bindeing on parent re-render
    const onClickRef = useRef(onCustomerClick);
    const onCtxRef = useRef(onContextMenu);
    useEffect(() => { onClickRef.current = onCustomerClick; }, [onCustomerClick]);
    useEffect(() => { onCtxRef.current = onContextMenu; }, [onContextMenu]);

    const eventHandlers = useMemo(() => ({
        click: (e: any) => {
            L.DomEvent.stopPropagation(e);
            onClickRef.current(customer);
        },
        contextmenu: (e: any) => {
            if (onCtxRef.current) {
                L.DomEvent.stopPropagation(e);
                onCtxRef.current(e, customer);
            }
        }
    }), [customer]);

    return (
        <Marker
            position={[customer.lat, customer.lng]}
            icon={icon}
            eventHandlers={eventHandlers}
        >
            <Tooltip direction="top" offset={[0, -12]} opacity={0.9}>
                <div className="font-bold text-xs">{customer.name}</div>
                {customer.address && <div className="text-[10px] opacity-80 max-w-[150px] truncate">{customer.address}</div>}
            </Tooltip>
        </Marker>
    );
});

interface CustomersLayerProps {
    customers: Customer[];
    selectedId?: string | null;
    onCustomerClick: (customer: Customer) => void;
    visible: boolean;
    mapZoom: number;
    onContextMenu?: (e: L.LeafletMouseEvent, customer: Customer) => void;
}

export const CustomersLayer: React.FC<CustomersLayerProps> = React.memo(({ customers, selectedId, onCustomerClick, visible, mapZoom, onContextMenu }) => {
    if (!visible) return null;
    if (mapZoom < 14) return null;

    return (
        <>
            {customers.map(customer => (
                <CustomerMarkerItem
                    key={customer.id}
                    customer={customer}
                    isSelected={selectedId === customer.id}
                    onCustomerClick={onCustomerClick}
                    onContextMenu={onContextMenu}
                />
            ))}
        </>
    );
});
