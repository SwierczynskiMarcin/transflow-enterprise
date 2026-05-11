import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act, fireEvent } from '@testing-library/react';
import { ToastProvider, useToast } from './ToastContext';

const TestComponent = () => {
    const { showToast } = useToast();
    return (
        <div>
            <button onClick={() => showToast('Operation Successful', 'success')}>
                Trigger Success
            </button>
            <button onClick={() => showToast('Operation Failed', 'error')}>
                Trigger Error
            </button>
        </div>
    );
};

describe('ToastContext', () => {

    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        act(() => {
            vi.runOnlyPendingTimers();
        });
        vi.useRealTimers();
    });

    it('renders toast when showToast is called', () => {
        render(
            <ToastProvider>
                <TestComponent />
            </ToastProvider>
        );

        act(() => {
            fireEvent.click(screen.getByText('Trigger Success'));
        });

        expect(screen.getByText('Operation Successful')).toBeInTheDocument();
    });

    it('auto-removes toast after timeout', () => {
        render(
            <ToastProvider>
                <TestComponent />
            </ToastProvider>
        );

        act(() => {
            fireEvent.click(screen.getByText('Trigger Error'));
        });

        expect(screen.getByText('Operation Failed')).toBeInTheDocument();

        act(() => {
            vi.advanceTimersByTime(5000);
        });

        expect(screen.queryByText('Operation Failed')).not.toBeInTheDocument();
    });

    it('allows manual dismissal of toast', () => {
        render(
            <ToastProvider>
                <TestComponent />
            </ToastProvider>
        );

        act(() => {
            fireEvent.click(screen.getByText('Trigger Success'));
        });

        const toastMessage = screen.getByText('Operation Successful');
        expect(toastMessage).toBeInTheDocument();

        const closeButton = toastMessage.nextElementSibling;
        if (closeButton) {
            act(() => {
                fireEvent.click(closeButton);
            });
        }

        expect(screen.queryByText('Operation Successful')).not.toBeInTheDocument();
    });
});