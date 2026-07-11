import { API_CONFIG, buildApiUrl, getAuthenticatedFetchOptions } from '../../config/api';
import { logger } from '../utils/logger';
import type {
  Badge,
  BadgeProgress
} from '../models/Badge';

export class BadgeService {
  /**
   * Get combined badge data from progress endpoint (includes earned badges info)
   */
  static async getCombinedBadgeData(accessToken: string, userId: string): Promise<{
    badges: Badge[];
    progress: BadgeProgress[];
  }> {
    const url = buildApiUrl(API_CONFIG.ENDPOINTS.GET_USER_BADGE_PROGRESS.replace('{userId}', userId));
    
    try {
      const response = await fetch(url, {
        ...getAuthenticatedFetchOptions(accessToken),
        method: 'GET',
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData?.message || 
          errorData?.error ||
          `Failed to fetch user badge progress! Status: ${response.status}`
        );
      }

      const progress: BadgeProgress[] = await response.json();
      
      // Extract earned badges from progress data
      const earnedBadges: Badge[] = progress
        .filter(p => p.earned && p.earnedAt && p.isActive)
        .map(p => ({
          id: `${userId}-${p.badgeType}`,
          doctorId: userId, // Using doctorId for compatibility
          badgeType: p.badgeType as any,
          earnedAt: p.earnedAt!,
          isActive: p.isActive!,
          lastEvaluatedAt: p.lastEvaluatedAt || p.earnedAt!
        }));

      return {
        badges: earnedBadges,
        progress: progress
      };
    } catch (error) {
      logger.error('Failed to fetch combined badge data:', error);
      throw error;
    }
  }

  /**
   * Trigger manual badge evaluation for a user
   */
  static async evaluateUserBadges(accessToken: string, userId: string): Promise<void> {
    const url = buildApiUrl(API_CONFIG.ENDPOINTS.EVALUATE_USER_BADGES.replace('{userId}', userId));
    
    try {
      const response = await fetch(url, {
        ...getAuthenticatedFetchOptions(accessToken),
        method: 'POST',
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData?.message || 
          errorData?.error ||
          `Failed to evaluate badges! Status: ${response.status}`
        );
      }
    } catch (error) {
      logger.error('[FRONTEND_BADGE_EVALUATION] Error evaluating badges:', error);
      throw error;
    }
  }

  static formatEarnedDate(earnedAt: string): string {
    const date = new Date(earnedAt);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return 'Hoy';
    if (diffDays === 1) return 'Ayer';
    if (diffDays < 7) return `Hace ${diffDays} días`;
    if (diffDays < 30) return `Hace ${Math.floor(diffDays / 7)} semanas`;
    if (diffDays < 365) return `Hace ${Math.floor(diffDays / 30)} meses`;
    return `Hace ${Math.floor(diffDays / 365)} años`;
  }
}
