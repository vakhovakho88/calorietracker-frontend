import { ComponentFixture, TestBed } from '@angular/core/testing';

import { GoalSettingsComponent } from './goal-settings.component';

describe('GoalSettingsComponent', () => {
  let component: GoalSettingsComponent;
  let fixture: ComponentFixture<GoalSettingsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [GoalSettingsComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(GoalSettingsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
