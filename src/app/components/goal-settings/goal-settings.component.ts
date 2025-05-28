import { Component, OnInit, OnDestroy } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule, ValidatorFn, AbstractControl, ValidationErrors } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { CalorieTrackingService } from '../../services/calorie-tracking.service';
import { GoalSettings } from '../../models/calorie-data.model';
import { ApiService } from '../../services/api.service';
import { Subject, Subscription, timer } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

/**
 * GoalSettingsComponent - Allows users to set and manage their calorie goals
 * 
 * This component provides:
 * 1. Form to set total calorie goal (deficit or surplus)
 * 2. Options to specify time window in days or by end date
 * 3. Current goal summary display
 * 4. Undo functionality for goal changes
 */
@Component({
  selector: 'app-goal-settings',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './goal-settings.component.html',
  styleUrls: ['./goal-settings.component.scss']
})
export class GoalSettingsComponent implements OnInit, OnDestroy {
  // Form group for goal settings
  goalForm: FormGroup;
  
  // Current goal data
  currentGoal: GoalSettings = {
    totalCalorieGoal: 100000,
    timeWindowDays: 100,
    startDate: new Date()
  };
  
  // Make Math available to the template for calculations
  Math = Math;
  
  // Today's date for validation
  today = new Date();
  
  // UI state variables
  isLoading = false;
  showUndoBanner = false;
  undoTimeLeft = 10;
  previousGoal: GoalSettings | null = null;
  lastGoalId: string | undefined;
  
  // Toggle between days and end date input methods
  useEndDate = false;
  
  // For cleanup of subscriptions
  private destroy$ = new Subject<void>();
  private undoTimerSubscription?: Subscription;

  constructor(
    private fb: FormBuilder,
    private calorieService: CalorieTrackingService,
    private apiService: ApiService
  ) {
    // Initialize the form with validators
    this.goalForm = this.fb.group({
      // Total calorie goal (positive = deficit, negative = surplus)
      totalCalorieGoal: [
        '', 
        [
          Validators.required, 
          Validators.pattern(/^-?\d+$/),  // Allow positive or negative integers
          this.nonZeroValidator()         // Prevent zero values
        ]
      ],
      // Time window in days (1-3650)
      timeWindowDays: [
        '', 
        [
          Validators.required, 
          Validators.min(1),            // Minimum 1 day
          Validators.max(3650),         // Maximum ~10 years
          Validators.pattern(/^\d+$/)   // Only positive integers
        ]
      ],
      // Start date (today or future)
      startDate: [
        '', 
        [
          Validators.required, 
          this.dateNotInPastValidator()  // Prevent past dates
        ]
      ],
      // End date (for alternative input method)
      endDate: [
        '',
        [
          Validators.required,
          this.endDateValidator()       // Custom validator for end date
        ]
      ]
    });
  }

  ngOnInit(): void {
    // Load current goal settings when component initializes
    this.loadCurrentGoal();
  }

  ngOnDestroy(): void {
    // Clean up subscriptions when component is destroyed
    this.destroy$.next();
    this.destroy$.complete();
    
    if (this.undoTimerSubscription) {
      this.undoTimerSubscription.unsubscribe();
    }
  }
  /**
   * Load current goal settings from service
   */
  loadCurrentGoal(): void {
    this.isLoading = true;
    
    this.calorieService.fetchGoalSettings()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (settings) => {
          this.currentGoal = settings;
          this.lastGoalId = settings.goalId;
          
          // Check if the date from API is in the past, if so use today instead
          let startDate = settings.startDate;
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          const settingsDate = new Date(startDate);
          settingsDate.setHours(0, 0, 0, 0);
          
          if (settingsDate < today) {
            startDate = today;
          }
          
          // Calculate the end date based on the start date and time window
          const endDate = this.calculateEndDate(startDate, settings.timeWindowDays);
          
          // Update form with current values
          this.goalForm.patchValue({
            totalCalorieGoal: settings.totalCalorieGoal,
            timeWindowDays: settings.timeWindowDays,
            startDate: this.formatDate(startDate),
            endDate: this.formatDate(endDate)
          });
          
          this.isLoading = false;
        },
        error: (err) => {
          console.error('Error loading goal settings:', err);
          this.isLoading = false;
        }
      });
  }

  /**
   * Handle form submission
   */
  onSubmit(): void {
    // Exit if form is invalid
    if (this.goalForm.invalid) {
      // Mark all fields as touched to show validation errors
      Object.keys(this.goalForm.controls).forEach(key => {
        const control = this.goalForm.get(key);
        control?.markAsTouched();
      });
      return;
    }
    
    // Save the previous goal for potential undo operation
    this.previousGoal = { ...this.currentGoal };
    
    const formValue = this.goalForm.value;
    
    // Double-check that date is not in the past before submitting
    const selectedDate = new Date(formValue.startDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    selectedDate.setHours(0, 0, 0, 0);
    
    if (selectedDate < today) {
      // Mark the field as touched and invalid
      this.goalForm.get('startDate')?.setErrors({ 'dateInPast': true });
      this.goalForm.get('startDate')?.markAsTouched();
      return;
    }
    
    // Calculate timeWindowDays based on input method (days or end date)
    let timeWindowDays = parseInt(formValue.timeWindowDays, 10);
    
    if (this.useEndDate) {
      // Calculate days from start date to end date
      const startDateObj = new Date(formValue.startDate);
      const endDateObj = new Date(formValue.endDate);
      
      startDateObj.setHours(0, 0, 0, 0);
      endDateObj.setHours(0, 0, 0, 0);
      
      // Calculate the difference in days (+1 because the start date counts as day 1)
      const diffTime = Math.abs(endDateObj.getTime() - startDateObj.getTime());
      timeWindowDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
    }
    
    // Prepare the updated settings
    const updatedSettings: GoalSettings = {
      totalCalorieGoal: parseInt(formValue.totalCalorieGoal, 10),
      timeWindowDays: timeWindowDays,
      startDate: selectedDate,
      goalId: this.lastGoalId // Pass the existing ID for update if available
    };
    
    this.isLoading = true;
    
    // Submit the updated settings to the service
    this.calorieService.updateGoalSettings(updatedSettings)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          // Update successful
          this.isLoading = false;
          this.startUndoTimer();
          
          // If we have a goalId from the response, update it
          if (response && response.goalId) {
            this.lastGoalId = response.goalId;
          }
          
          // Update current goal for UI
          this.currentGoal = updatedSettings;
        },
        error: (err) => {
          this.isLoading = false;
          
          if (err.status === 400) {
            // Handle validation errors from server
            const serverErrors = err.error?.errors || {};
            
            // Map server errors to form controls
            if (serverErrors.TargetKcals) {
              this.goalForm.get('totalCalorieGoal')?.setErrors({ serverError: serverErrors.TargetKcals[0] });
            }
            
            if (serverErrors.TimeWindowDays) {
              this.goalForm.get('timeWindowDays')?.setErrors({ serverError: serverErrors.TimeWindowDays[0] });
            }
            
            if (serverErrors.StartDate) {
              this.goalForm.get('startDate')?.setErrors({ serverError: serverErrors.StartDate[0] });
            }
          }
          
          console.error('Error updating goal:', err);
        }
      });
  }

  /**
   * Toggle between time window (days) and end date input methods
   */
  toggleTimeWindowMethod(useEndDate: boolean): void {
    this.useEndDate = useEndDate;
    
    if (useEndDate) {
      // Switching to end date mode - calculate end date from current timeWindowDays
      const startDateStr = this.goalForm.get('startDate')?.value;
      const timeWindowDays = this.goalForm.get('timeWindowDays')?.value || this.currentGoal.timeWindowDays;
      
      if (startDateStr) {
        const startDate = new Date(startDateStr);
        const endDate = this.calculateEndDate(startDate, timeWindowDays);
        this.goalForm.get('endDate')?.setValue(this.formatDate(endDate));
      }
    } else {
      // Switching to days mode - calculate days from current end date if set
      const startDateStr = this.goalForm.get('startDate')?.value;
      const endDateStr = this.goalForm.get('endDate')?.value;
      
      if (startDateStr && endDateStr) {
        const startDate = new Date(startDateStr);
        const endDate = new Date(endDateStr);
        
        startDate.setHours(0, 0, 0, 0);
        endDate.setHours(0, 0, 0, 0);
        
        // Calculate the difference in days (+1 because the start date counts as day 1)
        const diffTime = Math.abs(endDate.getTime() - startDate.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
        
        // Update the timeWindowDays control
        this.goalForm.get('timeWindowDays')?.setValue(diffDays);
      }
    }
    
    // Validate the form
    this.goalForm.updateValueAndValidity();
  }

  /**
   * Handle start date changes
   * Update end date or revalidate timeWindowDays
   */
  onStartDateChange(): void {
    if (this.useEndDate) {
      // In end date mode, update the end date based on the new start date and current timeWindowDays
      const startDateStr = this.goalForm.get('startDate')?.value;
      const timeWindowDays = this.goalForm.get('timeWindowDays')?.value || this.currentGoal.timeWindowDays;
      
      if (startDateStr) {
        const startDate = new Date(startDateStr);
        const endDate = this.calculateEndDate(startDate, timeWindowDays);
        this.goalForm.get('endDate')?.setValue(this.formatDate(endDate));
      }
    }
    
    // Revalidate the form
    this.goalForm.updateValueAndValidity();
  }

  /**
   * Handle time window days changes
   * Update end date if in end date mode
   */
  onTimeWindowDaysChange(): void {
    if (this.useEndDate) {
      const startDateStr = this.goalForm.get('startDate')?.value;
      const timeWindowDays = this.goalForm.get('timeWindowDays')?.value;
      
      if (startDateStr && timeWindowDays) {
        const startDate = new Date(startDateStr);
        const endDate = this.calculateEndDate(startDate, timeWindowDays);
        this.goalForm.get('endDate')?.setValue(this.formatDate(endDate));
      }
    }
  }

  /**
   * Handle end date changes
   * Update timeWindowDays based on the new end date
   */
  onEndDateChange(): void {
    const startDateStr = this.goalForm.get('startDate')?.value;
    const endDateStr = this.goalForm.get('endDate')?.value;
    
    if (startDateStr && endDateStr) {
      const startDate = new Date(startDateStr);
      const endDate = new Date(endDateStr);
      
      startDate.setHours(0, 0, 0, 0);
      endDate.setHours(0, 0, 0, 0);
      
      // Calculate the difference in days (+1 because the start date counts as day 1)
      const diffTime = Math.abs(endDate.getTime() - startDate.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
      
      // Update the timeWindowDays control
      this.goalForm.get('timeWindowDays')?.setValue(diffDays);
    }
  }

  /**
   * Get the minimum allowed end date (one day after start date)
   */
  getMinEndDate(): string {
    const startDateStr = this.goalForm.get('startDate')?.value;
    if (!startDateStr) {
      return this.formatDate(this.today);
    }
    
    const startDate = new Date(startDateStr);
    const minEndDate = new Date(startDate);
    minEndDate.setDate(startDate.getDate() + 1); // Minimum 1 day after start date
    
    return this.formatDate(minEndDate);
  }

  /**
   * Undo the last goal change
   */
  undoLastChange(): void {
    if (!this.previousGoal) {
      return;
    }
    
    this.isLoading = true;
    
    // Call the undo API endpoint
    this.apiService.undoGoalChange(this.lastGoalId!)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          // Restore the previous goal
          this.currentGoal = this.previousGoal!;
          
          // Calculate the end date for the form
          const endDate = this.calculateEndDate(this.previousGoal!.startDate, this.previousGoal!.timeWindowDays);
          
          // Update form with previous values
          this.goalForm.patchValue({
            totalCalorieGoal: this.previousGoal!.totalCalorieGoal,
            timeWindowDays: this.previousGoal!.timeWindowDays,
            startDate: this.formatDate(this.previousGoal!.startDate),
            endDate: this.formatDate(endDate)
          });
          
          this.isLoading = false;
          this.showUndoBanner = false;
          
          if (this.undoTimerSubscription) {
            this.undoTimerSubscription.unsubscribe();
          }
        },
        error: (err) => {
          console.error('Error undoing goal change:', err);
          this.isLoading = false;
        }
      });
  }

  /**
   * Start the undo timer
   * Shows a banner with a countdown to undo the last change
   */
  startUndoTimer(): void {
    // Reset timer state
    this.showUndoBanner = true;
    this.undoTimeLeft = 10;
    
    // Clear any existing timer
    if (this.undoTimerSubscription) {
      this.undoTimerSubscription.unsubscribe();
    }
    
    // Start a new countdown timer
    this.undoTimerSubscription = timer(0, 1000)
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        this.undoTimeLeft--;
        
        if (this.undoTimeLeft <= 0) {
          this.showUndoBanner = false;
          this.undoTimerSubscription?.unsubscribe();
        }
      });
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

  // ========== UTILITY METHODS ==========

  /**
   * Custom validator to ensure value is not zero
   */
  nonZeroValidator(): ValidatorFn {
    return (control: AbstractControl): ValidationErrors | null => {
      if (!control.value) {
        return null; // Let required validator handle this
      }
      
      const value = parseInt(control.value, 10);
      return value === 0 ? { 'nonZero': true } : null;
    };
  }

  /**
   * Custom validator to ensure the date is not in the past
   */
  dateNotInPastValidator(): ValidatorFn {
    return (control: AbstractControl): ValidationErrors | null => {
      if (!control.value) {
        return null; // If no date is selected, let the required validator handle it
      }
      
      const selectedDate = new Date(control.value);
      // Set both dates to midnight for comparison, ignoring time
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      selectedDate.setHours(0, 0, 0, 0);
      
      return selectedDate < today ? { 'dateInPast': true } : null;
    };
  }

  /**
   * Custom validator for end date
   * Validates that end date is after start date and the total days don't exceed 3,650
   */
  endDateValidator(): ValidatorFn {
    return (control: AbstractControl): ValidationErrors | null => {
      if (!control.value) {
        return null; // Let required validator handle this
      }
      
      const endDate = new Date(control.value);
      endDate.setHours(0, 0, 0, 0);
      
      const form = control.parent;
      if (!form) {
        return null; // Cannot validate without parent form
      }
      
      const startDateStr = form.get('startDate')?.value;
      if (!startDateStr) {
        return null; // Cannot validate without start date
      }
      
      const startDate = new Date(startDateStr);
      startDate.setHours(0, 0, 0, 0);
      
      // Check if end date is before or equal to start date
      if (endDate <= startDate) {
        return { 'endDateBeforeStart': true };
      }
      
      // Calculate total days between start and end date
      const diffTime = Math.abs(endDate.getTime() - startDate.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1; // +1 because start date counts as day 1
      
      // Check if the total days exceed the maximum
      if (diffDays > 3650) {
        return { 'maxDuration': true };
      }
      
      return null;
    };
  }

  /**
   * Format a date for HTML date input (YYYY-MM-DD)
   */
  formatDate(date: Date): string {
    const d = new Date(date);
    const year = d.getFullYear();
    const month = ('0' + (d.getMonth() + 1)).slice(-2);
    const day = ('0' + d.getDate()).slice(-2);
    return `${year}-${month}-${day}`;
  }

  /**
   * Format a date for display (DD.MM.YYYY)
   */
  formatDisplayDate(date: Date | string): string {
    if (!date) return 'N/A';
    
    // Make sure we have a proper Date object
    let d: Date;
    
    if (typeof date === 'string') {
      // Handle ISO string format from API
      d = new Date(date);
    } else if (date instanceof Date) {
      d = date;
    } else {
      return 'Invalid date';
    }
    
    // Check if date is valid
    if (isNaN(d.getTime())) {
      return 'Invalid date';
    }
    
    const day = ('0' + d.getDate()).slice(-2);
    const month = ('0' + (d.getMonth() + 1)).slice(-2);
    const year = d.getFullYear();
    return `${day}.${month}.${year}`;
  }
  
  /**
   * Calculate end date based on start date and duration
   */
  calculateEndDate(startDate: Date | string | undefined, timeWindowDays: number | undefined): Date {
    if (!startDate) {
      startDate = this.currentGoal.startDate;
    }
    
    if (!timeWindowDays) {
      timeWindowDays = this.currentGoal.timeWindowDays;
    }
    
    // Make sure we have a proper Date object
    let startDateObj: Date;
    if (typeof startDate === 'string') {
      startDateObj = new Date(startDate);
    } else if (startDate instanceof Date) {
      startDateObj = new Date(startDate.getTime()); // Clone to avoid mutations
    } else {
      return new Date(); // Fallback to today
    }
    
    // Check if date is valid
    if (isNaN(startDateObj.getTime())) {
      return new Date(); // Fallback to today
    }
    
    // Create a new date object to avoid mutating the original
    const endDate = new Date(startDateObj);
    // Add the time window days, but subtract 1 because the start date counts as day 1
    endDate.setDate(startDateObj.getDate() + (timeWindowDays - 1));
    
    return endDate;
  }

  /**
   * Calculate the daily target calories
   * Returns a formatted number for display
   */
  calculateDailyTarget(): string {
    if (!this.currentGoal || this.currentGoal.timeWindowDays === 0) {
      return '0';
    }
    
    // Calculate daily target - using Math.round to ensure integer result
    const dailyTarget = Math.round(Math.abs(this.currentGoal.totalCalorieGoal) / this.currentGoal.timeWindowDays);
    
    // Return the calculated value as string
    return dailyTarget.toString();
  }
}
