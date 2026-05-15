// =============================================================================
// Form Configuration Repository - Local Database Operations
// =============================================================================

import { getDatabase } from './schema';
import { FormTab, FormField, OptionSet, OptionValue, TabType, FieldType } from '../types';

// -----------------------------------------------------------------------------
// Form Tabs
// -----------------------------------------------------------------------------

export async function saveFormTab(tab: FormTab): Promise<void> {
  const db = await getDatabase();
  
  await db.runAsync(
    `INSERT OR REPLACE INTO form_tabs 
     (id, project_id, tab_number, tab_type, title, display_order, is_active)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      tab.id,
      tab.projectId,
      tab.tabNumber,
      tab.tabType,
      tab.title,
      tab.displayOrder,
      tab.isActive ? 1 : 0
    ]
  );
}

export async function saveFormTabs(tabs: FormTab[]): Promise<void> {
  for (const tab of tabs) {
    await saveFormTab(tab);
  }
}

export async function getFormTabs(projectId: string): Promise<FormTab[]> {
  const db = await getDatabase();
  
  const rows = await db.getAllAsync<FormTabRow>(
    `SELECT * FROM form_tabs 
     WHERE project_id = ? AND is_active = 1 
     ORDER BY display_order`,
    [projectId]
  );

  return rows.map(mapRowToFormTab);
}

export async function getFormTabsByType(
  projectId: string, 
  tabType: TabType
): Promise<FormTab[]> {
  const db = await getDatabase();
  
  const rows = await db.getAllAsync<FormTabRow>(
    `SELECT * FROM form_tabs 
     WHERE project_id = ? AND tab_type = ? AND is_active = 1 
     ORDER BY display_order`,
    [projectId, tabType]
  );

  return rows.map(mapRowToFormTab);
}

export async function deleteFormTabsByProject(projectId: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync('DELETE FROM form_tabs WHERE project_id = ?', [projectId]);
}

// -----------------------------------------------------------------------------
// Form Fields
// -----------------------------------------------------------------------------

export async function saveFormField(field: FormField): Promise<void> {
  const db = await getDatabase();
  
  await db.runAsync(
    `INSERT OR REPLACE INTO form_fields 
     (id, project_id, form_tab_id, source_row_number, logical_data_column_number,
      tab_number, tab_type, display_order, field_type, label, description, question,
      option_set_id, target_data_column_name, is_required, is_visible, is_active,
      default_value, validation_rules_json)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      field.id,
      field.projectId,
      field.formTabId ?? null,
      field.sourceRowNumber ?? null,
      field.logicalDataColumnNumber ?? null,
      field.tabNumber,
      field.tabType,
      field.displayOrder,
      field.fieldType,
      field.label,
      field.description ?? null,
      field.question ?? null,
      field.optionSetId ?? null,
      field.targetDataColumnName ?? null,
      field.isRequired ? 1 : 0,
      field.isVisible ? 1 : 0,
      field.isActive ? 1 : 0,
      field.defaultValue ?? null,
      field.validationRulesJson ?? null
    ]
  );
}

export async function saveFormFields(fields: FormField[]): Promise<void> {
  for (const field of fields) {
    await saveFormField(field);
  }
}

export async function getFormFields(projectId: string): Promise<FormField[]> {
  const db = await getDatabase();
  
  const rows = await db.getAllAsync<FormFieldRow>(
    `SELECT * FROM form_fields 
     WHERE project_id = ? AND is_active = 1 
     ORDER BY tab_number, display_order`,
    [projectId]
  );

  return rows.map(mapRowToFormField);
}

export async function getFormFieldsByTab(tabId: string): Promise<FormField[]> {
  const db = await getDatabase();
  
  const rows = await db.getAllAsync<FormFieldRow>(
    `SELECT * FROM form_fields 
     WHERE form_tab_id = ? AND is_active = 1 
     ORDER BY display_order`,
    [tabId]
  );

  return rows.map(mapRowToFormField);
}

export async function getFormFieldsByTabType(
  projectId: string, 
  tabType: TabType
): Promise<FormField[]> {
  const db = await getDatabase();
  
  const rows = await db.getAllAsync<FormFieldRow>(
    `SELECT * FROM form_fields 
     WHERE project_id = ? AND tab_type = ? AND is_active = 1 
     ORDER BY display_order`,
    [projectId, tabType]
  );

  return rows.map(mapRowToFormField);
}

export async function deleteFormFieldsByProject(projectId: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync('DELETE FROM form_fields WHERE project_id = ?', [projectId]);
}

/**
 * Get the total count of active form fields for a project
 */
export async function getFormFieldsCount(projectId: string): Promise<number> {
  const db = await getDatabase();
  
  const result = await db.getFirstAsync<{ count: number }>(
    `SELECT COUNT(*) as count FROM form_fields 
     WHERE project_id = ? AND is_active = 1`,
    [projectId]
  );
  
  return result?.count ?? 0;
}

// -----------------------------------------------------------------------------
// Option Sets
// -----------------------------------------------------------------------------

export async function saveOptionSet(optionSet: OptionSet): Promise<void> {
  const db = await getDatabase();
  
  await db.runAsync(
    `INSERT OR REPLACE INTO option_sets 
     (id, project_id, code, name, source)
     VALUES (?, ?, ?, ?, ?)`,
    [
      optionSet.id,
      optionSet.projectId,
      optionSet.code,
      optionSet.name,
      optionSet.source ?? null
    ]
  );
}

export async function saveOptionSets(optionSets: OptionSet[]): Promise<void> {
  for (const optionSet of optionSets) {
    await saveOptionSet(optionSet);
  }
}

export async function getOptionSets(projectId: string): Promise<OptionSet[]> {
  const db = await getDatabase();
  
  const rows = await db.getAllAsync<OptionSetRow>(
    'SELECT * FROM option_sets WHERE project_id = ? ORDER BY name',
    [projectId]
  );

  return rows.map(mapRowToOptionSet);
}

export async function getOptionSet(optionSetId: string): Promise<OptionSet | null> {
  const db = await getDatabase();
  
  const row = await db.getFirstAsync<OptionSetRow>(
    'SELECT * FROM option_sets WHERE id = ?',
    [optionSetId]
  );

  return row ? mapRowToOptionSet(row) : null;
}

export async function deleteOptionSetsByProject(projectId: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    'DELETE FROM option_values WHERE option_set_id IN (SELECT id FROM option_sets WHERE project_id = ?)',
    [projectId]
  );
  await db.runAsync('DELETE FROM option_sets WHERE project_id = ?', [projectId]);
}

// -----------------------------------------------------------------------------
// Option Values
// -----------------------------------------------------------------------------

export async function saveOptionValue(value: OptionValue): Promise<void> {
  const db = await getDatabase();
  
  await db.runAsync(
    `INSERT OR REPLACE INTO option_values 
     (id, option_set_id, value, label, display_order, is_active)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      value.id,
      value.optionSetId,
      value.value,
      value.label,
      value.displayOrder,
      value.isActive ? 1 : 0
    ]
  );
}

export async function saveOptionValues(values: OptionValue[]): Promise<void> {
  for (const value of values) {
    await saveOptionValue(value);
  }
}

export async function getOptionValues(optionSetId: string): Promise<OptionValue[]> {
  const db = await getDatabase();
  
  const rows = await db.getAllAsync<OptionValueRow>(
    `SELECT * FROM option_values 
     WHERE option_set_id = ? AND is_active = 1 
     ORDER BY display_order`,
    [optionSetId]
  );

  return rows.map(mapRowToOptionValue);
}

export async function getOptionValuesMap(
  projectId: string
): Promise<Map<string, OptionValue[]>> {
  const db = await getDatabase();
  
  const rows = await db.getAllAsync<OptionValueRow>(
    `SELECT ov.* FROM option_values ov
     JOIN option_sets os ON ov.option_set_id = os.id
     WHERE os.project_id = ? AND ov.is_active = 1
     ORDER BY ov.option_set_id, ov.display_order`,
    [projectId]
  );

  const map = new Map<string, OptionValue[]>();
  
  for (const row of rows) {
    const value = mapRowToOptionValue(row);
    const existing = map.get(value.optionSetId) || [];
    existing.push(value);
    map.set(value.optionSetId, existing);
  }

  return map;
}

// -----------------------------------------------------------------------------
// Complete Form Config
// -----------------------------------------------------------------------------

export interface FormConfig {
  tabs: FormTab[];
  fields: FormField[];
  optionSets: OptionSet[];
  optionValues: Map<string, OptionValue[]>;
}

export async function getFullFormConfig(projectId: string): Promise<FormConfig> {
  const [tabs, fields, optionSets, optionValues] = await Promise.all([
    getFormTabs(projectId),
    getFormFields(projectId),
    getOptionSets(projectId),
    getOptionValuesMap(projectId)
  ]);

  return { tabs, fields, optionSets, optionValues };
}

export async function clearFormConfigByProject(projectId: string): Promise<void> {
  await deleteFormFieldsByProject(projectId);
  await deleteFormTabsByProject(projectId);
  await deleteOptionSetsByProject(projectId);
}

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

interface FormTabRow {
  id: string;
  project_id: string;
  tab_number: number;
  tab_type: string;
  title: string;
  display_order: number;
  is_active: number;
}

interface FormFieldRow {
  id: string;
  project_id: string;
  form_tab_id: string | null;
  source_row_number: number | null;
  logical_data_column_number: number | null;
  tab_number: number;
  tab_type: string;
  display_order: number;
  field_type: string;
  label: string;
  description: string | null;
  question: string | null;
  option_set_id: string | null;
  target_data_column_name: string | null;
  is_required: number;
  is_visible: number;
  is_active: number;
  default_value: string | null;
  validation_rules_json: string | null;
}

interface OptionSetRow {
  id: string;
  project_id: string;
  code: string;
  name: string;
  source: string | null;
}

interface OptionValueRow {
  id: string;
  option_set_id: string;
  value: string;
  label: string;
  display_order: number;
  is_active: number;
}

function mapRowToFormTab(row: FormTabRow): FormTab {
  return {
    id: row.id,
    projectId: row.project_id,
    tabNumber: row.tab_number,
    tabType: row.tab_type as TabType,
    title: row.title,
    displayOrder: row.display_order,
    isActive: row.is_active === 1,
  };
}

function mapRowToFormField(row: FormFieldRow): FormField {
  return {
    id: row.id,
    projectId: row.project_id,
    formTabId: row.form_tab_id ?? undefined,
    sourceRowNumber: row.source_row_number ?? undefined,
    logicalDataColumnNumber: row.logical_data_column_number ?? undefined,
    tabNumber: row.tab_number,
    tabType: row.tab_type as TabType,
    displayOrder: row.display_order,
    fieldType: row.field_type as FieldType,
    label: row.label,
    description: row.description ?? undefined,
    question: row.question ?? undefined,
    optionSetId: row.option_set_id ?? undefined,
    targetDataColumnName: row.target_data_column_name ?? undefined,
    isRequired: row.is_required === 1,
    isVisible: row.is_visible === 1,
    isActive: row.is_active === 1,
    defaultValue: row.default_value ?? undefined,
    validationRulesJson: row.validation_rules_json ?? undefined,
  };
}

function mapRowToOptionSet(row: OptionSetRow): OptionSet {
  return {
    id: row.id,
    projectId: row.project_id,
    code: row.code,
    name: row.name,
    source: row.source ?? undefined,
  };
}

function mapRowToOptionValue(row: OptionValueRow): OptionValue {
  return {
    id: row.id,
    optionSetId: row.option_set_id,
    value: row.value,
    label: row.label,
    displayOrder: row.display_order,
    isActive: row.is_active === 1,
  };
}
