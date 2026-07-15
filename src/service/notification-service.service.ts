// FBUG-003 — the ad-hoc `handleAuthError()` that dispatched HANDLE_AUTH_ERROR with a
// never-invoked `retryAction` is gone: 401 → refresh → retry is now handled once,
// centrally, by `authenticatedFetch` (config/api).
import { API_CONFIG, authenticatedFetch, buildApiUrl } from '../../config/api';
import { logger } from '../utils/logger';

export interface NotificationResponse {
  id: string;
  type: 'TURN_CANCELLED' | 'MODIFY_REQUEST_APPROVED' | 'MODIFY_REQUEST_REJECTED' | 'PATIENT_FILE_UPLOADED' | 'TURN_RESERVED';
  relatedEntityId: string;
  message: string;
  isRead: boolean;
  createdAt: string;
}

export class NotificationService {
  static async getNotifications(accessToken: string): Promise<NotificationResponse[]> {
    const url = buildApiUrl(API_CONFIG.ENDPOINTS.GET_NOTIFICATIONS);
    try {
      const response = await authenticatedFetch(url, accessToken, {
        method: 'GET',
      });

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
      const response = await authenticatedFetch(url, accessToken, {
        method: 'DELETE',
      });

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