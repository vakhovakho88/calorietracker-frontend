/**
 * Models/interfaces for the calorie tracker application
 * These define the core data structures used throughout the app
 */

/**
 * GoalSettings - Represents a user's calorie goal configuration
 * 
 * A goal can be either:
 * - A calorie deficit goal (positive value) - Used when trying to lose weight
 * - A calorie surplus goal (negative value) - Used when trying to gain weight/muscle
 */
export interface GoalSettings {
  /**
   * Total calorie target for the entire goal period
   * - Positive value: Deficit goal (burn more than consume)
   * - Negative value: Surplus goal (consume more than burn)
   */
  totalCalorieGoal: number;
  
  /**
   * Number of days over which to achieve the goal
   */
  timeWindowDays: number;
  
  /**
   * Date when the goal period starts
   */
  startDate: Date;
  
  /**
   * Daily target calories (calculated as totalCalorieGoal / timeWindowDays)
   * This is the average daily deficit/surplus needed to achieve the goal
   */
  dailyTargetCalories?: number;
  
  /**
   * Unique identifier for the goal (used for API operations)
   */
  goalId?: string;
}

/**
 * DailyLog - Represents a single day's calorie tracking entry
 * 
 * Contains both user input values (calories burned/consumed) and
 * calculated metrics like running totals and averages.
 */
export interface DailyLog {
  /**
   * Unique identifier for the daily log
   */
  id: number;
  
  /**
   * The date this log entry is for
   */
  date: Date;
  
  /**
   * Day number within the goal period (1-based)
   * Day 1 = start date of the goal
   */
  dayNumber: number;
  
  /**
   * Number of calories burned on this day (through exercise, BMR, etc.)
   */
  caloriesBurned: number;
  
  /**
   * Number of calories consumed on this day (food and drink)
   */
  caloriesConsumed: number;
  
  /**
   * Daily calorie balance (caloriesBurned - caloriesConsumed)
   * - Positive value: Deficit (burned more than consumed)
   * - Negative value: Surplus (consumed more than burned)
   */
  dailyDifference: number;
  
  /**
   * Running total of all daily differences up to this day
   */
  runningSum?: number;
  
  /**
   * Remaining calories needed to reach the goal
   */
  remainingToGoal?: number;
  
  /**
   * Average daily difference over the last 4 days
   */
  rollingAvg4Day?: number;
  
  /**
   * Average daily difference over the last 7 days
   */
  rollingAvg7Day?: number;
  
  /**
   * Average daily difference across all days recorded so far
   */
  overallAverage?: number;
  
  /**
   * Daily target calories calculated from the goal
   */
  dailyTargetCalories?: number;
  
  /**
   * Whether this day is on track to meet the goal
   */
  isOnTrack?: boolean;
  
  /**
   * CSS class for styling based on status
   */
  statusClass?: string;
  
  /**
   * Human-readable status message
   */
  statusText?: string;
}