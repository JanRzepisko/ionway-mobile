// =============================================================================
// Database Module Exports
// =============================================================================

// Schema and setup
export { 
  getDatabase, 
  clearAllData, 
  clearProjectData,
  getDatabaseStats 
} from './schema';

// Projects
export { 
  saveProject, 
  getProject, 
  getAllProjects,
  updateProjectSyncState,
  deleteProject 
} from './projects';

// Devices
export {
  saveDevice,
  saveDevices,
  getDevice,
  getDeviceByLocalId,
  getDevicesByProject,
  deleteDevicesByProject,
  getFilteredDevices,
  getFilteredDevicesPaginated,
  getFilteredDevicesCount,
  getDistinctBuildings,
  getDistinctLevels,
  getDistinctZones,
  getDistinctSystems,
  getDistinctGroups,
  getDistinctTypes,
  getDistinctDrawingNumbers,
  createDeviceOffline,
  updateDeviceSyncStatus,
  getPendingDevices,
  getDeviceCount,
  getNextZnacznikPreview,
  fixStuckUploadingDevices
} from './devices';
export type { PaginatedDevicesResult } from './devices';

// Form Configuration
export {
  saveFormTab,
  saveFormTabs,
  getFormTabs,
  getFormTabsByType,
  deleteFormTabsByProject,
  saveFormField,
  saveFormFields,
  getFormFields,
  getFormFieldsByTab,
  getFormFieldsByTabType,
  deleteFormFieldsByProject,
  getFormFieldsCount,
  saveOptionSet,
  saveOptionSets,
  getOptionSets,
  getOptionSet,
  deleteOptionSetsByProject,
  saveOptionValue,
  saveOptionValues,
  getOptionValues,
  getOptionValuesMap,
  getFullFormConfig,
  clearFormConfigByProject
} from './formConfig';

// Audits
export {
  createAuditSession,
  saveAuditSession,
  getAuditSession,
  getAuditSessionByLocalId,
  getAuditSessionsByDevice,
  getAuditSessionsByProject,
  getAuditSessionsByProject as getAllAuditSessions,
  getCompletedSessionsForProject,
  getAllSessionsForProject,
  getInProgressSession,
  getExistingSessionForDevice,
  completeAuditSession,
  updateAuditSessionSyncStatus,
  getPendingAuditSessions,
  fixStuckUploadingSessions,
  deleteLocalAuditSession,
  saveAuditAnswer,
  upsertAnswer,
  getAnswersBySession,
  getAnswer,
  getAnswersMap,
  updateAnswerSyncStatus,
  getPendingAnswersForSession,
  getAuditStats,
  syncAuditSessionsFromServer,
  getCompletedAuditSessions,
  getAuditSessionWithDetails,
  markAllSessionsForResync,
  updateSessionLastInteraction,
  getAuditSessionsPaginated,
  getAuditSessionCounts,
  getAnswerCountsForSessions,
} from './audits';
export type { PaginatedAuditSessionsResult, AuditSessionFilters } from './audits';

// Photos
export {
  createAuditPhoto,
  createAuditPhotosForDevices,
  getPhotosBySession,
  getPhotosByDevice,
  getPhotosPendingUpload,
  getPhotosPendingUploadForProject,
  markPhotoAsSynced,
  markPhotoUploadError,
  deletePhoto,
  deletePhotosBySession,
  getPhotoByLocalId,
  countPhotosForDevice
} from './photos';
export type { AuditPhoto } from './photos';

// Helper alias
export { getDevice as getDeviceById } from './devices';
