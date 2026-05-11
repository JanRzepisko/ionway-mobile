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
  getInProgressSession,
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
  getAuditStats
} from './audits';

// Helper alias
export { getDevice as getDeviceById } from './devices';
