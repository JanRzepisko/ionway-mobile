// =============================================================================
// Cascading Filters - Device selection with hierarchical filtering
// Offline-first: all filtering happens on local data
// =============================================================================

import React, { useState, useMemo, useCallback } from 'react';
import { 
  View, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity, 
  FlatList,
  Modal as RNModal 
} from 'react-native';
import { Text, Searchbar, Portal, Modal, Divider } from 'react-native-paper';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import { colors, spacing, borderRadius, typography, shadows, screen } from '../../theme';
import { DeviceFilters } from '../../types';

// -----------------------------------------------------------------------------
// Filter Dropdown Component
// -----------------------------------------------------------------------------

interface FilterDropdownProps {
  label: string;
  icon: string;
  value?: string;
  options: string[];
  onSelect: (value: string | undefined) => void;
  disabled?: boolean;
  count?: number;
}

function FilterDropdown({ 
  label, 
  icon,
  value, 
  options, 
  onSelect, 
  disabled = false,
  count 
}: FilterDropdownProps) {
  const [visible, setVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  const hasValue = !!value;
  const isDisabled = disabled || options.length === 0;

  const filteredOptions = useMemo(() => {
    if (!searchQuery) return options;
    const query = searchQuery.toLowerCase();
    return options.filter(o => o.toLowerCase().includes(query));
  }, [options, searchQuery]);

  const handleSelect = (optionValue: string | undefined) => {
    onSelect(optionValue);
    setVisible(false);
    setSearchQuery('');
  };

  return (
    <>
      <TouchableOpacity 
        style={[
          styles.filterDropdown, 
          hasValue && styles.filterDropdownActive,
          isDisabled && styles.filterDropdownDisabled
        ]}
        onPress={() => !isDisabled && setVisible(true)}
        activeOpacity={isDisabled ? 1 : 0.7}
      >
        <View style={styles.filterDropdownContent}>
          <View style={[
            styles.filterIconContainer,
            hasValue && styles.filterIconContainerActive
          ]}>
            <Icon 
              name={icon} 
              size={20} 
              color={hasValue ? colors.primary : colors.textSecondary} 
            />
          </View>
          <View style={styles.filterTextContainer}>
            <Text style={styles.filterLabel}>{label}</Text>
            <Text 
              style={[
                styles.filterValue, 
                hasValue && styles.filterValueActive
              ]}
              numberOfLines={1}
            >
              {value || (isDisabled ? 'Brak opcji' : 'Wszystkie')}
            </Text>
          </View>
          {count !== undefined && (
            <View style={styles.filterCount}>
              <Text style={styles.filterCountText}>{count}</Text>
            </View>
          )}
          <Icon 
            name="chevron-down" 
            size={20} 
            color={isDisabled ? colors.textDisabled : colors.textSecondary} 
          />
        </View>
      </TouchableOpacity>

      <Portal>
        <Modal
          visible={visible}
          onDismiss={() => {
            setVisible(false);
            setSearchQuery('');
          }}
          contentContainerStyle={styles.filterModal}
        >
          <View style={styles.filterModalHeader}>
            <View style={styles.filterModalIconContainer}>
              <Icon name={icon} size={24} color={colors.primary} />
            </View>
            <Text style={styles.filterModalTitle}>{label}</Text>
            <TouchableOpacity 
              onPress={() => setVisible(false)}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Icon name="close" size={24} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          {options.length > 8 && (
            <Searchbar
              placeholder="Szukaj..."
              onChangeText={setSearchQuery}
              value={searchQuery}
              style={styles.filterModalSearchbar}
              inputStyle={styles.filterModalSearchbarInput}
            />
          )}

          {hasValue && (
            <>
              <TouchableOpacity
                style={styles.filterModalClear}
                onPress={() => handleSelect(undefined)}
              >
                <Icon name="close-circle" size={20} color={colors.error} />
                <Text style={styles.filterModalClearText}>Wyczyść wybór</Text>
              </TouchableOpacity>
              <Divider style={styles.filterModalDivider} />
            </>
          )}

          <FlatList
            data={filteredOptions}
            keyExtractor={(item) => item}
            style={styles.filterModalList}
            renderItem={({ item }) => {
              const isSelected = item === value;
              return (
                <TouchableOpacity
                  style={[
                    styles.filterModalItem,
                    isSelected && styles.filterModalItemSelected
                  ]}
                  onPress={() => handleSelect(item)}
                  activeOpacity={0.7}
                >
                  <Text style={[
                    styles.filterModalItemText,
                    isSelected && styles.filterModalItemTextSelected
                  ]}>
                    {item}
                  </Text>
                  {isSelected && (
                    <Icon name="check" size={20} color={colors.primary} />
                  )}
                </TouchableOpacity>
              );
            }}
            ListEmptyComponent={
              <View style={styles.filterModalEmpty}>
                <Icon name="magnify-close" size={32} color={colors.textDisabled} />
                <Text style={styles.filterModalEmptyText}>Brak wyników</Text>
              </View>
            }
          />
        </Modal>
      </Portal>
    </>
  );
}

// -----------------------------------------------------------------------------
// Cascading Filters Component
// -----------------------------------------------------------------------------

interface CascadingFiltersProps {
  filters: DeviceFilters;
  filterOptions: {
    buildings: string[];
    levels: string[];
    zones: string[];
    systems: string[];
    groups: string[];
    types: string[];
  };
  filteredCount: number;
  totalCount: number;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onFilterChange: (key: keyof DeviceFilters, value: string | undefined) => void;
  onClearFilters: () => void;
}

export function CascadingFilters({
  filters,
  filterOptions,
  filteredCount,
  totalCount,
  searchQuery,
  onSearchChange,
  onFilterChange,
  onClearFilters,
}: CascadingFiltersProps) {
  const hasActiveFilters = useMemo(() => {
    return Object.entries(filters).some(([key, value]) => 
      key !== 'searchQuery' && value !== undefined
    );
  }, [filters]);

  const activeFilterCount = useMemo(() => {
    return Object.entries(filters).filter(([key, value]) => 
      key !== 'searchQuery' && value !== undefined
    ).length;
  }, [filters]);

  return (
    <View style={styles.container}>
      {/* Search */}
      <View style={styles.searchContainer}>
        <Searchbar
          placeholder="Szukaj po ID, nazwie lub numerze rysunku..."
          onChangeText={onSearchChange}
          value={searchQuery}
          style={styles.searchbar}
          inputStyle={styles.searchInput}
          icon={() => <Icon name="magnify" size={22} color={colors.textSecondary} />}
        />
      </View>

      {/* Results summary */}
      <View style={styles.summaryRow}>
        <View style={styles.summaryLeft}>
          <Text style={styles.summaryText}>
            Znaleziono: <Text style={styles.summaryCount}>{filteredCount}</Text>
            {filteredCount !== totalCount && (
              <Text style={styles.summaryTotal}> z {totalCount}</Text>
            )}
          </Text>
        </View>
        
        {hasActiveFilters && (
          <TouchableOpacity 
            style={styles.clearAllButton}
            onPress={onClearFilters}
          >
            <Icon name="filter-remove" size={18} color={colors.error} />
            <Text style={styles.clearAllText}>
              Wyczyść ({activeFilterCount})
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Filters */}
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false}
        style={styles.filtersScroll}
        contentContainerStyle={styles.filtersContent}
      >
        <FilterDropdown
          label="Budynek"
          icon="office-building"
          value={filters.building}
          options={filterOptions.buildings}
          onSelect={(v) => onFilterChange('building', v)}
          count={filterOptions.buildings.length}
        />
        
        <FilterDropdown
          label="Poziom"
          icon="layers"
          value={filters.level}
          options={filterOptions.levels}
          onSelect={(v) => onFilterChange('level', v)}
          count={filterOptions.levels.length}
        />
        
        <FilterDropdown
          label="Strefa"
          icon="map-marker-radius"
          value={filters.zone}
          options={filterOptions.zones}
          onSelect={(v) => onFilterChange('zone', v)}
          count={filterOptions.zones.length}
        />
        
        <FilterDropdown
          label="Układ"
          icon="sitemap"
          value={filters.system}
          options={filterOptions.systems}
          onSelect={(v) => onFilterChange('system', v)}
          count={filterOptions.systems.length}
        />
        
        <FilterDropdown
          label="Grupa"
          icon="group"
          value={filters.group}
          options={filterOptions.groups}
          onSelect={(v) => onFilterChange('group', v)}
          count={filterOptions.groups.length}
        />
        
        <FilterDropdown
          label="Typ"
          icon="tag-outline"
          value={filters.type}
          options={filterOptions.types}
          onSelect={(v) => onFilterChange('type', v)}
          count={filterOptions.types.length}
        />
      </ScrollView>

      {/* Active filters pills */}
      {hasActiveFilters && (
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          style={styles.activePillsScroll}
          contentContainerStyle={styles.activePillsContent}
        >
          {Object.entries(filters).map(([key, value]) => {
            if (key === 'searchQuery' || !value) return null;
            return (
              <TouchableOpacity
                key={key}
                style={styles.activePill}
                onPress={() => onFilterChange(key as keyof DeviceFilters, undefined)}
              >
                <Text style={styles.activePillText}>{value}</Text>
                <Icon name="close" size={16} color={colors.primaryDark} />
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
}

// -----------------------------------------------------------------------------
// Styles
// -----------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.outlineVariant,
  },
  
  // Search
  searchContainer: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
  searchbar: {
    backgroundColor: colors.surfaceVariant,
    borderRadius: borderRadius.lg,
    elevation: 0,
  },
  searchInput: {
    ...typography.bodyLarge,
  },
  
  // Summary
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  summaryLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  summaryText: {
    ...typography.bodyMedium,
    color: colors.textSecondary,
  },
  summaryCount: {
    ...typography.titleMedium,
    color: colors.textPrimary,
    fontWeight: '600',
  },
  summaryTotal: {
    ...typography.bodyMedium,
    color: colors.textDisabled,
  },
  clearAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    padding: spacing.sm,
  },
  clearAllText: {
    ...typography.labelMedium,
    color: colors.error,
  },
  
  // Filters scroll
  filtersScroll: {
    maxHeight: screen.isTablet ? 100 : 90,
  },
  filtersContent: {
    paddingHorizontal: screen.isTablet ? spacing.xl : spacing.lg,
    paddingBottom: spacing.md,
    gap: spacing.sm,
  },
  
  // Filter dropdown
  filterDropdown: {
    backgroundColor: colors.surfaceVariant,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.outline,
    minWidth: screen.isTablet ? 180 : 140,
    maxWidth: screen.isTablet ? 280 : 200,
  },
  filterDropdownActive: {
    backgroundColor: colors.primaryLight,
    borderColor: colors.primary,
  },
  filterDropdownDisabled: {
    opacity: 0.5,
  },
  filterDropdownContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    gap: spacing.sm,
  },
  filterIconContainer: {
    width: 36,
    height: 36,
    borderRadius: borderRadius.md,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterIconContainerActive: {
    backgroundColor: colors.primaryLight,
  },
  filterTextContainer: {
    flex: 1,
    minWidth: 60,
  },
  filterLabel: {
    ...typography.labelSmall,
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  filterValue: {
    ...typography.bodyMedium,
    color: colors.textSecondary,
    marginTop: 2,
  },
  filterValueActive: {
    color: colors.primaryDark,
    fontWeight: '600',
  },
  filterCount: {
    backgroundColor: colors.outlineVariant,
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  filterCountText: {
    ...typography.labelSmall,
    color: colors.textSecondary,
  },
  
  // Active pills
  activePillsScroll: {
    maxHeight: 44,
    borderTopWidth: 1,
    borderTopColor: colors.outlineVariant,
  },
  activePillsContent: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
  },
  activePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primaryLight,
    paddingVertical: spacing.xs,
    paddingLeft: spacing.md,
    paddingRight: spacing.sm,
    borderRadius: borderRadius.full,
    gap: spacing.xs,
  },
  activePillText: {
    ...typography.labelMedium,
    color: colors.primaryDark,
  },
  
  // Filter modal
  filterModal: {
    backgroundColor: colors.surface,
    margin: spacing.xl,
    borderRadius: borderRadius.xl,
    maxHeight: '80%',
  },
  filterModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.outlineVariant,
    gap: spacing.md,
  },
  filterModalIconContainer: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.md,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterModalTitle: {
    ...typography.titleLarge,
    color: colors.textPrimary,
    flex: 1,
  },
  filterModalSearchbar: {
    margin: spacing.md,
    backgroundColor: colors.surfaceVariant,
    elevation: 0,
  },
  filterModalSearchbarInput: {
    ...typography.bodyLarge,
  },
  filterModalClear: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    marginHorizontal: spacing.md,
    gap: spacing.sm,
  },
  filterModalClearText: {
    ...typography.labelLarge,
    color: colors.error,
  },
  filterModalDivider: {
    marginHorizontal: spacing.md,
  },
  filterModalList: {
    maxHeight: 400,
  },
  filterModalItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.lg,
    marginHorizontal: spacing.md,
    borderRadius: borderRadius.md,
  },
  filterModalItemSelected: {
    backgroundColor: colors.primaryLight,
  },
  filterModalItemText: {
    ...typography.bodyLarge,
    color: colors.textPrimary,
  },
  filterModalItemTextSelected: {
    color: colors.primaryDark,
    fontWeight: '600',
  },
  filterModalEmpty: {
    alignItems: 'center',
    padding: spacing.xxl,
  },
  filterModalEmptyText: {
    ...typography.bodyLarge,
    color: colors.textDisabled,
    marginTop: spacing.md,
  },
});
