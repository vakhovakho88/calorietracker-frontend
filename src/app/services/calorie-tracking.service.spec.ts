import { TestBed } from '@angular/core/testing';

import { CalorieTrackingService } from './calorie-tracking.service';

describe('CalorieTrackingService', () => {
  let service: CalorieTrackingService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(CalorieTrackingService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
