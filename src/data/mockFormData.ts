// =============================================================================
// Mock Form Data - For testing dynamic form renderer without backend
// Based on Audix audit form structure
// =============================================================================

import { FormTab, FormField, OptionSet, OptionValue, Device, TabType, FieldType } from '../types';

// -----------------------------------------------------------------------------
// Mock Project ID
// -----------------------------------------------------------------------------
export const MOCK_PROJECT_ID = 'mock-project-001';

// -----------------------------------------------------------------------------
// Mock Devices
// -----------------------------------------------------------------------------
export const mockDevices: Device[] = [
  {
    id: 'device-001',
    localId: 'device-001',
    projectId: MOCK_PROJECT_ID,
    elementId: 'AC-01-B1-L1',
    name: 'Klimatyzator biurowy #1',
    building: 'Budynek A',
    level: 'Poziom 1',
    zone: 'Strefa biurowa',
    system: 'HVAC',
    group: 'Klimatyzacja',
    type: 'Klimatyzator',
    isNew: false,
    createdLocally: false,
    createdAt: Date.now() - 86400000,
    auditCount: 2,
    lastAuditAt: Date.now() - 3600000,
    syncStatus: 'synced',
  },
  {
    id: 'device-002',
    localId: 'device-002',
    projectId: MOCK_PROJECT_ID,
    elementId: 'VEN-02-B1-L2',
    name: 'Wentylator wywiewny #2',
    building: 'Budynek A',
    level: 'Poziom 2',
    zone: 'Strefa techniczna',
    system: 'HVAC',
    group: 'Wentylacja',
    type: 'Wentylator',
    isNew: false,
    createdLocally: false,
    createdAt: Date.now() - 172800000,
    auditCount: 1,
    syncStatus: 'synced',
  },
  {
    id: 'device-003',
    localId: 'device-003',
    projectId: MOCK_PROJECT_ID,
    elementId: 'PUMP-03-B2-L0',
    name: 'Pompa obiegowa #3',
    building: 'Budynek B',
    level: 'Piwnica',
    zone: 'Kotłownia',
    system: 'CO',
    group: 'Pompy',
    type: 'Pompa',
    isNew: true,
    createdLocally: true,
    createdByUserId: 'user-001',
    createdAt: Date.now() - 3600000,
    auditCount: 0,
    syncStatus: 'pending_upload',
  },
];

// -----------------------------------------------------------------------------
// Mock Form Tabs
// -----------------------------------------------------------------------------
export const mockFormTabs: FormTab[] = [
  {
    id: 'tab-001',
    projectId: MOCK_PROJECT_ID,
    tabNumber: 1,
    tabType: 'audit_form',
    title: 'Identyfikacja',
    displayOrder: 1,
    isActive: true,
  },
  {
    id: 'tab-002',
    projectId: MOCK_PROJECT_ID,
    tabNumber: 2,
    tabType: 'audit_form',
    title: 'Stan techniczny',
    displayOrder: 2,
    isActive: true,
  },
  {
    id: 'tab-003',
    projectId: MOCK_PROJECT_ID,
    tabNumber: 3,
    tabType: 'audit_form',
    title: 'Parametry pracy',
    displayOrder: 3,
    isActive: true,
  },
  {
    id: 'tab-004',
    projectId: MOCK_PROJECT_ID,
    tabNumber: 4,
    tabType: 'audit_form',
    title: 'Uwagi i zalecenia',
    displayOrder: 4,
    isActive: true,
  },
];

// -----------------------------------------------------------------------------
// Mock Option Sets
// -----------------------------------------------------------------------------
export const mockOptionSets: OptionSet[] = [
  {
    id: 'optset-condition',
    projectId: MOCK_PROJECT_ID,
    code: 'STAN_TECHNICZNY',
    name: 'Stan techniczny',
    source: 'excel',
  },
  {
    id: 'optset-yesno',
    projectId: MOCK_PROJECT_ID,
    code: 'TAK_NIE',
    name: 'Tak/Nie',
    source: 'excel',
  },
  {
    id: 'optset-priority',
    projectId: MOCK_PROJECT_ID,
    code: 'PRIORYTET',
    name: 'Priorytet',
    source: 'excel',
  },
  {
    id: 'optset-actions',
    projectId: MOCK_PROJECT_ID,
    code: 'DZIALANIA',
    name: 'Wymagane działania',
    source: 'excel',
  },
  {
    id: 'optset-manufacturer',
    projectId: MOCK_PROJECT_ID,
    code: 'PRODUCENT',
    name: 'Producent',
    source: 'excel',
  },
];

// -----------------------------------------------------------------------------
// Mock Option Values
// -----------------------------------------------------------------------------
export const mockOptionValues: OptionValue[] = [
  // Stan techniczny
  { id: 'opt-cond-1', optionSetId: 'optset-condition', value: 'dobry', label: 'Dobry', displayOrder: 1, isActive: true },
  { id: 'opt-cond-2', optionSetId: 'optset-condition', value: 'zadowalajacy', label: 'Zadowalający', displayOrder: 2, isActive: true },
  { id: 'opt-cond-3', optionSetId: 'optset-condition', value: 'wymaga_naprawy', label: 'Wymaga naprawy', displayOrder: 3, isActive: true },
  { id: 'opt-cond-4', optionSetId: 'optset-condition', value: 'zly', label: 'Zły - wymiana', displayOrder: 4, isActive: true },
  
  // Tak/Nie
  { id: 'opt-yn-1', optionSetId: 'optset-yesno', value: 'tak', label: 'Tak', displayOrder: 1, isActive: true },
  { id: 'opt-yn-2', optionSetId: 'optset-yesno', value: 'nie', label: 'Nie', displayOrder: 2, isActive: true },
  { id: 'opt-yn-3', optionSetId: 'optset-yesno', value: 'nie_dotyczy', label: 'Nie dotyczy', displayOrder: 3, isActive: true },
  
  // Priorytet
  { id: 'opt-pri-1', optionSetId: 'optset-priority', value: 'niski', label: 'Niski', displayOrder: 1, isActive: true },
  { id: 'opt-pri-2', optionSetId: 'optset-priority', value: 'sredni', label: 'Średni', displayOrder: 2, isActive: true },
  { id: 'opt-pri-3', optionSetId: 'optset-priority', value: 'wysoki', label: 'Wysoki', displayOrder: 3, isActive: true },
  { id: 'opt-pri-4', optionSetId: 'optset-priority', value: 'krytyczny', label: 'Krytyczny', displayOrder: 4, isActive: true },
  
  // Wymagane działania
  { id: 'opt-act-1', optionSetId: 'optset-actions', value: 'brak', label: 'Brak wymaganych działań', displayOrder: 1, isActive: true },
  { id: 'opt-act-2', optionSetId: 'optset-actions', value: 'konserwacja', label: 'Konserwacja', displayOrder: 2, isActive: true },
  { id: 'opt-act-3', optionSetId: 'optset-actions', value: 'naprawa', label: 'Naprawa', displayOrder: 3, isActive: true },
  { id: 'opt-act-4', optionSetId: 'optset-actions', value: 'wymiana_czesci', label: 'Wymiana części', displayOrder: 4, isActive: true },
  { id: 'opt-act-5', optionSetId: 'optset-actions', value: 'wymiana', label: 'Wymiana urządzenia', displayOrder: 5, isActive: true },
  { id: 'opt-act-6', optionSetId: 'optset-actions', value: 'przeglad_specjalistyczny', label: 'Przegląd specjalistyczny', displayOrder: 6, isActive: true },
  
  // Producent
  { id: 'opt-man-1', optionSetId: 'optset-manufacturer', value: 'carrier', label: 'Carrier', displayOrder: 1, isActive: true },
  { id: 'opt-man-2', optionSetId: 'optset-manufacturer', value: 'daikin', label: 'Daikin', displayOrder: 2, isActive: true },
  { id: 'opt-man-3', optionSetId: 'optset-manufacturer', value: 'mitsubishi', label: 'Mitsubishi Electric', displayOrder: 3, isActive: true },
  { id: 'opt-man-4', optionSetId: 'optset-manufacturer', value: 'lg', label: 'LG', displayOrder: 4, isActive: true },
  { id: 'opt-man-5', optionSetId: 'optset-manufacturer', value: 'samsung', label: 'Samsung', displayOrder: 5, isActive: true },
  { id: 'opt-man-6', optionSetId: 'optset-manufacturer', value: 'toshiba', label: 'Toshiba', displayOrder: 6, isActive: true },
  { id: 'opt-man-7', optionSetId: 'optset-manufacturer', value: 'panasonic', label: 'Panasonic', displayOrder: 7, isActive: true },
  { id: 'opt-man-8', optionSetId: 'optset-manufacturer', value: 'fujitsu', label: 'Fujitsu', displayOrder: 8, isActive: true },
  { id: 'opt-man-9', optionSetId: 'optset-manufacturer', value: 'bosch', label: 'Bosch', displayOrder: 9, isActive: true },
  { id: 'opt-man-10', optionSetId: 'optset-manufacturer', value: 'viessmann', label: 'Viessmann', displayOrder: 10, isActive: true },
  { id: 'opt-man-11', optionSetId: 'optset-manufacturer', value: 'inne', label: 'Inny producent', displayOrder: 11, isActive: true },
];

// -----------------------------------------------------------------------------
// Mock Form Fields
// -----------------------------------------------------------------------------
export const mockFormFields: FormField[] = [
  // Tab 1: Identyfikacja
  {
    id: 'field-001',
    projectId: MOCK_PROJECT_ID,
    formTabId: 'tab-001',
    tabNumber: 1,
    tabType: 'audit_form',
    displayOrder: 1,
    fieldType: 'readonlyInfo',
    label: 'Informacja o audycie',
    description: 'Przed rozpoczęciem audytu upewnij się, że masz dostęp do urządzenia i wszystkich niezbędnych narzędzi pomiarowych.',
    isRequired: false,
    isVisible: true,
    isActive: true,
  },
  {
    id: 'field-002',
    projectId: MOCK_PROJECT_ID,
    formTabId: 'tab-001',
    tabNumber: 1,
    tabType: 'audit_form',
    displayOrder: 2,
    fieldType: 'extendedList',
    label: 'Producent',
    question: 'Wybierz producenta urządzenia',
    optionSetId: 'optset-manufacturer',
    logicalDataColumnNumber: 1,
    targetDataColumnName: 'producent',
    isRequired: true,
    isVisible: true,
    isActive: true,
  },
  {
    id: 'field-003',
    projectId: MOCK_PROJECT_ID,
    formTabId: 'tab-001',
    tabNumber: 1,
    tabType: 'audit_form',
    displayOrder: 3,
    fieldType: 'text',
    label: 'Model urządzenia',
    question: 'Podaj model urządzenia (z tabliczki znamionowej)',
    logicalDataColumnNumber: 2,
    targetDataColumnName: 'model',
    isRequired: true,
    isVisible: true,
    isActive: true,
  },
  {
    id: 'field-004',
    projectId: MOCK_PROJECT_ID,
    formTabId: 'tab-001',
    tabNumber: 1,
    tabType: 'audit_form',
    displayOrder: 4,
    fieldType: 'text',
    label: 'Numer seryjny',
    question: 'Podaj numer seryjny (S/N)',
    logicalDataColumnNumber: 3,
    targetDataColumnName: 'numer_seryjny',
    isRequired: false,
    isVisible: true,
    isActive: true,
  },
  {
    id: 'field-005',
    projectId: MOCK_PROJECT_ID,
    formTabId: 'tab-001',
    tabNumber: 1,
    tabType: 'audit_form',
    displayOrder: 5,
    fieldType: 'number',
    label: 'Rok produkcji',
    question: 'Podaj rok produkcji urządzenia',
    logicalDataColumnNumber: 4,
    targetDataColumnName: 'rok_produkcji',
    isRequired: false,
    isVisible: true,
    isActive: true,
  },
  
  // Tab 2: Stan techniczny
  {
    id: 'field-006',
    projectId: MOCK_PROJECT_ID,
    formTabId: 'tab-002',
    tabNumber: 2,
    tabType: 'audit_form',
    displayOrder: 1,
    fieldType: 'radio',
    label: 'Ogólny stan techniczny',
    question: 'Oceń ogólny stan techniczny urządzenia',
    optionSetId: 'optset-condition',
    logicalDataColumnNumber: 5,
    targetDataColumnName: 'stan_techniczny',
    isRequired: true,
    isVisible: true,
    isActive: true,
  },
  {
    id: 'field-007',
    projectId: MOCK_PROJECT_ID,
    formTabId: 'tab-002',
    tabNumber: 2,
    tabType: 'audit_form',
    displayOrder: 2,
    fieldType: 'select',
    label: 'Dostęp do urządzenia',
    question: 'Czy jest zapewniony prawidłowy dostęp do urządzenia?',
    optionSetId: 'optset-yesno',
    logicalDataColumnNumber: 6,
    targetDataColumnName: 'dostep',
    isRequired: true,
    isVisible: true,
    isActive: true,
  },
  {
    id: 'field-008',
    projectId: MOCK_PROJECT_ID,
    formTabId: 'tab-002',
    tabNumber: 2,
    tabType: 'audit_form',
    displayOrder: 3,
    fieldType: 'checkbox',
    label: 'Urządzenie pracuje',
    question: 'Czy urządzenie jest w stanie pracy?',
    logicalDataColumnNumber: 7,
    targetDataColumnName: 'pracuje',
    isRequired: false,
    isVisible: true,
    isActive: true,
  },
  {
    id: 'field-009',
    projectId: MOCK_PROJECT_ID,
    formTabId: 'tab-002',
    tabNumber: 2,
    tabType: 'audit_form',
    displayOrder: 4,
    fieldType: 'slider',
    label: 'Sprawność szacunkowa',
    question: 'Oszacuj sprawność urządzenia (w %)',
    logicalDataColumnNumber: 8,
    targetDataColumnName: 'sprawnosc',
    isRequired: false,
    isVisible: true,
    isActive: true,
  },
  {
    id: 'field-010',
    projectId: MOCK_PROJECT_ID,
    formTabId: 'tab-002',
    tabNumber: 2,
    tabType: 'audit_form',
    displayOrder: 5,
    fieldType: 'checkbox',
    label: 'Stwierdzone nieprawidłowości',
    question: 'Zaznacz wszystkie stwierdzone nieprawidłowości',
    optionSetId: 'optset-actions',
    logicalDataColumnNumber: 9,
    targetDataColumnName: 'nieprawidlowosci',
    isRequired: false,
    isVisible: true,
    isActive: true,
  },
  
  // Tab 3: Parametry pracy
  {
    id: 'field-011',
    projectId: MOCK_PROJECT_ID,
    formTabId: 'tab-003',
    tabNumber: 3,
    tabType: 'audit_form',
    displayOrder: 1,
    fieldType: 'number',
    label: 'Moc nominalna [kW]',
    question: 'Podaj moc nominalną urządzenia w kW',
    logicalDataColumnNumber: 10,
    targetDataColumnName: 'moc_kw',
    isRequired: false,
    isVisible: true,
    isActive: true,
  },
  {
    id: 'field-012',
    projectId: MOCK_PROJECT_ID,
    formTabId: 'tab-003',
    tabNumber: 3,
    tabType: 'audit_form',
    displayOrder: 2,
    fieldType: 'number',
    label: 'Przepływ powietrza [m³/h]',
    question: 'Podaj nominalny przepływ powietrza',
    logicalDataColumnNumber: 11,
    targetDataColumnName: 'przeplyw',
    isRequired: false,
    isVisible: true,
    isActive: true,
  },
  {
    id: 'field-013',
    projectId: MOCK_PROJECT_ID,
    formTabId: 'tab-003',
    tabNumber: 3,
    tabType: 'audit_form',
    displayOrder: 3,
    fieldType: 'number',
    label: 'Temperatura zasilania [°C]',
    question: 'Zmierz temperaturę zasilania',
    logicalDataColumnNumber: 12,
    targetDataColumnName: 'temp_zasilania',
    isRequired: false,
    isVisible: true,
    isActive: true,
  },
  {
    id: 'field-014',
    projectId: MOCK_PROJECT_ID,
    formTabId: 'tab-003',
    tabNumber: 3,
    tabType: 'audit_form',
    displayOrder: 4,
    fieldType: 'number',
    label: 'Temperatura powrotu [°C]',
    question: 'Zmierz temperaturę powrotu',
    logicalDataColumnNumber: 13,
    targetDataColumnName: 'temp_powrotu',
    isRequired: false,
    isVisible: true,
    isActive: true,
  },
  {
    id: 'field-015',
    projectId: MOCK_PROJECT_ID,
    formTabId: 'tab-003',
    tabNumber: 3,
    tabType: 'audit_form',
    displayOrder: 5,
    fieldType: 'select',
    label: 'Tryb pracy',
    question: 'W jakim trybie pracuje urządzenie?',
    optionSetId: 'optset-yesno',
    logicalDataColumnNumber: 14,
    targetDataColumnName: 'tryb_pracy',
    isRequired: false,
    isVisible: true,
    isActive: true,
  },
  
  // Tab 4: Uwagi i zalecenia
  {
    id: 'field-016',
    projectId: MOCK_PROJECT_ID,
    formTabId: 'tab-004',
    tabNumber: 4,
    tabType: 'audit_form',
    displayOrder: 1,
    fieldType: 'radio',
    label: 'Priorytet działań',
    question: 'Określ priorytet wymaganych działań',
    optionSetId: 'optset-priority',
    logicalDataColumnNumber: 15,
    targetDataColumnName: 'priorytet',
    isRequired: true,
    isVisible: true,
    isActive: true,
  },
  {
    id: 'field-017',
    projectId: MOCK_PROJECT_ID,
    formTabId: 'tab-004',
    tabNumber: 4,
    tabType: 'audit_form',
    displayOrder: 2,
    fieldType: 'checkbox',
    label: 'Zalecane działania',
    question: 'Zaznacz wszystkie zalecane działania',
    optionSetId: 'optset-actions',
    logicalDataColumnNumber: 16,
    targetDataColumnName: 'zalecenia',
    isRequired: false,
    isVisible: true,
    isActive: true,
  },
  {
    id: 'field-018',
    projectId: MOCK_PROJECT_ID,
    formTabId: 'tab-004',
    tabNumber: 4,
    tabType: 'audit_form',
    displayOrder: 3,
    fieldType: 'text',
    label: 'Uwagi audytora',
    question: 'Opisz dodatkowe spostrzeżenia i uwagi',
    description: 'Możesz opisać szczegółowo stan urządzenia, zaobserwowane problemy lub zalecenia',
    logicalDataColumnNumber: 17,
    targetDataColumnName: 'uwagi',
    isRequired: false,
    isVisible: true,
    isActive: true,
  },
  {
    id: 'field-019',
    projectId: MOCK_PROJECT_ID,
    formTabId: 'tab-004',
    tabNumber: 4,
    tabType: 'audit_form',
    displayOrder: 4,
    fieldType: 'text',
    label: 'Szczegółowy opis problemu',
    question: 'W przypadku stwierdzenia problemów, opisz je szczegółowo',
    logicalDataColumnNumber: 18,
    targetDataColumnName: 'opis_problemu',
    isRequired: false,
    isVisible: true,
    isActive: true,
  },
];

// -----------------------------------------------------------------------------
// Helper: Get Option Values as Map
// -----------------------------------------------------------------------------
export function getMockOptionValuesMap(): Map<string, OptionValue[]> {
  const map = new Map<string, OptionValue[]>();
  
  for (const optionValue of mockOptionValues) {
    const existing = map.get(optionValue.optionSetId) || [];
    existing.push(optionValue);
    map.set(optionValue.optionSetId, existing);
  }
  
  return map;
}

// -----------------------------------------------------------------------------
// Helper: Get Fields by Tab
// -----------------------------------------------------------------------------
export function getMockFieldsByTab(tabId: string): FormField[] {
  return mockFormFields
    .filter(f => f.formTabId === tabId && f.isVisible && f.isActive)
    .sort((a, b) => a.displayOrder - b.displayOrder);
}

// -----------------------------------------------------------------------------
// Helper: Get Form Config
// -----------------------------------------------------------------------------
export function getMockFormConfig() {
  return {
    tabs: mockFormTabs.filter(t => t.isActive).sort((a, b) => a.displayOrder - b.displayOrder),
    fields: mockFormFields.filter(f => f.isVisible && f.isActive).sort((a, b) => a.displayOrder - b.displayOrder),
    optionSets: mockOptionSets,
    optionValues: getMockOptionValuesMap(),
  };
}
