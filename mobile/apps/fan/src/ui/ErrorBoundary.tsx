import React from 'react';
import * as Sentry from '@sentry/react-native';
import { Pressable, StyleSheet, Text, View } from 'react-native';

type Props = {
  children: React.ReactNode;
  label?: string;
};

type State = {
  hasError: boolean;
  error?: unknown;
};

export default class ErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(error: unknown): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: unknown, info: React.ErrorInfo) {
    console.error('[GLOBAL_ERROR_LOG]', {
      label: this.props.label ?? '(unlabeled)',
      error,
      info,
    });
    Sentry.captureException(error, { extra: { ...info, label: this.props.label } });
  }

  private retry = () => {
    this.setState({ hasError: false, error: undefined });
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <View style={styles.root}>
        <View style={styles.card}>
          <Text style={styles.title}>Something went wrong</Text>
          <Text style={styles.subtitle}>
            Please try again. If this keeps happening, check the terminal logs.
          </Text>

          <View style={styles.row}>
            <Pressable onPress={this.retry} style={styles.button}>
              <Text style={styles.buttonText}>Retry</Text>
            </Pressable>
            {this.props.label ? (
              <Text style={styles.section}>Section: {this.props.label}</Text>
            ) : null}
          </View>
        </View>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#4b1927',
    paddingHorizontal: 16,
    justifyContent: 'center',
  },
  card: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    backgroundColor: 'rgba(20,16,16,0.55)',
    padding: 16,
  },
  title: {
    color: '#e6d6d2',
    fontSize: 18,
    fontWeight: '300',
  },
  subtitle: {
    color: '#d8c7c3',
    fontSize: 13,
    marginTop: 6,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 14,
    flexWrap: 'wrap',
  },
  button: {
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '600',
  },
  section: {
    color: '#a99792',
    fontSize: 12,
  },
});
