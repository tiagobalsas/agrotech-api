import { PrismaClient } from '@prisma/client';
import axios from 'axios';

let wsNotifier: ((data: any) => void) | null = null;

export const setWebSocketNotifier = (notifier: (data: any) => void) => {
  wsNotifier = notifier;
};

export const fetchKpIndex = async (prisma: PrismaClient) => {
  const url = "https://services.swpc.noaa.gov/products/noaa-planetary-k-index.json";
  const { data } = await axios.get(url );
  const latestKp = data[data.length - 1]; // Pega o registro mais recente
  const [timestamp, kpValue] = latestKp;

  const newKpEntry = await prisma.kpIndex.create({
    data: {
      timestamp: new Date(timestamp),
      value: parseFloat(kpValue),
      source: "NOAA",
      type: "Kp"
    },
  });

  // Notifica os clientes WebSocket sobre o novo dado Kp
  if (wsNotifier) {
    wsNotifier(newKpEntry);
  }

  return { timestamp, kpValue };
};

export const getLatestKpData = async (prisma: PrismaClient) => {
  const latestEntry = await prisma.kpIndex.findFirst({
    orderBy: {
      timestamp: 'desc',
    },
  });
  return latestEntry;
};
