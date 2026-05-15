// =============================================================================
// Device Filter Bar - Cascading filters for devices
// =============================================================================

import React, { useState } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Text, Menu, Divider, Searchbar, IconButton } from 'react-native-paper';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import { colors, spacing, borderRadius, typography, shadows } from '../../theme';
import { DeviceFilters } from '../../types';
import { useProjectStore } from '../../stores/projectStore';

interface FilterChipProps {
  label: string;
  value?: string;
  options: string[];
  onSelect: (value: string | undefined) => void;
}

function FilterChip({ label, value, options, onSelect }: FilterChipProps) {
  const [visible, setVisible] = useState(false);
  
  const hasValue = !!value;
  
  return (
    <Menu
      visible={visible}
      onDismiss={() => setVisible(false)}
      anchor={
        <TouchableOpacity 
          style={[styles.chip, hasValue && styles.chipActive]}
          onPress={() => setVisible(true)}
        >
          <Text style={[styles.chipLabel, hasValue && styles.chipLabelActive]}>
            {value || label}
          </Text>
          <Icon 
            name="chevron-down" 
            size={18} 
            color={hasValue ? colors.primary : colors.textSecondary} 
          />
        </TouchableOpacity>
      }
      contentStyle={styles.menuContent}
    >
      {hasValue && (
        <>
          <Menu.Item 
            onPress={() => { onSelect(undefined); setVisible(false); }}
            title="Wyczyść"
            leadingIcon="close"
            titleStyle={styles.clearItem}
          />
          <Divider />
        </>
      )}
      
      <ScrollView style={styles.menuScroll}>
        {options.map((option) => (
          <Menu.Item
            key={option}
            onPress={() => { onSelect(option); setVisible(false); }}
            title={option}
            titleStyle={option === value ? styles.selectedItem : undefined}
            trailingIcon={option === value ? 'check' : undefined}
          />
        ))}
      </ScrollView>
      
      {options.length === 0 && (
        <Menu.Item
          title="Brak opcji"
          disabled
          titleStyle={styles.noOptions}
        />
      )}
    </Menu>
  );
}

export function DeviceFilterBar() {
  const { filters, filterOptions, setFilter, setSearchQuery: storeSetSearchQuery, clearFilters } = useProjectStore();
  const [searchQuery, setSearchQuery] = useState(filters.searchQuery || '');
  
  const hasActiveFilters = Object.values(filters).some(v => v !== undefined);

  const handleSearch = (query: string) => {
    setSearchQuery(query);
    storeSetSearchQuery(query || undefined);
  };

  return (
    <View style={styles.container}>
      {/* Search */}
      <Searchbar
        placeholder="Szukaj urządzenia..."
        onChangeText={handleSearch}
        value={searchQuery}
        style={styles.searchbar}
        inputStyle={styles.searchInput}
      />
      
      {/* Filter chips */}
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false}
        style={styles.filtersScroll}
        contentContainerStyle={styles.filtersContent}
      >
        <FilterChip
          label="Budynek"
          value={filters.building}
          options={filterOptions.buildings}
          onSelect={(v) => setFilter('building', v)}
        />
        
        <FilterChip
          label="Poziom"
          value={filters.level}
          options={filterOptions.levels}
          onSelect={(v) => setFilter('level', v)}
        />
        
        <FilterChip
          label="Strefa"
          value={filters.zone}
          options={filterOptions.zones}
          onSelect={(v) => setFilter('zone', v)}
        />
        
        <FilterChip
          label="System"
          value={filters.system}
          options={filterOptions.systems}
          onSelect={(v) => setFilter('system', v)}
        />
        
        <FilterChip
          label="Grupa"
          value={filters.group}
          options={filterOptions.groups}
          onSelect={(v) => setFilter('group', v)}
        />
        
        <FilterChip
          label="Typ"
          value={filters.type}
          options={filterOptions.types}
          onSelect={(v) => setFilter('type', v)}
        />
        
        {hasActiveFilters && (
          <TouchableOpacity style={styles.clearAll} onPress={clearFilters}>
            <Icon name="filter-remove" size={20} color={colors.error} />
            <Text style={styles.clearAllText}>Wyczyść</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.surface,
    paddingTop: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.outlineVariant,
  },
  searchbar: {
    marginHorizontal: spacing.md,
    marginBottom: spacing.md,
    backgroundColor: colors.surfaceVariant,
    borderRadius: borderRadius.lg,
    elevation: 0,
  },
  searchInput: {
    ...typography.bodyLarge,
  },
  filtersScroll: {
    marginBottom: spacing.md,
  },
  filtersContent: {
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.surfaceVariant,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: colors.outline,
    gap: spacing.xs,
  },
  chipActive: {
    backgroundColor: colors.primaryLight,
    borderColor: colors.primary,
  },
  chipLabel: {
    ...typography.labelLarge,
    color: colors.textSecondary,
  },
  chipLabelActive: {
    color: colors.primary,
    fontWeight: '600',
  },
  menuContent: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    maxHeight: 300,
  },
  menuScroll: {
    maxHeight: 250,
  },
  clearItem: {
    color: colors.error,
  },
  selectedItem: {
    color: colors.primary,
    fontWeight: '600',
  },
  noOptions: {
    color: colors.textDisabled,
    fontStyle: 'italic',
  },
  clearAll: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: spacing.xs,
  },
  clearAllText: {
    ...typography.labelLarge,
    color: colors.error,
  },
});
