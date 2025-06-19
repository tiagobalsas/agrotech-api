
import { PrismaClient } from '@prisma/client';

const ALERT_THRESHOLD = 5; // Kp >= 5: tempestade geomagnética

export default {
  async checkAlerts(prisma: PrismaClient) {
    const latestKp = await prisma.kpIndex.findFirst({
      orderBy: { timestamp: 'desc' },
    });

    if (!latestKp) return { alert: false, message: "Nenhum dado de Kp disponível." };

    const alert = latestKp.value >= ALERT_THRESHOLD;
    const message = alert
      ? "ALERTA: Tempestade geomagnética ativa! Evite voos de drone."
      : "Condições normais para voo.";

    return {
      timestamp: latestKp.timestamp,
      kpValue: latestKp.value,
      alert,
      message,
    };
  },
};


