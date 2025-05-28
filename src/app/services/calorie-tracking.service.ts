import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, of } from 'rxjs';
import { catchError, map, tap } from 'rxjs/operators';
import { DailyLog, GoalSettings } from '../models/calorie-data.model';
import { ApiService } from './api.service';

/**
 * CalorieTrackingService - Central business logic service for the calorie tracker app
 * 
 * This service acts as the bridge between the UI components and the API service.
 * It handles:
 * 1. Managing state of daily logs and goal settings
 * 2. Data calculations and business logic
 * 3. Caching data to minimize API calls
 * 4. Error handling and notifications
 */
@Injectable({
  providedIn: 'root'
})
export class CalorieTrackingService {
  // State management using BehaviorSubject for reactive updates
  private dailyLogsSubject = new BehaviorSubject<DailyLog[]>([]);
  private goalSettingsSubject = new BehaviorSubject<GoalSettings | null>(null);
  private errorMessageSubject = new BehaviorSubject<string | null>(null);
  
  // Expose observables for components to subscribe to
  dailyLogs$ = this.dailyLogsSubject.asObservable();
  goalSettings$ = this.goalSettingsSubject.asObservable();
  errorMessage$ = this.errorMessageSubject.asObservable();

  constructor(private apiService: ApiService) {
    // Initialize data on service creation
    this.refreshData();
  }

  /**
   * Refresh all data from the API
   */
  refreshData(): void {
    this.fetchGoalSettings();
    this.fetchDailyLogs();
  }

  // ========== DAILY LOG METHODS ==========

  /**
   * Get daily logs from cache or API
   * @returns Observable of DailyLog array
   */
  getDailyLogs(): Observable<DailyLog[]> {
    // If we already have logs in our cache, return those immediately
    const cachedLogs = this.dailyLogsSubject.getValue();
    if (cachedLogs.length > 0) {
      return of(cachedLogs);
    }
    
    // Otherwise fetch from API
    return this.fetchDailyLogs();
  }

  /**
   * Fetch fresh daily logs from API
   * @returns Observable of DailyLog array
   */
  fetchDailyLogs(): Observable<DailyLog[]> {
    return this.apiService.getDailyLogs().pipe(
      tap(logs => {
        // Process logs (calculations, sorting, etc.)
        const processedLogs = this.processLogs(logs);
        // Update state
        this.dailyLogsSubject.next(processedLogs);
      }),
      catchError(error => {
        this.handleError('Failed to load daily logs');
        return of([]);
      })
    );
  }

  /**
   * Add a new daily log entry
   * @param log The log to add
   * @returns Observable of the added log
   */
  addDailyLog(log: Partial<DailyLog>): Observable<DailyLog> {
    return this.apiService.addDailyLog(log).pipe(
      tap(newLog => {
        // Update state by adding new log to cache
        const currentLogs = this.dailyLogsSubject.getValue();
        const updatedLogs = [...currentLogs, newLog];
        const processedLogs = this.processLogs(updatedLogs);
        this.dailyLogsSubject.next(processedLogs);
      }),
      catchError(error => {
        this.handleError('Failed to add daily log');
        throw error;
      })
    );
  }

  /**
   * Update an existing daily log
   * @param log The log to update
   * @returns Observable of the updated log
   */
  updateDailyLog(log: DailyLog): Observable<DailyLog> {
    return this.apiService.updateDailyLog(log).pipe(
      tap(updatedLog => {
        // Update state by replacing old log with updated log
        const currentLogs = this.dailyLogsSubject.getValue();
        const updatedLogs = currentLogs.map(
          existingLog => existingLog.id === updatedLog.id ? updatedLog : existingLog
        );
        const processedLogs = this.processLogs(updatedLogs);
        this.dailyLogsSubject.next(processedLogs);
      }),
      catchError(error => {
        this.handleError('Failed to update daily log');
        throw error;
      })
    );
  }

  /**
   * Delete a daily log
   * @param id ID of the log to delete
   * @returns Observable with success status
   */
  deleteDailyLog(id: number): Observable<void> {
    return this.apiService.deleteDailyLog(id).pipe(
      tap(_ => {
        // Update state by removing deleted log
        const currentLogs = this.dailyLogsSubject.getValue();
        const updatedLogs = currentLogs.filter(log => log.id !== id);
        const processedLogs = this.processLogs(updatedLogs);
        this.dailyLogsSubject.next(processedLogs);
      }),
      catchError(error => {
        this.handleError('Failed to delete daily log');
        throw error;
      })
    );
  }

  /**
   * Delete all daily logs
   * @returns Observable with success status
   */
  deleteAllDailyLogs(): Observable<void> {
    return this.apiService.deleteAllDailyLogs().pipe(
      tap(_ => {
        // Clear all logs from state
        this.dailyLogsSubject.next([]);
      }),
      catchError(error => {
        this.handleError('Failed to delete all daily logs');
        throw error;
      })
    );
  }

  // ========== GOAL METHODS ==========

  /**
   * Get goal settings from cache or API
   * @returns Observable of GoalSettings
   */
  getGoalSettings(): Observable<GoalSettings> {
    // If we already have goal settings in our cache, return those immediately
    const cachedSettings = this.goalSettingsSubject.getValue();
    if (cachedSettings) {
      return of(cachedSettings);
    }
    
    // Otherwise fetch from API
    return this.fetchGoalSettings();
  }

  /**
   * Fetch fresh goal settings from API
   * @returns Observable of GoalSettings
   */  fetchGoalSettings(): Observable<GoalSettings> {
    return this.apiService.getGoalSettings().pipe(
      tap(settings => {
        // Update state
        this.goalSettingsSubject.next(settings);
        
        // Refresh logs to update calculations based on new goal
        this.fetchDailyLogs();
      }),
      catchError(error => {
        this.handleError('Failed to load goal settings');
        const fallbackSettings: GoalSettings = {
          totalCalorieGoal: 3500,
          timeWindowDays: 7,
          startDate: new Date()
        };
        // Update state with fallback settings
        this.goalSettingsSubject.next(fallbackSettings);
        return of(fallbackSettings);
      })
    );
  }

  /**
   * Update goal settings
   * @param settings New goal settings
   * @returns Observable of updated GoalSettings
   */
  updateGoalSettings(settings: GoalSettings): Observable<GoalSettings> {
    return this.apiService.updateGoalSettings(settings).pipe(
      tap(updatedSettings => {
        // Update state
        this.goalSettingsSubject.next(updatedSettings);
        
        // Refresh logs to update calculations based on new goal
        this.fetchDailyLogs();
      }),
      catchError(error => {
        this.handleError('Failed to update goal settings');
        throw error;
      })
    );
  }

  /**
   * Undo the last goal change
   * @returns Observable with success status
   */
  undoGoalChange(): Observable<void> {
    const currentSettings = this.goalSettingsSubject.getValue();
    
    if (!currentSettings || !currentSettings.goalId) {
      this.handleError('No goal settings to undo');
      return of(undefined);
    }
    
    return this.apiService.undoGoalChange(currentSettings.goalId).pipe(
      tap(_ => {
        // Refresh all data after undo
        this.refreshData();
      }),
      catchError(error => {
        this.handleError('Failed to undo goal change');
        throw error;
      })
    );
  }

  /**
   * Calculate the daily target calories based on the goal settings
   * @returns Daily target calories or 0 if no goal
   */
  calculateDailyTargetCalories(): number {
    const settings = this.goalSettingsSubject.getValue();
    if (!settings) {
      return 0;
    }
    
    return Math.round(Math.abs(settings.totalCalorieGoal) / settings.timeWindowDays);
  }

  // ========== HELPER METHODS ==========

  /**
   * Process raw logs from API to add calculated fields
   * @param logs Raw logs to process
   * @returns Processed logs with calculated fields
   */
  private processLogs(logs: DailyLog[]): DailyLog[] {
    if (!logs.length) {
      return [];
    }
    
    // Sort logs by date (oldest first)
    const sortedLogs = [...logs].sort((a, b) => 
      new Date(a.date).getTime() - new Date(b.date).getTime()
    );
    
    // Get goal settings for calculations
    const settings = this.goalSettingsSubject.getValue();
    const dailyTarget = settings ? 
      Math.round(Math.abs(settings.totalCalorieGoal) / settings.timeWindowDays) : 0;
    
    // Add calculated fields to each log
    return sortedLogs.map((log, index) => {
      // Calculate status based on goal settings
      const isOnTrack = this.calculateIsOnTrack(log, settings);
      
      // Copy log and add calculated fields
      return {
        ...log,
        isOnTrack,
        statusClass: isOnTrack ? 'on-track' : 'off-track'
      };
    });
  }

  /**
   * Determine if a daily log is on track to meet the goal
   * @param log The daily log to evaluate
   * @param settings The goal settings to compare against
   * @returns True if on track, false otherwise
   */
  private calculateIsOnTrack(log: DailyLog, settings: GoalSettings | null): boolean {
    if (!settings) {
      return false;
    }
    
    const dailyTarget = Math.round(Math.abs(settings.totalCalorieGoal) / settings.timeWindowDays);
    
    if (settings.totalCalorieGoal > 0) {
      // For deficit goals (weight loss) - need to burn more than consume
      return log.dailyDifference >= dailyTarget;
    } else {
      // For surplus goals (weight gain) - need to consume more than burn
      return log.dailyDifference <= -dailyTarget;
    }
  }

  /**
   * Handle errors from API calls
   * @param defaultMessage Default error message to show
   */
  private handleError(defaultMessage: string): void {
    // Get specific error from API service if available
    const apiError = this.apiService.getLastError();
    
    // Update error message state
    this.errorMessageSubject.next(apiError || defaultMessage);
    
    // Log error to console
    console.error(apiError || defaultMessage);
  }

  /**
   * Clear the current error message
   */
  clearError(): void {
    this.errorMessageSubject.next(null);
  }

  /**
   * Validate daily log input data
   * @param input The input data to validate
   * @returns Validation result with isValid flag and error message
   */
  validateDailyLogInput(input: { caloriesBurned: number; caloriesConsumed: number }): { isValid: boolean; errorMessage?: string } {
    // Check for valid numbers
    if (isNaN(input.caloriesBurned) || isNaN(input.caloriesConsumed)) {
      return { isValid: false, errorMessage: 'Please enter valid numbers for calories' };
    }

    // Check for negative values
    if (input.caloriesBurned < 0 || input.caloriesConsumed < 0) {
      return { isValid: false, errorMessage: 'Calorie values cannot be negative' };
    }

    // Check for reasonable upper limits (e.g., 50,000 calories per day is unrealistic)
    if (input.caloriesBurned > 50000 || input.caloriesConsumed > 50000) {
      return { isValid: false, errorMessage: 'Calorie values seem unrealistically high (max 50,000)' };
    }

    return { isValid: true };
  }
}
