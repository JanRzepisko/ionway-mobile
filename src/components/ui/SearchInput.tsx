// =============================================================================
// Search Input Component
// Large, tablet-friendly search input with clear button
// =============================================================================

import React from 'react';
import { View, StyleSheet, TextInput, TouchableOpacity } from 'react-native';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import { colors, spacing, borderRadius, typography } from '../../theme';

interface SearchInputProps {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
  onSubmit?: () => void;
  size?: 'medium' | 'large';
}

export function SearchInput({
  value,
  onChangeText,
  placeholder = 'Szukaj...',
  autoFocus = false,
  onSubmit,
  size = 'large',
}: SearchInputProps) {
  const handleClear = () => {
    onChangeText('');
  };

  const sizeStyles = {
    medium: {
      container: { height: 44, paddingHorizontal: spacing.md },
      input: { ...typography.bodyMedium },
      iconSize: 20,
    },
    large: {
      container: { height: 56, paddingHorizontal: spacing.lg },
      input: { ...typography.bodyLarge },
      iconSize: 24,
    },
  };

  const s = sizeStyles[size];

  return (
    <View style={[styles.container, s.container]}>
      <Icon 
        name="magnify" 
        size={s.iconSize} 
        color={colors.textSecondary} 
        style={styles.searchIcon}
      />
      
      <TextInput
        style={[styles.input, s.input]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textDisabled}
        autoFocus={autoFocus}
        autoCapitalize="none"
        autoCorrect={false}
        returnKeyType="search"
        onSubmitEditing={onSubmit}
      />
      
      {value.length > 0 && (
        <TouchableOpacity
          onPress={handleClear}
          style={styles.clearButton}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Icon name="close-circle" size={20} color={colors.textSecondary} />
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceVariant,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
  },
  searchIcon: {
    marginRight: spacing.sm,
  },
  input: {
    flex: 1,
    color: colors.textPrimary,
    padding: 0,
  },
  clearButton: {
    marginLeft: spacing.sm,
    padding: spacing.xs,
  },
});
