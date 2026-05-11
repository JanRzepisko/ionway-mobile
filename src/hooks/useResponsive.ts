import { useState, useEffect } from 'react';
import { Dimensions, ScaledSize } from 'react-native';

export type DeviceType = 'phone' | 'tablet';
export type Orientation = 'portrait' | 'landscape';

interface ResponsiveData {
  width: number;
  height: number;
  deviceType: DeviceType;
  orientation: Orientation;
  isPhone: boolean;
  isTablet: boolean;
  isPortrait: boolean;
  isLandscape: boolean;
  // Scaling factors
  scale: number;
  fontScale: number;
  // Responsive values helper
  responsive: <T>(phone: T, tablet: T) => T;
  // Column count for grids
  columns: number;
}

const TABLET_MIN_WIDTH = 600;

function getDeviceType(width: number): DeviceType {
  return width >= TABLET_MIN_WIDTH ? 'tablet' : 'phone';
}

function getOrientation(width: number, height: number): Orientation {
  return width > height ? 'landscape' : 'portrait';
}

function getColumns(width: number, deviceType: DeviceType): number {
  if (deviceType === 'phone') return 1;
  if (width >= 1024) return 3;
  if (width >= 768) return 2;
  return 1;
}

function calculateResponsiveData(window: ScaledSize): ResponsiveData {
  const { width, height, scale, fontScale } = window;
  const deviceType = getDeviceType(width);
  const orientation = getOrientation(width, height);

  return {
    width,
    height,
    deviceType,
    orientation,
    isPhone: deviceType === 'phone',
    isTablet: deviceType === 'tablet',
    isPortrait: orientation === 'portrait',
    isLandscape: orientation === 'landscape',
    scale,
    fontScale,
    responsive: <T>(phone: T, tablet: T) => deviceType === 'tablet' ? tablet : phone,
    columns: getColumns(width, deviceType),
  };
}

export function useResponsive(): ResponsiveData {
  const [data, setData] = useState<ResponsiveData>(() => 
    calculateResponsiveData(Dimensions.get('window'))
  );

  useEffect(() => {
    const subscription = Dimensions.addEventListener('change', ({ window }) => {
      setData(calculateResponsiveData(window));
    });

    return () => subscription?.remove();
  }, []);

  return data;
}

// Static helpers for non-hook usage
export function getResponsiveValue<T>(phone: T, tablet: T): T {
  const { width } = Dimensions.get('window');
  return width >= TABLET_MIN_WIDTH ? tablet : phone;
}

export function isTablet(): boolean {
  const { width } = Dimensions.get('window');
  return width >= TABLET_MIN_WIDTH;
}

export function isPhone(): boolean {
  return !isTablet();
}

// Responsive spacing multiplier
export function getSpacingMultiplier(): number {
  return isTablet() ? 1.25 : 1;
}

// Responsive font size
export function getResponsiveFontSize(baseSize: number): number {
  const multiplier = isTablet() ? 1.1 : 1;
  return Math.round(baseSize * multiplier);
}
