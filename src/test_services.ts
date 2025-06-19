import { PrismaClient } from '@prisma/client';
import noaaService from './services/noaa.service';
import droneAlertService from './services/drone-alert.service';

async function testServices() {
  const prisma = new PrismaClient();

  try {
    console.log('Fetching Kp Index...');
    const kpData = await noaaService.fetchKpIndex(prisma);
    console.log('Kp Index Data:', kpData);

    console.log('Checking Drone Alerts...');
    const alertData = await droneAlertService.checkAlerts(prisma);
    console.log('Drone Alert Data:', alertData);
  } catch (error) {
    console.error('Error during service test:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testServices();

