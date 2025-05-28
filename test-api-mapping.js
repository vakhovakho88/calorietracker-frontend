// Test script to verify API data mapping
const fetch = require('node-fetch');

async function testApiMapping() {
    try {
        console.log('Testing API mapping...');
        
        // Test the backend API directly
        const response = await fetch('http://localhost:5052/api/v1/goals/active');
        const backendData = await response.json();
        
        console.log('Backend API response:');
        console.log(JSON.stringify(backendData, null, 2));
        
        // Simulate the frontend mapping
        const frontendMappedData = {
            goalId: backendData.goalId,
            totalCalorieGoal: backendData.targetKcals,
            timeWindowDays: backendData.timeWindowDays,
            startDate: new Date(backendData.startDate)
        };
        
        console.log('\nFrontend mapped data:');
        console.log({
            goalId: frontendMappedData.goalId,
            totalCalorieGoal: frontendMappedData.totalCalorieGoal,
            timeWindowDays: frontendMappedData.timeWindowDays,
            startDate: frontendMappedData.startDate.toISOString()
        });
        
        console.log('\n✅ API mapping test completed successfully!');
        
    } catch (error) {
        console.error('❌ API mapping test failed:', error.message);
    }
}

testApiMapping();
