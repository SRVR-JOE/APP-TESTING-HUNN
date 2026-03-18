/**
 * Tests for the ErrorBoundary React component.
 *
 * Verifies:
 *  1. Children render normally when no error occurs.
 *  2. Default fallback UI is shown when a child throws.
 *  3. Custom fallback prop is used when provided.
 *  4. The "Try Again" button resets the error state.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import React from 'react';
import { ErrorBoundary } from './ErrorBoundary';

// Suppress React's console.error for expected errors during tests
beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

// A component that throws on render — used to trigger the ErrorBoundary
function ThrowingComponent({ message }: { message: string }): JSX.Element {
  throw new Error(message);
}

// A component that throws only on the first render, then renders normally
let throwOnce = true;
function ThrowOnceComponent(): JSX.Element {
  if (throwOnce) {
    throwOnce = true; // will be reset in the test
    throw new Error('first render error');
  }
  return <div>Recovered content</div>;
}

describe('ErrorBoundary', () => {
  it('should render children when no error occurs', () => {
    render(
      <ErrorBoundary>
        <div>Hello World</div>
      </ErrorBoundary>,
    );

    expect(screen.getByText('Hello World')).toBeInTheDocument();
  });

  it('should display default fallback UI when a child throws', () => {
    render(
      <ErrorBoundary>
        <ThrowingComponent message="Something broke" />
      </ErrorBoundary>,
    );

    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    expect(screen.getByText('Something broke')).toBeInTheDocument();
    expect(screen.getByText('Try Again')).toBeInTheDocument();
  });

  it('should display custom fallback when provided', () => {
    render(
      <ErrorBoundary fallback={<div>Custom error page</div>}>
        <ThrowingComponent message="fail" />
      </ErrorBoundary>,
    );

    expect(screen.getByText('Custom error page')).toBeInTheDocument();
    expect(screen.queryByText('Something went wrong')).not.toBeInTheDocument();
  });

  it('should display generic message when error has no message', () => {
    // Create a component that throws an error with empty message
    function ThrowEmpty(): JSX.Element {
      throw new Error('');
    }

    render(
      <ErrorBoundary>
        <ThrowEmpty />
      </ErrorBoundary>,
    );

    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    expect(screen.getByText('An unexpected error occurred')).toBeInTheDocument();
  });

  it('should reset error state and re-render children when Try Again is clicked', () => {
    // We need a component that throws on first render but not on subsequent renders
    let shouldThrow = true;

    function ConditionalThrow(): JSX.Element {
      if (shouldThrow) {
        throw new Error('temporary error');
      }
      return <div>Content after recovery</div>;
    }

    render(
      <ErrorBoundary>
        <ConditionalThrow />
      </ErrorBoundary>,
    );

    // Verify we see the error UI
    expect(screen.getByText('Something went wrong')).toBeInTheDocument();

    // Fix the underlying issue
    shouldThrow = false;

    // Click "Try Again"
    fireEvent.click(screen.getByText('Try Again'));

    // Should now see the recovered content
    expect(screen.getByText('Content after recovery')).toBeInTheDocument();
    expect(screen.queryByText('Something went wrong')).not.toBeInTheDocument();
  });
});
