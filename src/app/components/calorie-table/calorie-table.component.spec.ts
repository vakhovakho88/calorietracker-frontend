import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CalorieTableComponent } from './calorie-table.component';

describe('CalorieTableComponent', () => {
  let component: CalorieTableComponent;
  let fixture: ComponentFixture<CalorieTableComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CalorieTableComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(CalorieTableComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
