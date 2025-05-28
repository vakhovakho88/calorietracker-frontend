/**
 * API Models for the calorie tracker
 * These interfaces define the data structures used to communicate with the backend API
 */

/**
 * ApiGoal - Goal data as returned from the API
 */
export interface ApiGoal {
  goalId: string;               // Unique identifier from backend
  userId: string;               // Owner of the goal
  targetKcals: number;          // Total calorie target
  timeWindowDays: number;       // Duration in days
  startDate: string;            // ISO date string
  concurrencyStamp: string;     // For optimistic concurrency
  dailyTargetCalories?: number; // Calculated per-day target
}

/**
 * ApiDailyLog - Daily log data as returned from the API
 */
export interface ApiDailyLog {
  dailyLogId: string;           // Unique identifier
  userId: string;               // Owner of the log
  date: string;                 // ISO date string
  kcalsBurn: number;            // Calories burned
  kcalsIntake: number;          // Calories consumed
  kcalsDiff: number;            // Difference (burned - consumed)
  sumDiffs: number;             // Running sum of differences
  goalDelta: number;            // Remaining to goal
  avg4Days: number;             // 4-day average
  avg7Days: number;             // 7-day average
  avgAll: number;               // Overall average
  dayNum: number;               // Day number in sequence
  
  // Status information
  targetKcalsPerDay?: number;   // Daily target
  progressPercentage?: number;  // Progress as percentage
  statusIndicator?: string;     // Status indicator
}

/**
 * DTOs for creating and updating goals
 */
export interface CreateGoalDto {
  targetKcals: number;         // Total calorie target
  timeWindowDays: number;      // Duration in days
  startDate: string;           // ISO date string
}

export interface UpdateGoalDto {
  targetKcals: number;         // Updated calorie target
  timeWindowDays: number;      // Updated duration
}

/**
 * DTOs for creating and updating daily logs
 */
export interface CreateDailyLogDto {
  date: string;                // ISO date string
  kcalsBurn: number;           // Calories burned
  kcalsIntake: number;         // Calories consumed
}

export interface UpdateDailyLogDto {
  kcalsBurn: number;           // Updated calories burned
  kcalsIntake: number;         // Updated calories consumed
}

/**
 * Paged result for API responses that include pagination
 */
export interface PagedResultDto<T> {
  items: T[];                  // Collection of items
  totalCount: number;          // Total number of items
  pageNumber: number;          // Current page number
  pageSize: number;            // Number of items per page
}