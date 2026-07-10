import { API_CONFIG, buildApiUrl, getAuthenticatedFetchOptions } from '../../config/api';
import { logger } from '../utils/logger';
import { orchestrator } from '#/core/Orchestrator';

export interface NotificationResponse {
  id: string;
  type: 'TURN_CANCELLED' | 'MODIFY_REQUEST_APPROVED' | 'MODIFY_REQUEST_REJECTED' | 'PATIENT_FILE_UPLOADED' | 'TURN_RESERVED';
  relatedEntityId: string;
  message: string;
  isRead: boolean;
  createdAt: string;
}

// Utility function to handle authentication errors centrally
async function handleAuthError(error: Response, retryFn?: () => Promise<any>): Promise<void> {
  if (error.status === 401) {
    // Send auth error event to orchestrator
    orchestrator.sendToMachine('auth', {
      type: 'HANDLE_AUTH_ERROR',
      error,
      retryAction: retryFn
    });
  }
}

export class NotificationService {
  static async getNotifications(accessToken: string): Promise<NotificationResponse[]> {
    const url = buildApiUrl(API_CONFIG.ENDPOINTS.GET_NOTIFICATIONS);
    try {
      const response = await fetch(url, {
        ...getAuthenticatedFetchOptions(accessToken),
        method: 'GET',
      });

      if (response.status === 401) {
        await handleAuthError(response, () => this.getNotifications(accessToken));
      }

      if (!response.ok) {
        const errorData: any = await response.json().catch(() => ({}));
        logger.error('[NotificationService] getNotifications - Error:', errorData);
        throw new Error(
          errorData?.message ||
          errorData?.error ||
          `Failed to fetch notifications! Status: ${response.status}`
        );
      }
      const result: { notifications: NotificationResponse[] } = await response.json();
      return result.notifications;
    } catch (error) {
      logger.error('[NotificationService] getNotifications - Exception:', error);
      throw error;
    }
  }

  static async deleteNotification(notificationId: string, accessToken: string): Promise<void> {
    const url = buildApiUrl(API_CONFIG.ENDPOINTS.DELETE_NOTIFICATION.replace('{notificationId}', notificationId));
    try {
      const response = await fetch(url, {
        ...getAuthenticatedFetchOptions(accessToken),
        method: 'DELETE',
      });

      if (response.status === 401) {
        await handleAuthError(response, () => this.deleteNotification(notificationId, accessToken));
      }

      if (!response.ok) {
        const errorData: any = await response.json().catch(() => ({}));
        logger.error('[NotificationService] deleteNotification - Error:', errorData);
        throw new Error(
          errorData?.message ||
          errorData?.error ||
          `Failed to delete notification! Status: ${response.status}`
        );
      }
    } catch (error) {
      logger.error('[NotificationService] deleteNotification - Exception:', error);
      throw error;
    }
  }
}