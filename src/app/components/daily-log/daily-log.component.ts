import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule, ValidatorFn, AbstractControl } from '@angular/forms';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { CalorieTrackingService } from '../../services/calorie-tracking.service';
import { DailyLog, GoalSettings } from '../../models/calorie-data.model';

/**
 * DailyLogComponent - Allows users to add daily calorie tracking entries
 * 
 * This component provides:
 * 1. Form to add new daily log entries (date, calories burned, calories consumed)
 * 2. Date validation based on the current goal window
 * 3. Success/error feedback for submission attempts
 */
@Component({
  selector: 'app-daily-log',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './daily-log.component.html',
  styleUrls: ['./daily-log.component.scss']
})
export class DailyLogComponent implements OnInit, OnDestroy {
  // Form for adding daily logs
  logForm: FormGroup;
  
  // Reference date for validation
  today = new Date();
  
  // Status messages
  successMessage: string = '';
  errorMessage: string = '';
  showSuccessMessage: boolean = false;
  showErrorMessage: boolean = false;
  
  // Application data
  dailyLogs: DailyLog[] = [];
  goalSettings: GoalSettings | null = null;
  
  // UI state
  allowFutureDates: boolean = true; // Set to false if future dates should be blocked
  loading: boolean = false; // For loading indicator

  // For cleanup of subscriptions
  private destroy$ = new Subject<void>();

  constructor(
    private fb: FormBuilder,
    private calorieService: CalorieTrackingService
  ) {
    // Initialize form with basic validators
    this.logForm = this.fb.group({
      date: [this.formatDate(this.today), [Validators.required]],
      caloriesBurned: ['', [
        Validators.required, 
        Validators.min(0), 
        Validators.pattern(/^\d+$/) // Only positive integers
      ]],
      caloriesConsumed: ['', [
        Validators.required, 
        Validators.min(0), 
        Validators.pattern(/^\d+$/) // Only positive integers
      ]]
    });
  }  ngOnInit(): void {
    // Subscribe to daily logs for duplicate date validation
    this.calorieService.dailyLogs$
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (logs) => {
          this.dailyLogs = Array.isArray(logs) ? logs : [];
        },
        error: (error) => {
          console.error('Error loading daily logs:', error);
          this.dailyLogs = []; // Ensure it's always an array
        }
      });

    // Load goal settings for date window validation
    this.calorieService.getGoalSettings().subscribe(settings => {
      this.goalSettings = settings;
      
      // Update validators to include custom date validators
      this.logForm.get('date')?.setValidators([
        Validators.required,
        this.dateNotInPastValidator(),
        this.dateNotInFutureValidator(),
        this.dateWithinGoalWindowValidator()
      ]);
      
      // Apply the updated validators
      this.logForm.get('date')?.updateValueAndValidity();
    });
  }

  ngOnDestroy(): void {
    // Clean up subscriptions
    this.destroy$.next();
    this.destroy$.complete();
  }

  /**
   * Handle form submission
   */
  onSubmit(): void {
    if (this.logForm.valid) {
      const formValue = this.logForm.value;
      const selectedDate = new Date(formValue.date);
      
      // Check for duplicate date before submitting
      if (this.isDuplicateDate(selectedDate)) {
        this.errorMessage = `An entry for ${this.formatDisplayDate(selectedDate)} already exists`;
        this.showErrorMessage = true;
        this.showSuccessMessage = false;
        
        // Hide message after 3 seconds
        setTimeout(() => {
          this.showErrorMessage = false;
        }, 3000);
        return;
      }
        // Get and validate the input values
      const caloriesBurned = parseInt(formValue.caloriesBurned, 10);
      const caloriesConsumed = parseInt(formValue.caloriesConsumed, 10);
      
      console.log('Form values:', formValue);
      console.log('Parsed values - caloriesBurned:', caloriesBurned, 'caloriesConsumed:', caloriesConsumed);
      
      // Additional validation using service method
      const validation = this.calorieService.validateDailyLogInput({
        caloriesBurned,
        caloriesConsumed
      });
      
      if (!validation.isValid) {
        this.errorMessage = validation.errorMessage || 'Invalid input values';
        this.showErrorMessage = true;
        return;
      }
        // Show loading indicator
      this.loading = true;
      
      // Create the new log entry
      const newLog: Partial<DailyLog> = {
        date: selectedDate,
        caloriesBurned,
        caloriesConsumed
      };
      
      console.log('DailyLogComponent - Creating new log:', newLog);
        // Try to add the log
      this.calorieService.addDailyLog(newLog).subscribe({
        next: (addedLog) => {
          // Hide loading indicator
          this.loading = false;
          
          // Show success message (no need to manually update dailyLogs, service handles it)
          this.successMessage = `Successfully added entry for ${this.formatDisplayDate(selectedDate)}`;
          this.showSuccessMessage = true;
          this.showErrorMessage = false;
          
          // Hide message after 3 seconds
          setTimeout(() => {
            this.showSuccessMessage = false;
          }, 3000);
          
          // Reset form after successful submission
          this.resetForm();
        },
        error: (error) => {
          // Hide loading indicator
          this.loading = false;
          
          console.error('Error adding daily log:', error);
          
          // Show error message
          this.errorMessage = `Failed to add entry. Please try again.`;
          this.showErrorMessage = true;
          this.showSuccessMessage = false;
          
          // Hide message after 3 seconds
          setTimeout(() => {
            this.showErrorMessage = false;
          }, 3000);
        }
      });
    }
  }

  /**
   * Reset form to initial state
   */
  resetForm(): void {
    this.logForm.patchValue({
      date: this.formatDate(this.today),
      caloriesBurned: '',
      caloriesConsumed: ''
    });
    
    // Reset form state
    this.logForm.markAsPristine();
    this.logForm.markAsUntouched();
  }

  /**
   * Prevents direct typing in date fields while still allowing picker use
   * @param event Keyboard event
   */
  preventTyping(event: KeyboardEvent): void {
    // Allow: Delete, Backspace, Tab, Escape, Enter, navigation keys
    const allowedKeys = [
      'Delete', 'Backspace', 'Tab', 'Escape', 'Enter', 
      'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown',
      'Home', 'End'
    ];
    
    if (allowedKeys.includes(event.key)) {
      return;
    }
    
    // Allow Ctrl+A, Ctrl+C, Ctrl+V, Ctrl+X
    if ((event.ctrlKey || event.metaKey) && 
        ['a', 'c', 'v', 'x'].includes(event.key.toLowerCase())) {
      return;
    }
    
    // Prevent all other direct input
    event.preventDefault();
  }

  // ========== VALIDATORS ==========
  /**
   * Check if a date already exists in the logs
   * @param date Date to check for duplicates
   * @returns true if date already exists
   */
  isDuplicateDate(date: Date): boolean {
    // Safety check: ensure dailyLogs is an array
    if (!Array.isArray(this.dailyLogs)) {
      console.warn('dailyLogs is not an array, initializing as empty array');
      this.dailyLogs = [];
      return false;
    }
    
    const dateString = this.formatDate(date);
    return this.dailyLogs.some(log => this.formatDate(log.date) === dateString);
  }

  /**
   * Custom validator to ensure the date is not in the past
   */
  dateNotInPastValidator(): ValidatorFn {
    return (control: AbstractControl): {[key: string]: any} | null => {
      if (!control.value) {
        return null; // Let the required validator handle empty values
      }
      
      const selectedDate = new Date(control.value);
      
      // Set both dates to midnight for comparison
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      selectedDate.setHours(0, 0, 0, 0);
      
      return selectedDate < today ? { 'dateInPast': true } : null;
    };
  }

  /**
   * Custom validator to ensure the date is not in the future (if configured)
   */
  dateNotInFutureValidator(): ValidatorFn {
    return (control: AbstractControl): {[key: string]: any} | null => {
      // Skip validation if future dates are allowed or no value
      if (!control.value || this.allowFutureDates) {
        return null;
      }
      
      const selectedDate = new Date(control.value);
      
      // Set both dates to midnight for comparison
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      selectedDate.setHours(0, 0, 0, 0);
      
      return selectedDate > today ? { 'dateInFuture': true } : null;
    };
  }

  /**
   * Custom validator to ensure date is within goal window
   */
  dateWithinGoalWindowValidator(): ValidatorFn {
    return (control: AbstractControl): {[key: string]: any} | null => {
      // Skip validation if no value or no goal settings
      if (!control.value || !this.goalSettings) {
        return null;
      }
      
      const selectedDate = new Date(control.value);
      selectedDate.setHours(0, 0, 0, 0);
      
      // Calculate start and end dates of the goal window
      const startDate = new Date(this.goalSettings.startDate);
      startDate.setHours(0, 0, 0, 0);
      
      // Calculate the end date (start date + timeWindowDays - 1)
      const endDate = new Date(this.goalSettings.startDate);
      endDate.setDate(endDate.getDate() + this.goalSettings.timeWindowDays - 1);
      endDate.setHours(23, 59, 59, 999); // End of the day
      
      // Check if date is before goal start
      if (selectedDate < startDate) {
        return { 'dateBeforeGoalStart': true };
      }
      
      // Check if date is after goal end
      if (selectedDate > endDate) {
        return { 'dateAfterGoalEnd': true };
      }
      
      return null;
    };
  }

  // ========== UTILITY METHODS ==========

  /**
   * Format a date for HTML date input (YYYY-MM-DD)
   */
  formatDate(date: Date): string {
    if (!date) return '';
    
    const d = new Date(date);
    const year = d.getFullYear();
    const month = ('0' + (d.getMonth() + 1)).slice(-2);
    const day = ('0' + d.getDate()).slice(-2);
    return `${year}-${month}-${day}`;
  }
  
  /**
   * Format a date for display (DD.MM.YYYY)
   */
  formatDisplayDate(date: Date): string {
    if (!date) return '';
    
    const d = new Date(date);
    const day = ('0' + d.getDate()).slice(-2);
    const month = ('0' + (d.getMonth() + 1)).slice(-2);
    const year = d.getFullYear();
    return `${day}.${month}.${year}`;
  }
}
