import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { DailyLog, GoalSettings } from '../../models/calorie-data.model';
import { CalorieTrackingService } from '../../services/calorie-tracking.service';

/**
 * CalorieTableComponent - Displays daily calorie logs in a table format
 * 
 * This component provides:
 * 1. Table view of all daily calorie entries
 * 2. Status indicators for tracking progress
 * 3. Summary statistics and rolling averages
 * 4. Visual indicators for on-track and off-track status
 */
@Component({
  selector: 'app-calorie-table',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './calorie-table.component.html',
  styleUrls: ['./calorie-table.component.scss']
})
export class CalorieTableComponent implements OnInit, OnDestroy {
  // Data properties
  dailyLogs: DailyLog[] = [];
  goalSettings: GoalSettings | null = null;
  
  // Sorting properties
  isDateSortAscending: boolean = true;
  
  // Delete confirmation properties
  showDeleteConfirm: boolean = false;
  showDeleteAllConfirm: boolean = false;
  logToDelete: DailyLog | null = null;
  
  // Edit form properties
  showEditForm: boolean = false;
  showEditError: boolean = false;
  editErrorMessage: string = '';
  editForm: FormGroup;
  currentEditLog: DailyLog | null = null;
  
  // Success message
  showSuccessMessage: boolean = false;
  
  // Today's date for form validation
  today: Date = new Date();
  
  // Table display settings
  displayedColumns: string[] = [
    'date', 
    'dayNumber', 
    'caloriesBurned', 
    'caloriesConsumed', 
    'dailyDifference', 
    'runningSum',
    'remainingToGoal',
    'status'
  ];
  
  // Optional columns that can be toggled
  showAvgColumns: boolean = false;
  
  // For cleanup of subscriptions
  private destroy$ = new Subject<void>();

  constructor(private calorieService: CalorieTrackingService, private fb: FormBuilder) { 
    // Initialize the edit form
    this.editForm = this.fb.group({
      date: ['', Validators.required],
      caloriesBurned: ['', [Validators.required, Validators.min(0)]],
      caloriesConsumed: ['', [Validators.required, Validators.min(0)]],
      dailyDifference: ['', Validators.required],
      runningSum: ['', Validators.required],
      remainingToGoal: ['', Validators.required],
      status: ['']
    });
  }

  ngOnInit(): void {
    // Load goal settings
    this.calorieService.getGoalSettings()
      .pipe(takeUntil(this.destroy$))
      .subscribe(settings => {
        this.goalSettings = settings;
      });
    
    // Load daily logs
    this.calorieService.getDailyLogs()
      .pipe(takeUntil(this.destroy$))
      .subscribe(logs => {
        this.dailyLogs = logs;
      });
  }
  ngOnDestroy(): void {
    // Clean up subscriptions
    this.destroy$.next();
    this.destroy$.complete();
  }

  /**
   * Load or reload data from the service
   */
  loadData(): void {
    // Load goal settings
    this.calorieService.getGoalSettings()
      .pipe(takeUntil(this.destroy$))
      .subscribe(settings => {
        this.goalSettings = settings;
      });
    
    // Load daily logs
    this.calorieService.getDailyLogs()
      .pipe(takeUntil(this.destroy$))
      .subscribe(logs => {
        this.dailyLogs = logs;
      });
  }

  /**
   * Toggle display of average columns
   */
  toggleAverageColumns(): void {
    this.showAvgColumns = !this.showAvgColumns;
    
    // Update the displayed columns based on the toggle state
    if (this.showAvgColumns) {
      // Add average columns
      this.displayedColumns = [
        'date', 
        'dayNumber', 
        'caloriesBurned', 
        'caloriesConsumed', 
        'dailyDifference', 
        'runningSum',
        'remainingToGoal',
        'rollingAvg4Day',
        'rollingAvg7Day',
        'overallAverage',
        'status'
      ];
    } else {
      // Remove average columns
      this.displayedColumns = [
        'date', 
        'dayNumber', 
        'caloriesBurned', 
        'caloriesConsumed', 
        'dailyDifference', 
        'runningSum',
        'remainingToGoal',
        'status'
      ];
    }
  }

  /**
   * Determine the CSS class for status display
   * @param log Daily log entry
   * @returns CSS class name
   */
  getStatusClass(log: DailyLog): string {
    return log.statusClass || (log.isOnTrack ? 'on-track' : 'off-track');
  }

  /**
   * Determine if a value is positive
   * @param value Number to check
   * @returns true if value is positive
   */
  isPositive(value: number | undefined): boolean {
    return value !== undefined && value > 0;
  }

  /**
   * Determine if a value is negative
   * @param value Number to check
   * @returns true if value is negative
   */
  isNegative(value: number | undefined): boolean {
    return value !== undefined && value < 0;
  }

  /**
   * Format a date as DD.MM.YYYY
   * @param date Date to format
   * @returns Formatted date string
   */
  formatDate(date: Date): string {
    if (!date) return '';
    
    const d = new Date(date);
    const day = ('0' + d.getDate()).slice(-2);
    const month = ('0' + (d.getMonth() + 1)).slice(-2);
    const year = d.getFullYear();
    return `${day}.${month}.${year}`;
  }

  /**
   * Calculate percentage of goal completed
   * @param log Daily log entry
   * @returns Percentage as number between 0-100
   */
  calculateGoalPercentage(log: DailyLog): number {
    if (!this.goalSettings || !log.runningSum) {
      return 0;
    }
    
    // Calculate based on whether it's a deficit or surplus goal
    if (this.goalSettings.totalCalorieGoal > 0) {
      // Deficit goal (positive target)
      return Math.min(100, Math.max(0, (log.runningSum / this.goalSettings.totalCalorieGoal) * 100));
    } else {
      // Surplus goal (negative target)
      return Math.min(100, Math.max(0, (log.runningSum / Math.abs(this.goalSettings.totalCalorieGoal)) * 100));
    }
  }

  /**
   * Get a human-readable status message
   * @param log Daily log entry
   * @returns Status message
   */
  getStatusMessage(log: DailyLog): string {
    if (!this.goalSettings) {
      return 'No goal set';
    }
    
    if (log.statusText) {
      return log.statusText;
    }
    
    const dailyTarget = Math.round(Math.abs(this.goalSettings.totalCalorieGoal) / this.goalSettings.timeWindowDays);
    
    if (this.goalSettings.totalCalorieGoal > 0) {
      // Deficit goal
      if (log.dailyDifference && log.dailyDifference >= dailyTarget) {
        return 'On Track';
      } else {
        return 'Off Track';
      }
    } else {
      // Surplus goal
      if (log.dailyDifference && log.dailyDifference <= dailyTarget) {
        return 'On Track';
      } else {
        return 'Off Track';
      }
    }
  }

  /**
   * Get total calorie deficit/surplus
   * @returns Total as string with sign
   */
  getTotalCalorieBalance(): string {
    if (this.dailyLogs.length === 0) {
      return '0';
    }
    
    // Get the latest running sum value
    const latestLog = this.dailyLogs.sort((a, b) => b.dayNumber - a.dayNumber)[0];
    const total = latestLog.runningSum || 0;
    
    return total > 0 ? `+${total}` : total.toString();
  }

  /**
   * Calculate days remaining in the goal period
   * @returns Number of days remaining
   */
  getDaysRemaining(): number {
    if (!this.goalSettings) {
      return 0;
    }
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const startDate = new Date(this.goalSettings.startDate);
    startDate.setHours(0, 0, 0, 0);
    
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + this.goalSettings.timeWindowDays - 1);
    
    // If today is after the end date, return 0
    if (today > endDate) {
      return 0;
    }
    
    // If today is before the start date, return the full period
    if (today < startDate) {
      return this.goalSettings.timeWindowDays;
    }
    
    // Calculate days between today and end date
    const diffTime = Math.abs(endDate.getTime() - today.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    return diffDays;
  }

  /**
   * Calculate the average daily difference for all logs
   * @returns Average daily difference
   */
  getAverageDailyDifference(): number {
    if (this.dailyLogs.length === 0) {
      return 0;
    }
    
    const sum = this.dailyLogs.reduce((acc, log) => acc + (log.dailyDifference || 0), 0);
    return Math.round(sum / this.dailyLogs.length);
  }

  /**
   * Get the overall progress message
   * @returns Progress message
   */
  getOverallProgressMessage(): string {
    if (!this.goalSettings || this.dailyLogs.length === 0) {
      return 'No data available';
    }
    
    const latestLog = this.dailyLogs.sort((a, b) => b.dayNumber - a.dayNumber)[0];
    const avgDiff = this.getAverageDailyDifference();
    const daysRemaining = this.getDaysRemaining();
    
    // Calculate daily target
    const dailyTarget = Math.round(Math.abs(this.goalSettings.totalCalorieGoal) / this.goalSettings.timeWindowDays);
    
    if (this.goalSettings.totalCalorieGoal > 0) {
      // Deficit goal
      if (avgDiff >= dailyTarget) {
        return `Great job! You're averaging ${avgDiff} calories above your daily target of ${dailyTarget}.`;
      } else if (latestLog.runningSum && latestLog.runningSum > 0) {
        return `You're making progress with a total deficit of ${latestLog.runningSum} calories, but your daily average of ${avgDiff} is below your target of ${dailyTarget}.`;
      } else {
        return `You're currently below your target. You need to average ${dailyTarget} calories deficit per day.`;
      }
    } else {
      // Surplus goal
      if (avgDiff <= dailyTarget) {
        return `Great job! You're averaging a surplus of ${Math.abs(avgDiff)} calories, meeting your daily target of ${dailyTarget}.`;
      } else {
        return `Your calorie surplus is higher than your target. Try to maintain closer to ${dailyTarget} calories surplus per day.`;
      }
    }
  }

  // ========== MISSING METHODS FOR TEMPLATE ==========

  /**
   * Get CSS class for table row
   * @param log Daily log entry
   * @returns CSS class name
   */
  getRowClass(log: DailyLog): string {
    return log.isOnTrack ? 'on-track-row' : 'off-track-row';
  }

  /**
   * Show edit form for a daily log
   * @param log Daily log to edit
   */
  showEdit(log: DailyLog): void {
    this.editForm.patchValue({
      date: this.formatDateForInput(new Date(log.date)),
      caloriesBurned: log.caloriesBurned,
      caloriesConsumed: log.caloriesConsumed
    });
    this.currentEditLog = log;
    this.showEditForm = true;
    this.showEditError = false;
  }

  /**
   * Show delete confirmation modal
   * @param log Daily log to delete
   */
  confirmDelete(log: DailyLog): void {
    this.logToDelete = log;
    this.showDeleteConfirm = true;
  }

  /**
   * Proceed with deleting the selected log
   */
  proceedWithDelete(): void {
    if (this.logToDelete) {
      this.calorieService.deleteDailyLog(this.logToDelete.id!).subscribe({
        next: () => {
          this.loadData();
          this.showSuccessMessage = true;
          setTimeout(() => this.showSuccessMessage = false, 3000);
        },
        error: (error) => {
          console.error('Error deleting log:', error);
        }
      });
    }
    this.cancelDelete();
  }

  /**
   * Cancel delete operation
   */
  cancelDelete(): void {
    this.logToDelete = null;
    this.showDeleteConfirm = false;
  }

  /**
   * Show delete all confirmation modal
   */
  confirmDeleteAll(): void {
    this.showDeleteAllConfirm = true;
  }

  /**
   * Proceed with deleting all logs
   */
  proceedWithDeleteAll(): void {
    this.calorieService.deleteAllDailyLogs().subscribe({
      next: () => {
        this.loadData();
        this.showSuccessMessage = true;
        setTimeout(() => this.showSuccessMessage = false, 3000);
      },
      error: (error) => {
        console.error('Error deleting all logs:', error);
      }
    });
    this.cancelDeleteAll();
  }

  /**
   * Cancel delete all operation
   */
  cancelDeleteAll(): void {
    this.showDeleteAllConfirm = false;
  }

  /**
   * Sort table by date
   */
  sortByDate(): void {
    this.isDateSortAscending = !this.isDateSortAscending;
    
    this.dailyLogs.sort((a, b) => {
      const dateA = new Date(a.date).getTime();
      const dateB = new Date(b.date).getTime();
      
      return this.isDateSortAscending ? dateA - dateB : dateB - dateA;
    });
  }

  /**
   * Save edited daily log
   */
  saveEdit(): void {
    if (this.editForm.valid && this.currentEditLog) {
      const formData = this.editForm.value;
      const updatedLog: DailyLog = {
        ...this.currentEditLog,
        date: new Date(formData.date),
        caloriesBurned: formData.caloriesBurned,
        caloriesConsumed: formData.caloriesConsumed
      };

      this.calorieService.updateDailyLog(updatedLog).subscribe({
        next: () => {
          this.loadData();
          this.cancelEdit();
          this.showSuccessMessage = true;
          setTimeout(() => this.showSuccessMessage = false, 3000);
        },
        error: (error) => {
          this.showEditError = true;
          this.editErrorMessage = 'Failed to update entry. Please try again.';
          console.error('Error updating log:', error);
        }
      });
    }
  }

  /**
   * Cancel edit operation
   */
  cancelEdit(): void {
    this.showEditForm = false;
    this.showEditError = false;
    this.editErrorMessage = '';
    this.currentEditLog = null;
    this.editForm.reset();
  }

  /**
   * Format date for HTML date input
   * @param date Date to format
   * @returns Date string in YYYY-MM-DD format
   */
  formatDateForInput(date: Date): string {
    const d = new Date(date);
    const year = d.getFullYear();
    const month = ('0' + (d.getMonth() + 1)).slice(-2);
    const day = ('0' + d.getDate()).slice(-2);
    return `${year}-${month}-${day}`;
  }

  // ==========  OVERALL STATUS METHODS FOR STATUS BOX ==========

  /**
   * Get overall status class for the status box
   * @returns CSS class name for overall progress
   */
  getOverallStatusClass(): string {
    if (!this.goalSettings || this.dailyLogs.length === 0) {
      return 'no-data';
    }
    
    const overall = this.calculateOverallPercentage();
    return overall >= 80 ? 'on-track' : 'off-track';
  }

  /**
   * Get overall status message for the status box
   * @returns Status message for overall progress
   */
  getOverallStatusMessage(): string {
    if (!this.goalSettings) {
      return 'No goal set';
    }
    
    if (this.dailyLogs.length === 0) {
      return 'No entries yet';
    }
    
    const percentage = this.calculateOverallPercentage();
    if (percentage >= 80) {
      return 'On Track';
    } else {
      return 'Keep going!';
    }
  }

  /**
   * Calculate overall goal percentage for the status box
   * @returns Percentage as number between 0-100
   */
  calculateOverallPercentage(): number {
    if (!this.goalSettings || this.dailyLogs.length === 0) {
      return 0;
    }
    
    // Calculate progress based on days logged vs time window
    const daysLogged = this.dailyLogs.length;
    const timeWindow = this.goalSettings.timeWindowDays || 1;
    
    return Math.min(100, (daysLogged / timeWindow) * 100);
  }
}
