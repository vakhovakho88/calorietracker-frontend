import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError, of } from 'rxjs';
import { catchError, tap, map } from 'rxjs/operators';
import { DailyLog, GoalSettings } from '../models/calorie-data.model';

/**
 * ApiService - Handles all HTTP communication with the backend
 * 
 * This service provides methods for:
 * 1. Getting, creating, updating, and deleting daily logs
 * 2. Getting and updating goal settings
 * 3. Error handling for API requests
 */
@Injectable({
  providedIn: 'root'
})
export class ApiService {
  // Base URL for all API endpoints
  private apiUrl = 'http://localhost:5052/api';
  
  // Track the last error message for the UI
  private lastErrorMessage: string | null = null;

  constructor(private http: HttpClient) {}

  // ========== DAILY LOG API METHODS ==========
  /**
   * Get all daily logs
   * @returns Observable of DailyLog array
   */  
  getDailyLogs(): Observable<DailyLog[]> {
    return this.http.get<{items: DailyLog[], totalCount: number, pageNumber: number, pageSize: number, totalPages: number, hasPrevious: boolean, hasNext: boolean}>(`${this.apiUrl}/v1/dailylogs`)
      .pipe(
        map(response => response.items), // Extract the items array from paginated response
        tap(logs => console.log(`Fetched ${logs.length} daily logs`)),
        catchError(this.handleError<DailyLog[]>('getDailyLogs', []))
      );
  }

  /**
   * Get a single daily log by ID
   * @param id The ID of the daily log to fetch
   * @returns Observable of DailyLog
   */  getDailyLog(id: number): Observable<DailyLog> {
    return this.http.get<DailyLog>(`${this.apiUrl}/v1/dailylogs/${id}`)
      .pipe(
        tap(_ => console.log(`Fetched daily log id=${id}`)),
        catchError(this.handleError<DailyLog>(`getDailyLog id=${id}`))
      );
  }

  /**
   * Add a new daily log
   * @param log The daily log data to add
   * @returns Observable of the created DailyLog
   */  addDailyLog(log: Partial<DailyLog>): Observable<DailyLog> {
    return this.http.post<DailyLog>(`${this.apiUrl}/v1/dailylogs`, log)
      .pipe(
        tap((newLog: DailyLog) => console.log(`Added daily log w/ id=${newLog.id}`)),
        catchError(this.handleError<DailyLog>('addDailyLog'))
      );
  }

  /**
   * Update an existing daily log
   * @param log The daily log data to update
   * @returns Observable of the updated DailyLog
   */  updateDailyLog(log: DailyLog): Observable<DailyLog> {
    return this.http.put<DailyLog>(`${this.apiUrl}/v1/dailylogs/${log.id}`, log)
      .pipe(
        tap(_ => console.log(`Updated daily log id=${log.id}`)),
        catchError(this.handleError<DailyLog>('updateDailyLog'))
      );
  }

  /**
   * Delete a daily log
   * @param id The ID of the daily log to delete
   * @returns Observable with success status
   */  deleteDailyLog(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/v1/dailylogs/${id}`)
      .pipe(
        tap(_ => console.log(`Deleted daily log id=${id}`)),
        catchError(this.handleError<void>('deleteDailyLog'))
      );
  }

  /**
   * Delete all daily logs
   * @returns Observable with success status
   */  deleteAllDailyLogs(): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/v1/dailylogs/all`)
      .pipe(
        tap(_ => console.log('Deleted all daily logs')),
        catchError(this.handleError<void>('deleteAllDailyLogs'))
      );
  }
  // ========== GOAL SETTINGS API METHODS ==========
  /**
   * Get the current goal settings
   * @returns Observable of GoalSettings
   */
  getGoalSettings(): Observable<GoalSettings> {
    return this.http.get<{goalId: string, targetKcals: number, timeWindowDays: number, startDate: string}>(`${this.apiUrl}/v1/goals/active`)
      .pipe(
        map(response => ({
          goalId: response.goalId,
          totalCalorieGoal: response.targetKcals,
          timeWindowDays: response.timeWindowDays,
          startDate: new Date(response.startDate)
        })),
        tap(_ => console.log('Fetched goal settings')),
        catchError(this.handleError<GoalSettings>('getGoalSettings'))
      );
  }

  /**
   * Update goal settings
   * @param settings The new goal settings
   * @returns Observable of the updated GoalSettings
   */
  updateGoalSettings(settings: GoalSettings): Observable<GoalSettings> {
    // Convert frontend model to backend DTO format
    const goalData = {
      targetKcals: settings.totalCalorieGoal,
      timeWindowDays: settings.timeWindowDays,
      startDate: settings.startDate.toISOString().split('T')[0] // Convert to YYYY-MM-DD format
    };    if (settings.goalId) {
      // Update existing goal
      return this.http.put<{goalId: string, targetKcals: number, timeWindowDays: number, startDate: string}>(`${this.apiUrl}/v1/goals/${settings.goalId}`, goalData)
        .pipe(
          map(response => ({
            goalId: response.goalId,
            totalCalorieGoal: response.targetKcals,
            timeWindowDays: response.timeWindowDays,
            startDate: new Date(response.startDate)
          })),
          tap(newSettings => console.log(`Updated goal settings w/ id=${newSettings.goalId}`)),
          catchError(this.handleError<GoalSettings>('updateGoalSettings'))
        );
    } else {
      // Create new goal
      return this.http.post<{goalId: string, targetKcals: number, timeWindowDays: number, startDate: string}>(`${this.apiUrl}/v1/goals`, goalData)
        .pipe(
          map(response => ({
            goalId: response.goalId,
            totalCalorieGoal: response.targetKcals,
            timeWindowDays: response.timeWindowDays,
            startDate: new Date(response.startDate)
          })),
          tap(newSettings => console.log(`Created goal settings w/ id=${newSettings.goalId}`)),
          catchError(this.handleError<GoalSettings>('updateGoalSettings'))
        );
    }
  }

  /**
   * Undo the last goal change
   * @param goalId The ID of the goal to undo
   * @returns Observable with success status
   */  undoGoalChange(goalId: string): Observable<void> {
    return this.http.post<void>(`${this.apiUrl}/v1/goals/${goalId}/undo`, {})
      .pipe(
        tap(_ => console.log(`Undid goal change id=${goalId}`)),
        catchError(this.handleError<void>('undoGoalChange'))
      );
  }

  // ========== ERROR HANDLING ==========

  /**
   * Get the last error message
   * @returns The last error message or null
   */
  getLastError(): string | null {
    return this.lastErrorMessage;
  }
  /**
   * Handle HTTP operation errors
   * @param operation Name of the operation that failed
   * @param result Optional value to return as the observable result
   */
  private handleError<T>(operation = 'operation', result?: T) {
    return (error: HttpErrorResponse): Observable<T> => {
      // Log error to console
      console.error(`${operation} failed: ${error.message}`);
      
      // Prepare user-friendly error message
      if (error.error instanceof ErrorEvent) {
        // Client-side error
        this.lastErrorMessage = `Error: ${error.error.message}`;
      } else {
        // Server-side error
        this.lastErrorMessage = `Server returned code ${error.status}: ${error.error?.message || error.statusText}`;
      }
      
      // Return the fallback result to keep app running
      return of(result as T);
    };
  }
}