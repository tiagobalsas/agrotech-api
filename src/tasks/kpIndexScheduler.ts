import { schedule } from 'node-cron';
import { fetchKpIndex } from '../services/noaa.service'; // Importa a função nomeada
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const startKpIndexScheduler = () => {
  schedule('*/15 * * * *', async () => {
    console.log('Executando tarefa agendada: buscando dados do Índice Kp...');
    try {
      await fetchKpIndex(prisma);
      console.log('Dados do Índice Kp buscados e salvos com sucesso.');
    } catch (error) {
      console.error('Erro ao buscar dados do Índice Kp na tarefa agendada:', error);
    }
  });
};
