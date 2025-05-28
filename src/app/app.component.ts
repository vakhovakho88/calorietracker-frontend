import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { GoalSettingsComponent } from './components/goal-settings/goal-settings.component';
import { DailyLogComponent } from './components/daily-log/daily-log.component';
import { CalorieTableComponent } from './components/calorie-table/calorie-table.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, GoalSettingsComponent, DailyLogComponent, CalorieTableComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss'
})
export class AppComponent {
  title = 'Calorie Tracker';
}
