import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Radius, Spacing } from '../styles/theme';
import { useTheme } from '../contexts/ThemeContext';

export default function AppDetailHeader({
  title,
  subtitle,
  onBack,
  rightActions,
  rightIcon,
  onRightPress,
  rightDisabled = false,
  centerPress,
  centerDisabled = true,
  showChevron = false,
}) {
  const { colors: Colors } = useTheme();

  return (
    <View style={[styles.wrap, { backgroundColor: Colors.background, borderBottomColor: Colors.border }]}>
      <TouchableOpacity
        style={[styles.iconButton, { backgroundColor: Colors.surfaceAlt, borderColor: Colors.border }]}
        onPress={onBack}
        activeOpacity={0.82}
        accessibilityRole="button"
        accessibilityLabel="Volver"
      >
        <MaterialIcons name="arrow-back" size={22} color={Colors.textPrimary} />
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.titleWrap}
        onPress={centerPress}
        disabled={centerDisabled}
        activeOpacity={0.78}
      >
        <View style={{ flex: 1, minWidth: 0 }}>
          {subtitle ? (
            <Text style={[styles.subtitle, { color: Colors.primary }]} numberOfLines={1}>
              {subtitle}
            </Text>
          ) : null}
          <Text style={[styles.title, { color: Colors.textPrimary }]} numberOfLines={1}>
            {title}
          </Text>
        </View>
        {showChevron ? <MaterialIcons name="keyboard-arrow-down" size={22} color={Colors.textMuted} /> : null}
      </TouchableOpacity>

      <View style={styles.actionsWrap}>
        {Array.isArray(rightActions) && rightActions.length > 0 ? (
          rightActions.slice(0, 2).map((action) => (
            <TouchableOpacity
              key={action.icon}
              style={[
                styles.iconButton,
                { backgroundColor: Colors.surfaceAlt, borderColor: Colors.border, opacity: action.disabled ? 0.42 : 1 },
              ]}
              onPress={action.onPress}
              disabled={action.disabled}
              activeOpacity={0.82}
              accessibilityRole="button"
              accessibilityLabel={action.label}
            >
              <MaterialIcons name={action.icon} size={22} color={Colors.textPrimary} />
            </TouchableOpacity>
          ))
        ) : (
          <TouchableOpacity
            style={[
              styles.iconButton,
              { backgroundColor: Colors.surfaceAlt, borderColor: Colors.border, opacity: rightDisabled || !rightIcon ? 0.42 : 1 },
            ]}
            onPress={onRightPress}
            disabled={rightDisabled || !rightIcon}
            activeOpacity={0.82}
            accessibilityRole="button"
          >
            {rightIcon ? <MaterialIcons name={rightIcon} size={22} color={Colors.textPrimary} /> : null}
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    minHeight: 66,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
  },
  iconButton: {
    width: 42,
    height: 42,
    borderRadius: Radius.lg,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleWrap: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  subtitle: {
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  title: {
    fontSize: 17,
    fontWeight: '900',
    marginTop: 1,
  },
  actionsWrap: {
    minWidth: 42,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 6,
  },
});
