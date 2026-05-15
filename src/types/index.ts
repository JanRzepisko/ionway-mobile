// =============================================================================
// Audix Types - Offline-First Architecture
// =============================================================================

// -----------------------------------------------------------------------------
// Sync Status
// -----------------------------------------------------------------------------
export type SyncStatus = 
  | 'local_only'      // Created locally, never synced
  | 'pending_upload'  // Ready to be uploaded
  | 'uploading'       // Currently uploading
  | 'synced'          // Successfully synced with server
  | 'upload_error'    // Upload failed
  | 'conflict';       // Conflict detected

// -----------------------------------------------------------------------------
// User & Auth
// -----------------------------------------------------------------------------
export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  fullName: string;
  role: 'Admin' | 'Coordinator' | 'Auditor';
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
}

export interface AuthState {
  user: User | null;
  tokens: AuthTokens | null;
  isAuthenticated: boolean;
}

// -----------------------------------------------------------------------------
// Project
// -----------------------------------------------------------------------------
export interface Project {
  id: string;
  name: string;
  description?: string;
  status: string;
  importVersion: number;
  lastSyncAt?: number;
  deviceCount: number;
}

// -----------------------------------------------------------------------------
// Device
// -----------------------------------------------------------------------------
export interface Device {
  id: string;
  localId: string;
  serverId?: string;
  projectId: string;
  elementId: string;
  name: string;
  znacznik?: string; // Auto-generated marker: Z00001JK0b (number + initials + last 2 chars of user GUID)
  building?: string;
  level?: string;
  zone?: string;
  system?: string;
  group?: string;
  type?: string;
  drawingNumber?: string;
  routeNumber?: string;
  disciplineCode?: string;
  isNew: boolean;
  createdLocally: boolean;
  createdByUserId?: string;
  createdAt: number;
  auditCount: number;
  lastAuditAt?: number;
  additionalDataJson?: string;
  syncStatus: SyncStatus;
}

// -----------------------------------------------------------------------------
// Form Configuration
// -----------------------------------------------------------------------------
export type TabType = 'filter' | 'add_device' | 'audit_form';

export type FieldType = 
  | 'text'
  | 'textArea'
  | 'number'
  | 'select'
  | 'radio'
  | 'checkbox'
  | 'slider'
  | 'extendedList'
  | 'readonlyInfo'
  | 'date'
  | 'photo'
  | 'signature';

export interface FormTab {
  id: string;
  projectId: string;
  tabNumber: number;
  tabType: TabType;
  title: string;
  displayOrder: number;
  isActive: boolean;
}

export interface FormField {
  id: string;
  projectId: string;
  formTabId?: string;
  sourceRowNumber?: number;
  logicalDataColumnNumber?: number;
  tabNumber: number;
  tabType: TabType;
  displayOrder: number;
  fieldType: FieldType;
  label: string;
  description?: string;
  question?: string;
  optionSetId?: string;
  targetDataColumnName?: string;
  isRequired: boolean;
  isVisible: boolean;
  isActive: boolean;
  defaultValue?: string;
  validationRulesJson?: string;
}

export interface OptionSet {
  id: string;
  projectId: string;
  code: string;
  name: string;
  source?: string;
}

export interface OptionValue {
  id: string;
  optionSetId: string;
  value: string;
  label: string;
  displayOrder: number;
  isActive: boolean;
}

export interface DataColumnMapping {
  logicalDataColumnNumber: number;
  columnName: string;
  excelColumnIndex: number;
  sectionName?: string;
}

// -----------------------------------------------------------------------------
// Audit Session & Answers
// -----------------------------------------------------------------------------
export type AuditStatus = 'draft' | 'in_progress' | 'completed' | 'cancelled';

export interface AuditSession {
  id: string;
  localId: string;
  serverId?: string;
  projectId: string;
  deviceId: string;
  deviceLocalId: string;
  auditorId: string;
  status: AuditStatus;
  startedAt: number;
  completedAt?: number;
  createdAt?: number;
  createdOffline: boolean;
  notes?: string;
  lastEditedById?: string;
  lastEditedByName?: string;
  lastEditedAt?: number;
  syncStatus: SyncStatus;
}

export interface AuditAnswer {
  id: string;
  localId: string;
  serverId?: string;
  auditSessionId: string;
  auditSessionLocalId: string;
  deviceId: string;
  formFieldId: string;
  logicalDataColumnNumber?: number;
  valueText?: string;
  valueJson?: string;
  comment?: string;
  auditorId: string;
  auditorName?: string;
  answeredAt: number;
  syncStatus: SyncStatus;
}

// -----------------------------------------------------------------------------
// Sync Queue
// -----------------------------------------------------------------------------
export type SyncAction = 'upload_device' | 'upload_audit' | 'upload_answers';

export interface SyncQueueItem {
  id: number;
  action: SyncAction;
  entityType: 'device' | 'audit_session' | 'audit_answer';
  entityLocalId: string;
  projectId: string;
  payload: string;
  attempts: number;
  lastAttemptAt?: number;
  errorMessage?: string;
  createdAt: number;
}

// -----------------------------------------------------------------------------
// Sync State
// -----------------------------------------------------------------------------
export interface SyncState {
  projectId: string;
  importVersion: number;
  lastDownloadAt?: number;
  lastUploadAt?: number;
  deviceCount: number;
  pendingUploads: number;
  isDownloading: boolean;
  isUploading: boolean;
  lastError?: string;
}

// -----------------------------------------------------------------------------
// Filter Options
// -----------------------------------------------------------------------------
export interface DeviceFilterOptions {
  buildings: string[];
  levels: string[];
  zones: string[];
  systems: string[];
  groups: string[];
  types: string[];
}

export interface DeviceFilters {
  building?: string;
  buildings?: string[];
  level?: string;
  levels?: string[];
  zone?: string;
  zones?: string[];
  system?: string;
  group?: string;
  type?: string;
  types?: string[];
  search?: string;
  searchQuery?: string;
}

// -----------------------------------------------------------------------------
// API Response Types
// -----------------------------------------------------------------------------
export interface MobileDownloadResponse {
  projectId: string;
  projectName: string;
  importVersion: number;
  serverTime: string;
  fullSync: boolean;
  formConfig: {
    projectId: string;
    importVersion: number;
    lastUpdatedAt: string;
    tabs: ApiFormTab[];
    optionSets: ApiOptionSet[];
  };
  devices: ApiDevice[];
  filterOptions: DeviceFilterOptions;
  auditSessions?: ServerAuditSession[];
  deletedAuditSessionIds?: string[];
  stats: {
    totalDevices: number;
    formTabs: number;
    formFields: number;
    optionSets: number;
    auditSessions?: number;
    deletedAuditSessions?: number;
  };
}

export interface ServerAuditSession {
  id: string;
  mobileLocalId: string;
  deviceId: string;
  auditorId: string;
  status: string;
  startedAt: string;
  completedAt?: string;
  notes?: string;
  updatedAt?: string;
  answers: ServerAuditAnswer[];
}

export interface ServerAuditAnswer {
  id: string;
  mobileLocalId: string;
  formFieldId: string;
  logicalDataColumnNumber?: number;
  valueText?: string;
  valueJson?: string;
  comment?: string;
  answeredAt: string;
}

export interface ApiFormTab {
  id: string;
  tabNumber: number;
  tabType: string;
  title: string;
  displayOrder: number;
  isActive: boolean;
  fields: ApiFormField[];
}

export interface ApiFormField {
  id: string;
  formTabId?: string;
  sourceRowNumber?: number;
  logicalDataColumnNumber?: number;
  tabNumber: number;
  tabType: string;
  displayOrder: number;
  fieldType: string;
  label: string;
  description?: string;
  question?: string;
  optionSetId?: string;
  targetDataColumnName?: string;
  isRequired: boolean;
  isVisible: boolean;
  isActive: boolean;
  defaultValue?: string;
  validationRulesJson?: string;
}

export interface ApiOptionSet {
  id: string;
  code: string;
  name: string;
  source?: string;
  values: ApiOptionValue[];
}

export interface ApiOptionValue {
  id: string;
  value: string;
  label: string;
  displayOrder: number;
}

export interface ApiDevice {
  id: string;
  elementId: string;
  name: string;
  znacznik?: string;
  building?: string;
  level?: string;
  zone?: string;
  system?: string;
  group?: string;
  type?: string;
  drawingNumber?: string;
  routeNumber?: string;
  disciplineCode?: string;
  isNew: boolean;
  auditCount: number;
  lastAuditAt?: string;
  additionalDataJson?: string;
}

export interface MobileUploadRequest {
  projectId: string;
  mobileDeviceId: string;
  importVersion: number;
  uploadedAt: string;
  newDevices: MobileNewDevice[];
  auditSessions: MobileAuditSession[];
}

export interface MobileNewDevice {
  mobileLocalId: string;
  elementId: string;
  name: string;
  znacznik?: string;
  building?: string;
  level?: string;
  zone?: string;
  system?: string;
  group?: string;
  type?: string;
  drawingNumber?: string;
  routeNumber?: string;
  disciplineCode?: string;
  createdAt: string;
  additionalDataJson?: string;
}

export interface MobileAuditSession {
  mobileLocalId: string;
  deviceId?: string;
  deviceMobileLocalId?: string;
  status: string; // Server expects C# enum names: Draft, InProgress, Completed, Cancelled
  startedAt: string;
  completedAt?: string;
  createdOffline?: boolean;
  notes?: string;
  lastEditedByUserId?: string;
  lastEditedByUserName?: string;
  lastEditedAt?: string;
  answers: MobileAuditAnswer[];
}

export interface MobileAuditAnswer {
  mobileLocalId: string;
  formFieldId: string;
  logicalDataColumnNumber?: number;
  valueText?: string;
  valueJson?: string;
  comment?: string;
  answeredAt: string;
  updatedAt?: string;
}

export interface MobileUploadResponse {
  success: boolean;
  serverTime: string;
  deviceResults: DeviceSyncResult[];
  auditResults: AuditSyncResult[];
  stats: UploadStats;
  errors?: string[];
}

export interface DeviceSyncResult {
  mobileLocalId: string;
  serverId?: string;
  success: boolean;
  alreadyExists?: boolean;
  error?: string;
}

export interface AuditSyncResult {
  mobileLocalId: string;
  serverId?: string;
  success: boolean;
  alreadyExists?: boolean;
  warning?: string;
  answersSynced: number;
  answersSkipped?: number;
  answersFailed?: number;
  error?: string;
}

export interface UploadStats {
  devicesReceived: number;
  devicesCreated: number;
  devicesFailed: number;
  auditsReceived: number;
  auditsCreated: number;
  auditsFailed: number;
  answersReceived: number;
  answersCreated: number;
}
