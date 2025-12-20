
import React, { createContext, useState, useContext, ReactNode } from 'react';

type Language = 'en' | 'pt';

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
}

const translations = {
  en: {
    // Theme
    'theme_light': 'Light Mode',
    'theme_dark': 'Dark Mode',

    // Login & Dashboard
    'enter_btn': 'Enter System',
    'register_btn': 'Create Account',
    'no_account': "Don't have an account?",
    'already_have_account': 'Already have an account?',
    'register_title': 'Create FTTH Planner Account',
    'back_to_login': 'Back to Login',
    'registration_success': 'Account created! You can now log in.',
    'registration_failed': 'Registration failed. Username might be taken.',
    'welcome': 'Welcome, {name}',
    'logout': 'Logout',
    'my_projects': 'My Projects',
    'create_new_project_btn': 'Create New Project',
    'no_projects': 'No projects found. Create your first one!',
    'last_modified': 'Last modified: {date}',
    'open_project': 'Open Project',
    'exit_project': 'Exit to Dashboard',
    'delete_project_confirm': 'Are you sure you want to delete project "{name}"?',

    // App / Sidebar
    'app_title': 'FTTH Planner',
    'tools': 'Tools',
    'settings': 'Settings',
    'system_settings': 'Settings',
    'view_options': 'View Options',
    'toggle_labels': 'Labels',
    'mode_view': 'Selection / Nav',
    'mode_move': 'Move Elements',
    'mode_otdr': 'OTDR Trace',
    'mode_add_cto': 'Place CTO',
    'mode_add_pop': 'Place POP',
    'mode_draw_cable': 'Draw Cable',
    'mode_connect_cable': 'Connect Cable',
    'select_project_placeholder': 'Select Project...',
    'ai_audit': 'AI Network Audit',
    'analyzing': 'Analyzing...',
    'tooltip_view': 'Navigation Mode: Click markers or cables to select/edit.',
    'tooltip_move': 'Move Mode: Drag CTOs or POPs to adjust position.',
    'tooltip_otdr': 'OTDR Mode: Click a cable to locate a distance/event.',
    'tooltip_add_cto': 'Placement Mode: Click on map to add CTO.',
    'tooltip_add_pop': 'Placement Mode: Click on map to add a Central Office (POP).',
    'tooltip_draw_cable': 'Drawing: Click anywhere to draw cable. Click markers to snap.',
    'tooltip_draw_cable_start': 'Drawing: Click map or Node to start cable.',
    'tooltip_connect': 'Connection Mode: Click cable line to add SPLIT point. Drag point to Node to connect.',
    'ai_report_title': 'AI Engineer Report',
    'deployment_progress': 'Deployment Progress',
    'search_placeholder': 'Search CTO or POP...',
    'search_no_results': 'No results found',

    // Toasts
    'toast_imported': 'Imported {ctos} CTOs and {cables} Cables',
    'toast_cto_added': 'CTO added successfully',
    'toast_pop_added': 'POP added successfully',
    'toast_cto_splicing_saved': 'CTO Splicing saved',
    'toast_pop_saved': 'POP configuration configuration saved',
    'toast_cto_deleted': 'CTO deleted',
    'toast_pop_deleted': 'POP deleted',
    'toast_cable_updated': 'Cable updated',
    'toast_cable_deleted': 'Cable deleted',
    'toast_cable_created': 'Cable created successfully',
    'toast_cable_connected_start': 'Cable start connected to {name}',
    'toast_cable_connected_end': 'Cable end connected to {name}',
    'toast_cable_split': 'Cable split (Sangria) and connected to {name}',
    'import_error': 'Failed to import file. See console for details.',
    'import_no_geo': 'No compatible geometry (Points or Lines) found in this file.',

    // OTDR Messages & Errors
    'otdr_title': 'OTDR Calculator',
    'otdr_distance_lbl': 'Distance (Meters)',
    'otdr_direction': 'Direction',
    'otdr_from_start': 'From Start/Node A',
    'otdr_from_end': 'From End/Node B',
    'otdr_locate': 'Locate Event',
    'otdr_result': 'Event Location',
    'otdr_error_length': 'Distance exceeds cable length ({length}m)',
    'otdr_trace_start_error': 'OTDR Trace: Please start from a cable fiber port.',
    'otdr_cable_not_found': 'OTDR Error: Cable not found.',
    'otdr_conn_mismatch': 'OTDR Error: Cable connectivity mismatch.',
    'otdr_end_open': 'OTDR: End of fiber reached (Open End).',
    'otdr_next_node_error': 'OTDR Error: Next node not found.',
    'otdr_fiber_end_node': 'OTDR: Fiber ends at {node} (Not Spliced).',
    'otdr_event_equipment': 'OTDR: Event at {node} (Equipment Connection).',
    'otdr_max_depth': 'OTDR: Max trace depth reached.',
    'otdr_success_cable': 'Found inside cable {name}',
    'otdr_trace_msg': 'Trace from selected fiber',
    'otdr_instruction_banner': 'Click a fiber port to measure distance.',
    'otdr_event_tooltip': 'OTDR Event',

    // Common
    'save': 'Save',
    'cancel': 'Cancel',
    'delete': 'Delete',
    'confirm_delete': 'Confirm Delete',
    'name': 'Name',
    'status': 'Status',
    'color': 'Color',
    'id': 'ID',
    'manage_splicing': 'Manage Splicing',
    'manage_pop': 'Manage Rack & Patching',
    'unsaved_changes': 'Unsaved Changes',
    'unsaved_changes_msg': 'You have unsaved changes. Do you want to save them before closing?',
    'discard': 'Discard',
    'save_and_close': 'Save & Close',
    'clear_connections_confirm': 'Are you sure you want to clear ALL connections? This cannot be undone.',
    'clear_all': 'Clear All',
    'confirm_delete_equip_msg': 'Are you sure you want to delete {name}?',
    'delete_warning_msg': 'Warning: All connections associated with this {type} will be removed permanently.',

    // Statuses
    'status_PLANNED': 'Planned',
    'status_NOT_DEPLOYED': 'Not Deployed',
    'status_DEPLOYED': 'Deployed',
    'status_CERTIFIED': 'Certified',

    // CTO/POP Details
    'edit_cto': 'Edit CTO',
    'edit_pop': 'Edit POP',
    'cto_info': 'CTO Information',
    'pop_info': 'POP Information',
    'inputs': 'Inputs',
    'connections': 'Connections',
    'spliced': 'Spliced',
    'patched': 'Patched',
    'splitters': 'Splitters',
    'equipment': 'Equipment',
    'backbone_cables': 'Backbone Cables',
    'confirm_delete_cto_msg': 'Confirm deletion of {name}? All connected cables will be removed.',
    'confirm_delete_pop_msg': 'Confirm deletion of POP {name}? This will remove all racks, equipment, and connected cables.',
    'delete_cto_btn': 'Delete CTO',
    'delete_pop_btn': 'Delete POP',

    // Cable Editor
    'edit_cable': 'Edit Cable',
    'cable_name': 'Cable Name',
    'fiber_count': 'Fiber Count',
    'loose_tubes': 'Loose Tubes',
    'tube': 'Tube',
    'estimated_length': 'Estimated Length',
    'map_color': 'Map Color',
    'disabled': 'Disabled',
    'save_changes': 'Save Changes',
    'confirm_delete_cable_msg': 'Confirm deletion of {name}? This will remove associated fusion splices.',

    // Project Manager / Create Modal
    'project_manager': 'Project Manager',
    'create_project': 'Create Project',
    'new_project_placeholder': 'Project Name (e.g. Center Expansion)',
    'import_kmz_title': 'Import KMZ/KML to Current Project',
    'import_kmz_desc': 'Clique to upload .kmz or .kml file',
    'processing': 'Processing...',
    'your_projects': 'Your Projects',
    'load_project': 'Load',
    'delete_last_project_error': 'Cannot delete the last project.',
    'items_count': 'Items: {ctos} CTOs, {cables} Cabos',
    'search_location': 'Initial Location',
    'search_location_placeholder': 'Search city or address...',
    'searching_location': 'Searching...',
    'no_location_results': 'No location found',
    'pinned_location': 'Pinned Location',
    'create_project_modal_title': 'Create New Project',
    'map_instruction': 'Drag the map or click to set the project center.',
    'confirm_create': 'Create Project',
    'snap_distance_lbl': 'Auto-Connect Distance (meters)',
    'snap_distance_help': 'Maximum distance for a cable to automatically snap to a box (CTO/POP) when dragging.',

    // CTO Internal Editor
    'splicing_title': 'Splicing: {name}',
    'dio_splicing_title': 'DIO Splicing: {name}',
    'splicing_help': 'Mouse Wheel to Zoom. Drag Background to Pan. Double-click points to remove.',
    'add_splitter': 'Splitter',
    'add_fusion': 'Fusion',
    'auto_splice': 'Auto Pass-Through',
    'reset_connections': 'Reset Connections',
    'drop_to_connect': 'Drop on a port to connect, or background to disconnect.',
    'moving_point': 'Moving control point...',
    'panning': 'Panning',
    'general_help': 'Drag ports to connect. Click lines to add points. Double-click points to remove. Double-click names to rename.',
    'rename_fusion': 'Rename Fusion Point:',
    'export_pdf': 'Export PDF',
    'generating_pdf': 'Generating...',
    'tool_vfl': 'VFL (Visual Fault Locator)',
    'vfl_active_msg': 'VFL Active: Click any port to inject light.',
    'vfl_active_status': 'VFL Active',
    'vfl_source_label': 'Source: {name}',
    'turn_off': 'Turn Off',
    'source_cable': 'Source Cable',
    'target_cable': 'Target Cable',
    'perform_splice': 'Fuse All Fibers',
    'splice_success': 'Successfully fused {count} fibers.',
    'smart_align': 'Smart Align',

    // DIO Editor Strings
    'link_cables': 'Link Cables',
    'no_cables_linked': 'No Cables Linked',
    'link_cables_help': 'You can link cables to this DIO using the button above.',
    'connect_fiber_tray': 'Connect Fiber to DIO Tray',
    'connected_to_port': 'Currently connected to Port {port}',
    'select_tray_port_help': 'Select a tray port below to splice this fiber.',
    'green_light_help': 'Green lights indicate active OLT signal flowing to the cable.',

    // New Translations for Trays
    'tray': 'Tray',
    'trays': 'Trays',

    // POP Editor
    'pop_editor_title': 'POP Management: {name}',
    'add_olt': 'Add OLT',
    'add_dio': 'Add DIO',
    'olt_ports': 'PON Ports',
    'dio_ports': 'Ports',
    'rack_view': 'Rack View',

    // Map Layers
    'map_street': 'Street',
    'map_satellite': 'Satellite',
    'map_layers': 'Layers',
    'layer_cables': 'Cables',
    'layer_ctos': 'CTOs',
    'layer_pops': 'POPs'
  },
  pt: {
    // Theme
    'theme_light': 'Modo Claro',
    'theme_dark': 'Modo Escuro',

    // Login & Dashboard
    'enter_btn': 'Entrar no Sistema',
    'register_btn': 'Criar Conta',
    'no_account': 'Não tem uma conta?',
    'already_have_account': 'Já tem uma conta?',
    'register_title': 'Criar Conta FTTH Planner',
    'back_to_login': 'Voltar para o Login',
    'registration_success': 'Conta criada! Agora você pode entrar.',
    'registration_failed': 'Falha no registro. Usuário já pode existir.',
    'welcome': 'Bem-vindo, {name}',
    'logout': 'Sair',
    'my_projects': 'Meus Projetos',
    'create_new_project_btn': 'Criar Novo Projeto',
    'no_projects': 'Nenhum projeto encontrado. Crie o primeiro!',
    'last_modified': 'Última modificação: {date}',
    'open_project': 'Abrir Projeto',
    'exit_project': 'Sair para o Painel',
    'delete_project_confirm': 'Tem certeza que deseja deletar o projeto "{name}"?',

    // App / Sidebar
    'app_title': 'Planejador FTTH',
    'tools': 'Ferramentas',
    'settings': 'Configurações',
    'system_settings': 'Configurações',
    'view_options': 'Opções de Visualização',
    'toggle_labels': 'Nomes',
    'mode_view': 'Seleção / Nav',
    'mode_move': 'Mover Elementos',
    'mode_otdr': 'OTDR Trace',
    'mode_add_cto': 'Adicionar CTO',
    'mode_add_pop': 'Adicionar POP',
    'mode_draw_cable': 'Desenhar Cabo',
    'mode_connect_cable': 'Conectar / Sangria',
    'select_project_placeholder': 'Selecione o Projeto...',
    'ai_audit': 'Auditoria IA',
    'analyzing': 'Analisando...',
    'tooltip_view': 'Navegação: Clique para editar. Elementos estão travados.',
    'tooltip_move': 'Modo Mover: Arraste CTOs ou POPs para ajustar a posição.',
    'tooltip_otdr': 'Modo OTDR: Clique em um cabo para localizar um evento.',
    'tooltip_add_cto': 'Posicionamento: Clique no mapa para adicionar CTO.',
    'tooltip_add_pop': 'Posicionamento: Clique no mapa para adicionar um POP (Central).',
    'tooltip_draw_cable': 'Desenhando: Clique no mapa ou nó para finalizar o cabo.',
    'tooltip_draw_cable_start': 'Desenhando: Clique no mapa ou Nó para iniciar o cabo.',
    'tooltip_connect': 'Conexão: Clique no cabo para criar ponto de SANGRIA. Arraste até o Nó.',
    'ai_report_title': 'Relatório de Engenharia IA',
    'deployment_progress': 'Progresso de Implantação',
    'search_placeholder': 'Buscar CTO ou POP...',
    'search_no_results': 'Nenhum resultado',

    // Toasts
    'toast_imported': 'Importado {ctos} CTOs e {cables} Cabos',
    'toast_cto_added': 'CTO adicionada com sucesso',
    'toast_pop_added': 'POP adicionado com sucesso',
    'toast_cto_splicing_saved': 'Fusões da CTO salvas',
    'toast_pop_saved': 'Configuração do POP salva',
    'toast_cto_deleted': 'CTO deletada',
    'toast_pop_deleted': 'POP deletado',
    'toast_cable_updated': 'Cabo atualizado',
    'toast_cable_deleted': 'Cabo deletado',
    'toast_cable_created': 'Cabo criado com sucesso',
    'toast_cable_connected_start': 'Início do cabo conectado a {name}',
    'toast_cable_connected_end': 'Fim do cabo conectado a {name}',
    'toast_cable_split': 'Cabo sangrado e conectado a {name}',
    'import_error': 'Falha ao importar arquivo. Veja o console.',
    'import_no_geo': 'Nenhuma geometria compatível (Pontos ou Linhas) encontrada.',

    // OTDR Messages & Errors
    'otdr_title': 'Calculadora OTDR',
    'otdr_distance_lbl': 'Distância da Medição (m)',
    'otdr_direction': 'Direção',
    'otdr_from_start': 'Do Início (Nó A)',
    'otdr_from_end': 'Do Fim (Nó B)',
    'otdr_locate': 'Localizar Evento',
    'otdr_result': 'Local do Evento',
    'otdr_error_length': 'Distância excede o tamanho do cabo ({length}m)',
    'otdr_trace_start_error': 'Rastreio OTDR: Por favor comece de uma porta de fibra de cabo.',
    'otdr_cable_not_found': 'Erro OTDR: Cabo não encontrado.',
    'otdr_conn_mismatch': 'Erro OTDR: Inconsistência na conectividade do cabo.',
    'otdr_end_open': 'OTDR: Fim da fibra alcançado (Ponta Aberta).',
    'otdr_next_node_error': 'Erro OTDR: Próximo nó não encontrado.',
    'otdr_fiber_end_node': 'OTDR: Fibra termina em {node} (Não fusionada).',
    'otdr_event_equipment': 'OTDR: Evento em {node} (Conexão com Equipamento).',
    'otdr_max_depth': 'OTDR: Profundidade máxima de rastreio atingida.',
    'otdr_success_cable': 'Encontrado dentro do cabo {name}',
    'otdr_trace_msg': 'Rastrear a partir da fibra selecionada',
    'otdr_instruction_banner': 'Clique em uma porta de fibra para medir a distância.',
    'otdr_event_tooltip': 'Evento OTDR',

    // Common
    'save': 'Salvar',
    'cancel': 'Cancelar',
    'delete': 'Deletar',
    'confirm_delete': 'Confirmar Deleção',
    'name': 'Nome',
    'status': 'Status',
    'color': 'Cor',
    'id': 'ID',
    'manage_splicing': 'Gerenciar Fusões',
    'manage_pop': 'Gerenciar Rack e Patching',
    'unsaved_changes': 'Alterações Não Salvas',
    'unsaved_changes_msg': 'Você tem alterações não salvas. Deseja salvá-las antes de sair?',
    'discard': 'Descartar',
    'save_and_close': 'Salvar e Sair',
    'clear_connections_confirm': 'Tem certeza que deseja limpar TODAS as conexões? Isso não pode ser desfeito.',
    'clear_all': 'Limpar Tudo',
    'confirm_delete_equip_msg': 'Tem certeza que deseja deletar {name}?',
    'delete_warning_msg': 'Aviso: Todas as conexões associadas a este {type} serão removidas permanentemente.',

    // Statuses
    'status_PLANNED': 'Em Projeto',
    'status_NOT_DEPLOYED': 'Não Implantado',
    'status_DEPLOYED': 'Implantado',
    'status_CERTIFIED': 'Certificado',

    // CTO/POP Details
    'edit_cto': 'Editar CTO',
    'edit_pop': 'Editar POP',
    'cto_info': 'Informações da CTO',
    'pop_info': 'Informações do POP',
    'inputs': 'Entradas',
    'connections': 'Conexões',
    'spliced': 'Fusões',
    'patched': 'Manobras',
    'splitters': 'Splitters',
    'equipment': 'Equipamentos',
    'backbone_cables': 'Cabos Backbone',
    'confirm_delete_cto_msg': 'Confirmar deleção de {name}? Todos os cabos conectados serão removidos.',
    'confirm_delete_pop_msg': 'Confirmar deleção do POP {name}? Isso removerá racks, equipamentos e cabos.',
    'delete_cto_btn': 'Deletar CTO',
    'delete_pop_btn': 'Deletar POP',

    // Cable Editor
    'edit_cable': 'Editar Cabo',
    'cable_name': 'Nome do Cabo',
    'fiber_count': 'Qtd. Fibras',
    'loose_tubes': 'Tubos Loose',
    'tube': 'Tubo',
    'estimated_length': 'Comprimento Est.',
    'map_color': 'Cor no Mapa',
    'disabled': 'Desativado',
    'save_changes': 'Salvar Alterações',
    'confirm_delete_cable_msg': 'Confirmar deleção de {name}? Isso removerá as fusões associadas.',

    // Project Manager / Create Modal
    'project_manager': 'Gerenciador de Projetos',
    'create_project': 'Criar Projeto',
    'new_project_placeholder': 'Nome do Projeto (ex: Expansão Centro)',
    'import_kmz_title': 'Importar KMZ/KML para Projeto Atual',
    'import_kmz_desc': 'Clique para enviar arquivo .kmz ou .kml',
    'processing': 'Processando...',
    'your_projects': 'Seus Projetos',
    'load_project': 'Carregar',
    'delete_last_project_error': 'Não é possível deletar o último projeto.',
    'items_count': 'Itens: {ctos} CTOs, {cables} Cabos',
    'search_location': 'Localização Inicial',
    'search_location_placeholder': 'Pesquise cidade ou endereço...',
    'searching_location': 'Buscando...',
    'no_location_results': 'Local não encontrado',
    'pinned_location': 'Local Fixado',
    'create_project_modal_title': 'Criar Novo Projeto',
    'map_instruction': 'Arraste o mapa ou clique para definir o centro do projeto.',
    'confirm_create': 'Criar Projeto',
    'snap_distance_lbl': 'Distância de Imã (metros)',
    'snap_distance_help': 'Distância máxima para um cabo "grudar" automaticamente em uma caixa (CTO/POP) ao arrastar.',

    // CTO Internal Editor
    'splicing_title': 'Fusão: {name}',
    'dio_splicing_title': 'Fusão DIO: {name}',
    'splicing_help': 'Role para Zoom. Arraste fundo para mover. Duplo-clique remove pontos.',
    'add_splitter': 'Splitter',
    'add_fusion': 'Fusão',
    'auto_splice': 'Auto Passante',
    'reset_connections': 'Resetar Conexões',
    'drop_to_connect': 'Solte na porta para conectar, ou no fundo para desconectar.',
    'moving_point': 'Movendo ponto de controle...',
    'panning': 'Movendo tela',
    'general_help': 'Arraste portas para conectar. Clique nas linhas para criar curvas. Duplo-clique para remover. Renomeie com duplo-clique.',
    'rename_fusion': 'Renomear Ponto de Fusão:',
    'export_pdf': 'Exportar PDF',
    'generating_pdf': 'Gerando...',
    'tool_vfl': 'VFL (Caneta Óptica)',
    'vfl_active_msg': 'VFL Ativo: Clique em qualquer porta para injetar a luz.',
    'vfl_active_status': 'VFL Ativo',
    'vfl_source_label': 'Fonte: {name}',
    'turn_off': 'Desligar',
    'source_cable': 'Cabo Origem',
    'target_cable': 'Cabo Destino',
    'perform_splice': 'Fusionar Tudo',
    'splice_success': 'Fusionadas {count} fibras com sucesso.',
    'smart_align': 'Alinhamento Inteligente',

    // DIO Editor Strings
    'link_cables': 'Vincular Cabos',
    'no_cables_linked': 'Nenhum Cabo Vinculado',
    'link_cables_help': 'Você pode vincular cabos a este DIO usando o botão acima.',
    'connect_fiber_tray': 'Conectar Fibra à Bandeja DIO',
    'connected_to_port': 'Atualmente conectado à Porta {port}',
    'select_tray_port_help': 'Selecione uma porta da bandeja abaixo para fusionar esta fibra.',
    'green_light_help': 'Luzes verdes indicam sinal OLT ativo fluindo para o cabo.',

    // New Translations for Trays
    'tray': 'Bandeja',
    'trays': 'Bandejas',

    // POP Editor
    'pop_editor_title': 'Gerenciamento POP: {name}',
    'add_olt': 'Add OLT',
    'add_dio': 'Add DIO',
    'olt_ports': 'Portas PON',
    'dio_ports': 'Portas',
    'rack_view': 'Visão do Rack',

    // Map Layers
    'map_street': 'Mapa Rua',
    'map_satellite': 'Satélite',
    'map_layers': 'Camadas',
    'layer_cables': 'Cabos',
    'layer_ctos': 'CTOs',
    'layer_pops': 'POPs'
  }
};

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [language, setLanguage] = useState<Language>('pt'); // Default to PT based on request

  const t = (key: string, params?: Record<string, string | number>) => {
    let text = translations[language][key as keyof typeof translations['en']] || key;

    if (params) {
      Object.entries(params).forEach(([k, v]) => {
        text = text.replace(`{${k}}`, String(v));
      });
    }
    return text;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};
