import { PrismaClient } from '@prisma/client';
import axios from 'axios';

let wsNotifier: ((data: any) => void) | null = null;

export const setWebSocketNotifier = (notifier: (data: any) => void) => {
  wsNotifier = notifier;
};

export const fetchKpIndex = async (prisma: PrismaClient) => {
  const url = "https://services.swpc.noaa.gov/products/noaa-planetary-k-index.json";
  const { data } = await axios.get(url);
  
  // O frontend espera um array de objetos com 'time' e 'kp'
  const formattedData = data.map((entry: any) => ({
    time: new Date(entry[0]),
    kp: parseFloat(entry[1])
  }));

  const latestKp = formattedData[formattedData.length - 1]; // Pega o registro mais recente já formatado

  if (!latestKp) {
    console.warn("No latest Kp data found after formatting.");
    return []; // Retorna um array vazio ou lida com o erro de forma apropriada
  }

  // Verifica se já existe um registro para o mesmo timestamp e tipo
  const existingKpEntry = await prisma.kpIndex.findUnique({
    where: {
      timestamp_type: { // Assuming you have a unique constraint on timestamp and type in your schema.prisma
        timestamp: latestKp.time,
        type: "Kp"
      }
    }
  });

  let newOrExistingKpEntry;
  if (!existingKpEntry) {
    newOrExistingKpEntry = await prisma.kpIndex.create({
      data: {
        timestamp: latestKp.time,
        value: latestKp.kp,
        source: "NOAA",
        type: "Kp"
      },
    });
  } else {
    newOrExistingKpEntry = existingKpEntry;
  }

  // Notifica os clientes WebSocket sobre o novo dado Kp
  if (wsNotifier) {
    wsNotifier(newOrExistingKpEntry);
  }

  return formattedData; // Retorna o array formatado
};

export const getLatestKpData = async (prisma: PrismaClient) => {
  const latestEntry = await prisma.kpIndex.findFirst({
    orderBy: {
      timestamp: 'desc',
    },
  });
  return latestEntry;
};
