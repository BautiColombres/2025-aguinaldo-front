import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import NotificationModal from './NotificationModal';
import type { NotificationResponse } from '#/service/notification-service.service';

vi.mock('#/providers/MachineProvider', () => ({ useMachines: vi.fn() }));
vi.mock('#/providers/DataProvider', () => ({ useDataMachine: vi.fn() }));
vi.mock('#/utils/dateTimeUtils', () => ({ formatDateTime: vi.fn(() => '01/01/2025 10:00') }));

import { useMachines } from '#/providers/MachineProvider';
import { useDataMachine } from '#/providers/DataProvider';

const makeNotification = (
  type: NotificationResponse['type'],
  message: string,
): NotificationResponse => ({
  id: `${type}-1`,
  type,
  relatedEntityId: 'entity-1',
  message,
  isRead: false,
  createdAt: '2025-01-01T10:00:00Z',
});

const setup = (notifications: NotificationResponse[]) => {
  (useMachines as any).mockReturnValue({
    notificationState: {
      context: {
        notifications,
        isDeletingNotification: false,
        isDeletingAllNotifications: false,
      },
    },
    notificationSend: vi.fn(),
    uiSend: vi.fn(),
    doctorSend: vi.fn(),
  });
  (useDataMachine as any).mockReturnValue({
    dataState: { context: { userRole: 'DOCTOR', myTurns: [] } },
  });
  return render(<NotificationModal open onClose={vi.fn()} />);
};

describe('NotificationModal severity by type (FBUG-L3)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('shows a warning chip for TURN_CANCELLED even when the message lacks the Spanish keyword', () => {
    setup([makeNotification('TURN_CANCELLED', 'Tu cita fue anulada por el profesional')]);

    expect(screen.getByText('Atención')).toBeInTheDocument();
    expect(screen.queryByText('Confirmación')).not.toBeInTheDocument();
  });

  it('shows a warning chip for MODIFY_REQUEST_REJECTED regardless of message wording', () => {
    setup([makeNotification('MODIFY_REQUEST_REJECTED', 'Novedad sobre tu solicitud de cambio')]);

    expect(screen.getByText('Atención')).toBeInTheDocument();
    expect(screen.queryByText('Confirmación')).not.toBeInTheDocument();
  });

  it('shows a success chip for TURN_RESERVED regardless of message wording', () => {
    setup([makeNotification('TURN_RESERVED', 'Novedad en tu agenda')]);

    expect(screen.getByText('Confirmación')).toBeInTheDocument();
    expect(screen.queryByText('Atención')).not.toBeInTheDocument();
  });

  it('shows a success chip for MODIFY_REQUEST_APPROVED', () => {
    setup([makeNotification('MODIFY_REQUEST_APPROVED', 'Tu solicitud avanzó')]);

    expect(screen.getByText('Confirmación')).toBeInTheDocument();
    expect(screen.queryByText('Atención')).not.toBeInTheDocument();
  });
});
