import {
  CommonActions,
  createNavigationContainerRef,
  type NavigationState,
} from '@react-navigation/native';

export const navigationRef = createNavigationContainerRef();

export function resetToLogin() {
  if (!navigationRef.isReady()) return;

  navigationRef.dispatch(
    CommonActions.reset({
      index: 0,
      routes: [{ name: 'Login' }],
    })
  );
}

export function getRootState(): NavigationState | undefined {
  if (!navigationRef.isReady()) return undefined;
  return navigationRef.getRootState();
}

export function navigate(name: string, params?: any) {
  if (!navigationRef.isReady()) return;
  (navigationRef as any).navigate(name, params);
}
